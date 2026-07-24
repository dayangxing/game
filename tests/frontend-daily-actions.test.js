import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createGameApi } from '../frontend/src/api/gameApi.js';
import { getView } from '../frontend/src/ui/views.js';
import { buildStoryChoiceActions } from '../frontend/src/lib/utils/helpers.js';

test('frontend page does not expose a free text command input', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');
  const actionPanel = fs.readFileSync('frontend/src/components/ActionPanel.svelte', 'utf8');

  assert.equal(html.includes('id="commandInput"'), false);
  assert.equal(html.includes('id="commandForm"'), false);
  assert.equal(html.includes('id="app"'), true);
  assert.match(actionPanel, /class="action-grid"/);
  assert.doesNotMatch(actionPanel, /commandInput|commandForm/);
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

test('story director choices become distinct frontend action cards for the next step', () => {
  const actions = buildStoryChoiceActions([
    { id: 'choice_1', text: '沿着符纹进入雾隐秘境' },
    { id: 'choice_2', text: '先在石门外刻下回返记号' }
  ]);

  assert.deepEqual(actions.map((action) => action.title), ['抉择 1', '抉择 2']);
  assert.deepEqual(actions.map((action) => action.command), [
    '沿着符纹进入雾隐秘境',
    '先在石门外刻下回返记号'
  ]);
  assert.ok(actions.every((action) => action.source === 'story-choice'));
});

test('Svelte daily action submission is locked until the streamed result refreshes actions', () => {
  const source = fs.readFileSync('frontend/src/lib/stores/gameStore.svelte.js', 'utf8');

  assert.match(source, /let _dailyActionPending = \$state\(false\);/);
  assert.match(source, /if \(_dailyActionPending\) \{/);
  assert.match(source, /_dailyActionPending = true;/);
  assert.match(source, /_dailyActionPending = false;/);
});
