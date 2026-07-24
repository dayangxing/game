import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeDirectorOutput } from '../backend/src/agents/storyDirector.js';
import { buildStoryDirectorMessages } from '../backend/src/llm/prompts/storyDirectorPrompt.js';
import { createGame } from '../src/engine.js';

test('story director prompt sends compact context and forbids numeric authority', () => {
  const game = {
    ...createGame(31),
    onboarding: { completed: true },
    timePressure: {
      calendarLabel: '玄历3年 秋 第7月',
      elapsedYears: 3,
      remainingLifespan: 70,
      maxLifespan: 116,
      lastDeltaTime: '半年',
      lastLifespanCost: 3,
      lastLongevityGain: 0,
      lastNetLifespanDelta: -3,
      recentRecoveryFatigue: 1,
      warningLevel: 'strained'
    },
    storyMemory: {
      longSummary: '顾清河在青云宗追查雾隐秘境与飞升骗局。',
      recentTurns: [{
        turn: 1,
        title: '命火微澜',
        action: '继续',
        outcome: '命火异常。',
        timeLabel: '半年',
        netLifespanDelta: -3,
        warningLevel: 'strained'
      }],
      openThreads: [{ title: '飞升骗局伏笔', detail: '飞升传闻前后矛盾。', status: '未解' }],
      characterNotes: [{ name: '林师姐', role: '内门弟子', affinity: 34, tone: '谨慎', memories: ['提醒过命火异常。'] }],
      resolvedThreads: [],
      lastUpdatedTurn: 1
    }
  };
  game.character = {
    ...game.character,
    origin: '渔村遗孤',
    spiritualRoot: '土灵根',
    traits: ['经脉坚韧', '福缘深厚']
  };
  const messages = buildStoryDirectorMessages({ game, input: { type: 'continue' } });
  const system = messages.find((message) => message.role === 'system').content;
  const user = JSON.parse(messages.find((message) => message.role === 'user').content);

  assert.match(system, /连续剧情导演/);
  assert.match(system, /不得输出具体数值/);
  assert.match(system, /effectHints/);
  assert.match(system, /短标题/);
  assert.match(system, /target/);
  assert.match(system, /direction/);
  assert.match(system, /intensity/);
  assert.match(system, /必须承认时间流逝|不要让连续剧情都像同一天/);
  assert.match(system, /不得输出具体数值/);
  assert.match(system, /章节由后端规则层决定/);
  assert.match(system, /不得创建章节、完成章节目标、修改真相旗标、修改契约立场或宣布结局 id/);
  assert.match(system, /如果当前状态已经结束，不得生成新的行动或继续推进剧情/);
  assert.equal(user.task, 'continuous_story_director');
  assert.equal(user.input.type, 'continue');
  assert.equal(user.context.timePressure.warningLevel, 'strained');
  assert.match(JSON.stringify(user.context.timePressure), /remainingLifespan|maxLifespan|lastDeltaTime/);
  assert.equal(user.context.storyMemory.longSummary.includes('飞升骗局'), true);
  assert.equal(user.context.recentTurns.length, 1);
  assert.equal(user.context.recentTurns[0].timeLabel, '半年');
  assert.equal(user.context.recentTurns[0].warningLevel, 'strained');
  assert.deepEqual(user.context.characterBackground, {
    origin: '渔村遗孤',
    spiritualRoot: '土灵根',
    traits: ['经脉坚韧', '福缘深厚']
  });
  const hardConstraints = user.hardConstraints.join('\n');
  assert.match(hardConstraints, /章节由后端规则层决定/);
  assert.match(hardConstraints, /不得创建章节、完成章节目标、修改真相旗标、修改契约立场或宣布结局 id/);
  assert.match(hardConstraints, /如果当前状态已经结束，不得生成新的行动或继续推进剧情/);
  assert.match(hardConstraints, /身世、灵根和命格天赋|角色背景/);
  assert.doesNotMatch(JSON.stringify(user), /apiKey|baseUrl|prompt|debug/i);
});

