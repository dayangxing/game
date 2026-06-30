import test from 'node:test';
import assert from 'node:assert/strict';

import { EVENT_CATALOG, TRUTH_FLAGS } from '../backend/src/domain/events/eventCatalog.js';
import { selectEventActions } from '../backend/src/domain/events/eventSelector.js';
import { isEventEligible } from '../backend/src/domain/events/triggerMatcher.js';
import { applyEffects, resolveChoice } from '../backend/src/domain/events/effectResolver.js';
import { createGame } from '../src/engine.js';

function formalGame() {
  return {
    ...createGame(31),
    onboarding: { completed: true, stepId: 'formal_life', completedStepIds: [], unlockedCharacterCreation: true },
    inventory: { materials: { 凝露草: 2, 雷纹草: 1 }, pills: {} },
    karma: { karma: 0, evil: 0, fate: 0, debts: [], vendettas: [], futureEventFlags: [] },
    flags: {},
    cooldowns: {},
    characterSeed: 31,
    character: { name: '顾清河', traits: [], origin: '山野孤子', spiritualRoot: '雷木双灵根' }
  };
}

test('event catalog seeds enough content and all truth flags', () => {
  assert.ok(EVENT_CATALOG.length >= 28);
  for (const flag of TRUTH_FLAGS) {
    assert.ok(EVENT_CATALOG.some((event) => JSON.stringify(event).includes(flag)), `${flag} is seeded`);
  }
});

test('event catalog covers the core Qingyun, mist, lifespan, ascension and npc arcs', () => {
  const requiredEvents = [
    'qingyun_life_register',
    'elder_private_warning',
    'mist_lantern_path',
    'mist_archive_full',
    'lifespan_debt_collector',
    'false_ascender_name',
    'lin_shijie_warning',
    'xuanheng_private_confession'
  ];

  for (const id of requiredEvents) {
    assert.ok(EVENT_CATALOG.some((event) => event.id === id), `${id} should be seeded`);
  }

  const storyText = EVENT_CATALOG.map((event) => JSON.stringify(event)).join('\n');
  assert.match(storyText, /青云宗/);
  assert.match(storyText, /雾隐秘境/);
  assert.match(storyText, /寿元|命灯/);
  assert.match(storyText, /飞升|天门/);
  assert.match(storyText, /林师姐|玄衡长老/);
});

test('trigger matcher respects view and flag requirements', () => {
  const game = formalGame();
  const mistEvent = EVENT_CATALOG.find((event) => event.id === 'mist_bronze_bell');

  assert.equal(isEventEligible(mistEvent, game, 'realm'), true);
  assert.equal(isEventEligible(mistEvent, game, 'bag'), false);
  assert.equal(isEventEligible({ ...mistEvent, trigger: { ...mistEvent.trigger, requiresFlags: ['missing_flag'] } }, game, 'realm'), false);
});

test('effect resolver applies stat, item, relation, flag and future event effects', () => {
  const game = formalGame();
  const event = EVENT_CATALOG.find((candidate) => candidate.id === 'market_injured_cultivator');
  const choice = event.choices.find((candidate) => candidate.id === 'save');
  const result = resolveChoice({
    game,
    event,
    choice,
    now: new Date('2026-06-29T08:00:00.000Z')
  });

  assert.equal(result.game.turn, 1);
  assert.equal(result.game.flags.saved_injured_cultivator, true);
  assert.equal(result.game.karma.futureEventFlags.includes('old_friend_returns'), true);
  assert.ok(result.game.karma.karma > game.karma.karma);
  assert.ok(result.entry.body.includes('赠丹'));
  assert.equal(result.ruleResult.success, true);
});

test('unsupported effects fail closed before mutating game state', () => {
  const game = formalGame();

  assert.throws(() => applyEffects(game, [{ type: 'unknown', id: 'bad' }]), /RULE_EFFECT_INVALID/);
  assert.equal(game.turn, 0);
});

