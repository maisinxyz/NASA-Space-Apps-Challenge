// Download the hero fonts (Cabinet Grotesk, Satoshi) from Fontshare into public/fonts/fontshare/ (git-ignored).
// Licence: ITF Free Font License v2.0 (https://www.fontshare.com/licenses/itf-ffl, read 2026-11-13). It allows each
// licensee to self-host the fonts for their own website (clause 01) but forbids redistributing the files through a
// repository or public server (clause 02), so the files are never committed: every developer fetches their own copy
// from Fontshare. Files are saved exactly as Fontshare serves them (no subsetting or conversion, clause 02).
// Skips when already downloaded; never fails the dev server when offline (the page falls back to system fonts).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, "../public/fonts/fontshare");
const cssOut = resolve(dir, "fonts.css");
// One request per family: the API returns only the first family when several are combined.
const APIS = ["cabinet-grotesk@700,800,900", "satoshi@300,400,500,700"].map((f) => `https://api.fontshare.com/v2/css?f[]=${f}&display=swap`);

if (existsSync(cssOut)) process.exit(0);
try {
  const css = (await Promise.all(APIS.map(async (u) => (await fetch(u)).text()))).join("\n");
  mkdirSync(dir, { recursive: true });
  let local = "";
  for (const block of css.split("@font-face").slice(1)) {
    const woff2 = block.match(/url\('(\/\/cdn\.fontshare\.com\/[^']+\.woff2)'\)/)?.[1];
    const family = block.match(/font-family:\s*'([^']+)'/)?.[1];
    const weight = block.match(/font-weight:\s*(\d+)/)?.[1];
    if (!woff2 || !family || !weight) continue;
    const file = `${family.toLowerCase().replace(/\s+/g, "-")}-${weight}.woff2`;
    const res = await fetch(`https:${woff2}`);
    if (!res.ok) throw new Error(`${res.status} for ${file}`);
    writeFileSync(resolve(dir, file), Buffer.from(await res.arrayBuffer()));
    local += `@font-face { font-family: '${family}'; src: url('./${file}') format('woff2'); font-weight: ${weight}; font-style: normal; font-display: swap; }\n`;
  }
  if (!local) throw new Error("no fonts in Fontshare CSS");
  writeFileSync(cssOut, `/* Downloaded from Fontshare (ITF Free Font License). Not for redistribution: do not commit. */\n${local}`);
  console.log(`Fetched Fontshare fonts -> ${dir}`);
} catch (e) {
  console.warn(`Fontshare fonts not fetched (${e instanceof Error ? e.message : e}); the hero uses fallback fonts.`);
}
