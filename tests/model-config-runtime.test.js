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
