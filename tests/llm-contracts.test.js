import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDailyActionsRequest,
  buildNarrationRequest,
  deterministicResponsibilities,
  llmResponsibilities,
  llmResponseSchemas
} from '../frontend/src/ai/llmContracts.js';
import { createGameApi } from '../frontend/src/api/gameApi.js';
import { getView } from '../frontend/src/ui/views.js';

test('llm and deterministic responsibilities are explicitly separated', () => {
  assert.ok(deterministicResponsibilities.includes('player_stats'));
  assert.ok(deterministicResponsibilities.includes('rule_resolution'));
  assert.ok(deterministicResponsibilities.includes('content_safety_gate'));
  assert.ok(llmResponsibilities.includes('daily_action_generation'));
  assert.ok(llmResponsibilities.includes('narrative_polish'));
  assert.ok(llmResponsibilities.includes('npc_voice'));
});

test('daily action request includes compact game context and schema name', async () => {
  const api = createGameApi({ seed: 5 });
  const game = await api.createGame();
  const request = buildDailyActionsRequest(game, getView('realm'));

  assert.equal(request.task, 'daily_action_generation');
  assert.equal(request.schema, llmResponseSchemas.dailyActions.name);
  assert.equal(request.context.player.realm, '炼气七层');
  assert.equal(request.context.view.id, 'realm');
  assert.ok(request.constraints.some((item) => item.includes('不得直接修改数值')));
});

test('narration request includes resolved rule result instead of asking llm to decide rules', async () => {
  const api = createGameApi({ seed: 5 });
  const game = await api.createGame();
  const [action] = await api.getDailyActions(game, getView('cultivation'));
  const next = await api.submitDailyAction(game, action);
  const request = buildNarrationRequest(game, next, action);

  assert.equal(request.task, 'narrative_polish');
  assert.equal(request.schema, llmResponseSchemas.narration.name);
  assert.equal(request.context.before.turn, 0);
  assert.equal(request.context.after.turn, 1);
  assert.equal(request.context.action.id, action.id);
  assert.ok(request.constraints.some((item) => item.includes('不得改写规则结算结果')));
});
