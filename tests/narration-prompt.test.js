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
  assert.match(system, /只有.*现有 NPC.*相关.*npcLine/s);
  assert.match(system, /不涉及.*NPC.*空字符串/s);

  assert.equal(user.task, 'narrative_polish');
  assert.match(user.instruction, /只能润色已结算结果/);
  assert.equal(user.action.title, '三月闭关');
  assert.equal(user.ruleDelta.qi, 11);
  assert.equal(user.ruleDelta.spiritStones, -4);
  assert.equal(user.npcVoiceGuide[0].name, '林师姐');
  assert.ok(user.hardConstraints.some((constraint) => constraint.includes('不得新增')));
  assert.ok(user.hardConstraints.some((constraint) => constraint.includes('不涉及 NPC') && constraint.includes('空字符串')));
  assert.match(system, /剧情摘要|近期回合|未解伏笔/);
});

test('narration prompt includes compact deterministic state for attributes, vitality, collections, and breakthrough context', () => {
  const messages = buildNarrationMessages(makePromptInput());
  const user = JSON.parse(messages.find((message) => message.role === 'user').content);

  assert.deepEqual(user.beforeGame.character.attributes, {
    rootBone: 6,
    comprehension: 7,
    fortune: 4,
    willpower: 5,
    lifeSeed: 3
  });
  assert.equal(user.afterGame.player.health, 121);
  assert.equal(user.afterGame.player.maxHealth, 134);
  assert.equal(user.afterGame.player.lifespan, 88);
  assert.equal(user.afterGame.player.maxLifespan, 96);
  assert.deepEqual(user.afterGame.treasures, [
    {
      name: '静心莲香',
      rarity: '良品',
      description: '点燃后可令识海宁静，突破时更易定神。',
      bonuses: { breakthroughChance: 3 }
    }
  ]);
  assert.deepEqual(user.afterGame.techniques, [
    {
      name: '青木诀',
      grade: '凡品',
      type: '心法',
      level: 1,
      description: '以木息滋养经脉。',
      bonuses: { cultivationGain: 6, maxHealth: 6 }
    }
  ]);
  assert.equal('id' in user.afterGame.treasures[0], false);
  assert.equal('id' in user.afterGame.techniques[0], false);
  assert.deepEqual(user.action.breakthrough, {
    targetRealm: '炼气八层',
    successChance: 72,
    failureConsequence: { healthLoss: 18, lifespanLoss: 1, progressLoss: 40 }
  });
  assert.deepEqual(user.narrativeContext.storyMemory, {
    longSummary: '陆青玄在青云宗外门稳住雷木双息，雾隐秘境与飞升传闻仍未解释。',
    recentTurns: [
      {
        turn: 1,
        title: '闭关试炼',
        action: '闭关修炼三月，尝试突破',
        outcome: '规则已经完成结算。',
        npcLine: '林师姐提醒他稳住雷息。',
        worldEvent: '坊市拍卖预告',
        statDelta: { qi: 11, lifespan: -2 }
      }
    ],
    openThreads: [
      {
        title: '飞升骗局伏笔',
        detail: '宗门典籍对飞升的记载前后矛盾。',
        status: '未解'
      }
    ],
    resolvedThreads: [],
    characterNotes: [
      {
        name: '林师姐',
        role: '内门弟子',
        affinity: 36,
        tone: '温和而谨慎',
        memories: ['见证陆青玄闭关后气息更趋凝实。']
      }
    ],
    lastUpdatedTurn: 1
  });
  assert.deepEqual(user.ruleEntry.breakthrough, {
    succeeded: false,
    targetRealm: '炼气八层',
    successChance: 72
  });
  assert.equal(user.ruleDelta.health, -13);
  assert.equal(user.ruleDelta.lifespan, -2);
});

test('narration prompt forbids changing event rule effects', () => {
  const messages = buildNarrationMessages(makePromptInput());
  const system = messages.find((message) => message.role === 'system').content;
  const user = JSON.parse(messages.find((message) => message.role === 'user').content);
  const payload = JSON.stringify(user);

  assert.match(system, /不得新增奖励/);
  assert.match(system, /不得改写.*treasure|treasure.*不得改写|不得增删.*法宝|行囊/);
  assert.match(system, /technique|功法/);
  assert.match(system, /attributes|属性|灵根/);
  assert.match(system, /health|气血/);
  assert.match(system, /maxLifespan|寿元上限/);
  assert.match(system, /突破.*成功失败|成功失败.*突破/);
  assert.match(system, /不得新增.*flag/);
  assert.doesNotMatch(system, /eventId|choiceId|breakthroughPreview|breakthroughResult/);
  assert.match(system, /只能润色已结算结果/);

  assert.deepEqual(user.action.settledContext, {
    isResolved: true,
    kind: '突破尝试'
  });
  assert.doesNotMatch(payload, /eventId|choiceId|act_0_cultivation_0|mist_bronze_bell|approach|medium|breakthroughPreview|breakthroughResult/);
  assert.doesNotMatch(payload, /raw_story_memory_id|internal_thread_id/);
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
  assert.match(system, /attributes|属性|灵根/);
  assert.match(system, /health|气血/);
  assert.match(system, /maxLifespan|寿元上限/);
  assert.match(system, /treasures|法宝|行囊/);
  assert.match(system, /techniques|功法/);
  assert.match(system, /破境预览|突破预览/);
  assert.match(system, /突破结果|突破.*成功失败|成功失败.*突破/);
  assert.match(system, /成功失败/);
  assert.match(system, /不涉及.*NPC.*空字符串/s);
  assert.deepEqual(user.validationErrors, ['body too short', 'missing npcLine']);
  assert.equal(user.rawNarration.title, '短');
  assert.equal(user.afterGame.turn, 1);
  assert.match(user.requiredSchema.npcLine, /不涉及.*NPC.*空字符串/s);
});

