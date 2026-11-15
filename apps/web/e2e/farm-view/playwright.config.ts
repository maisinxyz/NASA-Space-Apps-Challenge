import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  workers: 1, // one run at a time (8 GB Mac)
  timeout: 45_000,
  use: { baseURL: process.env.QA_BASE_URL ?? "http://localhost:3003", viewport: { width: 1440, height: 900 } },
  outputDir: process.env.QA_OUTPUT ?? "/tmp/fieldtwin-ui-ux-playwright",
  reporter: [["list"]],
  projects: [{ name: "chromium", use: { browserName: "chromium", launchOptions: { args: ["--use-angle=swiftshader", "--enable-webgl"] } } }],
});
