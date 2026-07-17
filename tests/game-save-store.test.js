import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createGameSaveStore } from '../backend/src/storage/gameSaveStore.js';

function withTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wendao-save-'));
}

test('save store returns null for a first launch and restores a saved game', () => {
  const dir = withTempDir();
  try {
    const filePath = path.join(dir, 'save.json');
    const store = createGameSaveStore({ filePath });
    const game = { version: 4, turn: 9, player: { name: '青璃' } };

    assert.equal(store.load(), null);
    store.save(game);
    assert.deepEqual(store.load(), game);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('save store backs up malformed JSON and starts cleanly', () => {
  const dir = withTempDir();
  try {
    const filePath = path.join(dir, 'save.json');
    fs.writeFileSync(filePath, '{bad json', 'utf8');
    const store = createGameSaveStore({ filePath });

    assert.equal(store.load(), null);
    assert.equal(fs.existsSync(`${filePath}.corrupt`), true);
    assert.equal(store.load(), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('save store clear is idempotent', () => {
  const dir = withTempDir();
  try {
    const filePath = path.join(dir, 'save.json');
    const store = createGameSaveStore({ filePath });

    store.save({ turn: 1 });
    store.clear();
    store.clear();
    assert.equal(fs.existsSync(filePath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
