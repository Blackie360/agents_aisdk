import { test, expect, type Page } from "@playwright/test";
import { showcase } from "../../lib/importers/showcase";

for (const size of [
  { width: 375, height: 812 },
  { width: 1280, height: 800 },
]) {
  test(`first visit draws the Prisma example with no clicks or server calls at ${size.width}px`, async ({
    page,
  }) => {
    const serverCalls: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/schema-(explanation|visualizer)/.test(r.url()))
        serverCalls.push(r.url());
    });
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.locator(".react-flow__node")).toHaveCount(
      showcase.models.length,
    );
    for (const model of showcase.models)
      await expect(
        page.getByRole("button", {
          name: new RegExp(`^${model} \\d+ fields`),
        }),
      ).toBeVisible();
    await expect(page.locator(".react-flow__edge")).not.toHaveCount(0);
    await expect(page.getByLabel("Schema source", { exact: true })).toHaveValue(
      showcase.source,
    );
    expect(serverCalls).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("the user's own schema replaces the example, and a saved draft is not overwritten", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".react-flow__node")).toHaveCount(
    showcase.models.length,
  );
  await page
    .getByLabel("Schema source", { exact: true })
    .fill("CREATE TABLE mine (id INT PRIMARY KEY);");
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  await page.getByLabel("Input format").selectOption("postgresql");
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /^mine 1 field/ }),
  ).toBeVisible();
  // After the draft saves, a reload restores the user's schema, not the example.
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("schemamind.draft.v1")),
    )
    .toContain("mine");
  await page.reload();
  await expect(page.getByLabel("Schema source", { exact: true })).toHaveValue(
    "CREATE TABLE mine (id INT PRIMARY KEY);",
  );
  // The restored draft is redrawn with its saved format, never the example.
  await expect(page.getByLabel("Input format")).toHaveValue("postgresql");
  await expect(page.locator(".react-flow__node")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: /^mine 1 field/ }),
  ).toBeVisible();
});

/** Layout of the diagram canvas within the first viewport (no scrolling). */
const firstScreen = (page: Page) =>
  page.evaluate(() => {
    const box = (s: string) =>
      document.querySelector(s)!.getBoundingClientRect();
    const canvas = box(".react-flow");
    const top = Math.max(0, canvas.top);
    const bottom = Math.min(innerHeight, canvas.bottom);
    const nodes = [...document.querySelectorAll(".react-flow__node")].map((n) =>
      n.getBoundingClientRect(),
    );
    return {
      scrollY,
      canvasTop: canvas.top,
      visibleHeight: bottom - top,
      fullyVisible: nodes.filter(
        (r) =>
          r.top >= top &&
          r.bottom <= bottom &&
          r.left >= canvas.left - 1 &&
          r.right <= canvas.right + 1,
      ).length,
      zoom: Number(
        document
          .querySelector('[aria-label="Diagram zoom"]')!
          .textContent!.replace("%", ""),
      ),
      panelTop: box(".canvas-panel").top,
      sourceTop: box(".source-panel").top,
      stepNumbersShown: [...document.querySelectorAll(".step-number")].some(
        (n) => getComputedStyle(n).display !== "none",
      ),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });

for (const size of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
]) {
  test(`phones at ${size.width}x${size.height} open on a readable diagram above the input`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.locator(".react-flow__node")).toHaveCount(
      showcase.models.length,
    );
    // Let the opening fit settle (it animates).
    await expect
      .poll(async () => (await firstScreen(page)).fullyVisible, {
        timeout: 5000,
      })
      .toBeGreaterThanOrEqual(3);
    const layout = await firstScreen(page);
    expect(layout.scrollY).toBe(0);
    expect(layout.canvasTop).toBeGreaterThanOrEqual(0);
    expect(layout.canvasTop).toBeLessThanOrEqual(270);
    expect(layout.visibleHeight).toBeGreaterThanOrEqual(300);
    // At least three whole models on screen at a readable zoom.
    expect(layout.zoom).toBeGreaterThanOrEqual(50);
    expect(layout.fullyVisible).toBeGreaterThanOrEqual(3);
    // Diagram first, input below; no step numbers counting 2-then-1.
    expect(layout.panelTop).toBeLessThan(layout.sourceTop);
    expect(layout.stepNumbersShown).toBe(false);
    expect(layout.overflow).toBeLessThanOrEqual(0);
    await expect(page.getByLabel("Schema source", { exact: true })).toHaveValue(
      showcase.source,
    );
  });
}

