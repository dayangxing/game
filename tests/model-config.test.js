import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { createBackendApp } from '../backend/src/app.js';
import { loadLocalEnv } from '../backend/src/config/env.js';

test('local env loader reads .env fallback and lets .env.local override it', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'wendao-env-'));
  const env = {};

  fs.writeFileSync(path.join(cwd, '.env'), [
    'BAILIAN_API_KEY=from-env',
    'BAILIAN_CHAT_MODEL=qwen-fallback',
    'IGNORED_EMPTY=',
    '# comment'
  ].join('\n'));
  fs.writeFileSync(path.join(cwd, '.env.local'), [
    'BAILIAN_API_KEY="from-local"',
    'BAILIAN_FAST_MODEL=qwen-fast-local'
  ].join('\n'));

  const result = loadLocalEnv({ cwd, env });

  assert.deepEqual(result.loadedFiles, ['.env', '.env.local']);
  assert.equal(env.BAILIAN_API_KEY, 'from-local');
  assert.equal(env.BAILIAN_CHAT_MODEL, 'qwen-fallback');
  assert.equal(env.BAILIAN_FAST_MODEL, 'qwen-fast-local');
  assert.equal(env.IGNORED_EMPTY, '');
});

test('git ignores local model env files', () => {
  const output = execFileSync('git', ['check-ignore', '.env.local', '.env'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });

  assert.deepEqual(output.trim().split('\n'), ['.env.local', '.env']);
});

test('model health reports configuration without exposing secrets', async () => {
  const secret = 'unit-test-secret';
  const app = createBackendApp({
    env: {
      BAILIAN_API_KEY: secret,
      BAILIAN_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      BAILIAN_CHAT_MODEL: 'qwen3.7-plus'
    }
  });

  const response = await app.handle(new Request('http://127.0.0.1:8787/api/v1/model-health'));
  const payload = await response.json();
  const serialized = JSON.stringify(payload);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.data.modelHealth.status, 'configured');
  assert.equal(payload.data.modelHealth.hasApiKey, true);
  assert.equal(payload.data.modelHealth.baseUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  assert.equal(payload.data.modelHealth.apiKey, undefined);
  assert.equal(serialized.includes(secret), false);
});
