import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const exactSecrets = [];
if (existsSync(new URL('../.env.local', import.meta.url))) {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && /KEY|SECRET|TOKEN|PASSWORD/.test(match[1])) {
      const value = match[2].replace(/^['"]|['"]$/g, '');
      if (value.length >= 16) exactSecrets.push(value);
    }
  }
}
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{30,}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{40,}\b/,
  /["'](?:private_key|secret_key)["']\s*:\s*["']ed25519:[1-9A-HJ-NP-Za-km-z]{75,}/,
];
const matches = new Set();
function check(text, label) {
  if (exactSecrets.some(s => text.includes(s)) || patterns.some(p => p.test(text))) matches.add(label);
}
const paths = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
for (const path of paths) {
  if (/^(?:\.env(?:\.|$)|.*\/(?:\.env(?:\.|$)))/.test(path) && !path.endsWith('.env.example')) matches.add(`${path} (environment file exposed to Git)`);
  const file = new URL('../' + path.replaceAll('\\', '/'), import.meta.url);
  if (existsSync(file)) check(readFileSync(file, 'utf8'), path);
}
const history = git(['rev-list', '--objects', '--all']).trim().split('\n').filter(Boolean);
let blobs = 0;
for (const entry of history) {
  const [objectId, ...label] = entry.split(' ');
  const type = git(['cat-file', '-t', objectId]).trim();
  if (type !== 'blob') continue;
  blobs++;
  check(git(['cat-file', 'blob', objectId]), `history:${objectId.slice(0, 12)}:${label.join(' ')}`);
}
if (matches.size) {
  console.error('Potential secret material detected. Values are deliberately hidden. Inspect locally:\n' + [...matches].join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${paths.length} tracked/unignored files and ${blobs} historical blobs checked; no known key or supported credential pattern detected.`);
  console.log('This bounded check supplements review; it cannot identify every possible secret format.');
}
