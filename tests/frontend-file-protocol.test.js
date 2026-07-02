import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('frontend redirects file protocol loads to the local dev server', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');

  assert.match(html, /location\.protocol\s*===\s*'file:'/);
  assert.match(html, /http:\/\/127\.0\.0\.1:5173\/frontend\//);
});
