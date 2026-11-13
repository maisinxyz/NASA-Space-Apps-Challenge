// Copy packages/contracts/fixtures -> apps/web/public/mock (gitignored). Run: pnpm sync-mocks
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../../packages/contracts/fixtures");
const dest = resolve(here, "../public/mock");

if (!existsSync(src)) {
  console.error(`Fixtures not found at ${src}. Run \`make fixtures\` at the repo root.`);
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`Copied fixtures -> ${dest}`);
