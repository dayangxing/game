import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('frontend redirects file protocol loads to the local dev server', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');

  assert.match(html, /location\.protocol\s*===\s*'file:'/);
  assert.match(html, /http:\/\/127\.0\.0\.1:5173\//);
});

test('Svelte entry imports the global stylesheet through the Vite module graph', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');
  const main = fs.readFileSync('frontend/src/main.js', 'utf8');

  assert.match(main, /import\s+['"]\.\/styles\.css['"]/);
  assert.doesNotMatch(html, /<link[^>]+src\/styles\.css/);
});
