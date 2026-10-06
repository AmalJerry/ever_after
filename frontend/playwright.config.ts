import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  reporter: "list",
  workers: 1,
  timeout: 45000,
  webServer: process.env.CI
    ? [
        {
          command: "python manage.py runserver 127.0.0.1:8000 --noreload",
          cwd: "../backend",
          url: "http://127.0.0.1:8000/api/health/",
          reuseExistingServer: false,
        },
        {
          command: "npm run start -- --hostname 127.0.0.1 --port 3000",
          url: "http://127.0.0.1:3000/",
          reuseExistingServer: false,
        },
      ]
    : undefined,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
});
