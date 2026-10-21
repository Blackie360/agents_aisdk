import { test, expect, type Page } from "@playwright/test";
import { examples } from "../../lib/importers/catalog";
import { showcase } from "../../lib/importers/showcase";

const source = (page: Page) =>
  page.getByLabel("Schema source", { exact: true });
const nodes = (page: Page) => page.locator(".react-flow__node");
const alert = (page: Page) => page.locator(".source-panel [role=alert]");

test("Open file: a JPEG is 'not a schema file' and the last diagram stays (QA B, G)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  const jpeg = Buffer.alloc(165_000, 7);
  jpeg.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
  await page.getByLabel("Upload schema file").setInputFiles({
    name: "photo.jpg",
    mimeType: "image/jpeg",
    buffer: jpeg,
  });
  await expect(alert(page)).toHaveText(/^This isn't a schema file\./);
  await expect(alert(page)).not.toContainText("150 entity");
  // The failed import keeps the last good result and the editor content.
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  await expect(source(page)).toHaveValue(showcase.source);
  // A renamed binary is caught by content, not only by type.
  await page.getByLabel("Upload schema file").setInputFiles({
    name: "schema.sql",
    mimeType: "application/sql",
    buffer: jpeg,
  });
  await expect(alert(page)).toHaveText(/^This isn't a schema file\./);
});

test("Open file: over-limit schemas name the actual limit, same as paste (QA B)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  const upload = page.getByLabel("Upload schema file");
  await upload.setInputFiles({
    name: "huge.sql",
    mimeType: "application/sql",
    buffer: Buffer.from("-- padding\n".repeat(20_000)),
  });
  await expect(alert(page)).toHaveText(
    "Schema exceeds the 200 KB import limit.",
  );
  await upload.setInputFiles({
    name: "many.sql",
    mimeType: "application/sql",
    buffer: Buffer.from(
      Array.from(
        { length: 151 },
        (_, i) => `CREATE TABLE t${i} (id INT);`,
      ).join("\n"),
    ),
  });
  await expect(alert(page)).toHaveText(/^Limit: 150 entities per import\./);
  await expect(nodes(page)).toHaveCount(showcase.models.length);
});

test("a rejected paste does not leave 'Draft saved' beside 'not saved' (QA F)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  await source(page).fill("CREATE TABLE kept (id INT PRIMARY KEY);");
  await expect(
    page.getByText("Draft saved in this browser.", { exact: true }),
  ).toBeVisible();
  const oversized = Array.from(
    { length: 151 },
    (_, i) => `CREATE TABLE t${i} (id INT);`,
  ).join("\n");
  await source(page).focus();
  await page.evaluate((text) => {
    const area = document.querySelector("textarea")!;
    const data = new DataTransfer();
    data.setData("text", text);
    area.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  }, oversized);
  await expect(alert(page)).toContainText("this input was not saved");
  await expect(
    page.getByText("Draft saved in this browser.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Previous draft kept in this browser.", { exact: true }),
  ).toBeVisible();
  await expect(source(page)).toHaveValue(
    "CREATE TABLE kept (id INT PRIMARY KEY);",
  );
});

test("Prisma syntax errors are plain with line and column in the UI (QA C)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  await source(page).fill("model User { id Int @id\nposts Post[] }");
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(alert(page)).toHaveText(
    /^Invalid Prisma syntax at line 1, column 14: expected a new line before "id"/,
  );
  await expect(alert(page)).not.toContainText("-->");
});

test("an unresolved TypeORM target is a Schema review warning (QA E)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  await source(page).fill(
    examples.typeorm.replace('"target": "Team"', '"target": "Nope"'),
  );
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  const review = page.getByLabel("Schema review");
  await expect(review).toContainText("Unresolved reference");
  await expect(review).toContainText('"Nope" is not in this import');
});

