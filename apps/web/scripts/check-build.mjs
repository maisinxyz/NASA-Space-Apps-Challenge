// Fails if the production build still contains unverified markers (PRD B8). Run after `pnpm build`: pnpm check-build
// Scans .next/static and .next/server. Exit 0 = clean, 1 = markers found, 2 = no build output.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MARKERS = ["TODO(verify)"];
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dirs = ["static", "server"].map((d) => join(root, ".next", d)).filter((d) => existsSync(d));

if (dirs.length === 0) {
  console.error("check-build: no .next/static or .next/server found. Run `pnpm build` first.");
  process.exit(2);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const hits = [];
let scanned = 0;
for (const dir of dirs) {
  for (const file of walk(dir)) {
    if (/\.(png|jpe?g|webp|gif|ico|woff2?|ttf|bin|map)$/i.test(file)) continue;
    scanned++;
    const text = readFileSync(file, "utf8");
    for (const m of MARKERS) {
      const count = text.split(m).length - 1;
      if (count) hits.push(`${relative(root, file)}: ${count} x "${m}"`);
    }
  }
}

if (hits.length) {
  console.error(`check-build: unverified markers in the production build (${hits.length} file(s)):`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log(`check-build: OK, ${scanned} files scanned, no ${MARKERS.join(", ")} markers.`);
