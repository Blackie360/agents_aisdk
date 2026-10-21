import { test, expect } from "@playwright/test";

test("admin requires sign-in, hides providers without config and shows counts for admins", async ({
  page,
  request,
}) => {
  // Real server: no session, so the API refuses and no sign-in is configured.
  const api = await request.get("/api/admin/usage");
  expect(api.status()).toBe(401);
  expect((await api.json()).code).toBe("SIGN_IN_REQUIRED");
  expect((await (await request.get("/api/account")).json()).providers).toEqual(
    [],
  );
  expect((await request.post("/api/auth/sign-in/social")).status()).toBe(503);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Admin sign-in" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sign-in is not configured on this deployment."),
  ).toBeVisible();
  await expect(page.locator("input[type=password]")).toHaveCount(0);

  // Signed in as an admin (mocked session and data).
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        providers: ["google", "github"],
        user: { name: "Felix", email: "felix@example.com", image: null },
        admin: true,
      },
    }),
  );
  await page.route("**/api/admin/usage", (route) =>
    route.fulfill({
      json: {
        totals: [
          { kind: "visualization", outcome: "success", count: 42 },
          { kind: "explanation", outcome: "failure", count: 3 },
        ],
        daily: [],
        firstEvent: null,
      },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Schema visualizations" }),
  ).toBeVisible();
  await expect(page.getByText("42", { exact: true })).toBeVisible();
  await expect(
    page.getByText("0 successful · 3 failed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("felix@example.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/schemamind-admin-phone.png",
    fullPage: true,
  });
});

test("signed-in non-admins are told so; signed-out admins see provider buttons", async ({
  page,
}) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: { providers: ["github"], user: null, admin: false },
    }),
  );
  await page.route("**/api/admin/usage", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "SIGN_IN_REQUIRED", message: "Sign in" },
    }),
  );
  let signInBody: any = null;
  await page.route("**/api/auth/sign-in/social", (route) => {
    signInBody = route.request().postDataJSON();
    return route.fulfill({
      json: { url: "/admin?signed-in=1", redirect: true },
    });
  });
  await page.goto("/admin");
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await expect(page).toHaveURL(/signed-in=1/);
  expect(signInBody).toEqual({ provider: "github", callbackURL: "/admin" });

  await page.unroute("**/api/admin/usage");
  await page.route("**/api/admin/usage", (route) =>
    route.fulfill({
      status: 403,
      json: { code: "NOT_ADMIN", message: "Not admin" },
    }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Not an admin account" }),
  ).toBeVisible();
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
