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