function makePromptInput() {
  return {
    beforeGame: {
      turn: 0,
      calendar: { year: 3, season: '春', month: 1 },
      character: {
        attributes: {
          rootBone: 6,
          comprehension: 7,
          fortune: 4,
          willpower: 5,
          lifeSeed: 3
        }
      },
      player: {
        name: '陆青玄',
        realm: '炼气七层',
        qi: 74,
        mood: 68,
        cultivationProgress: 42,
        spiritStones: 126,
        sectRelation: 32,
        location: '青云宗外门',
        health: 134,
        maxHealth: 134,
        lifespan: 90,
        maxLifespan: 96
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
      treasures: [
        {
          id: 'calm_lotus_incense',
          name: '静心莲香',
          rarity: '良品',
          description: '点燃后可令识海宁静，突破时更易定神。',
          bonuses: { breakthroughChance: 3 }
        }
      ],
      techniques: [
        {
          id: 'qingmu_jue',
          name: '青木诀',
          grade: '凡品',
          type: '心法',
          level: 1,
          description: '以木息滋养经脉。',
          bonuses: { cultivationGain: 6, maxHealth: 6 }
        }
      ],
      worldEvents: [{ title: '青云宗春试将近', detail: '外门弟子都在准备争夺内门名额。', turn: 0 }],
      foreshadows: ['雷木双灵根可能引来异常天劫。']
    },
    afterGame: {
      turn: 1,
      calendar: { year: 3, season: '春', month: 2 },
      character: {
        attributes: {
          rootBone: 6,
          comprehension: 7,
          fortune: 4,
          willpower: 5,
          lifeSeed: 3
        }
      },
      player: {
        name: '陆青玄',
        realm: '炼气七层',
        qi: 85,
        mood: 71,
        cultivationProgress: 58,
        spiritStones: 122,
        sectRelation: 33,
        location: '青云宗外门',
        health: 121,
        maxHealth: 134,
        lifespan: 88,
        maxLifespan: 96
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
      treasures: [
        {
          id: 'calm_lotus_incense',
          name: '静心莲香',
          rarity: '良品',
          description: '点燃后可令识海宁静，突破时更易定神。',
          bonuses: { breakthroughChance: 3 }
        }
      ],
      techniques: [
        {
          id: 'qingmu_jue',
          name: '青木诀',
          grade: '凡品',
          type: '心法',
          level: 1,
          description: '以木息滋养经脉。',
          bonuses: { cultivationGain: 6, maxHealth: 6 }
        }
      ],
      worldEvents: [{ title: '坊市拍卖预告', detail: '一枚雷纹筑基丹将在月末拍卖。', turn: 1 }],
      foreshadows: ['若陆青玄强行突破，雷木双息可能产生反噬。'],
      storyMemory: {
        longSummary: '陆青玄在青云宗外门稳住雷木双息，雾隐秘境与飞升传闻仍未解释。',
        recentTurns: [
          {
            turn: 1,
            title: '闭关试炼',
            action: '闭关修炼三月，尝试突破',
            outcome: '规则已经完成结算。',
            npcLine: '林师姐提醒他稳住雷息。',
            worldEvent: '坊市拍卖预告',
            statDelta: { qi: 11, lifespan: -2 },
            rawId: 'raw_story_memory_id'
          }
        ],
        openThreads: [
          {
            title: '飞升骗局伏笔',
            detail: '宗门典籍对飞升的记载前后矛盾。',
            status: '未解',
            id: 'internal_thread_id'
          }
        ],
        resolvedThreads: [],
        characterNotes: [
          {
            name: '林师姐',
            role: '内门弟子',
            affinity: 36,
            tone: '温和而谨慎',
            memories: ['见证陆青玄闭关后气息更趋凝实。']
          }
        ],
        lastUpdatedTurn: 1
      }
    },
    action: {
      id: 'act_0_cultivation_0',
      eventId: 'mist_bronze_bell',
      choiceId: 'approach',
      title: '三月闭关',
      command: '闭关修炼三月，尝试突破',
      risk: 'medium',
      breakthroughPreview: {
        targetRealm: '炼气八层',
        chance: 72,
        failureCost: {
          health: 18,
          lifespan: 1,
          progressLoss: 40
        }
      }
    },
    ruleEntry: {
      title: '闭关试炼',
      command: '闭关修炼三月，尝试突破',
      body: '规则已经完成结算。',
      npcLine: '林师姐提醒他稳住雷息。',
      worldEvent: '坊市拍卖预告',
      breakthroughResult: {
        success: false,
        targetRealm: '炼气八层',
        chance: 72,
        roll: 81
      }
    }
  };
}