test('normalizes story director output to public scene, choices, and safe effect hints', () => {
  const game = createGame(31);
  const normalized = normalizeDirectorOutput({
    scene: '你在洞府中听见雾隐钟声，命火随之忽明忽暗。',
    mode: 'choice',
    npcLines: [
      { npcId: 'lin_shijie', speaker: '林师姐', line: '你也听见钟声了？' },
      { npcId: 'unknown', speaker: '陌生仙人', line: '送你仙剑。' }
    ],
    effectHints: [
      { target: 'lifespan', direction: 'down', intensity: 'small', amount: 50 }
    ],
    choices: [
      {
        id: 'follow-bell',
        title: '追查钟声',
        text: '循着钟声前往后山',
        tone: 'explore',
        effectHints: [{ target: 'foreshadow', direction: 'advance', intensity: 'small', topic: '雾隐秘境' }]
      },
      {
        id: 'ask-lin',
        title: '询问师姐',
        text: '先问林师姐旧事',
        tone: 'social',
        effectHints: [{ target: 'npc_affinity', npcId: 'lin_shijie', direction: 'up', intensity: 'small' }]
      }
    ],
    memoryHints: ['雾隐钟声与命火异常有关。']
  }, game);

  assert.equal(normalized.mode, 'choice');
  assert.equal(normalized.choices.length, 2);
  assert.deepEqual(normalized.choices.map((choice) => choice.id), ['follow_bell', 'ask_lin']);
  assert.deepEqual(normalized.choices.map((choice) => choice.title), ['追查钟声', '询问师姐']);
  assert.equal(normalized.npcLines.length, 1);
  assert.equal(normalized.npcLines[0].speaker, '林师姐');
  assert.deepEqual(normalized.effectHints, [
    { target: 'lifespan', direction: 'down', intensity: 'small' }
  ]);
  assert.doesNotMatch(JSON.stringify(normalized), /50|陌生仙人|送你仙剑/);
});

test('story director receives unsummarized authoritative turns with the checkpoint', () => {
  const game = createGame(31);
  game.turn = 4;
  game.version = 4;
  game.log = [
    { id: 'turn-1', title: '旧一', command: '旧行动一', body: '旧结果一' },
    { id: 'turn-2', title: '旧二', command: '旧行动二', body: '旧结果二' },
    { id: 'turn-3', title: '新一', command: '追查钟声', body: '发现残契', worldEvent: '雾隐回响' },
    { id: 'turn-4', title: '新二', command: '询问师姐', body: '得知旧案', npcLine: '小心飞升传闻。' }
  ];
  game.storyMemory = {
    ...game.storyMemory,
    summaryThroughTurn: 2,
    summaryRevision: 3
  };

  const user = JSON.parse(buildStoryDirectorMessages({ game, input: { type: 'continue' } })[1].content);
  assert.equal(user.context.storyMemory.summaryThroughTurn, 2);
  assert.deepEqual(user.context.storyMemory.unsummarizedTurns.map((turn) => turn.turn), [3, 4]);
  assert.equal(user.context.storyMemory.unsummarizedTurns[0].worldEvent, '雾隐回响');
  assert.equal(user.context.storyMemory.unsummarizedTurns[1].outcome, '得知旧案');
});

test('story director drops stale long summary and receives the rolling 50-turn context', () => {
  const game = createGame(31);
  game.turn = 55;
  game.version = 55;
  game.log = Array.from({ length: 55 }, (_, index) => ({
    id: `turn-${index + 1}`,
    turn: index + 1,
    title: `回合${index + 1}`,
    command: `行动${index + 1}`,
    body: `结果${index + 1}`
  }));
  game.storyMemory = {
    ...game.storyMemory,
    longSummary: '窗口外的旧摘要，不应继续发送',
    summaryThroughTurn: 54,
    summaryWindowStartTurn: 0,
    summaryRevision: 4
  };

  const user = JSON.parse(buildStoryDirectorMessages({ game, input: { type: 'continue' } })[1].content);
  const memory = user.context.storyMemory;
  assert.equal(memory.summaryWindowStale, true);
  assert.equal(memory.longSummary, '');
  assert.deepEqual(memory.rollingWindowTurns.map((turn) => turn.turn), Array.from({ length: 50 }, (_, index) => index + 6));
  assert.deepEqual(memory.unsummarizedTurns, []);
});

test('falls back to continue mode when model gives too few valid choices', () => {
  const normalized = normalizeDirectorOutput({
    scene: '你暂时压下命火波动。',
    mode: 'choice',
    choices: [{ id: 'only-one', text: '继续观察', effectHints: [] }]
  }, createGame(31));

  assert.equal(normalized.mode, 'continue');
  assert.deepEqual(normalized.choices, []);
});