test("an invalid personal key reads 'Invalid API key', not a model error (QA A)", async ({
  page,
}) => {
  // The route's provider mapping is unit-tested with mocked provider replies;
  // this checks the UI shows the route's message as-is.
  await page.route("**/api/schema-explanation", (route) =>
    route.fulfill({
      status: 401,
      json: {
        code: "AI_INVALID_KEY",
        message:
          "Invalid API key for xAI. Check that it is an xAI key (not another provider's), copied in full and still active.",
      },
    }),
  );
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  await page.getByPlaceholder("API key").fill("sk-fake123");
  await page.getByRole("button", { name: "Explain with Grok" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Invalid API key for xAI.",
  );
  await expect(page.getByRole("status")).not.toContainText("model");
});

test("Mermaid ERD says why it is disabled for document schemas (QA #9)", async ({
  page,
}) => {
  await page.goto("/");
  await source(page).fill(examples["json-schema"]);
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  const mermaid = page.getByRole("button", { name: "Mermaid ERD" });
  await expect(mermaid).toBeDisabled();
  await expect(mermaid).toHaveAttribute("title", /relational tables/);
  await expect(
    page.getByText("Mermaid ERD is for relational tables.", { exact: false }),
  ).toBeVisible();
});

test("Visualize keeps the editor usable and says edits cancel the run (QA #7)", async ({
  page,
}) => {
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  await source(page).fill(
    "CREATE TABLE one (id INT PRIMARY KEY, email TEXT NOT NULL);",
  );
  await page.getByLabel("Input format").selectOption("postgresql");
  const started = Date.now();
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(source(page)).toBeEditable();
  await expect(nodes(page)).toHaveCount(1);
  // Generous bound for CI; measured warm runs are ~100ms.
  expect(Date.now() - started).toBeLessThan(3000);
  await expect(page.getByText(/keep editing while the diagram/)).toHaveCount(0);
});

test("a restored draft that no longer parses shows a quiet hint (QA retest)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "schemamind.draft.v1",
      JSON.stringify({
        version: 1,
        input: "CREATE TABLE broken (id INT,,);",
        format: "postgresql",
      }),
    );
  });
  await page.goto("/");
  await expect(source(page)).toHaveValue("CREATE TABLE broken (id INT,,);");
  const canvas = page.locator(".canvas-panel");
  await expect(canvas).toContainText(
    "Your saved draft couldn't be drawn. Edit it or select Visualize.",
  );
  // Quiet: no error alert, and no diagram.
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
  await expect(nodes(page)).toHaveCount(0);
  // Editing removes the hint.
  await source(page).fill("CREATE TABLE fixed (id INT PRIMARY KEY);");
  await expect(canvas).toContainText("Add a schema, then select Visualize.");
});

test("at 375px the example chip row shows there is more to scroll (QA retest)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  const row = page.locator(".example-chips");
  const state = () =>
    row.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const last = [...el.querySelectorAll("button")]
        .at(-1)!
        .getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        overflows: el.scrollWidth > el.clientWidth,
        mask: style.maskImage || (style as any).webkitMaskImage,
        lastRight: last.right,
        fadeStart: box.right - 44,
        viewport: innerWidth,
      };
    });
  const before = await state();
  expect(before.overflows).toBe(true);
  // The right edge fades out, so the cut-off chip reads as "more this way".
  expect(before.mask).toContain("linear-gradient");
  expect(before.lastRight).toBeGreaterThan(before.viewport);
  // Scrolled to the end, "Document" sits fully on screen, clear of the fade.
  await row.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  const after = await state();
  expect(after.lastRight).toBeLessThanOrEqual(after.fadeStart);
  await expect(page.getByRole("button", { name: "Document" })).toBeInViewport({
    ratio: 1,
  });
  // Desktop shows every chip without a fade.
  await page.setViewportSize({ width: 1280, height: 800 });
  expect((await state()).mask).not.toContain("linear-gradient");
});