for (const size of [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 900, height: 1000 },
]) {
  test(`the diagram comes first and is visible at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.locator(".react-flow__node")).toHaveCount(
      showcase.models.length,
    );
    const layout = await firstScreen(page);
    expect(layout.panelTop).toBeLessThan(layout.sourceTop);
    expect(layout.visibleHeight).toBeGreaterThanOrEqual(
      size.height < 500 ? 180 : 300,
    );
    expect(layout.stepNumbersShown).toBe(false);
    expect(layout.overflow).toBeLessThanOrEqual(0);
  });
}

test("desktop keeps the input panel beside the diagram, with step numbers", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator(".react-flow__node")).toHaveCount(
    showcase.models.length,
  );
  const source = await page.locator(".source-panel").boundingBox();
  const canvas = await page.locator(".canvas-panel").boundingBox();
  expect(source!.x).toBeLessThan(canvas!.x);
  expect(Math.abs(source!.y - canvas!.y)).toBeLessThan(1);
  expect(canvas!.y).toBeLessThan(800);
  expect((await firstScreen(page)).stepNumbersShown).toBe(true);
});

test("first visit does not save the example as a draft", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".react-flow__node")).toHaveCount(
    showcase.models.length,
  );
  await page.waitForTimeout(700); // longer than the 400ms autosave delay
  expect(
    await page.evaluate(() => localStorage.getItem("schemamind.draft.v1")),
  ).toBeNull();
  await expect(page.getByText(/Draft saved|Saving draft/)).toHaveCount(0);
  // The first real edit is saved.
  await page
    .getByLabel("Schema source", { exact: true })
    .fill("CREATE TABLE edited (id INT PRIMARY KEY);");
  await expect(
    page.getByText("Draft saved in this browser.", { exact: true }),
  ).toBeVisible();
});

test("an oversized saved draft is removed and the example is drawn instead", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem(
      "schemamind.draft.v1",
      JSON.stringify({ version: 1, input: "x".repeat(200001), format: "auto" }),
    );
  });
  await page.goto("/");
  await expect(page.getByText(/Oversized draft removed/)).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(
    showcase.models.length,
  );
});

test("a saved draft keeps its format: the example text saved as PostgreSQL is not drawn as Prisma", async ({
  page,
}) => {
  await page.addInitScript((source) => {
    localStorage.setItem(
      "schemamind.draft.v1",
      JSON.stringify({ version: 1, input: source, format: "postgresql" }),
    );
  }, showcase.source);
  await page.goto("/");
  await expect(page.getByLabel("Input format")).toHaveValue("postgresql");
  await expect(page.getByLabel("Schema source", { exact: true })).toHaveValue(
    showcase.source,
  );
  // Restoring finishes (Prisma text does not parse as PostgreSQL): no diagram.
  await expect(page.getByText("Restoring your diagram…")).toHaveCount(0);
  await expect(page.getByText("Your diagram starts here")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});

test("slow 3G: the example shows a loading state, then draws without timing out", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "CDP throttling is Chromium-only");
  test.setTimeout(120_000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  // QA profile: 400 kbps, 400 ms latency, 4x CPU slowdown.
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.setViewportSize({ width: 390, height: 844 });
  const start = Date.now();
  await page.goto("/", { waitUntil: "commit" });
  // Server-rendered loading state, never the empty placeholder.
  await expect(page.getByText("Drawing the example diagram…")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Your diagram starts here")).toHaveCount(0);
  await expect(page.locator(".react-flow__node")).toHaveCount(
    showcase.models.length,
    { timeout: 90_000 },
  );
  console.log(`slow-3G first draw after ${Date.now() - start}ms`);
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});

test("if the parser cannot download, the example shows an error with Retry", async ({
  page,
}) => {
  // Allow the page's own scripts; fail everything the worker would fetch.
  let blocked = true;
  await page.route("**/_next/static/chunks/**", async (route) => {
    if (blocked && route.request().resourceType() !== "script")
      return route.abort();
    return route.continue();
  });
  await page.goto("/");
  const alert = page.locator(".canvas-panel [role=alert]");
  await expect(alert).toContainText(/connection and retry/i, {
    timeout: 20_000,
  });
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
  blocked = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(
    showcase.models.length,
  );
  await expect(alert).toHaveCount(0);
});

for (const [label, content] of [
  ["0-byte", ""],
  ["whitespace-only", "  \n\t\n  "],
] as const) {
  test(`opening a ${label} file is rejected and keeps the text, diagram and draft`, async ({
    page,
  }) => {
    const mine = "CREATE TABLE mine (id INT PRIMARY KEY, name TEXT);";
    await page.goto("/");
    await expect(page.locator(".react-flow__node")).toHaveCount(
      showcase.models.length,
    );
    const source = page.getByLabel("Schema source", { exact: true });
    await source.fill(mine);
    await page.getByLabel("Input format").selectOption("postgresql");
    await page
      .getByRole("button", { name: "Visualize schema", exact: true })
      .click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(
      page.getByText("Draft saved in this browser.", { exact: true }),
    ).toBeVisible();
    const draft = () =>
      page.evaluate(() => localStorage.getItem("schemamind.draft.v1"));
    const saved = await draft();
    expect(saved).toContain("mine");
    await page.getByLabel("Upload schema file").setInputFiles({
      name: "empty.sql",
      mimeType: "application/sql",
      buffer: Buffer.from(content),
    });
    await expect(page.locator(".source-panel [role=alert]")).toHaveText(
      "This file is empty.",
    );
    await page.waitForTimeout(700); // longer than the 400ms autosave delay
    await expect(source).toHaveValue(mine);
    await expect(page.getByLabel("Input format")).toHaveValue("postgresql");
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(page.getByText("Draft cleared.")).toHaveCount(0);
    expect(await draft()).toBe(saved);
  });
}
