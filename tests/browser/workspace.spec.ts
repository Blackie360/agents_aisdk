import { test, expect, type Page } from "@playwright/test";
import { examples } from "../../lib/importers/catalog";
// The app opens on the Prisma showcase; these flows exercise the small SQL example.
const useSqlExample = (page: Page) =>
  page.getByLabel("Schema source", { exact: true }).fill(examples.postgresql);
test("imports stay local when the hosted parsing API is broken; AI failure preserves the diagram", async ({
  page,
}) => {
  await page.goto("/");
  await useSqlExample(page);
  let requests = 0;
  await page.route("**/api/schema-visualizer", (route) => {
    requests++;
    return route.fulfill({ status: 500 });
  });
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  expect(requests).toBe(0);
  await page.route("**/api/schema-explanation", (route) =>
    route.fulfill({ status: 502, body: "<html>private proxy details</html>" }),
  );
  await page.getByRole("button", { name: "Explain with Grok" }).click();
  await expect(page.getByRole("status")).toContainText(
    "non-JSON response (HTTP 502)",
  );
  await expect(page.getByRole("status")).not.toContainText(
    "private proxy details",
  );
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});
test("auto import, interactive diagram, details, exports and optional AI failure", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await useSqlExample(page);
  await expect(page.getByLabel("Input format")).toHaveValue("auto");
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  const node = page.locator(".react-flow__node").first();
  const box = await node.boundingBox();
  await page.mouse.move(box!.x + 70, box!.y + 35);
  await page.mouse.down();
  await page.mouse.move(box!.x + 120, box!.y + 65, { steps: 5 });
  await page.mouse.up();
  await expect(node).not.toHaveCSS("transform", "none");
  await page.getByRole("button", { name: /members 4 fields/ }).click();
  await expect(page.getByRole("dialog")).toContainText("References teams.id");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("schemamind.json");
  const mermaid = page.waitForEvent("download");
  await page.getByRole("button", { name: "Mermaid ERD" }).click();
  expect((await mermaid).suggestedFilename()).toBe("schemamind.mmd");
  await page.getByRole("button", { name: "Explain with Grok" }).click();
  await expect(page.getByRole("status")).toContainText("not configured");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("all importers render through the browser worker", async ({ page }) => {
  await page.goto("/");
  for (const [format, content] of Object.entries(examples)) {
    await page.getByLabel("Input format").selectOption(format);
    await page.getByLabel("Schema source", { exact: true }).fill(content);
    await page
      .getByRole("button", { name: "Visualize schema", exact: true })
      .click();
    await expect(page.locator(".react-flow__node")).toHaveCount(
      format === "json-schema" ? 1 : 2,
    );
    await expect(
      page.getByRole("region", { name: "Schema input" }).getByRole("alert"),
    ).toHaveCount(0);
  }
  await expect(
    page.getByRole("button", { name: "Mermaid ERD" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Customer 3 fields/ }).click();
  await expect(page.getByRole("dialog")).toContainText("city");
  await expect(page.getByRole("dialog")).toContainText("Optional property");
});
test("file auto-detection, ambiguous SQL and invalid replacement remove stale diagram", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Upload schema file").setInputFiles({
    name: "schema.ts",
    mimeType: "text/plain",
    buffer: Buffer.from(examples.drizzle),
  });
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page
    .getByLabel("Schema source", { exact: true })
    .fill("CREATE TABLE a(id INTEGER);");
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Schema input" }).getByRole("alert"),
  ).toContainText("ambiguous");
  await page.getByLabel("Input format").selectOption("sqlite");
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page.getByLabel("Schema source", { exact: true }).fill("broken");
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Schema input" }).getByRole("alert"),
  ).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});
test("mobile controls fit without horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await useSqlExample(page);
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/workspace-mobile.png",
    fullPage: true,
  });
});
test("API rejects malformed and oversized input", async ({ request }) => {
  expect(
    (await request.post("/api/schema-visualizer", { data: "bad" })).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/schema-visualizer", {
        data: { schema: "x".repeat(251000), format: "prisma" },
      })
    ).status(),
  ).toBe(413);
});

test("local project discovery lists candidates and imports only the selected file", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Find schema files in folder")
    .setInputFiles("tests/fixtures/project");
  await expect(
    page.getByRole("button", {
      name: "project/prisma/schema.prisma",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /notes.txt/ })).toHaveCount(0);
  await expect(
    page.getByLabel("Schema source", { exact: true }),
  ).not.toContainText("FolderExample");
  await page
    .getByRole("button", { name: "project/prisma/schema.prisma", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.locator(".react-flow__node")).toContainText(
    "FolderExample",
  );
});

