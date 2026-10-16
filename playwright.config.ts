import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:3100", headless: true },
  webServer: {
    command: "npm start -- --hostname 127.0.0.1 --port 3100",
    port: 3100,
    reuseExistingServer: false,
  },
  reporter: "list",
});
