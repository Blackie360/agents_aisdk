import { test, expect } from "@playwright/test";
import { examples } from "../../lib/importers/catalog";
test("auto import, interactive diagram, details, exports and optional AI failure", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
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
  await page.getByRole("button", { name: "Explain with AI" }).click();
  await expect(page.getByRole("status")).toContainText("not configured");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await page.screenshot({
    path: "test-results/workspace-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("all importers render through the production API", async ({ page }) => {
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
