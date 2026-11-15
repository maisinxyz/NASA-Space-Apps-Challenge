// pnpm dev forwards Next arguments while keeping canonical fixtures current.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchFixtures } from './sync-mocks.mjs';

const require = createRequire(import.meta.url);
export function startDevelopment({
  command = process.execPath,
  args = [require.resolve('next/dist/bin/next'), 'dev', '--turbopack', ...process.argv.slice(2)],
  fixtureOptions,
  stdio = 'inherit',
} = {}) {
  const fixtures = watchFixtures(fixtureOptions);
  const child = spawn(command, args, { stdio });
  let stopping = false;
  let killTimer;
  const stop = (signal = 'SIGTERM') => {
    if (stopping) return;
    stopping = true;
    fixtures.close();
    child.kill(signal);
    killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
    killTimer.unref();
  };
  const interrupt = () => stop('SIGINT');
  const terminate = () => stop('SIGTERM');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  function cleanup() {
    stopping = true;
    fixtures.close(); clearTimeout(killTimer);
    process.off('SIGINT', interrupt); process.off('SIGTERM', terminate);
  }
  child.on('error', (error) => { console.error(error); cleanup(); });
  child.on('exit', cleanup);
  return { child, stop };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { child } = startDevelopment();
  child.on('error', () => { process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1); });
}
