# macOS 与 Windows 单机 App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 Electron 将当前问道浮生前后端封装为可在 macOS 与 Windows 运行的单机桌面 App，并提供本地 JSON 权威存档。

**Architecture:** Electron 主进程启动当前 Node 后端 `createBackendApp()` 和 `startBackendServer()`，使用端口 `0` 获取随机本地端口；通过 `loadURL(file://...?...api=...)` 和 preload 将桌面标记/API 地址传给现有 renderer。后端通过注入式 JSON 存档适配器恢复和持久化权威游戏状态，浏览器开发模式继续使用现有 `start:all`。

**Tech Stack:** Electron、Electron Forge、原生 ESM、原生 HTML/CSS/ES modules、Node.js built-in test runner、JSON 原子写入。

## Global Constraints

- 只修改当前 `dev` 分支，不修改或推送 `main`。
- macOS 与 Windows 是本次目标平台；Linux 不纳入验收。
- 不改变现有游戏 API 响应结构、事件规则、章节推进和移动端 UI 行为。
- Electron renderer 不开启 `nodeIntegration`，保留 `contextIsolation`，只通过 preload 暴露两个运行时值。
- 单机权威存档写入 Electron `app.getPath('userData')` 对应目录，不写入安装目录。
- 浏览器开发命令 `npm run start:all` 必须继续可用。
- 不把 API Key 写入源码、安装包资源、测试或 Git。
- 保留现有 `.idea/` 未跟踪文件，不纳入提交。

---

### Task 1: Build the persistent JSON save adapter

**Files:**
- Create: `backend/src/storage/gameSaveStore.js`
- Create: `tests/game-save-store.test.js`

**Interfaces:**
- `createGameSaveStore({ filePath, fsImpl = fs })` returns `{ load, save, clear }`.
- `load()` returns the parsed game object when the file is valid, `null` when it does not exist, and `null` after backing up malformed JSON.
- `save(game)` writes JSON through a sibling temporary file and an atomic rename.
- `clear()` removes the save file when present and is idempotent.

- [ ] **Step 1: Write the failing persistence tests**

Create `tests/game-save-store.test.js`:

```js
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
  const filePath = path.join(dir, 'save.json');
  const store = createGameSaveStore({ filePath });
  const game = { version: 4, turn: 9, player: { name: '青璃' } };

  assert.equal(store.load(), null);
  store.save(game);
  assert.deepEqual(store.load(), game);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('save store backs up malformed JSON and starts cleanly', () => {
  const dir = withTempDir();
  const filePath = path.join(dir, 'save.json');
  fs.writeFileSync(filePath, '{bad json', 'utf8');
  const store = createGameSaveStore({ filePath });

  assert.equal(store.load(), null);
  assert.equal(fs.existsSync(`${filePath}.corrupt`), true);
  assert.equal(store.load(), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('save store clear is idempotent', () => {
  const dir = withTempDir();
  const filePath = path.join(dir, 'save.json');
  const store = createGameSaveStore({ filePath });

  store.save({ turn: 1 });
  store.clear();
  store.clear();
  assert.equal(fs.existsSync(filePath), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/game-save-store.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because the storage adapter does not exist.

- [ ] **Step 3: Implement atomic JSON persistence**

Implement `createGameSaveStore` with these rules:

```js
export function createGameSaveStore({ filePath, fsImpl = fs } = {}) {
  if (!filePath) throw new TypeError('filePath is required');

  function load() {
    try {
      return JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      if (error instanceof SyntaxError) {
        fsImpl.renameSync(filePath, `${filePath}.corrupt`);
        return null;
      }
      throw error;
    }
  }

  function save(game) {
    fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    fsImpl.writeFileSync(tempPath, `${JSON.stringify(game, null, 2)}\n`, 'utf8');
    fsImpl.renameSync(tempPath, filePath);
  }

  function clear() {
    try {
      fsImpl.unlinkSync(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  return { load, save, clear };
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test tests/game-save-store.test.js`

Expected: all three save-store tests pass.

### Task 2: Make the backend lifecycle and persistence injectable

**Files:**
- Modify: `backend/src/server.js`
- Modify: `backend/src/app.js`
- Create: `tests/backend-desktop-runtime.test.js`

**Interfaces:**
- `startBackendServer({ host, port, app })` continues returning the Node HTTP server.
- Add `waitForServerListening(server)` returning `{ host, port }` after the server emits `listening` and rejecting on startup error.
- Add `closeBackendServer(server)` returning a Promise and resolving if the server is already closed.
- `createBackendApp({ initialGame, persistGame })` uses `initialGame` when provided and calls `persistGame(game)` after successful mutating requests.

- [ ] **Step 1: Write failing lifecycle and persistence tests**

Create `tests/backend-desktop-runtime.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '../backend/src/app.js';
import { createGame } from '../src/engine.js';
import { closeBackendServer, startBackendServer, waitForServerListening } from '../backend/src/server.js';

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options
  });
  return { response, body: await response.json() };
}

test('backend starts on an available random port and closes idempotently', async () => {
  const server = startBackendServer({ host: '127.0.0.1', port: 0 });
  const address = await waitForServerListening(server);
  const result = await fetch(`http://127.0.0.1:${address.port}/api/v1/game/state`);

  assert.equal(result.status, 200);
  await closeBackendServer(server);
  await closeBackendServer(server);
});

test('backend restores initial state and persists a successful reset', async () => {
  const persisted = [];
  const initialGame = createGame(7);
  initialGame.turn = 12;
  initialGame.player.name = '旧存档';
  const app = createBackendApp({
    initialGame,
    persistGame: async (game) => persisted.push(game)
  });
  const server = startBackendServer({ host: '127.0.0.1', port: 0, app });
  const address = await waitForServerListening(server);

  const initial = await requestJson(`http://127.0.0.1:${address.port}`, '/api/v1/game/state');
  assert.equal(initial.body.data.game.turn, 12);

  const reset = await requestJson(`http://127.0.0.1:${address.port}`, '/api/v1/game/reset', {
    method: 'POST',
    body: JSON.stringify({ rerollSeed: 9 })
  });
  assert.equal(reset.response.status, 200);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].turn, 0);

  await closeBackendServer(server);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/backend-desktop-runtime.test.js`

Expected: FAIL because the lifecycle helpers, `initialGame`, and persistence callback do not exist.

- [ ] **Step 3: Implement server lifecycle helpers**

In `backend/src/server.js`, export:

```js
export function waitForServerListening(server) {
  if (server.listening) return Promise.resolve(server.address());
  return new Promise((resolve, reject) => {
    const onListening = () => {
      cleanup();
      resolve(server.address());
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      server.off('listening', onListening);
      server.off('error', onError);
    };
    server.once('listening', onListening);
    server.once('error', onError);
  });
}

export function closeBackendServer(server) {
  if (!server || !server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
```

- [ ] **Step 4: Add initial state and post-request persistence**

In `createBackendApp(options)`, initialize `state.game` from `options.initialGame ?? createGame(...)`, and store `options.persistGame`. Wrap the existing route dispatch so every successful `POST` response calls `await state.persistGame(state.game)` before returning. `GET` and failed responses must not write saves. Keep pending action maps in memory; only `state.game` is persisted.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `node --test tests/backend-desktop-runtime.test.js`

Expected: both lifecycle and persistence tests pass.

### Task 3: Add the Electron runtime and secure preload bridge

**Files:**
- Create: `electron/backendRuntime.mjs`
- Create: `electron/main.mjs`
- Create: `electron/preload.cjs`
- Create: `tests/desktop-app.test.js`

**Interfaces:**
- `startDesktopBackend({ savePath, env })` returns `{ baseUrl, server, stop }`.
- `stop()` closes the backend and is idempotent.
- `preload.cjs` exposes `window.WENDAO_DESKTOP_APP === true` and `window.WENDAO_API_BASE_URL` without exposing Node APIs.

- [ ] **Step 1: Write failing desktop source and runtime tests**

Create `tests/desktop-app.test.js` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
```

Add an integration test for `startDesktopBackend` that uses a temporary save path, fetches `/api/v1/game/state`, calls `stop()` twice, and asserts the second call resolves.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/desktop-app.test.js`

Expected: FAIL because the Electron files and runtime do not exist.

- [ ] **Step 3: Implement `electron/backendRuntime.mjs`**

The runtime must:

1. Create a save store at the supplied `savePath`.
2. Load the saved game before creating the backend app.
3. Call `createBackendApp({ initialGame, persistGame })`.
4. Start `startBackendServer({ host: '127.0.0.1', port: 0, app })`.
5. Await `waitForServerListening` and return `baseUrl` using the assigned port.
6. Make `stop()` call `closeBackendServer` once and resolve on later calls.

- [ ] **Step 4: Implement `electron/preload.cjs`**

Read `api` from `new URLSearchParams(window.location.search).get('api')`, then expose only:

```js
contextBridge.exposeInMainWorld('WENDAO_DESKTOP_APP', true);
contextBridge.exposeInMainWorld('WENDAO_API_BASE_URL', api);
```

Do not expose `require`, `process`, `ipcRenderer`, filesystem methods, or arbitrary IPC channels.

- [ ] **Step 5: Implement `electron/main.mjs`**

Create a `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, `preload: pathToFileURL(preloadPath).pathname`, and load the frontend through a file URL containing `desktop=1` and the encoded runtime API URL. Start the backend before creating the window; show an error dialog and quit if startup fails. Close the runtime in `before-quit`, guarding against repeated shutdown calls.

- [ ] **Step 6: Update the file-protocol redirect guard**

In `frontend/index.html`, change the redirect condition to:

```js
if (location.protocol === 'file:' && !window.WENDAO_DESKTOP_APP) {
  location.replace('http://127.0.0.1:5173/frontend/');
}
```

The existing browser-development redirect remains unchanged for ordinary `file:` opens.

- [ ] **Step 7: Run focused desktop tests**

Run: `node --test tests/desktop-app.test.js tests/backend-desktop-runtime.test.js`

Expected: all desktop runtime and source contract tests pass without launching a GUI window.

### Task 4: Add Electron Forge packaging and development commands

**Files:**
- Modify: `package.json`
- Create: `forge.config.cjs`
- Test: `tests/desktop-app.test.js`
- Modify: `README.md`

**Interfaces:**
- `npm run desktop:dev` launches `electron electron/main.mjs`.
- `npm run desktop:package` runs `electron-forge package`.
- `npm run desktop:make` runs `electron-forge make`.
- Existing `start:all` remains the browser development command.

- [ ] **Step 1: Write failing package contract tests**

Append to `tests/desktop-app.test.js`:

```js
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
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/desktop-app.test.js`

Expected: FAIL because package metadata and Forge configuration do not exist.

- [ ] **Step 3: Install desktop build dependencies**

Run: `npm install --save-dev electron @electron-forge/cli @electron-forge/maker-dmg @electron-forge/maker-squirrel @electron-forge/maker-zip`

Expected: `package.json` and the lockfile are updated with Electron and Forge dependencies. Use the project Node environment; do not install into the base Python environment.

- [ ] **Step 4: Add package metadata and scripts**

Set `main` to `electron/main.mjs`, `productName` to `问道浮生`, and add the three scripts from the tests. Keep `test`, `start:frontend`, `start:backend`, and `start:all` unchanged.

- [ ] **Step 5: Add Forge configuration**

Create `forge.config.cjs` with `packagerConfig.asar = true` and makers for:

- `@electron-forge/maker-squirrel` on `win32`;
- `@electron-forge/maker-dmg` on `darwin`;
- `@electron-forge/maker-zip` on `darwin` and `win32`.

Do not include API keys or local `.env` files in extra resources.

- [ ] **Step 6: Document desktop commands and save location**

Add a README section that explains `desktop:dev`, `desktop:package`, `desktop:make`, local-mode offline behavior, cloud-mode API requirements, and that final macOS/Windows signed builds should run on their respective platforms or CI runners.

- [ ] **Step 7: Run package contract tests**

Run: `node --test tests/desktop-app.test.js`

Expected: all desktop package and source contract tests pass.

### Task 5: Verify development startup, persistence, tests, and package generation

**Files:**
- Inspect: `electron/main.mjs`
- Inspect: `electron/preload.cjs`
- Inspect: `electron/backendRuntime.mjs`
- Inspect: `forge.config.cjs`
- Inspect: `README.md`

- [ ] **Step 1: Run the full test suite**

Run: `node --test`

Expected: exit code `0` and zero failures.

- [ ] **Step 2: Start the desktop development app**

Run: `npm run desktop:dev`

Expected: an Electron window opens, no Python server is started, backend state loads through a random localhost port, and the initial onboarding screen is visible. Stop the app and confirm the process exits without leaving the backend listening.

- [ ] **Step 3: Verify persistence through a desktop runtime smoke test**

Run: `node --test tests/game-save-store.test.js tests/backend-desktop-runtime.test.js tests/desktop-app.test.js`

Expected: save creation, reload, corrupt backup, random-port startup, idempotent shutdown, and package contracts all pass.

- [ ] **Step 4: Generate an unsigned local package**

Run: `npm run desktop:package`

Expected: Electron Forge creates a platform-specific package under `out/` without requiring the browser development servers.

- [ ] **Step 5: Review workspace and diff**

Run: `git diff --check` and `git status --short --branch`.

Expected: no whitespace errors; `.idea/` remains untracked and unstaged; only the desktop implementation, tests, docs, package metadata, and lockfile are included.
