# 模型配置界面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or **superpowers:executing-plans** to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加 API 地址、API Key、主模型配置界面，并在桌面 App 首次未配置时自动弹出，保存后立即应用且跨桌面重启保留。

**Architecture:** 后端新增可校验的运行时模型配置对象和两个配置 API。配置提交后重建 Bailian-compatible client、story graph 和 story director，但不改变游戏状态；Electron 运行时把配置存入 `userData/model-config.json`，浏览器开发模式使用 localStorage 副本。前端在现有菜单中增加“模型配置”并在首次未配置时自动打开弹窗。

**Tech Stack:** 原生 HTML/CSS/ES modules、Node.js HTTP API、Node 内置测试、Electron userData JSON 存储、现有 Electron Forge。

## Global Constraints

- 只修改当前 `dev` 分支，不修改或推送 `main`。
- 首次启动且未配置 API Key 时自动弹出配置界面；“暂不配置”只跳过当前会话。
- API Key 不进入游戏存档、传记导出、游戏状态响应、模型健康响应或日志。
- 现有 `GET /api/v1/model-selection`、`GET /api/v1/model-health` 和本地 Mock 模式保持兼容。
- 不改变章节、事件、寿元、突破和移动端 UI 既有行为。
- 保留 `.idea/` 未跟踪文件，不纳入提交。

---

### Task 1: Add generic JSON config persistence

**Files:**
- Create: `backend/src/storage/jsonFileStore.js`
- Modify: `backend/src/storage/gameSaveStore.js`
- Create: `tests/json-file-store.test.js`

**Interfaces:**
- `createJsonFileStore({ filePath, fsImpl = fs })` returns `{ load, save, clear }`.
- Missing files return `null`; malformed JSON is renamed to `${filePath}.corrupt` and returns `null`.
- `save(value)` writes a sibling temporary file with mode `0o600`, then renames atomically.
- `createGameSaveStore` continues exporting the existing API by delegating to the generic store.

- [ ] **Step 1: Write the failing persistence tests**

Create `tests/json-file-store.test.js` with tests for missing file, atomic restore, malformed backup, and idempotent clear:

```js
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
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test tests/json-file-store.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `jsonFileStore.js` does not exist.

- [ ] **Step 3: Implement the generic store and preserve the game store API**

Move the existing read/backup/atomic-write behavior into `jsonFileStore.js`. Use `fsImpl.writeFileSync(tempPath, text, { encoding: 'utf8', mode: 0o600 })`. Change `gameSaveStore.js` to:

```js
import { createJsonFileStore } from './jsonFileStore.js';

export function createGameSaveStore(options = {}) {
  return createJsonFileStore(options);
}
```

- [ ] **Step 4: Run the focused tests**

Run: `node --test tests/json-file-store.test.js tests/game-save-store.test.js`

Expected: all JSON store and existing game save tests pass.

### Task 2: Make model configuration validated and dynamically applied by the backend

**Files:**
- Create: `backend/src/llm/modelConfig.js`
- Modify: `backend/src/llm/modelSelection.js`
- Modify: `backend/src/llm/bailianClient.js`
- Modify: `backend/src/app.js`
- Create: `tests/model-config-runtime.test.js`

**Interfaces:**
- `DEFAULT_MODEL_CONFIG` contains the approved default base URL and `qwen3.7-plus`.
- `normalizeModelConfig(input, current?)` returns `{ baseUrl, chatModel, apiKey }` or throws a validation error.
- `toPublicModelConfig(config)` never returns `apiKey` and returns `{ baseUrl, chatModel, configured, apiKeyMasked }`.
- `createBackendApp({ modelConfig, persistModelConfig, createLlm })` accepts an initial config and applies later config changes without replacing `state.game`.

- [ ] **Step 1: Write failing backend configuration tests**

Create `tests/model-config-runtime.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '../backend/src/app.js';
import { normalizeModelConfig, toPublicModelConfig } from '../backend/src/llm/modelConfig.js';

