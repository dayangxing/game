import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '../backend/src/app.js';

test('formal action response includes authoritative chapter transition', async () => {
  const app = createBackendApp({
    seed: 31,
    now: () => new Date('2026-07-15T00:00:00.000Z'),
    llm: {
      async generateNarration() {
        return {
          status: 'generated',
          title: '新章初见',
          body: '旧章落幕，新章启封。',
          npcLine: '',
          foreshadow: ''
        };
      }
    }
  });

  const state = app.getState();
  state.game = {
    ...state.game,
    onboarding: { completed: true },
    turn: 0,
    version: 0,
    chapterHistory: [],
    storyProgress: {
      chapterId: 'qi', chapterIndex: 1, status: 'active', completedObjectiveIds: [],
      truthFlags: ['lifespan_mark'], sectPath: null, contractStance: null,
      finalChoiceMade: false, endingId: null
    },
    flags: { lifespan_mark: true },
    player: { ...state.game.player, realm: '炼气九层', cultivationProgress: 0 },
    npcs: state.game.npcs.map((npc) => npc.name === '林师姐' ? { ...npc, affinity: 14 } : npc)
  };
  state.pendingActions.set('act_test', {
    id: 'act_test',
    title: '回合测试',
    command: '与林师姐交流',
    source: 'mock',
    turn: 0,
    expiresAt: '2026-07-16T00:00:00.000Z',
    consumed: false
  });

  const response = await app.handle(new Request('http://localhost/api/v1/turns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId: 'act_test', clientTurn: 0 })
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.game.chapter.id, 'foundation');
  assert.equal(payload.data.turnResult.chapterTransition.toChapterId, 'foundation');
  assert.equal(payload.data.game.storyProgress.chapterId, 'foundation');
});