test('item costs fail closed before creating free crafting results', () => {
  const game = {
    ...formalGame(),
    inventory: { materials: { 凝露草: 0, 雷纹草: 1 }, pills: {} }
  };
  const effects = [
    { type: 'item', path: 'materials.凝露草', delta: -1 },
    { type: 'item', path: 'pills.聚气丹', delta: 1 }
  ];

  assert.throws(() => applyEffects(game, effects), /CHOICE_REQUIREMENT_FAILED:materials\.凝露草/);
  assert.deepEqual(game.inventory, { materials: { 凝露草: 0, 雷纹草: 1 }, pills: {} });
});

test('stat costs fail closed before granting paid rewards', () => {
  const game = {
    ...formalGame(),
    player: {
      ...formalGame().player,
      spiritStones: 10
    }
  };
  const effects = [
    { type: 'stat', path: 'player.spiritStones', delta: -25 },
    { type: 'item', path: 'materials.雷纹草', delta: 2 },
    { type: 'evil', delta: 2 }
  ];

  assert.throws(() => applyEffects(game, effects), /CHOICE_REQUIREMENT_FAILED:player\.spiritStones/);
  assert.equal(game.player.spiritStones, 10);
  assert.equal(game.inventory.materials.雷纹草, 1);
});

test('formal selector returns at least three deterministic event actions for every primary view', () => {
  const game = formalGame();
  const now = new Date('2026-06-30T08:00:00.000Z');

  for (const viewId of ['home', 'cultivation', 'skills', 'realm', 'bag']) {
    const actions = selectEventActions({ game, viewId, now });
    assert.ok(actions.length >= 3, `${viewId} should expose at least three event actions`);
    assert.ok(actions.every((action) => action.source === 'event'));
  }
});

test('bag selector filters out crafting choices that cannot pay their material costs', () => {
  const game = {
    ...formalGame(),
    inventory: { materials: { 凝露草: 0, 雷纹草: 1 }, pills: {} }
  };
  const actions = selectEventActions({
    game,
    viewId: 'bag',
    now: new Date('2026-06-30T08:00:00.000Z')
  });

  assert.equal(actions.some((action) => action.eventId === 'alchemy_make_qi_pill'), false);
});

test('bag selector filters out market offers that cannot pay their spirit stone cost', () => {
  const base = formalGame();
  const game = {
    ...base,
    player: {
      ...base.player,
      spiritStones: 10
    }
  };
  const actions = selectEventActions({
    game,
    viewId: 'bag',
    now: new Date('2026-06-30T08:00:00.000Z')
  });

  assert.equal(actions.some((action) => action.eventId === 'black_market_offer'), false);
});

test('relation effects target the intended npc only', () => {
  const game = formalGame();
  const next = applyEffects(game, [
    { type: 'relation', npcId: 'lin_shijie', delta: 4 },
    { type: 'relation', npcId: 'xuanheng', delta: 5 }
  ]);

  const lin = next.npcs.find((npc) => npc.name === '林师姐');
  const elder = next.npcs.find((npc) => npc.name === '玄衡长老');

  assert.equal(lin.affinity, game.npcs.find((npc) => npc.name === '林师姐').affinity + 4);
  assert.equal(elder.affinity, game.npcs.find((npc) => npc.name === '玄衡长老').affinity + 5);
});

test('sect events update authoritative sect relation instead of dead state', () => {
  const game = formalGame();
  const event = EVENT_CATALOG.find((candidate) => candidate.id === 'sect_trial_notice');
  const choice = event.choices.find((candidate) => candidate.id === 'join');
  const result = resolveChoice({
    game,
    event,
    choice,
    now: new Date('2026-06-30T08:00:00.000Z')
  });

  assert.equal(result.game.player.sectRelation, game.player.sectRelation + 15);
  assert.equal('sect' in result.game, false);
});
