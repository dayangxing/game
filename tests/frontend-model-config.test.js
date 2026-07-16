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
