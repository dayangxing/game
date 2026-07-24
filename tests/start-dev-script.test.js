import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const scriptPath = 'scripts/start-dev.sh';

test('one-command startup script manages frontend and backend services', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const mode = fs.statSync(scriptPath).mode;

  assert.ok(mode & 0o111, 'startup script should be executable');
  assert.match(source, /set -Eeuo pipefail/);
  assert.match(source, /backend\/src\/server\.js/);
  assert.match(source, /node_modules\/\.bin\/vite/);
  assert.match(source, /frontend\/vite\.config\.js/);
  assert.match(source, /api\/v1\/game\/state/);
  assert.match(source, /trap .*INT/);
  assert.match(source, /trap .*EXIT/);
  assert.match(source, /OPEN_BROWSER/);
  assert.match(source, /自动终止|already in use|already.*running/i);
});

test('package and readme expose the one-command startup entry', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const readme = fs.readFileSync('README.md', 'utf8');

  assert.equal(packageJson.scripts['start:all'], 'bash scripts/start-dev.sh');
  assert.match(readme, /npm run start:all/);
  assert.match(readme, /127\.0\.0\.1:5173\//);
});
