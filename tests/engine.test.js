import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceTurn, createGame, exportNovel } from '../src/engine.js';

test('createGame returns a playable cultivation state', () => {
  const game = createGame(12);

  assert.equal(game.player.name, '陆青玄');
  assert.equal(game.player.realm, '炼气七层');
  assert.equal(game.calendar.season, '春');
  assert.ok(game.player.qi > 0);
  assert.ok(game.suggestions.length >= 3);
  assert.ok(game.timeline.length >= 1);
});

test('advanceTurn interprets cultivation commands and updates progress', () => {
  const game = createGame(12);
  const next = advanceTurn(game, '闭关修炼三月，尝试突破');

  assert.equal(next.turn, game.turn + 1);
  assert.equal(next.calendar.month, game.calendar.month + 1);
  assert.ok(next.player.cultivationProgress > game.player.cultivationProgress);
  assert.match(next.log.at(-1).title, /闭关|修炼|突破/);
  assert.ok(next.suggestions.some((item) => item.includes('突破') || item.includes('稳固')));
});

test('advanceTurn records npc memory for social commands', () => {
  const game = createGame(8);
  const next = advanceTurn(game, '找林师姐打听雾隐秘境的消息');

  const lin = next.npcs.find((npc) => npc.name === '林师姐');
  assert.ok(lin.affinity > game.npcs.find((npc) => npc.name === '林师姐').affinity);
  assert.ok(lin.memories.some((memory) => memory.includes('雾隐秘境') || memory.includes('打听')));
  assert.match(next.log.at(-1).npcLine, /林师姐/);
});

test('advanceTurn can add a world evolution event', () => {
  const game = createGame(3);
  const next = advanceTurn(game, '前往后山探索灵脉');

  assert.ok(next.worldEvents.length >= game.worldEvents.length);
  assert.ok(next.timeline.length > game.timeline.length);
  assert.ok(next.log.at(-1).worldEvent);
});

test('exportNovel returns readable story text with logs and memories', () => {
  const game = advanceTurn(createGame(8), '找林师姐打听雾隐秘境的消息');
  const text = exportNovel(game);

  assert.match(text, /问道浮生/);
  assert.match(text, /陆青玄/);
  assert.match(text, /林师姐/);
  assert.match(text, /玄历/);
});
