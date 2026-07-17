import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createJsonFileStore } from '../backend/src/storage/jsonFileStore.js';

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wendao-config-'));
  return { dir, filePath: path.join(dir, 'config.json') };
}

test('json file store saves and restores arbitrary config values', () => {
  const { dir, filePath } = tempFile();
  try {
    const store = createJsonFileStore({ filePath });
    const value = { baseUrl: 'https://example.test/v1', chatModel: 'model-a' };
    assert.equal(store.load(), null);
    store.save(value);
    assert.deepEqual(store.load(), value);
    assert.equal(fs.existsSync(`${filePath}.${process.pid}.tmp`), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('json file store backs up malformed values and starts clean', () => {
  const { dir, filePath } = tempFile();
  try {
    fs.writeFileSync(filePath, '{broken', 'utf8');
    const store = createJsonFileStore({ filePath });
    assert.equal(store.load(), null);
    assert.equal(fs.existsSync(`${filePath}.corrupt`), true);
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('json file store clear can be called repeatedly', () => {
  const { dir, filePath } = tempFile();
  try {
    const store = createJsonFileStore({ filePath });
    store.clear();
    store.save({ enabled: true });
    store.clear();
    store.clear();
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
