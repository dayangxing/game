import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('desktop entry uses the local backend runtime and secure BrowserWindow settings', () => {
  const source = fs.readFileSync('electron/main.mjs', 'utf8');

  assert.match(source, /startDesktopBackend/);
  assert.match(source, /loadURL\(/);
  assert.match(source, /preload/);
  assert.match(source, /contextIsolation:\s*true/);
  assert.match(source, /nodeIntegration:\s*false/);
  assert.match(source, /before-quit/);
});

test('preload exposes only the desktop marker and runtime API address', () => {
  const source = fs.readFileSync('electron/preload.cjs', 'utf8');

  assert.match(source, /contextBridge\.exposeInMainWorld\(['"]WENDAO_DESKTOP_APP['"]/);
  assert.match(source, /contextBridge\.exposeInMainWorld\(['"]WENDAO_API_BASE_URL['"]/);
  assert.doesNotMatch(source, /nodeIntegration/);
  assert.doesNotMatch(source, /ipcRenderer/);
});

test('desktop backend starts from a temporary save path and stops twice', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wendao-desktop-'));
  try {
    const { startDesktopBackend } = await import('../electron/backendRuntime.mjs');
    const runtime = await startDesktopBackend({ savePath: path.join(dir, 'save.json') });
    const reset = await fetch(`${runtime.baseUrl}/api/v1/game/reset`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rerollSeed: 77 })
    });
    await reset.json();
    await runtime.stop();
    await runtime.stop();

    const reloaded = await startDesktopBackend({ savePath: path.join(dir, 'save.json') });
    try {
      const response = await fetch(`${reloaded.baseUrl}/api/v1/game/state`);
      const payload = await response.json();
      assert.equal(response.status, 200);
      assert.equal(payload.ok, true);
      assert.equal(payload.data.game.seed, 77);
    } finally {
      await reloaded.stop();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('package metadata exposes desktop development and distribution commands', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

  assert.equal(packageJson.main, 'electron/main.mjs');
  assert.equal(packageJson.productName, '问道浮生');
  assert.equal(packageJson.scripts['desktop:dev'], 'electron electron/main.mjs');
  assert.equal(packageJson.scripts['desktop:package'], 'electron-forge package');
  assert.equal(packageJson.scripts['desktop:make'], 'electron-forge make');
  assert.equal(packageJson.scripts['start:all'], 'bash scripts/start-dev.sh');
});

test('Forge config declares macOS and Windows makers', () => {
  const source = fs.readFileSync('forge.config.cjs', 'utf8');

  assert.match(source, /maker-squirrel/);
  assert.match(source, /maker-dmg/);
  assert.match(source, /maker-zip/);
  assert.match(source, /prune:\s*false/);
  assert.match(source, /\.env/);
});
