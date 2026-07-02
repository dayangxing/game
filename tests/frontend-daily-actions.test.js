import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createGameApi } from '../frontend/src/api/gameApi.js';
import { getView } from '../frontend/src/ui/views.js';

test('frontend page does not expose a free text command input', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');

  assert.equal(html.includes('id="commandInput"'), false);
  assert.equal(html.includes('id="commandForm"'), false);
  assert.equal(html.includes('id="activeViewContent"'), true);
  assert.equal(html.includes('id="actionGrid"'), false);
});

test('daily action api returns structured options for future AI generation', async () => {
  const api = createGameApi({ seed: 9 });
  const game = await api.createGame();
  const actions = await api.getDailyActions(game, getView('cultivation'));

  assert.ok(actions.length >= 3);
  assert.ok(actions.every((action) => action.id));
  assert.ok(actions.every((action) => action.command));
  assert.ok(actions.every((action) => action.storyHook));
  assert.ok(actions.every((action) => action.llmRequest?.task === 'daily_action_generation'));
  assert.ok(actions.some((action) => action.command.includes('闭关')));
});

test('daily action options can advance the game through the api', async () => {
  const api = createGameApi({ seed: 9 });
  const game = await api.createGame();
  const [action] = await api.getDailyActions(game, getView('realm'));
  const next = await api.submitDailyAction(game, action);

  assert.equal(next.turn, 1);
  assert.match(next.log.at(-1).command, /后山|秘境|巡山/);
});
