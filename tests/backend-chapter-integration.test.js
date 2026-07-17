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

test('final choice resolves an ending and blocks subsequent actions', async () => {
  const app = createBackendApp({
    seed: 31,
    now: () => new Date('2026-07-15T00:00:00.000Z'),
    llm: {
      async generateNarration() {
        return { status: 'generated', title: '终局', body: '天门应声而裂。', npcLine: '', foreshadow: '' };
      }
    }
  });
  const state = app.getState();
  state.game = {
    ...state.game,
    onboarding: { completed: true },
    turn: 0,
    version: 0,
    storyProgress: {
      chapterId: 'finale', chapterIndex: 6, status: 'active', completedObjectiveIds: ['finale_stance'],
      truthFlags: ['lifespan_mark', 'mist_archive', 'bronze_bell', 'heaven_gate_key'],
      sectPath: 'truth', contractStance: 'reject', finalChoiceMade: true, endingId: null
    },
    flags: { heaven_gate_key: true },
    player: { ...state.game.player, realm: '金丹后期', cultivationProgress: 0 }
  };
  state.pendingActions.set('act_finale', {
    id: 'act_finale', title: '终局抉择', command: '继续', source: 'mock', turn: 0,
    expiresAt: '2026-07-16T00:00:00.000Z', consumed: false
  });

  const response = await app.handle(new Request('http://localhost/api/v1/turns', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actionId: 'act_finale', clientTurn: 0 })
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.data.game.ending.id, 'break_contract');
  assert.equal(payload.data.game.storyProgress.status, 'ended');
  assert.equal(payload.data.turnResult.ending.id, 'break_contract');

  const blocked = await app.handle(new Request('http://localhost/api/v1/daily-actions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ viewId: 'home', gameVersion: 1 })
  }));
  const blockedPayload = await blocked.json();
  assert.equal(blocked.status, 409);
  assert.equal(blockedPayload.error.code, 'GAME_ENDED');
});