test("personal xAI key is masked, opt-in, absent from storage and exports, and cleared on reload", async ({
  page,
}) => {
  await page.goto("/");
  await useSqlExample(page);
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  const key = page.getByLabel("Bring your own xAI API key (optional)");
  await expect(key).toHaveAttribute("type", "password");
  const dummy = "xai-test-browser-only";
  let calls = 0;
  await page.route("**/api/schema-explanation", async (route) => {
    calls++;
    expect(route.request().postDataJSON().apiKey).toBe(dummy);
    await route.fulfill({ json: { explanation: "Mock Grok explanation" } });
  });
  await key.fill(dummy);
  expect(calls).toBe(0);
  expect(
    await page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
      }),
    ),
  ).not.toContain(dummy);
  await page.getByRole("button", { name: "Explain with Grok" }).click();
  await expect(page.getByRole("status")).toContainText("Mock Grok explanation");
  expect(calls).toBe(1);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).not.toContain(dummy);
  await page.getByRole("button", { name: "Clear key" }).click();
  await expect(key).toHaveValue("");
  await key.fill(dummy);
  await page.reload();
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(key).toHaveValue("");
  await page.screenshot({ path: "test-results/xai-byok.png", fullPage: true });
});

test("a delayed earlier file cannot overwrite a newer selection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const read = File.prototype.text;
    File.prototype.text = async function () {
      const text = await read.call(this);
      if (this.name === "slow.sql")
        await new Promise((resolve) => setTimeout(resolve, 500));
      return text;
    };
  });
  await page.goto("/");
  const upload = page.getByLabel("Upload schema file");
  await upload.setInputFiles({
    name: "slow.sql",
    mimeType: "text/plain",
    buffer: Buffer.from("old selection"),
  });
  await upload.setInputFiles({
    name: "new.sql",
    mimeType: "text/plain",
    buffer: Buffer.from("new selection"),
  });
  await expect(page.getByLabel("Schema source", { exact: true })).toHaveValue(
    "new selection",
  );
  await page.waitForTimeout(700); // Exercise completion of the deliberately delayed older read.
  await expect(page.getByLabel("Schema source", { exact: true })).toHaveValue(
    "new selection",
  );
});

test("PostgreSQL trigger scripts import tables with visible omission notes", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Schema source", { exact: true })
    .fill(`CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE tickets (id bigint PRIMARY KEY, local_status text, embedding vector(1536));
CREATE TRIGGER ticket_evidence_gate BEFORE UPDATE OF local_status ON tickets FOR EACH ROW EXECUTE FUNCTION enforce_ticket_evidence();`);
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(page.locator(".react-flow__node")).toContainText("tickets");
  await page.getByText(/Import notes \(/).click();
  await expect(
    page.getByText(/Unsupported statement omitted: create trigger/),
  ).toBeVisible();
});

