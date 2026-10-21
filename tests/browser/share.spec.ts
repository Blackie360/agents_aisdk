import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { examples } from "../../lib/importers/catalog";
import { showcase } from "../../lib/importers/showcase";
import { INVALID_SHARE_LINK, TOO_LARGE_TO_SHARE } from "../../lib/share/link";

const source = (page: Page) =>
  page.getByLabel("Schema source", { exact: true });
const nodes = (page: Page) => page.locator(".react-flow__node");
const copyButton = (page: Page) =>
  page.getByRole("button", { name: "Copy link" });
const DRAFT = "schemamind.draft.v1";

async function allowClipboard(context: BrowserContext) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:3100",
  });
}
/** Model names and edge count currently drawn. */
const drawn = async (page: Page) => ({
  models: (
    await page.locator(".react-flow__node strong").allTextContents()
  ).sort(),
  edges: await page.locator(".react-flow__edge").count(),
});
async function visualize(page: Page, text: string, format: string) {
  await source(page).fill(text);
  await page.getByLabel("Input format").selectOption(format);
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
}
async function copyLink(page: Page) {
  await copyButton(page).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Link copied" }),
  ).toBeVisible();
  return page.evaluate(() => navigator.clipboard.readText());
}

test("copy a link, open it in a fresh browser: same diagram, no clicks, no server calls", async ({
  page,
  browser,
  context,
}) => {
  await allowClipboard(context);
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  await visualize(page, examples.postgresql, "postgresql");
  await expect(nodes(page)).toHaveCount(2);
  const original = await drawn(page);
  expect(original.models).toHaveLength(2);
  expect(original.edges).toBeGreaterThan(0);
  const link = await copyLink(page);
  expect(link).toMatch(/^http:\/\/127\.0\.0\.1:3100\/#s=v1\.[A-Za-z0-9_-]+$/);

  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  const requests: string[] = [];
  other.on("request", (r) => {
    if (r.url().includes("/api/")) requests.push(r.url());
  });
  await other.goto(link);
  await expect(nodes(other)).toHaveCount(2);
  expect(await drawn(other)).toEqual(original);
  await expect(source(other)).toHaveValue(examples.postgresql);
  await expect(other.getByLabel("Input format")).toHaveValue("postgresql");
  // The schema stays in the fragment: no API call carries it anywhere.
  expect(requests.filter((u) => /schema-|usage/.test(u))).toEqual([]);
  // Viewing a link does not create a draft in the recipient's browser.
  await other.waitForTimeout(700);
  expect(
    await other.evaluate((k) => localStorage.getItem(k), DRAFT),
  ).toBeNull();
  await fresh.close();
});

test("the showcase example shares and reopens with all its models and edges", async ({
  page,
  browser,
  context,
}) => {
  await allowClipboard(context);
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  const original = await drawn(page);
  const link = await copyLink(page);
  const fresh = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const other = await fresh.newPage();
  await other.goto(link);
  await expect(nodes(other)).toHaveCount(showcase.models.length);
  expect(await drawn(other)).toEqual(original);
  await fresh.close();
});

test("a corrupt link shows a clear error and falls back to the example", async ({
  page,
}) => {
  await page.goto("/#s=v1.AAAAtampered");
  await expect(page.locator(".canvas-panel [role=alert]")).toHaveText(
    INVALID_SHARE_LINK,
  );
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  await expect(source(page)).toHaveValue(showcase.source);
  // The broken fragment is removed so a reload does not repeat the error.
  expect(await page.evaluate(() => location.hash)).toBe("");
});

test("a corrupt link falls back to the saved draft, untouched", async ({
  page,
}) => {
  const draft = JSON.stringify({
    version: 1,
    input: "CREATE TABLE mine (id INT PRIMARY KEY);",
    format: "postgresql",
  });
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem(key, value);
      }
    },
    [DRAFT, draft],
  );
  await page.goto("/#s=v2.whatever");
  await expect(page.locator(".canvas-panel [role=alert]")).toContainText(
    "newer version",
  );
  await expect(nodes(page)).toHaveCount(1);
  await expect(source(page)).toHaveValue(
    "CREATE TABLE mine (id INT PRIMARY KEY);",
  );
  expect(await page.evaluate((k) => localStorage.getItem(k), DRAFT)).toBe(
    draft,
  );
});

