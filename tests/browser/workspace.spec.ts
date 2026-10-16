import { test, expect } from "@playwright/test";
import { examples } from "../../lib/importers/catalog";
test("imports stay local when the hosted parsing API is broken; AI failure preserves the diagram", async ({
  page,
}) => {
  await page.goto("/");
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
