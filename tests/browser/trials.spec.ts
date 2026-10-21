import { test, expect } from "@playwright/test";

test("after the free explanations, the UI asks visitors to sign in", async ({
  page,
}) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: { providers: ["google", "github"], user: null, admin: false },
    }),
  );
  let calls = 0;
  await page.route("**/api/schema-explanation", (route) => {
    calls++;
    return calls === 1
      ? route.fulfill({
          json: { explanation: "First free explanation" },
          headers: { "X-Free-Explanations-Remaining": "0" },
        })
      : route.fulfill({
          status: 401,
          json: {
            error: "signup_required",
            code: "SIGNUP_REQUIRED",
            message:
              "You've used your 3 free explanations. Sign in to keep going, or bring your own API key.",
            providers: ["google", "github"],
          },
        });
  });
  await page.goto("/");
  // The Prisma showcase is already drawn on load; no Visualize click needed.
  await expect(page.locator(".react-flow__node")).toHaveCount(8);
  await page.getByRole("button", { name: "Explain with Grok" }).click();
  await expect(page.getByText("First free explanation")).toBeVisible();
  await expect(
    page.getByText("No free explanations left. Sign in to keep going."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explain with Grok" }).click();
  await expect(page.getByText("Create a free account")).toBeVisible();
  await expect(
    page.getByText("You've used your 3 free explanations"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
  // Header sign-in is available too.
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByText("Sign in for more free explanations."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("signed-in users see their email and can sign out", async ({ page }) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        providers: ["github"],
        user: { name: "Dev", email: "dev@example.com", image: null },
        admin: false,
      },
    }),
  );
  let signedOut = false;
  await page.route("**/api/auth/sign-out", (route) => {
    signedOut = true;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto("/");
  await expect(page.getByText("dev@example.com")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect.poll(() => signedOut).toBe(true);
});