test("an oversized schema says it is too large to share instead of making a broken link", async ({
  page,
  context,
}) => {
  await allowClipboard(context);
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  // Barely compressible names: within the 200 KB / 150 entity / 3000 field
  // limits, but the link would pass the length cap.
  let seed = 1;
  const word = () => {
    let w = "c";
    for (let i = 0; i < 20; i++)
      w += "abcdefghijklmnopqrstuvwxyz"[
        (seed = (seed * 48271) % 2147483647) % 26
      ];
    return w;
  };
  const big = Array.from(
    { length: 95 },
    (_, i) =>
      `CREATE TABLE t${i}_${word()} (id INT PRIMARY KEY, ${Array.from({ length: 30 }, () => `${word()} TEXT`).join(", ")});`,
  ).join("\n");
  await visualize(page, big, "postgresql");
  await expect(nodes(page)).toHaveCount(95, { timeout: 20_000 });
  await page.evaluate(() => navigator.clipboard.writeText("untouched"));
  await copyButton(page).click();
  await expect(page.locator(".canvas-panel [role=alert]")).toHaveText(
    TOO_LARGE_TO_SHARE,
  );
  await expect(page.getByText("Link copied")).toHaveCount(0);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "untouched",
  );
});

test("opening a link keeps the saved draft until the user edits, then clears the fragment", async ({
  page,
  browser,
  context,
}) => {
  await allowClipboard(context);
  await page.goto("/");
  await visualize(page, examples.mysql, "mysql");
  await expect(nodes(page)).not.toHaveCount(0);
  const link = await copyLink(page);

  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  const draft = JSON.stringify({
    version: 1,
    input: "CREATE TABLE my_own (id INT PRIMARY KEY);",
    format: "postgresql",
  });
  await other.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem(key, value);
      }
    },
    [DRAFT, draft],
  );
  await other.goto(link);
  // The link wins over the draft…
  await expect(source(other)).toHaveValue(examples.mysql);
  await expect(other.getByLabel("Input format")).toHaveValue("mysql");
  await expect(nodes(other)).not.toHaveCount(0);
  await other.waitForTimeout(700);
  // …but does not overwrite it, and a reload still opens the link.
  expect(await other.evaluate((k) => localStorage.getItem(k), DRAFT)).toBe(
    draft,
  );
  await expect(other.getByText(/Draft saved/)).toHaveCount(0);
  expect(await other.evaluate(() => location.hash)).toMatch(/^#s=v1\./);
  await other.reload();
  await expect(source(other)).toHaveValue(examples.mysql);
  // The first edit makes it the user's own: saved as their draft, fragment gone.
  await source(other).fill(examples.mysql + "\n-- edited");
  await expect(
    other.getByText("Draft saved in this browser.", { exact: true }),
  ).toBeVisible();
  expect(
    JSON.parse((await other.evaluate((k) => localStorage.getItem(k), DRAFT))!)
      .input,
  ).toContain("-- edited");
  expect(await other.evaluate(() => location.hash)).toBe("");
  await fresh.close();
});

test("without clipboard access the link is shown selected in a read-only field", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
  });
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  await copyButton(page).click();
  const field = page.getByLabel("Share link");
  await expect(field).toHaveAttribute("readonly", "");
  await expect(field).toHaveValue(/#s=v1\./);
  expect(
    await field.evaluate(
      (el: HTMLInputElement) =>
        el.selectionStart === 0 && el.selectionEnd === el.value.length,
    ),
  ).toBe(true);
});

test("375x667: share works and the layout holds", async ({
  page,
  browser,
  context,
}) => {
  await allowClipboard(context);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await expect(nodes(page)).toHaveCount(showcase.models.length);
  await expect(copyButton(page)).toBeInViewport();
  const layout = () =>
    page.evaluate(() => ({
      canvasTop: document.querySelector(".react-flow")!.getBoundingClientRect()
        .top,
      overflow: document.documentElement.scrollWidth - innerWidth,
    }));
  expect((await layout()).canvasTop).toBeLessThanOrEqual(270);
  expect((await layout()).overflow).toBeLessThanOrEqual(0);
  const link = await copyLink(page);
  // The "Link copied" notice floats over the canvas; it does not push it down.
  expect((await layout()).canvasTop).toBeLessThanOrEqual(270);
  const fresh = await browser.newContext({
    viewport: { width: 375, height: 667 },
  });
  const other = await fresh.newPage();
  await other.goto(link);
  await expect(nodes(other)).toHaveCount(showcase.models.length);
  const opened = await other.evaluate(() => ({
    canvasTop: document.querySelector(".react-flow")!.getBoundingClientRect()
      .top,
    overflow: document.documentElement.scrollWidth - innerWidth,
  }));
  expect(opened.canvasTop).toBeLessThanOrEqual(270);
  expect(opened.overflow).toBeLessThanOrEqual(0);
  await fresh.close();
});
