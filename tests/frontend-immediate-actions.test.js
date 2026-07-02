import test from 'node:test';
import assert from 'node:assert/strict';

import { createGameApi } from '../frontend/src/api/gameApi.js';
import { createImmediateViewActions } from '../frontend/src/ui/immediateViewActions.js';
import { getView } from '../frontend/src/ui/views.js';

test('immediate view actions keep tab navigation usable before backend actions return', async () => {
  const api = createGameApi({ seed: 13 });
  const game = await api.createGame('mock');
  const actions = createImmediateViewActions(game, getView('skills'));

  assert.equal(actions.length, 3);
  assert.ok(actions.every((action) => action.id.startsWith('skills-immediate-')));
  assert.ok(actions.some((action) => action.command.includes('青木诀')));
  assert.ok(actions.every((action) => action.source === 'immediate'));
  assert.ok(actions.every((action) => action.storyHook.includes('当前界面：命簿')));
  assert.equal(actions[0].llmRequest.task, 'daily_action_generation');
  assert.equal(actions[0].llmRequest.context.view.id, 'skills');
});
