// Copy Cesium's static runtime (workers, assets, widget CSS) -> apps/web/public/cesium (gitignored).
// Cesium loads these at runtime from window.CESIUM_BASE_URL ("/cesium"). Runs in predev/prebuild.
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../node_modules/cesium/Build/Cesium");
const dest = resolve(here, "../public/cesium");

if (!existsSync(src)) {
  console.error(`Cesium build not found at ${src}. Run \`corepack pnpm install\` in apps/web.`);
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
for (const dir of ["Workers", "ThirdParty", "Assets", "Widgets"]) {
  cpSync(resolve(src, dir), resolve(dest, dir), { recursive: true, dereference: true });
}
console.log(`Copied Cesium static files -> ${dest}`);
