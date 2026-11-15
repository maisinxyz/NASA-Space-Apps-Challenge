// Publish the installed worker unchanged: Turbopack cannot resolve MapLibre's dynamic default worker URL.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
export function syncMapLibre({ publicRoot = resolve(here, '../public') } = {}) {
  const { version } = JSON.parse(readFileSync(require.resolve('maplibre-gl/package.json'), 'utf8'));
  const url = `/maplibre/${version}/maplibre-gl-worker.mjs`;
  const destination = join(publicRoot, url);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs'), destination);
  return { url, destination };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Published MapLibre worker -> ${syncMapLibre().destination}`);
}
