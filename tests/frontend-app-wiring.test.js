import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('browser app configures the game api for backend-first mode', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /WENDAO_API_BASE_URL/);
  assert.match(source, /baseUrl:\s*BACKEND_BASE_URL/);
  assert.match(source, /preferredMode:\s*initialMode/);
});
