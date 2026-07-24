import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/engine.js';
import {
  SUMMARY_WINDOW_TURNS,
  getStoryMemoryPromptContext,
  normalizeStoryMemory,
  recordStoryMemoryTurn,
  selectRollingSummaryTurns,
  selectUnsummarizedTurns
} from '../src/storyMemory.js';
import {
  SUMMARY_WINDOW_TURNS as FRONTEND_SUMMARY_WINDOW_TURNS,
  getStoryMemoryPromptContext as getFrontendStoryMemoryPromptContext,
  normalizeStoryMemory as normalizeFrontendStoryMemory,
  selectRollingSummaryTurns as selectFrontendRollingSummaryTurns,
  selectUnsummarizedTurns as selectFrontendUnsummarizedTurns
} from '../frontend/src/lib/storyMemory.js';

const legacySummary = '旧版开局摘要。雷木双灵根、雾隐秘境与飞升传闻已经成为长期疑云。';

function createCurrentCharacterGame() {
  return {
    turn: 0,
    character: {
      name: '沈照夜',
      origin: '渔村遗孤',
      spiritualRoot: '土灵根',
      traits: ['福缘深厚', '静水心境']
    },
    player: {
      name: '沈照夜',
      origin: '渔村遗孤',
      spiritualRoot: '土灵根'
    },
    log: [{ body: '玄衡长老翻过命簿，示意沈照夜自行踏上山门石阶。' }],
    foreshadows: [],
    npcs: []
  };
}

test('new memory starts with a turn-zero summary checkpoint', () => {
  const game = createGame(1);

  for (const memory of [game.storyMemory, normalizeFrontendStoryMemory(null, game)]) {
    assert.equal(memory.summaryThroughTurn, 0);
    assert.equal(memory.summaryRevision, 0);
    assert.equal(memory.summaryWindowStartTurn, 0);
  }
  assert.equal(SUMMARY_WINDOW_TURNS, 50);
  assert.equal(FRONTEND_SUMMARY_WINDOW_TURNS, 50);
});

test('legacy memory gets a conservative checkpoint without losing recent turns', () => {
  const game = createGame(2);
  const legacyMemory = {
    longSummary: '旧摘要',
    recentTurns: [
      { turn: 4, title: '四', action: 'a', outcome: 'o' },
      { turn: 5, title: '五', action: 'b', outcome: 'p' }
    ]
  };

  for (const normalize of [normalizeStoryMemory, normalizeFrontendStoryMemory]) {
    const normalized = normalize(legacyMemory, { ...game, turn: 5 });

    assert.equal(normalized.summaryThroughTurn, 3);
    assert.equal(normalized.summaryRevision, 0);
    assert.equal(normalized.summaryWindowStartTurn, 0);
    assert.deepEqual(normalized.recentTurns.map((item) => item.turn), [4, 5]);
  }
});

function createRollingWindowGame(formalTurnCount = 55) {
  return {
    turn: formalTurnCount,
    storyMemory: {
      longSummary: '旧摘要',
      summaryThroughTurn: formalTurnCount - 1,
      summaryRevision: 3,
      summaryWindowStartTurn: 0
    },
    log: [
      {
        id: 'formal-opening',
        turn: 0,
        title: '开局锚点',
        command: '入山',
        body: '玄衡长老翻过命簿，示意主角自行承受此后因果。'
      },
      ...Array.from({ length: formalTurnCount }, (_, index) => ({
        id: `turn-${index + 1}`,
        turn: index + 1,
        title: `正式回合${index + 1}`,
        command: `行动${index + 1}`,
        body: `结果${index + 1}`
      })),
      {
        id: 'resource-55-extra',
        turn: formalTurnCount,
        title: '机缘入手',
        command: '收取机缘',
        body: '这条即时机缘不应占用正式回合窗口。'
      }
    ]
  };
}

test('rolling summary selects the latest 50 formal turns and keeps turn zero as an anchor', () => {
  const game = createRollingWindowGame();
  const expectedTurns = [0, ...Array.from({ length: SUMMARY_WINDOW_TURNS }, (_, index) => index + 6)];

  for (const select of [selectRollingSummaryTurns, selectFrontendRollingSummaryTurns]) {
    const selected = select(game);

    assert.deepEqual(selected.turns.map((item) => item.turn), expectedTurns);
    assert.equal(selected.startTurn, 6);
    assert.equal(selected.endTurn, 55);
    assert.equal(selected.truncated, true);
    assert.equal(selected.turns.some((item) => item.outcome.includes('即时机缘')), false);
  }
});

test('stale summary context drops the old long summary and returns the rolling raw window', () => {
  const game = createRollingWindowGame();
  const expectedTurns = [0, ...Array.from({ length: SUMMARY_WINDOW_TURNS }, (_, index) => index + 6)];

  for (const getContext of [getStoryMemoryPromptContext, getFrontendStoryMemoryPromptContext]) {
    const context = getContext(game);

    assert.equal(context.longSummary, '');
    assert.equal(context.summaryThroughTurn, 54);
    assert.equal(context.summaryWindowStartTurn, 0);
    assert.equal(context.summaryWindowStale, true);
    assert.deepEqual(context.rollingWindowTurns.map((item) => item.turn), expectedTurns);
    assert.deepEqual(context.unsummarizedTurns, []);
  }
});

