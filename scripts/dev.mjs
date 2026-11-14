import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;
function run(name, args, cwd) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', () => { console.error(`${name} failed to start.`); shutdown(1); });
  child.on('exit', code => { if (!stopping) shutdown(code ?? 0); });
  return child;
}
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  process.exitCode = code;
}
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
run('worker', ['--import', 'tsx', 'apps/worker/src/index.ts'], root);
run('web', [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'dev', '--hostname', '127.0.0.1', '--port', '3000'], fileURLToPath(new URL('../apps/web/', import.meta.url)));
console.log('PROOFBOUND: frontend http://127.0.0.1:3000 · persistent worker http://127.0.0.1:3001');