async function json(response) {
  return response.json();
}

test('model config normalizes defaults and masks the API key', () => {
  const config = normalizeModelConfig({ apiKey: ' secret ', chatModel: ' custom-model ' });
  const publicConfig = toPublicModelConfig(config);
  assert.equal(config.baseUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  assert.equal(config.chatModel, 'custom-model');
  assert.equal(publicConfig.configured, true);
  assert.equal(publicConfig.apiKey, undefined);
  assert.equal(publicConfig.apiKeyMasked, '••••••••');
});

test('model config rejects unsupported URLs and empty model names', () => {
  assert.throws(() => normalizeModelConfig({ baseUrl: 'file:///secret', chatModel: 'model' }), /MODEL_CONFIG_INVALID/);
  assert.throws(() => normalizeModelConfig({ baseUrl: 'https://example.test/v1', chatModel: '   ' }), /MODEL_CONFIG_INVALID/);
});

test('backend applies a config update without resetting the current game', async () => {
  const persisted = [];
  const llmInstances = [];
  const app = createBackendApp({
    seed: 123,
    modelConfig: { apiKey: 'old-key', chatModel: 'old-model' },
    createLlm: ({ config }) => {
      llmInstances.push(config);
      return { generateNarration: async () => ({ status: 'fallback', title: '', body: '', npcLine: '', foreshadow: '' }) };
    },
    persistModelConfig: (config) => persisted.push(config)
  });

  const before = await json(await app.handle(new Request('http://localhost/api/v1/game/state')));
  const updated = await app.handle(new Request('http://localhost/api/v1/model-config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'new-key',
      chatModel: 'new-model'
    })
  }));
  const payload = await json(updated);
  const after = await json(await app.handle(new Request('http://localhost/api/v1/game/state')));

  assert.equal(updated.status, 200);
  assert.equal(payload.data.modelConfig.configured, true);
  assert.equal(payload.data.modelConfig.apiKey, undefined);
  assert.equal(after.data.game.seed, before.data.game.seed);
  assert.equal(persisted[0].apiKey, 'new-key');
  assert.equal(llmInstances.at(-1).chatModel, 'new-model');
});

