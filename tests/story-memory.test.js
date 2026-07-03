import test from 'node:test';
import assert from 'node:assert/strict';

import { createGame } from '../src/engine.js';
import { recordStoryMemoryTurn } from '../src/storyMemory.js';

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
