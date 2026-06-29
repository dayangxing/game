import test from 'node:test';
import assert from 'node:assert/strict';

import { createStoryGraph } from '../backend/src/agents/storyGraph.js';

test('story graph uses langgraph to generate narration from an injected llm', async () => {
  const graph = createStoryGraph({
    llm: {
      async generateNarration({ afterGame }) {
        return {
          title: '模型续写',
          body: `模型根据第${afterGame.turn}回合续写剧情。竹舍外雨声渐沉，雷木双息在经脉间一明一暗，陆青玄听见宗门钟声穿过云雾，知道这场闭关已经把旧日瓶颈推开一线。`,
          npcLine: '林师姐道：“此处由模型生成。”',
          foreshadow: '旧铃声在雾中回响。',
          continuityNotes: ['承认第1回合已保存。'],
          safetyFlags: []
        };
      }
    }
  });

  const result = await graph.invoke(makeGraphInput());

  assert.equal(graph.engine, 'langgraph');
  assert.equal(result.narration.status, 'generated');
  assert.equal(result.narration.title, '模型续写');
  assert.match(result.narration.body, /模型根据/);
});

test('story graph repairs invalid narration output before returning it', async () => {
  let repairInput;
  const graph = createStoryGraph({
    llm: {
      async generateNarration() {
        return {
          title: '短',
          body: '太短'
        };
      },
      async repairNarration(input) {
        repairInput = input;
        return {
          title: '修复续写',
          body: '竹舍外的雨声被宗门钟声压低，陆青玄从闭关中缓缓睁眼，丹田里的雷木双息仍旧纠缠，却比昨日更有章法。林师姐留下的旧符在案头微亮，像是在提醒他，雾隐秘境的因果尚未真正开启。',
          npcLine: '林师姐道：“稳住这一口气，别急着再冲。”',
          foreshadow: '案头旧符映出一缕青铜铃影。',
          continuityNotes: ['没有新增规则结果。'],
          safetyFlags: []
        };
      }
    }
  });

  const result = await graph.invoke(makeGraphInput());

  assert.ok(repairInput.validationErrors.some((error) => error.includes('body')));
  assert.equal(result.narration.status, 'generated');
  assert.equal(result.narration.title, '修复续写');
  assert.match(result.narration.body, /雾隐秘境/);
});

test('story graph preserves saved progress and returns retryable llm unavailable narration', async () => {
  const graph = createStoryGraph({
    llm: {
      async generateNarration() {
        throw new Error('network unavailable');
      }
    }
  });

  const result = await graph.invoke(makeGraphInput());

  assert.equal(result.narration.status, 'llm_unavailable');
  assert.equal(result.narration.savedTurn, 1);
  assert.equal(result.narration.retryable, true);
  assert.equal(result.narration.error.code, 'LLM_UNAVAILABLE');
  assert.match(result.narration.body, /已保存/);
});

function makeGraphInput() {
  return {
    beforeGame: { turn: 0, player: { name: '陆青玄' } },
    afterGame: {
      turn: 1,
      foreshadows: ['雷木伏笔仍未解开。'],
      player: { name: '陆青玄' }
    },
    action: {
      id: 'act_0_cultivation_0',
      title: '三月闭关',
      command: '闭关修炼三月，尝试突破'
    },
    ruleEntry: {
      title: '闭关试炼',
      body: '规则已经完成结算。',
      npcLine: '规则生成的旧台词不会作为最终剧情。'
    }
  };
}
