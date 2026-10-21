import { test, expect } from "@playwright/test";
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
  await expect(page.locator(".react-flow__node")).toHaveCount(0);
});

for (const size of [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
]) {
  test(`the example diagram is on the first screen at ${size.width}x${size.height}, before the input panel`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.locator(".react-flow__node")).toHaveCount(
      showcase.models.length,
    );
    const layout = await page.evaluate(() => {
      const box = (s: string) =>
        document.querySelector(s)!.getBoundingClientRect();
      const canvas = box(".react-flow");
      const visibleNodes = [
        ...document.querySelectorAll(".react-flow__node"),
      ].filter((n) => {
        const r = n.getBoundingClientRect();
        return (
          r.bottom > 0 &&
          r.top < innerHeight &&
          r.right > 0 &&
          r.left < innerWidth
        );
      }).length;
      return {
        scrollY,
        canvasTop: canvas.top,
        canvasHeight: canvas.height,
        panelTop: box(".canvas-panel").top,
        sourceTop: box(".source-panel").top,
        visibleNodes,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    expect(layout.scrollY).toBe(0);
    // The canvas starts inside the first viewport, with a usable slice of it showing.
    expect(layout.canvasTop).toBeGreaterThanOrEqual(0);
    expect(layout.canvasTop).toBeLessThan(size.height - 150);
    expect(layout.canvasHeight).toBeGreaterThan(300);
    expect(layout.visibleNodes).toBeGreaterThan(0);
    // Mobile order: diagram first, schema input below it.
    expect(layout.panelTop).toBeLessThan(layout.sourceTop);
    expect(layout.overflow).toBeLessThanOrEqual(0);
    // The input panel is still there, one scroll away.
    await expect(page.getByLabel("Schema source", { exact: true })).toHaveValue(
      showcase.source,
    );
  });
}

test("desktop keeps the input panel beside the diagram", async ({ page }) => {
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
});