for (const size of [
  { width: 375, height: 812 },
  { width: 812, height: 375 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
])
  test(`large diagrams fit and expand at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.goto("/");
    await page.setViewportSize(size);
    const source = Array.from(
      { length: 24 },
      (_, i) =>
        `CREATE TABLE table_${i} (id SERIAL PRIMARY KEY, ${Array.from({ length: 12 }, (_, j) => `field_${j} TEXT`).join(",")});`,
    ).join("\n");
    await page.getByLabel("Schema source", { exact: true }).fill(source);
    await page
      .getByRole("button", { name: "Visualize schema", exact: true })
      .click();
    await expect(page.locator(".react-flow__node")).toHaveCount(24);
    const allFit = () =>
      page.evaluate(() => {
        const canvas = document
          .querySelector(".react-flow")!
          .getBoundingClientRect();
        return [...document.querySelectorAll(".react-flow__node")].every(
          (node) => {
            const rect = node.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.left >= canvas.left &&
              rect.right <= canvas.right &&
              rect.top >= canvas.top &&
              rect.bottom <= canvas.bottom
            );
          },
        );
      });
    await expect.poll(allFit).toBe(true);
    const viewport = page.locator(".react-flow__viewport");
    const before = await viewport.getAttribute("style");
    await page.getByRole("button", { name: "Zoom In", exact: true }).click();
    await expect(viewport).not.toHaveAttribute("style", before!);
    const after = await viewport.getAttribute("style");
    await page.getByRole("button", { name: "Zoom Out", exact: true }).click();
    await expect(viewport).not.toHaveAttribute("style", after!);
    await page
      .getByLabel("Find table in diagram")
      .selectOption({ label: "table_23" });
    await expect
      .poll(async () => {
        const node = await page
          .locator(".react-flow__node")
          .filter({ hasText: "table_23" })
          .boundingBox();
        const canvas = await page.locator(".react-flow").boundingBox();
        return (
          !!node &&
          !!canvas &&
          node.x >= canvas.x &&
          node.x + node.width <= canvas.x + canvas.width
        );
      })
      .toBe(true);
    await page
      .getByRole("button", { name: "Fit to screen", exact: true })
      .click();
    await expect
      .poll(async () => {
        const box = await page.locator(".react-flow").boundingBox();
        const viewport = page.viewportSize()!;
        return (
          !!box &&
          box.width >= viewport.width - 4 &&
          box.height >= viewport.height - 4
        );
      })
      .toBe(true);
    await expect.poll(allFit).toBe(true);
    const close = page.getByRole("button", {
      name: "Close expanded view",
      exact: true,
    });
    await expect(close).toBeInViewport();
    await close.click();
    await expect(
      page.getByRole("button", { name: "Fit to screen", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Fit all", exact: true }).click();
    await expect.poll(allFit).toBe(true);
  });

test("provider changes clear credentials and selected providers reach the explanation request", async ({
  page,
}) => {
  await page.goto("/");
  await useSqlExample(page);
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  const requests: any[] = [];
  await page.route("**/api/schema-explanation", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        code: "AI_ACCESS_DENIED",
        message: "Provider rejected the API key or model access.",
      }),
    });
  });
  for (const provider of ["xai", "gemini", "openai", "kimi", "claude"]) {
    await page
      .getByRole("button", {
        name: `Use ${({ xai: "xAI", gemini: "Gemini", openai: "OpenAI", kimi: "Kimi", claude: "Claude" } as Record<string, string>)[provider]}`,
        exact: true,
      })
      .click();
    const key = page.getByLabel(/Bring your own .* API key/);
    await expect(key).toHaveValue("");
    await key.fill("synthetic-personal-key");
    await page.getByRole("button", { name: /Explain with/ }).click();
    await expect(page.getByRole("status")).toContainText("Provider rejected");
    expect(requests.at(-1).provider).toBe(provider);
    expect(requests.at(-1).apiKey).toBe("synthetic-personal-key");
  }
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});

test("schema drafts survive refresh, exclude keys, and can be cleared", async ({
  page,
}) => {
  await page.goto("/");
  const source = "CREATE TABLE saved_draft (id INTEGER PRIMARY KEY);";
  await page.getByLabel("Schema source", { exact: true }).fill(source);
  await page.getByLabel("Input format", { exact: true }).selectOption("sqlite");
  await expect(
    page.getByText("Draft saved in this browser.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Schema source", { exact: true })).toHaveValue(
    source,
  );
  await expect(page.getByLabel("Input format", { exact: true })).toHaveValue(
    "sqlite",
  );
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await page
    .getByLabel(/Bring your own .* API key/)
    .fill("never-save-this-key");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "never-save-this-key",
  );
  await page.getByRole("button", { name: "Clear draft", exact: true }).click();
  await expect(page.getByLabel("Schema source", { exact: true })).toHaveValue(
    "",
  );
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("schemamind.draft.v1")),
    )
    .toBeNull();
  await page.reload();
  await expect(
    page.getByLabel("Schema source", { exact: true }),
  ).not.toHaveValue(source);
});

test("unavailable browser storage does not prevent importing", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("unavailable");
    };
  });
  await page.goto("/");
  await useSqlExample(page);
  await expect(
    page.getByText("Draft could not be saved. Keep a copy before refreshing."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});

test("automatic local review links findings to table details", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Input format").selectOption("postgresql");
  await page
    .locator("textarea")
    .first()
    .fill(
      "CREATE TABLE parent (id int); CREATE TABLE child (id int PRIMARY KEY, parent_id int REFERENCES parent(id));",
    );
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  const review = page.getByRole("region", {
    name: "Schema review",
    exact: true,
  });
  await expect(review).toContainText("No primary key declared");
  await expect(review).toContainText("Reference has no declared unique target");
  await expect(review).toContainText("Check the foreign-key index");
  await review.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/schema-review-panel.png" });
  await review
    .getByRole("button", {
      name: "Inspect parent: No primary key declared",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("parent");
  await page.screenshot({
    path: "test-results/schema-review.png",
    fullPage: true,
  });
});

test("PostgreSQL rule details display checks, indexes and delete/update actions", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Input format").selectOption("postgresql");
  await page
    .getByLabel("Schema source", { exact: true })
    .fill(
      "CREATE TABLE p(id int PRIMARY KEY); CREATE TABLE c(id int PRIMARY KEY, pid int REFERENCES p(id) ON DELETE CASCADE ON UPDATE RESTRICT, amount int CHECK(amount > 0)); CREATE INDEX c_pid ON c(pid);",
    );
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await page.locator(".react-flow__node").filter({ hasText: "amount" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("ON DELETE CASCADE");
  await expect(dialog).toContainText("ON UPDATE RESTRICT");
  await expect(dialog).toContainText("CHECK constraints");
  await expect(dialog).toContainText("c_pid");
  await dialog.getByText("c_pid · btree", { exact: true }).click();
  await expect(dialog).toContainText("CREATE INDEX c_pid");
  await page.screenshot({ path: "test-results/postgres-rules.png" });
});

test("large pasted SQL and restored drafts cannot trap the editor", async ({
  page,
}) => {
  const source = Array.from(
    { length: 3000 },
    (_, i) => `CREATE TABLE table_${i} (id INT PRIMARY KEY);`,
  ).join("\n");
  await page.goto("/");
  const input = page.getByLabel("Schema source", { exact: true });
  const before = await input.inputValue();
  await input.fill(source, { timeout: 3000 });
  await expect(page.locator("p[role=alert]")).toContainText("150 entities");
  await expect(input).toHaveValue(before);
  await page.evaluate(
    (input) =>
      localStorage.setItem(
        "schemamind.draft.v1",
        JSON.stringify({ version: 1, input, format: "postgresql" }),
      ),
    source,
  );
  await page.reload();
  await expect(input).not.toHaveValue(source);
  await input.fill("CREATE TABLE small (id SERIAL PRIMARY KEY);");
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(input).toBeEnabled();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
});
test("missing references, garbage, support disclosure and safe Markdown are understandable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Supported formats" }).click();
  await expect(page.locator("#support details")).toHaveAttribute("open", "");
  await page.getByLabel("Input format").selectOption("postgresql");
  await page
    .getByLabel("Schema source", { exact: true })
    .fill("CREATE TABLE a (id INT, b_id INT REFERENCES nope(id));");
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.getByText(/Unresolved reference a → nope/)).toBeVisible();
  await page.route("**/api/schema-explanation", (route) =>
    route.fulfill({
      json: {
        explanation: "**Customer** uses `id`.\n<img src=x onerror=alert(1)>",
      },
    }),
  );
  await page.getByRole("button", { name: "Explain with Grok" }).click();
  await expect(page.getByRole("status").locator("strong")).toHaveText(
    "Customer",
  );
  await expect(page.getByRole("status").locator("code")).toHaveText("id");
  await expect(page.getByRole("status").locator("img")).toHaveCount(0);
  await page.getByLabel("Input format").selectOption("auto");
  await page
    .getByLabel("Schema source", { exact: true })
    .fill("hello world }{ ;;;");
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "Unrecognized schema",
  );
});

test("worker is reused, syntax errors are readable and document export has a reason", async ({
  page,
}) => {
  let workers = 0;
  page.on("worker", () => workers++);
  await page.goto("/");
  const input = page.getByLabel("Schema source", { exact: true });
  await page.getByLabel("Input format").selectOption("postgresql");
  const durations: number[] = [];
  for (let i = 0; i < 2; i++) {
    await input.fill(`CREATE TABLE t${i} (id INT PRIMARY KEY);`);
    const start = Date.now();
    await page
      .getByRole("button", { name: "Visualize schema", exact: true })
      .click();
    await expect(input).toBeEnabled();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    durations.push(Date.now() - start);
  }
  expect(workers).toBe(1);
  console.log("One-table visualize milliseconds:", durations);
  for (const format of ["postgresql", "mysql", "sqlite", "typeorm"]) {
    await page.getByLabel("Input format").selectOption(format);
    await input.fill(
      format === "typeorm"
        ? '{"name":'
        : "CREATE TABLE broken (id INT NOT NOT);",
    );
    await page
      .getByRole("button", { name: "Visualize schema", exact: true })
      .click();
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page.locator("p[role=alert]")).not.toContainText("kw_");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  }
  await page.getByLabel("Input format").selectOption("json-schema");
  await input.fill(
    JSON.stringify({
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    }),
  );
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(
    page.getByText(
      "Mermaid ERD is for relational tables. Use JSON export for document structures.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Schema review", exact: true }),
  ).toContainText("Review complete");
  await page.screenshot({
    path: "test-results/feedback-fixes.png",
    fullPage: true,
  });
});

test("small schemas fit larger while remaining inside the expanded canvas", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByLabel("Input format").selectOption("postgresql");
  await page
    .getByLabel("Schema source", { exact: true })
    .fill("CREATE TABLE small(id int PRIMARY KEY);");
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Fit to screen", exact: true })
    .click();
  await expect
    .poll(async () =>
      parseInt(await page.getByLabel("Diagram zoom").innerText()),
    )
    .toBeGreaterThan(100);
  await expect
    .poll(async () => {
      const box = await page.locator(".react-flow__node").boundingBox();
      return Math.abs(box!.x + box!.width / 2 - 720);
    })
    .toBeLessThan(5);
  const node = await page.locator(".react-flow__node").boundingBox();
  expect(node!.x).toBeGreaterThanOrEqual(0);
  expect(node!.x + node!.width).toBeLessThanOrEqual(1440);
  await page.screenshot({ path: "test-results/small-schema-fit.png" });
});

test("recovery explanation persists until editing and pending drafts flush on reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByText("Draft saved in this browser.", { exact: true })
    .waitFor();
  const oversized = Array.from(
    { length: 151 },
    (_, i) => `CREATE TABLE t${i}(id INT);`,
  ).join("\n");
  await page.evaluate(
    (input) =>
      localStorage.setItem(
        "schemamind.draft.v1",
        JSON.stringify({ version: 1, input, format: "postgresql" }),
      ),
    oversized,
  );
  await page.reload();
  await expect(page.getByText(/Oversized draft removed/)).toBeVisible();
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(() => localStorage.getItem("schemamind.draft.v1")),
  ).toBeNull();
  await expect(page.getByText(/Oversized draft removed/)).toBeVisible();
  const input = page.getByLabel("Schema source", { exact: true });
  await input.fill("CREATE TABLE fresh(id SERIAL PRIMARY KEY);");
  await page.reload();
  await expect(input).toHaveValue("CREATE TABLE fresh(id SERIAL PRIMARY KEY);");
});

test("accepted near-limit input is validated once per edit and saves after typing settles", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByText("Draft saved in this browser.", { exact: true })
    .waitFor();
  const source = Array.from(
    { length: 100 },
    (_, i) =>
      `CREATE TABLE t${i} (${Array.from({ length: 24 }, (_, j) => `field_${j}_${"x".repeat(64)} TEXT`).join(",\n")});`,
  ).join("\n");
  await page.evaluate(() => {
    (window as any).fullEncodes = 0;
    (window as any).draftWrites = 0;
    const encode = TextEncoder.prototype.encode;
    TextEncoder.prototype.encode = function (value) {
      if (value && value.length > 180000) (window as any).fullEncodes++;
      return encode.call(this, value);
    };
    const save = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "schemamind.draft.v1") (window as any).draftWrites++;
      return save.call(this, key, value);
    };
  });
  const input = page.getByLabel("Schema source", { exact: true });
  await input.fill(source);
  await page.keyboard.insertText(" ");
  await page.keyboard.insertText(" ");
  expect(await page.evaluate(() => (window as any).fullEncodes)).toBe(3);
  expect(await page.evaluate(() => (window as any).draftWrites)).toBe(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).draftWrites))
    .toBe(1);
  await page.keyboard.insertText(" ");
  await page.evaluate(() =>
    window.dispatchEvent(new PageTransitionEvent("pagehide")),
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("schemamind.draft.v1")!).input,
    ),
  ).toBe(await input.inputValue());
});

test("changing format after recovery resumes persistence", async ({ page }) => {
  await page.goto("/");
  await page
    .getByText("Draft saved in this browser.", { exact: true })
    .waitFor();
  await page.evaluate(() =>
    localStorage.setItem(
      "schemamind.draft.v1",
      JSON.stringify({
        version: 1,
        input: "x".repeat(200001),
        format: "postgresql",
      }),
    ),
  );
  await page.reload();
  await expect(page.getByText(/Oversized draft removed/)).toBeVisible();
  await page.getByLabel("Input format").selectOption("postgresql");
  await page.reload();
  await expect(page.getByLabel("Input format")).toHaveValue("postgresql");
  await expect(page.getByText(/Oversized draft removed/)).toHaveCount(0);
});
