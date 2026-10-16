import { test, expect } from "@playwright/test";

test("admin requires a password, shows separate counts and clears access on lock", async ({
  page,
  request,
}) => {
  expect((await request.get("/api/admin/usage")).status()).toBe(401);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await page
    .getByLabel("Admin password")
    .fill("synthetic-private-test-password");
  await page.getByRole("button", { name: "Open dashboard" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "Admin access required",
  );
  await page.route("**/api/admin/usage", (route) => {
    expect(route.request().headers().authorization).toBe(
      "Bearer synthetic-private-test-password",
    );
    return route.fulfill({
      json: {
        totals: [
          { kind: "visualization", outcome: "success", count: 42 },
          { kind: "explanation", outcome: "failure", count: 3 },
        ],
        daily: [],
        firstEvent: null,
      },
    });
  });
  await page.getByRole("button", { name: "Open dashboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Schema visualizations" }),
  ).toBeVisible();
  await expect(page.getByText("42", { exact: true })).toBeVisible();
  await expect(
    page.getByText("0 successful · 3 failed", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("synthetic-private-test-password");
  await page.screenshot({
    path: "/tmp/schemamind-admin-phone.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Lock dashboard" }).click();
  await expect(page.getByLabel("Admin password")).toHaveValue("");
  await expect(page.getByText("42", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Admin password")).toHaveValue("");
});

test("visualization telemetry contains no schema and cannot block diagrams", async ({
  page,
}) => {
  const events: any[] = [];
  await page.route("**/api/usage", (route) => {
    events.push(route.request().postDataJSON());
    return route.fulfill({ status: 503 });
  });
  await page.goto("/");
  await page.getByLabel("Input format").selectOption("postgresql");
  await page
    .getByLabel("Schema source", { exact: true })
    .fill("CREATE TABLE private_name (secret_column int);");
  await page
    .getByRole("button", { name: "Visualize schema", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Schema review", exact: true }),
  ).toBeVisible();
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    kind: "visualization",
    outcome: "success",
  });
  expect(Object.keys(events[0]).sort()).toEqual(["id", "kind", "outcome"]);
  expect(JSON.stringify(events)).not.toContain("private_name");
});
