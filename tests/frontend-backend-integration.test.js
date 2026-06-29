import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '../backend/src/app.js';
import { createGameApi } from '../frontend/src/api/gameApi.js';
import { getView } from '../frontend/src/ui/views.js';

test('frontend api client plays one turn through the backend contract', async () => {
  const backend = createBackendApp({
    seed: 41,
    now: () => new Date('2026-06-29T08:00:00.000Z'),
    llm: {
      async generateNarration({ afterGame, action }) {
        return {
          status: 'generated',
          title: '联调续写',
          body: `前端通过后端提交${action.title}，第${afterGame.turn}回合已由服务端结算。`,
          npcLine: '林师姐道：“这一次是后端传回来的消息。”',
          foreshadow: '青铜铃在后端日志中轻轻一响。'
        };
      }
    }
  });
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: (input, init) => backend.handle(new Request(input, init))
  });

  const game = await api.createGame();
  const actions = await api.getDailyActions(game, getView('cultivation'));
  const next = await api.submitDailyAction(game, actions[0]);
  const story = await api.exportStory(next);

  assert.equal(game.mode, 'api');
  assert.equal(actions.length, 4);
  assert.ok(actions.every((action) => action.id.startsWith('act_')));
  assert.equal(next.turn, 1);
  assert.equal(next.mode, 'api');
  assert.match(next.log.at(-1).body, /服务端结算/);
  assert.match(story, /问道浮生/);
});
