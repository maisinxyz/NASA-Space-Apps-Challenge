// Keep public/mock aligned with canonical fixtures without deleting the whole live directory.
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, watch } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultSource = resolve(here, '../../../packages/contracts/fixtures');
const defaultDestination = resolve(here, '../public/mock');

export function syncFixtures({ source = defaultSource, destination = defaultDestination } = {}) {
  source = resolve(source); destination = resolve(destination);
  if (!existsSync(source) || !statSync(source).isDirectory()) throw new Error(`Fixtures not found at ${source}. Run make fixtures at the repo root.`);
  const relation = relative(source, destination);
  const reverse = relative(destination, source);
  if (!relation || (!relation.startsWith(`..${sep}`) && relation !== '..') || (!reverse.startsWith(`..${sep}`) && reverse !== '..')) throw new Error('Fixture source and destination must be separate directories');
  function reconcile(from, to) {
    if (existsSync(to) && !statSync(to).isDirectory()) rmSync(to, { force: true });
    mkdirSync(to, { recursive: true });
    const entries = readdirSync(from, { withFileTypes: true });
    for (const entry of entries) {
      const input = join(from, entry.name), output = join(to, entry.name);
      if (entry.isDirectory()) reconcile(input, output);
      else if (entry.isFile()) {
        if (existsSync(output) && statSync(output).isDirectory()) rmSync(output, { recursive: true, force: true });
        const temporary = `${output}.sync-${process.pid}`;
        try { copyFileSync(input, temporary); renameSync(temporary, output); }
        finally { rmSync(temporary, { force: true }); }
      }
    }
    const names = new Set(entries.map((entry) => entry.name));
    for (const name of readdirSync(to)) if (!names.has(name)) rmSync(join(to, name), { recursive: true, force: true });
  }
  reconcile(source, destination);
}

export function watchFixtures({ source = defaultSource, destination = defaultDestination, debounceMs = 100, onError = console.error } = {}) {
  let timer;
  function signature(directory) {
    return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => {
      const path = join(directory, entry.name);
      const stat = statSync(path);
      return `${entry.name}:${stat.mtimeMs}:${stat.size}:${entry.isDirectory() ? signature(path) : ""}`;
    }).join("|");
  }
  let previous;
  const synchronize = () => { syncFixtures({ source, destination }); previous = signature(source); };
  // Watch before the initial copy so edits during startup also trigger a subsequent synchronization.
  const watcher = watch(source, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { synchronize(); } catch (error) { onError(error); } }, debounceMs);
  });
  watcher.on('error', onError);
  try { synchronize(); } catch (error) { watcher.close(); throw error; }
  // Native events can coalesce or miss a just-created directory during watcher startup.
  // A cheap metadata scan repairs missed events without repeatedly copying fixture binaries.
  const interval = setInterval(() => {
    try { if (signature(source) !== previous) synchronize(); } catch (error) { onError(error); }
  }, 1000);
  return { close() { clearTimeout(timer); clearInterval(interval); watcher.close(); } };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncFixtures();
  console.log(`Copied fixtures -> ${defaultDestination}`);
}