test('model config update with empty api key preserves the current key', async () => {
  const persisted = [];
  const app = createBackendApp({
    modelConfig: { apiKey: 'keep-me', chatModel: 'old-model' },
    persistModelConfig: (config) => persisted.push(config)
  });

  const response = await app.handle(new Request('http://localhost/api/v1/model-config', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chatModel: 'new-model' })
  }));
  assert.equal(response.status, 200);
  assert.equal(persisted.at(-1).apiKey, 'keep-me');
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --test tests/model-config-runtime.test.js`

Expected: FAIL because the config module and `/api/v1/model-config` route do not exist.

- [ ] **Step 3: Implement normalization and public serialization**

Implement `modelConfig.js` with default values, `URL` parsing limited to `http:`/`https:`, trimming, 160-character model limit, and `apiKey` preservation when the request omits it. `toPublicModelConfig` returns only the masked status.

- [ ] **Step 4: Inject config into model selection and client creation**

Update `getModelSelection(env, config)` and `resolveBailianApiKey(env, config)` so explicit runtime config wins over environment variables. Update `createBailianClient({ env, fetchImpl, config })` to use the resolved config while retaining existing defaults.

- [ ] **Step 5: Add backend routes and live client replacement**

Initialize `state.modelConfig`, `state.modelSelection`, and `state.llm` from the injected config. Add `GET /api/v1/model-config` and `POST /api/v1/model-config`. On successful POST, replace `state.llm`, recreate the story graph/director with that client, call `persistModelConfig(config)`, and return public config. Do not assign or normalize `state.game` in this path. Add `createLlm` injection for tests and preserve existing model health/selection response shapes.

- [ ] **Step 6: Run the focused tests**

Run: `node --test tests/model-config-runtime.test.js tests/model-config.test.js tests/bailian-client.test.js tests/backend-api.test.js`

Expected: all model and backend tests pass, with no raw API Key in response payloads.

### Task 3: Persist desktop model config and expose frontend API methods

**Files:**
- Modify: `electron/backendRuntime.mjs`
- Modify: `electron/main.mjs`
- Modify: `frontend/src/api/gameApi.js`
- Create: `tests/desktop-model-config.test.js`

**Interfaces:**
- `startDesktopBackend({ savePath, modelConfigPath, env })` loads and persists the separate config file.
- `createGameApi()` exposes `getModelConfig()`, `saveModelConfig(config)`, and `clearModelConfig()`.

- [ ] **Step 1: Write failing desktop persistence/API tests**

Create `tests/desktop-model-config.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('desktop backend persists model config separately from game state', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wendao-model-config-'));
  const savePath = path.join(dir, 'save.json');
  const modelConfigPath = path.join(dir, 'model-config.json');
  try {
    const { startDesktopBackend } = await import('../electron/backendRuntime.mjs');
    const first = await startDesktopBackend({ savePath, modelConfigPath });
    const response = await fetch(`${first.baseUrl}/api/v1/model-config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        baseUrl: 'https://api.example.test/v1',
        apiKey: 'secret-key',
        chatModel: 'model-a'
      })
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.modelConfig.apiKey, undefined);
    await first.stop();

    const second = await startDesktopBackend({ savePath, modelConfigPath });
    try {
      const configResponse = await fetch(`${second.baseUrl}/api/v1/model-config`);
      const configPayload = await configResponse.json();
      const gameResponse = await fetch(`${second.baseUrl}/api/v1/game/state`);
      const gamePayload = await gameResponse.json();
      assert.equal(configPayload.data.modelConfig.chatModel, 'model-a');
      assert.equal(configPayload.data.modelConfig.configured, true);
      assert.doesNotMatch(JSON.stringify(gamePayload), /secret-key/);
      assert.equal(fs.existsSync(modelConfigPath), true);
      assert.equal(fs.existsSync(savePath), false);
    } finally {
      await second.stop();
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('frontend game api exposes model config methods', () => {
  const source = fs.readFileSync('frontend/src/api/gameApi.js', 'utf8');
  assert.match(source, /getModelConfig/);
  assert.match(source, /saveModelConfig/);
  assert.match(source, /clearModelConfig/);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --test tests/desktop-model-config.test.js`

Expected: FAIL because the runtime option and API methods do not exist.

- [ ] **Step 3: Load and save the separate desktop config file**

In `backendRuntime.mjs`, derive `modelConfigPath` from the user-data save directory when omitted, load it before `createBackendApp`, pass `modelConfig` and `persistModelConfig`, and keep the game save path separate. The main process needs no new IPC because the renderer already talks to the local backend; keep `preload.cjs` limited to its existing two runtime values.

- [ ] **Step 4: Add frontend API methods**

Implement the three methods through existing `requestJson` with the paths and HTTP methods above. `clearModelConfig()` sends `{ clearApiKey: true }` and keeps the default base URL/model.

- [ ] **Step 5: Run the focused tests**

Run: `node --test tests/desktop-model-config.test.js tests/desktop-app.test.js`

Expected: all desktop persistence and API contract tests pass.

### Task 4: Build the first-open configuration modal and responsive styling

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/app.js`
- Modify: `frontend/src/styles.css`
- Create: `frontend/src/ui/modelConfig.js`
- Create: `tests/frontend-model-config.test.js`

**Interfaces:**
- `#modelConfigBtn` opens the modal from the utility menu.
- `#modelConfigOverlay` contains `#modelBaseUrlInput`, `#modelApiKeyInput`, `#modelNameInput`, `#saveModelConfigBtn`, `#clearModelConfigBtn`, and `#skipModelConfigBtn`.
- `shouldPromptModelConfig(config, sessionStorage)` opens only when the public config is unconfigured and the current session has not skipped it.

- [ ] **Step 1: Write failing frontend source and behavior tests**

Create `tests/frontend-model-config.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { shouldPromptModelConfig } from '../frontend/src/ui/modelConfig.js';

test('model config modal exposes fields and safe player-facing copy', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  assert.match(html, /id="modelConfigBtn"/);
  assert.match(html, /id="modelConfigOverlay"/);
  assert.match(html, /id="modelBaseUrlInput"/);
  assert.match(html, /id="modelApiKeyInput"[^>]*type="password"/);
  assert.match(html, /id="modelNameInput"/);
  assert.match(html, /id="saveModelConfigBtn"/);
  assert.match(html, /id="clearModelConfigBtn"/);
  assert.match(html, /id="skipModelConfigBtn"/);
  assert.match(source, /getModelConfig/);
  assert.match(source, /saveModelConfig/);
  assert.match(source, /shouldPromptModelConfig/);
  assert.doesNotMatch(html, /value="[^"]*sk-[^"]*"/i);
});

test('model config prompt opens only for unconfigured fresh sessions', () => {
  const freshSession = { getItem: () => null };
  const skippedSession = {
    getItem: (key) => key === 'wendao-model-config-skipped-v1' ? '1' : null
  };
  assert.equal(shouldPromptModelConfig({ configured: false }, freshSession), true);
  assert.equal(shouldPromptModelConfig({ configured: true }, freshSession), false);
  assert.equal(shouldPromptModelConfig({ configured: false }, skippedSession), false);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `node --test tests/frontend-model-config.test.js`

Expected: FAIL because the modal, helper, and event wiring do not exist.

- [ ] **Step 3: Add modal markup and accessible responsive styles**

Add a dialog overlay matching the existing guide modal, with labels, password autocomplete disabled, masked-key hint, inline status text, and mobile-safe one-column layout. Keep the modal usable at the existing desktop/tablet/mobile breakpoints.

- [ ] **Step 4: Load, save, apply, clear, and skip configuration**

After API creation, load public config and, in browser mode only, re-submit a localStorage config before normal game actions. Add menu and modal event handlers. On save, send trimmed values, store the browser copy only outside desktop, update status, and close on success. On clear, clear browser storage and send `clearApiKey`. On skip, set a session-only key and close. After the initial render, call the prompt helper; do not block game loading when the backend is unavailable.

- [ ] **Step 5: Run focused frontend tests**

Run: `node --test tests/frontend-model-config.test.js tests/frontend-app-wiring.test.js tests/frontend-layout.test.js`

Expected: all configuration modal and existing utility-menu tests pass.

### Task 5: Verify, document, and commit

**Files:**
- Modify: `README.md`
- Inspect: `backend/src/llm/modelConfig.js`, `electron/backendRuntime.mjs`, `frontend/src/app.js`, `frontend/src/styles.css`

- [ ] **Step 1: Document first-open behavior and configuration location**

Document the model configuration menu, first-open prompt, supported OpenAI-compatible endpoint shape, desktop config file separation from game saves, and the warning that API Key is not included in installers.

- [ ] **Step 2: Run the complete test suite**

Run: `node --test`

Expected: exit code `0` with all existing and new tests passing.

- [ ] **Step 3: Run whitespace and status checks**

Run: `git diff --check` and `git status --short --branch`.

Expected: no whitespace errors; `.idea/` remains untracked and unstaged.

- [ ] **Step 4: Commit the feature on dev**

```bash
git add README.md backend/src/app.js backend/src/llm/bailianClient.js backend/src/llm/modelConfig.js backend/src/llm/modelSelection.js backend/src/storage/gameSaveStore.js backend/src/storage/jsonFileStore.js electron/backendRuntime.mjs frontend/index.html frontend/src/api/gameApi.js frontend/src/app.js frontend/src/styles.css frontend/src/ui/modelConfig.js tests/desktop-model-config.test.js tests/frontend-model-config.test.js tests/json-file-store.test.js tests/model-config-runtime.test.js
git commit -m "feat: add model configuration screen"
```