test('fresh summary context preserves the existing summary and unsummarized delta', () => {
  const game = createRollingWindowGame(5);
  game.log = game.log.filter((entry) => !entry.id.startsWith('resource-'));
  game.storyMemory = {
    ...game.storyMemory,
    longSummary: '新鲜摘要',
    summaryThroughTurn: 3,
    summaryWindowStartTurn: 0
  };

  for (const getContext of [getStoryMemoryPromptContext, getFrontendStoryMemoryPromptContext]) {
    const context = getContext(game);

    assert.equal(context.longSummary, '新鲜摘要');
    assert.equal(context.summaryWindowStale, false);
    assert.deepEqual(context.unsummarizedTurns.map((item) => item.turn), [4, 5]);
    assert.deepEqual(context.rollingWindowTurns.map((item) => item.turn), [0, 1, 2, 3, 4, 5]);
  }
});

test('unsummarized turn selection reads the authoritative log after the checkpoint', () => {
  const game = {
    turn: 5,
    storyMemory: { summaryThroughTurn: 3, summaryRevision: 2 },
    log: [
      { id: 'turn-3', title: '旧', command: '旧', body: '旧' },
      { id: 'turn-4', title: '新一', command: '行动一', body: '结果一', npcLine: '旁白一', worldEvent: '世事一', debug: '不要暴露' },
      { id: 'turn-5', title: '新二', command: '行动二', body: '结果二', npcLine: '旁白二', worldEvent: '世事二', actionId: 'internal-id' }
    ]
  };

  for (const select of [selectUnsummarizedTurns, selectFrontendUnsummarizedTurns]) {
    const selected = select(game);

    assert.deepEqual(selected.turns, [
      {
        turn: 4,
        title: '新一',
        action: '行动一',
        outcome: '结果一',
        npcLine: '旁白一',
        worldEvent: '世事一'
      },
      {
        turn: 5,
        title: '新二',
        action: '行动二',
        outcome: '结果二',
        npcLine: '旁白二',
        worldEvent: '世事二'
      }
    ]);
    assert.equal(selected.truncated, false);
  }
});

test('unsummarized turn selection truncates from the oldest side when bounded', () => {
  const game = {
    turn: 5,
    storyMemory: { summaryThroughTurn: 0 },
    log: [
      { turn: 1, title: '一', command: '行动一', body: '结果一' },
      { turn: 2, title: '二', command: '行动二', body: '结果二' },
      { turn: 3, title: '三', command: '行动三', body: '结果三' }
    ]
  };

  for (const select of [selectUnsummarizedTurns, selectFrontendUnsummarizedTurns]) {
    const selected = select(game, { maxTurns: 2 });

    assert.deepEqual(selected.turns.map((item) => item.title), ['二', '三']);
    assert.equal(selected.truncated, true);
  }
});

test('summary jobs can select the oldest contiguous delta window', () => {
  const game = {
    turn: 5,
    storyMemory: { summaryThroughTurn: 0 },
    log: [
      { turn: 1, title: '一', command: '行动一', body: '结果一' },
      { turn: 2, title: '二', command: '行动二', body: '结果二' },
      { turn: 3, title: '三', command: '行动三', body: '结果三' }
    ]
  };

  for (const select of [selectUnsummarizedTurns, selectFrontendUnsummarizedTurns]) {
    const selected = select(game, { maxTurns: 2, preserveNewest: false });

    assert.deepEqual(selected.turns.map((item) => item.title), ['一', '二']);
    assert.equal(selected.truncated, true);
  }
});

test('story summary follows current character and migrates legacy fixed text', () => {
  const game = createCurrentCharacterGame();

  for (const normalize of [normalizeStoryMemory, normalizeFrontendStoryMemory]) {
    const memory = normalize({ longSummary: legacySummary }, game);

    assert.match(memory.longSummary, /沈照夜/);
    assert.match(memory.longSummary, /渔村遗孤/);
    assert.match(memory.longSummary, /土灵根/);
    assert.match(memory.longSummary, /福缘深厚、静水心境/);
    assert.doesNotMatch(memory.longSummary, /雷木双灵根、雾隐秘境与飞升传闻已经成为长期疑云/);
  }
});

test('initial story memory does not invent an ascension thread without evidence', () => {
  const game = createCurrentCharacterGame();

  for (const normalize of [normalizeStoryMemory, normalizeFrontendStoryMemory]) {
    const memory = normalize({
      openThreads: [{
        id: 'ascension_contract',
        title: '飞升骗局伏笔',
        detail: '宗门典籍与长老传闻中对飞升的说法仍有缺口。'
      }]
    }, game);

    assert.equal(memory.openThreads.some((thread) => thread.id === 'ascension_contract'), false);
  }
});

