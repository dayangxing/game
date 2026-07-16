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
  assert.equal(result.game.player.lifespan, game.player.lifespan - 2);
  assert.ok(result.entry.body.includes('赠丹'));
  assert.equal(result.entry.npcLine, '');
  assert.equal(result.ruleResult.success, true);
  assert.equal(result.ruleResult.lifespanCost, 2);
  assert.equal(result.ruleResult.timeResult.label, '一月');
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

test('event selector rotates away recently resolved events beyond the current-turn cooldown', () => {
  const game = {
    ...formalGame(),
    turn: 4,
    cooldowns: {
      sect_trial_notice: 2,
      sect_elder_split: 3
    }
  };
  const actions = selectEventActions({
    game,
    viewId: 'home',
    now: new Date('2026-07-01T08:00:00.000Z')
  });
  const eventIds = actions.map((action) => action.eventId);

  assert.equal(eventIds.includes('sect_trial_notice'), false);
  assert.equal(eventIds.includes('sect_elder_split'), false);
  assert.ok(eventIds.some((eventId) => eventId !== 'sect_trial_notice' && eventId !== 'sect_elder_split'));
});

test('event selector mixes categories instead of filling the day with one repeated lane', () => {
  const game = {
    ...formalGame(),
    turn: 5,
    flags: {
      lifespan_mark: true
    },
    karma: {
      ...formalGame().karma,
      futureEventFlags: ['old_friend_returns', 'elder_private_warning']
    }
  };
  const actions = selectEventActions({
    game,
    viewId: 'home',
    now: new Date('2026-07-01T08:00:00.000Z')
  });
  const categories = new Set(actions.map((action) => action.category));

  assert.ok(actions.length >= 3);
  assert.ok(categories.size >= 3, `expected mixed categories, got ${[...categories].join(',')}`);
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

test('realm selector surfaces the unlocked mist step reward event', () => {
  const base = formalGame();
  const game = {
    ...base,
    karma: {
      ...base.karma,
      futureEventFlags: ['elder_private_warning']
    }
  };
  const actions = selectEventActions({
    game,
    viewId: 'realm',
    now: new Date('2026-07-01T08:00:00.000Z')
  });

  assert.equal(actions.some((action) => action.eventId === 'mist_lantern_path'), true);
});

test('home selector does not globally boost unrelated unlocked future events', () => {
  const base = formalGame();
  const game = {
    ...base,
    karma: {
      ...base.karma,
      futureEventFlags: ['old_friend_returns']
    }
  };
  const actions = selectEventActions({
    game,
    viewId: 'home',
    now: new Date('2026-07-01T08:00:00.000Z')
  });

  assert.equal(actions.some((action) => action.eventId === 'old_friend_returns'), false);
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

test('reward events seed treasure and technique effects into the catalog', () => {
  const bell = EVENT_CATALOG.find((event) => event.id === 'mist_bronze_bell');
  const guidance = EVENT_CATALOG.find((event) => event.id === 'master_guidance');
  const lantern = EVENT_CATALOG.find((event) => event.id === 'mist_lantern_path');

  assert.equal(bell.choices.some((choice) => choice.success.effects.some((effect) => effect.type === 'treasure' && effect.id === 'calm_lotus_incense')), true);
  assert.equal(guidance.choices.some((choice) => choice.success.effects.some((effect) => effect.type === 'technique' && effect.id === 'qingmu_jue')), true);
  assert.equal(lantern.choices.some((choice) => choice.success.effects.some((effect) => effect.type === 'technique' && effect.id === 'mist_step')), true);
});

test('effect resolver grants treasure and technique rewards from event choices', () => {
  const game = {
    ...formalGame(),
    karma: {
      ...formalGame().karma,
      futureEventFlags: ['elder_private_warning']
    }
  };
  const bellEvent = EVENT_CATALOG.find((event) => event.id === 'mist_bronze_bell');
  const bellChoice = bellEvent.choices.find((choice) => choice.id === 'approach');
  const guidanceEvent = EVENT_CATALOG.find((event) => event.id === 'master_guidance');
  const guidanceChoice = guidanceEvent.choices.find((choice) => choice.id === 'stabilize');
  const lanternEvent = EVENT_CATALOG.find((event) => event.id === 'mist_lantern_path');
  const lanternChoice = lanternEvent.choices.find((choice) => choice.id === 'follow');

  const afterTreasure = resolveChoice({
    game,
    event: bellEvent,
    choice: bellChoice,
    now: new Date('2026-07-01T08:00:00.000Z')
  }).game;
  const afterQingmu = resolveChoice({
    game,
    event: guidanceEvent,
    choice: guidanceChoice,
    now: new Date('2026-07-01T08:00:00.000Z')
  }).game;
  const afterMistStep = resolveChoice({
    game,
    event: lanternEvent,
    choice: lanternChoice,
    now: new Date('2026-07-01T08:00:00.000Z')
  }).game;

  assert.equal(afterTreasure.treasures[0].id, 'calm_lotus_incense');
  assert.equal(afterTreasure.derivedBonuses.breakthroughChance, 3);
  assert.equal(afterQingmu.techniques[0].id, 'qingmu_jue');
  assert.equal(afterQingmu.derivedBonuses.cultivationGain, 6);
  assert.equal(afterMistStep.techniques[0].id, 'mist_step');
  assert.equal(afterMistStep.derivedBonuses.damageReduction, 5);
});

test('story progress effects can only set whitelisted branch fields', () => {
  const game = formalGame();
  const next = applyEffects(game, [
    { type: 'storyProgress', path: 'contractStance', value: 'reject' },
    { type: 'storyProgress', path: 'finalChoiceMade', value: true }
  ]);

  assert.equal(next.storyProgress.contractStance, 'reject');
  assert.equal(next.storyProgress.finalChoiceMade, true);
  assert.throws(
    () => applyEffects(game, [{ type: 'storyProgress', path: 'endingId', value: 'break_contract' }]),
    /RULE_EFFECT_INVALID:storyProgress/
  );
});

test('side event repeat rewards decay while costs and persistent flags remain intact', () => {
  const game = {
    ...formalGame(),
    eventHistory: {
      resolved: ['side'],
      repeatCounts: { side: 1 },
      lastResolvedTurn: { side: 2 }
    }
  };
  const event = {
    id: 'side',
    category: 'social',
    cadence: 'side',
    oneShot: false,
    cooldownTurns: 1,
    choices: [{
      id: 'help',
      label: '援手',
      command: '援手',
      risk: 'low',
      success: {
        text: '帮助',
        effects: [
          { type: 'stat', path: 'player.qi', delta: 10 },
          { type: 'stat', path: 'player.lifespan', delta: -2 },
          { type: 'flag', id: 'helped', value: true }
        ]
      }
    }]
  };
  const result = resolveChoice({
    game,
    event,
    choice: event.choices[0],
    now: new Date('2026-07-02T00:00:00.000Z')
  });

  assert.equal(result.game.player.qi, game.player.qi + 5);
  assert.equal(
    result.game.player.lifespan,
    game.player.lifespan - 2 + result.ruleResult.timeResult.netLifespanDelta
  );
  assert.equal(result.game.flags.helped, true);
  assert.equal(result.game.eventHistory.repeatCounts.side, 2);
});

test('resolved mainline events are never selected again in the same chapter', () => {
  const base = formalGame();
  const target = EVENT_CATALOG.find((event) => event.id === 'cultivation_breathing');
  const previousOneShot = target.oneShot;
  target.oneShot = true;
  const game = {
    ...base,
    storyProgress: { ...base.storyProgress, chapterId: 'prologue' },
    turn: 10,
    eventHistory: {
      resolved: ['cultivation_breathing'],
      repeatCounts: { cultivation_breathing: 1 },
      lastResolvedTurn: { cultivation_breathing: 0 }
    }
  };
  try {
    const actions = selectEventActions({
      game,
      viewId: 'home',
      now: new Date('2026-07-03T00:00:00.000Z')
    });
    assert.equal(actions.some((action) => action.eventId === 'cultivation_breathing'), false);
  } finally {
    if (previousOneShot === undefined) delete target.oneShot;
    else target.oneShot = previousOneShot;
  }
});

test('side events respect event history recent-resolution protection', () => {
  const base = formalGame();
  const game = {
    ...base,
    storyProgress: { ...base.storyProgress, chapterId: 'prologue' },
    turn: 5,
    eventHistory: {
      resolved: ['master_guidance'],
      repeatCounts: { master_guidance: 1 },
      lastResolvedTurn: { master_guidance: 4 }
    }
  };
  const actions = selectEventActions({
    game,
    viewId: 'skills',
    now: new Date('2026-07-03T00:00:00.000Z')
  });

  assert.equal(actions.some((action) => action.eventId === 'master_guidance'), false);
});
