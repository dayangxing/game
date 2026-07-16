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
