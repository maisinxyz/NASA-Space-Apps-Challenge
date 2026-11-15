import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { syncMapLibre } from '../sync-maplibre.mjs';
import { syncFixtures, watchFixtures } from '../sync-mocks.mjs';

const require = createRequire(import.meta.url);
async function eventually(check) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(check(), 'fixture watcher did not converge');
}
test('publishes the installed, versioned worker and preserves its exact bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'stardew-earth-worker-'));
  try {
    const { version } = require('maplibre-gl/package.json');
    const result = syncMapLibre({ publicRoot: root });
    assert.equal(result.url, `/maplibre/${version}/maplibre-gl-worker.mjs`);
    assert.deepEqual(readFileSync(join(root, result.url)), readFileSync(require.resolve('maplibre-gl/dist/maplibre-gl-worker.mjs')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('fixture watcher copies added nested fixtures, edits and removals, then closes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stardew-earth-fixtures-'));
  const source = join(root, 'source'), destination = join(root, 'mock');
  mkdirSync(source); writeFileSync(join(source, 'existing.json'), 'old');
  const watcher = watchFixtures({ source, destination, debounceMs: 10 });
  try {
    assert.equal(readFileSync(join(destination, 'existing.json'), 'utf8'), 'old');
    mkdirSync(join(source, 'copilot')); writeFileSync(join(source, 'copilot/chat_reply.json'), 'reply');
    await eventually(() => existsSync(join(destination, 'copilot/chat_reply.json')));
    writeFileSync(join(source, 'existing.json'), 'updated');
    await eventually(() => readFileSync(join(destination, 'existing.json'), 'utf8') === 'updated');
    rmSync(join(source, 'copilot'), { recursive: true });
    await eventually(() => !existsSync(join(destination, 'copilot')));
    watcher.close();
    writeFileSync(join(source, 'existing.json'), 'after-close');
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(readFileSync(join(destination, 'existing.json'), 'utf8'), 'updated');
  } finally { watcher.close(); rmSync(root, { recursive: true, force: true }); }
});
test('a missing fixture source fails without deleting the existing published fixtures', () => {
  const root = mkdtempSync(join(tmpdir(), 'stardew-earth-missing-'));
  try {
    const destination = join(root, 'mock'); mkdirSync(destination); writeFileSync(join(destination, 'keep.json'), 'keep');
    assert.throws(() => syncFixtures({ source: resolve(root, 'missing'), destination }));
    assert.equal(readFileSync(join(destination, 'keep.json'), 'utf8'), 'keep');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('development runner closes its watcher and terminates its child on shutdown', async () => {
  const { startDevelopment } = await import('../dev.mjs');
  const root = mkdtempSync(join(tmpdir(), 'stardew-earth-dev-'));
  const source = join(root, 'source'), destination = join(root, 'mock');
  mkdirSync(source); writeFileSync(join(source, 'fixture.json'), 'original');
  const runner = startDevelopment({
    command: process.execPath,
    args: ['-e', 'setInterval(() => {}, 1000)'],
    fixtureOptions: { source, destination },
    stdio: 'ignore',
  });
  try {
    const exited = new Promise((resolve) => runner.child.once('exit', resolve));
    runner.stop('SIGTERM');
    await exited;
    writeFileSync(join(source, 'fixture.json'), 'after-exit');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(readFileSync(join(destination, 'fixture.json'), 'utf8'), 'original');
  } finally { runner.stop('SIGTERM'); rmSync(root, { recursive: true, force: true }); }
});
test('Map2D sets the local worker URL before constructing a map and reports init failure separately', () => {
  const src = readFileSync(resolve(import.meta.dirname, '../../components/map2d/Map2D.tsx'), 'utf8');
  const setAt = src.indexOf('setWorkerUrl(`/maplibre/${getVersion()}/maplibre-gl-worker.mjs`)');
  assert.ok(setAt > 0 && setAt < src.indexOf('new MlMapCtor('));
  assert.match(src, /map2d-init-failed/);
  assert.match(src, /map2d-retry/);
});
