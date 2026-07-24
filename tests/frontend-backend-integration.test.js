import test from 'node:test';
import assert from 'node:assert/strict';

import { createBackendApp } from '../backend/src/app.js';
import { createGameApi } from '../frontend/src/api/gameApi.js';
import { createImmediateViewActions } from '../frontend/src/ui/immediateViewActions.js';
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
  backend.getState().game.onboarding = completedOnboardingState();
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

test('frontend api streams the formal turn-zero scene before exposing its daily choices', async () => {
  const backend = createBackendApp({
    seed: 41,
    now: () => new Date('2026-06-29T08:00:00.000Z'),
    llm: {
      async *streamStoryDirector() {
        yield '{"scene":"第0回合先到达前端的流式场景：山门钟声贴着晨雾落下。","mode":"choice","npcLines":[],"effectHints":[],"choices":[';
        yield '{"id":"enter","title":"入门","text":"沿山道走入外门","tone":"cautious","effectHints":[]},{"id":"ask","title":"问询","text":"先向玄衡长老问询","tone":"sect","effectHints":[]}],"memoryHints":[]}';
      }
    }
  });
  backend.getState().game.onboarding = completedOnboardingState();
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: (input, init) => backend.handle(new Request(input, init))
  });

  const game = await api.createFormalGame({ name: '顾清河', rerollSeed: 52 });
  const previews = [];
  const result = await api.getDailyActionsStreamWithState(game, getView('home'), {
    onStoryPreview(preview) {
      previews.push(preview);
    }
  });

  assert.equal(result.game.turn, 0);
  assert.ok(previews.some((preview) => preview.includes('第0回合先到达前端')));
  assert.match(result.game.log[0].body, /第0回合先到达前端/);
  assert.deepEqual(result.actions.map((action) => action.command), [
    '沿山道走入外门',
    '先向玄衡长老问询'
  ]);
});

test('frontend api client receives streamed narration before the final game result', async () => {
  const streamedChunks = [
    '{"title":"前端流式续写","body":"',
    '前端先接到第一段洞府雨声，看到历史行为里临时浮出一张正在续写的命簿。随后第二段文字抵达，角色的寿元消耗、修为变化和青云宗声望仍然由后端规则结算，模型只负责把这一回合写成顺滑的叙事。',
    '","npcLine":"林师姐道：\\"流式到了，就不用干等整段了。\\"","foreshadow":"雾隐秘境的钟声压在流光之后。","continuityNotes":[],"safetyFlags":[]}'
  ];
  const backend = createBackendApp({
    seed: 41,
    now: () => new Date('2026-06-29T08:00:00.000Z'),
    llm: {
      async *streamNarration() {
        for (const chunk of streamedChunks) {
          yield chunk;
        }
      }
    }
  });
  backend.getState().game.onboarding = completedOnboardingState();
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: (input, init) => backend.handle(new Request(input, init))
  });

  const game = await api.createGame();
  const actions = await api.getDailyActions(game, getView('cultivation'));
  const deltas = [];
  const previews = [];
  const next = await api.submitDailyActionStream(game, actions[0], {
    onNarrationDelta(delta, raw) {
      deltas.push({ delta, raw });
    },
    onNarrationPreview(preview) {
      previews.push(preview);
    }
  });

  assert.equal(next.turn, 1);
  assert.equal(next.mode, 'api');
  assert.ok(deltas.length >= 2);
  assert.ok(deltas[0].raw.includes('前端流式续写'));
  assert.ok(previews.some((preview) => preview.includes('历史行为里临时浮出')));
  assert.match(next.log.at(-1).title, /前端流式续写/);
});

test('frontend api client continues story and submits a generated director choice', async () => {
  const outputs = [
    {
      scene: '雾隐钟声贴着洞府窗棂滑过，顾清河意识到这不是寻常夜风。',
      mode: 'choice',
      npcLines: [],
      effectHints: [],
      choices: [
        {
          id: 'follow_mist',
          text: '循着钟声去后山',
          tone: 'explore',
          effectHints: [{ target: 'lifespan', direction: 'down', intensity: 'small' }]
        },
        {
          id: 'stay',
          text: '暂且守住洞府',
          tone: 'cautious',
          effectHints: [{ target: 'mood', direction: 'up', intensity: 'tiny' }]
        }
      ],
      memoryHints: ['雾隐钟声贴近洞府。']
    },
    {
      scene: '顾清河踏入后山雾线，草叶上的露光显出残缺符纹。',
      mode: 'continue',
      npcLines: [],
      effectHints: [{ target: 'foreshadow', direction: 'advance', intensity: 'small', topic: '雾隐秘境' }],
      choices: [],
      memoryHints: ['后山符纹与雾隐秘境相连。']
    }
  ];
  const backend = createBackendApp({
    seed: 45,
    now: () => new Date('2026-06-29T08:00:00.000Z'),
    llm: {
      async generateStoryDirector() {
        return outputs.shift();
      }
    }
  });
  backend.getState().game.onboarding = completedOnboardingState();
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: (input, init) => backend.handle(new Request(input, init))
  });

  const game = await api.createGame();
  const first = await api.continueStoryStream(game);
  const [choice] = first.turnResult.choices;
  const second = await api.chooseStoryStream(first.game, choice);

  assert.equal(first.game.turn, 1);
  assert.equal(first.turnResult.mode, 'choice');
  assert.deepEqual(choice, {
    id: choice.id,
    text: '循着钟声去后山'
  });
  assert.equal('effectHints' in choice, false);
  assert.equal(second.game.turn, 2);
  assert.match(second.game.log.at(-1).body, /后山雾线/);
  assert.ok(second.game.karma.futureEventFlags.includes('director_mist_thread'));
});

test('frontend api client rejects provisional immediate actions while backend refresh is pending', async () => {
  const backend = createBackendApp({
    seed: 43,
    now: () => new Date('2026-06-29T08:00:00.000Z'),
    llm: {
      async generateNarration({ afterGame, action }) {
        return {
          status: 'generated',
          title: '即时行动联调',
          body: `即时行动已兑换为后端行动${action.id}，第${afterGame.turn}回合由服务端结算。`,
          npcLine: '林师姐道：“临时选项也要走宗门文书。”',
          foreshadow: '功法阁旧册边缘出现青色焦痕。'
        };
      }
    }
  });
  backend.getState().game.onboarding = completedOnboardingState();
  backend.getState().game.cooldowns = {
    ...backend.getState().game.cooldowns,
    master_guidance: backend.getState().game.turn
  };
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: (input, init) => backend.handle(new Request(input, init))
  });

  const game = await api.createGame();
  const [immediateAction] = createImmediateViewActions(game, getView('skills'));
  await assert.rejects(() => api.submitDailyAction(game, immediateAction), (error) => {
    assert.equal(error.name, 'BackendApiError');
    assert.equal(error.details.code, 'ACTION_REFRESH_PENDING');
    assert.match(error.message, /行动尚在刷新/);
    return true;
  });
});

function completedOnboardingState() {
  return {
    completed: true,
    stepId: 'formal_life',
    completedStepIds: ['awakening', 'breathing', 'sect_contact', 'alchemy_trial', 'mist_bell', 'karma_choice', 'heaven_contract', 'formal_life'],
    unlockedCharacterCreation: true
  };
}
