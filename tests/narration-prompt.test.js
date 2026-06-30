import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNarrationMessages,
  buildRepairNarrationMessages
} from '../backend/src/llm/prompts/narrationPrompt.js';

test('narration prompt contains detailed role, boundaries, style, and json schema', () => {
  const messages = buildNarrationMessages(makePromptInput());
  const system = messages.find((message) => message.role === 'system').content;
  const user = JSON.parse(messages.find((message) => message.role === 'user').content);

  assert.match(system, /剧情叙事 agent/);
  assert.match(system, /绝对禁止/);
  assert.match(system, /afterGame 中不存在的结果一律不得补写/);
  assert.match(system, /暗色水墨修仙/);
  assert.match(system, /160 到 260 个汉字/);
  assert.match(system, /输出 JSON schema/);
  assert.match(system, /continuityNotes/);
  assert.match(system, /safetyFlags/);

  assert.equal(user.task, 'narrative_polish');
  assert.match(user.instruction, /只能润色已结算结果/);
  assert.equal(user.action.title, '三月闭关');
  assert.equal(user.ruleDelta.qi, 11);
  assert.equal(user.ruleDelta.spiritStones, -4);
  assert.equal(user.npcVoiceGuide[0].name, '林师姐');
  assert.ok(user.hardConstraints.some((constraint) => constraint.includes('不得新增')));
});

test('narration prompt forbids changing event rule effects', () => {
  const messages = buildNarrationMessages(makePromptInput());
  const system = messages.find((message) => message.role === 'system').content;
  const user = JSON.parse(messages.find((message) => message.role === 'user').content);

  assert.match(system, /不得新增奖励/);
  assert.match(system, /不得新增.*flag/);
  assert.match(system, /eventId/);
  assert.match(system, /choiceId/);
  assert.match(system, /只能润色已结算结果/);

  assert.equal(user.action.eventId, 'mist_bronze_bell');
  assert.equal(user.action.choiceId, 'approach');
});

test('repair prompt asks the model to only repair invalid json output', () => {
  const messages = buildRepairNarrationMessages({
    validationErrors: ['body too short', 'missing npcLine'],
    rawNarration: { title: '短' },
    afterGame: makePromptInput().afterGame
  });
  const system = messages.find((message) => message.role === 'system').content;
  const user = JSON.parse(messages.find((message) => message.role === 'user').content);

  assert.match(system, /只修复 JSON/);
  assert.match(system, /不要解释/);
  assert.match(system, /只能润色已结算结果/);
  assert.match(system, /flag/);
  assert.match(system, /futureEvent/);
  assert.match(system, /成功失败/);
  assert.deepEqual(user.validationErrors, ['body too short', 'missing npcLine']);
  assert.equal(user.rawNarration.title, '短');
  assert.equal(user.afterGame.turn, 1);
});

function makePromptInput() {
  return {
    action: {
      id: 'act_0_cultivation_0',
      eventId: 'mist_bronze_bell',
      choiceId: 'approach',
      title: '三月闭关',
      command: '闭关修炼三月，尝试突破',
      risk: 'medium'
    },
    beforeGame: {
      turn: 0,
      calendar: { year: 3, season: '春', month: 1 },
      player: {
        name: '陆青玄',
        realm: '炼气七层',
        qi: 74,
        mood: 68,
        cultivationProgress: 42,
        spiritStones: 126,
        sectRelation: 32,
        location: '青云宗外门'
      },
      npcs: [
        {
          name: '林师姐',
          role: '内门弟子',
          affinity: 34,
          tone: '温和而谨慎',
          memories: ['记得陆青玄曾在雨夜替她守过药田。']
        }
      ],
      worldEvents: [{ title: '青云宗春试将近', detail: '外门弟子都在准备争夺内门名额。', turn: 0 }],
      foreshadows: ['雷木双灵根可能引来异常天劫。']
    },
    afterGame: {
      turn: 1,
      calendar: { year: 3, season: '春', month: 2 },
      player: {
        name: '陆青玄',
        realm: '炼气七层',
        qi: 85,
        mood: 71,
        cultivationProgress: 58,
        spiritStones: 122,
        sectRelation: 33,
        location: '青云宗外门'
      },
      npcs: [
        {
          name: '林师姐',
          role: '内门弟子',
          affinity: 36,
          tone: '温和而谨慎',
          memories: ['见证陆青玄闭关后气息更趋凝实。']
        }
      ],
      worldEvents: [{ title: '坊市拍卖预告', detail: '一枚雷纹筑基丹将在月末拍卖。', turn: 1 }],
      foreshadows: ['若陆青玄强行突破，雷木双息可能产生反噬。']
    },
    ruleEntry: {
      title: '闭关试炼',
      command: '闭关修炼三月，尝试突破',
      body: '规则已经完成结算。',
      npcLine: '林师姐提醒他稳住雷息。',
      worldEvent: '坊市拍卖预告'
    }
  };
}
