// @ts-nocheck — @playwright/test is not installed yet (see docs/farm-view/test-report.md). Remove once it is.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  workers: 1, // one run at a time (8 GB Mac)
  timeout: 60_000,
  use: { baseURL: "http://localhost:3000", viewport: { width: 1440, height: 900 } },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
