import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLongSummaryMessages } from '../backend/src/llm/prompts/longSummaryPrompt.js';

test('long summary prompt carries authoritative facts and a strict JSON schema', () => {
  const game = {
    turn: 12,
    calendar: { year: 4, season: '秋', month: 7 },
    character: {
      name: '顾清河',
      origin: '渔村遗孤',
      spiritualRoot: '土灵根',
      traits: ['福缘深厚', '旧缘未断'],
      attributes: {悟性: 8, 体魄: 7}
    },
    player: {
      name: '顾清河',
      realm: '炼气三层',
      location: '青云宗外门',
      health: 82,
      maxHealth: 100,
      lifespan: 74,
      maxLifespan: 116,
      qi: 42,
      mood: 61,
      cultivationProgress: 30,
      spiritStones: 18,
      sectRelation: 24
    },
    chapter: { title: '雾隐初闻', progress: 40 },
    npcs: [{ name: '林师姐', role: '内门弟子', affinity: 34, tone: '谨慎', memories: ['提醒过命火异常。'] }],
    storyMemory: {
      openThreads: [{ title: '飞升骗局伏笔', detail: '飞升传闻前后矛盾。', status: '未解' }]
    },
    foreshadows: ['雾隐秘境的钟声与命火有关。'],
    worldEvents: ['宗门开始盘查外门弟子。']
  };
  const sourceTurns = [
    { turn: 11, title: '石室回响', action: '追查钟声', outcome: '发现残契', worldEvent: '', npcLine: '' },
    { turn: 12, title: '师姐来信', action: '询问林师姐', outcome: '得知旧案', worldEvent: '', npcLine: '不要相信飞升传闻。' }
  ];

  const messages = buildLongSummaryMessages({
    game,
    previousSummary: '顾清河已入青云宗，追查雾隐秘境与飞升传闻。',
    sourceTurns
  });

  assert.equal(messages.length, 2);
  const system = messages.find((message) => message.role === 'system').content;
  const user = JSON.parse(messages.find((message) => message.role === 'user').content);

  assert.match(system, /中文/);
  assert.match(system, /事实压缩/);
  assert.match(system, /合法 JSON object|JSON-only|JSON/);
  assert.match(system, /不得创造事实/);
  assert.match(system, /不得改变数字状态/);
  assert.match(system, /出身|身世/);
  assert.match(system, /灵根/);
  assert.match(system, /命格天赋/);
  assert.match(system, /未解决主线|未解主线|未解伏笔/);

  assert.equal(user.task, 'long_story_summary');
  assert.equal(user.previousSummary, '顾清河已入青云宗，追查雾隐秘境与飞升传闻。');
  assert.deepEqual(user.sourceTurns, sourceTurns);
  assert.deepEqual(user.openThreads, game.storyMemory.openThreads);
  assert.deepEqual(user.currentFacts.characterBackground, {
    name: '顾清河',
    origin: '渔村遗孤',
    spiritualRoot: '土灵根',
    traits: ['福缘深厚', '旧缘未断'],
    attributes: {悟性: 8, 体魄: 7}
  });
  assert.equal(user.currentFacts.player.health, 82);
  assert.equal(user.currentFacts.player.lifespan, 74);
  assert.deepEqual(user.outputSchema, {
    summary: 'string，420 字符以内的中文长期剧情事实摘要',
    coveredThroughTurn: 'integer，实际覆盖的最高 sourceTurns.turn；不得超过输入回合'
  });
  assert.doesNotMatch(JSON.stringify(user), /apiKey|baseUrl|response_format/i);
});

test('long summary prompt declares a rolling 50-turn window and isolates rebase from the old summary', () => {
  const openingAnchor = {
    turn: 0,
    title: '山门初醒',
    outcome: '角色在青云山门登记入册。'
  };
  const messages = buildLongSummaryMessages({
    game: {
      turn: 100,
      character: {
        origin: '渔村遗孤',
        spiritualRoot: '土灵根',
        traits: ['福缘深厚']
      },
      player: { name: '顾清河', realm: '炼气九层' },
      storyMemory: { openThreads: [] }
    },
    previousSummary: '窗口外的旧摘要，不应进入重建窗口。',
    sourceTurns: [{ turn: 99, title: '回声', outcome: '发现残契' }],
    summaryWindowStartTurn: 51,
    summaryWindowEndTurn: 100,
    rebase: true,
    openingAnchor
  });

  const system = messages.find((message) => message.role === 'system').content;
  const user = JSON.parse(messages.find((message) => message.role === 'user').content);

  assert.match(system, /rolling|滚动/);
  assert.match(system, /50/);
  assert.match(system, /rebase|重建|重新生成/);
  assert.equal(user.summaryWindowStartTurn, 51);
  assert.equal(user.summaryWindowEndTurn, 100);
  assert.equal(user.rebase, true);
  assert.deepEqual(user.openingAnchor, openingAnchor);
  assert.equal(user.previousSummary, '');
  assert.deepEqual(user.sourceTurns, [{ turn: 99, title: '回声', outcome: '发现残契' }]);
});