test('ordinary narration foreshadow stays out of unresolved story threads', () => {
  const before = createGame(31);
  const after = {
    ...before,
    turn: 1,
    log: [
      ...before.log,
      {
        id: 'turn-1',
        title: '闭关一日',
        command: '闭关修炼一日',
        body: '顾清河在洞府中吐纳一日，灵气略有精进。',
        npcLine: '',
        worldEvent: '晨起吐纳'
      }
    ]
  };

  const remembered = recordStoryMemoryTurn({
    before,
    after,
    action: { title: '闭关一日', command: '闭关修炼一日' },
    entry: after.log.at(-1),
    narration: {
      status: 'generated',
      title: '闭关一日',
      body: '顾清河在洞府中吐纳一日，灵气略有精进。',
      npcLine: '',
      foreshadow: '今日灵气微动，山门晨雾比昨日更深。',
      continuityNotes: [],
      safetyFlags: []
    }
  });

  assert.equal(remembered.storyMemory.recentTurns.at(-1).title, '闭关一日');
  assert.equal(
    remembered.storyMemory.openThreads.some((thread) => thread.detail.includes('山门晨雾比昨日更深')),
    false
  );
});

test('key foreshadow advances one structured unresolved story thread', () => {
  const before = createGame(31);
  const after = {
    ...before,
    turn: 1,
    log: [
      ...before.log,
      {
        id: 'turn-1',
        title: '残契回响',
        command: '研读古修残卷',
        body: '顾清河在残卷中看见天门旧契与雾隐铜铃同源。',
        npcLine: '',
        worldEvent: '天门契影'
      }
    ]
  };

  const remembered = recordStoryMemoryTurn({
    before,
    after,
    action: { title: '残契回响', command: '研读古修残卷' },
    entry: after.log.at(-1),
    narration: {
      status: 'generated',
      title: '残契回响',
      body: '顾清河在残卷中看见天门旧契与雾隐铜铃同源。',
      npcLine: '',
      foreshadow: '天门残契与雾隐铜铃出现同源回响。',
      continuityNotes: ['推进飞升骗局与雾隐秘境主线。'],
      safetyFlags: []
    }
  });

  const ascensionThread = remembered.storyMemory.openThreads.find((thread) => thread.id === 'ascension_contract');

  assert.ok(ascensionThread);
  assert.equal(ascensionThread.title, '飞升骗局伏笔');
  assert.equal(ascensionThread.status, '未解');
  assert.equal(ascensionThread.updatedTurn, 1);
  assert.ok(ascensionThread.clues.some((clue) => clue.includes('天门残契')));
  assert.equal(
    remembered.storyMemory.openThreads.filter((thread) => thread.id === 'ascension_contract').length,
    1
  );
});

test('recent turns remember time pressure for future story context', () => {
  const before = createGame(31);
  const after = {
    ...before,
    turn: 1,
    timePressure: {
      lastDeltaTime: '半年',
      lastNetLifespanDelta: -3,
      warningLevel: 'strained'
    },
    log: [
      ...before.log,
      {
        id: 'turn-1',
        title: '命火微澜',
        command: '继续',
        body: '顾清河压住命火波动，洞府外已换了一场秋雨。',
        npcLine: '',
        worldEvent: '寿元承压'
      }
    ]
  };

  const remembered = recordStoryMemoryTurn({
    before,
    after,
    action: { title: '命火微澜', command: '继续' },
    entry: after.log.at(-1),
    narration: {
      status: 'generated',
      title: '命火微澜',
      body: '顾清河压住命火波动，洞府外已换了一场秋雨。',
      npcLine: '',
      foreshadow: '',
      continuityNotes: [],
      safetyFlags: []
    }
  });
  const latest = remembered.storyMemory.recentTurns.at(-1);

  assert.equal(latest.timeLabel, '半年');
  assert.equal(latest.netLifespanDelta, -3);
  assert.equal(latest.warningLevel, 'strained');
});

test('recording a turn preserves summary checkpoint metadata', () => {
  const before = createGame(31);
  before.storyMemory = {
    ...before.storyMemory,
    summaryThroughTurn: 2,
    summaryRevision: 7,
    summaryWindowStartTurn: 12
  };
  const after = {
    ...before,
    turn: 3,
    log: [
      ...before.log,
      {
        id: 'turn-3',
        title: '继续修行',
        command: '闭关',
        body: '灵气在经脉中缓缓流转。'
      }
    ]
  };

  const remembered = recordStoryMemoryTurn({
    before,
    after,
    action: { title: '继续修行', command: '闭关' },
    entry: after.log.at(-1),
    narration: { title: '继续修行', body: '灵气在经脉中缓缓流转。' }
  });

  assert.equal(remembered.storyMemory.summaryThroughTurn, 2);
  assert.equal(remembered.storyMemory.summaryRevision, 7);
  assert.equal(remembered.storyMemory.summaryWindowStartTurn, 12);
});
