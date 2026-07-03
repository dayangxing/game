import { ATTRIBUTE_KEYS, deriveMaxHealth, deriveMaxLifespan } from '../attributes.js';
import { calculateDerivedBonuses, grantTechnique, grantTreasure } from '../rewards.js';
import { applyTimePressure } from '../time/timePressure.js';

export function resolveChoice({ game, event, choice, now }) {
  const outcome = choice.success;
  const withEffects = applyEffects(game, outcome.effects);
  const pressure = game.onboarding?.completed === false
    ? { game: withEffects, timeResult: null }
    : applyTimePressure({
      game: withEffects,
      action: { title: choice.label, command: choice.command, source: 'event' },
      command: choice.command,
      category: event.category === 'realm' ? 'explore' : undefined,
      source: 'event'
    });
  const next = pressure.game;
  const turn = game.turn + 1;
  const entry = {
    id: `turn-${turn}`,
    title: event.title,
    command: choice.command,
    body: outcome.text,
    npcLine: '',
    worldEvent: event.title
  };
  return {
    game: {
      ...next,
      turn,
      version: turn,
      log: [...next.log, entry],
      timeline: [...next.timeline, { type: event.category, title: event.title, detail: outcome.text }],
      worldEvents: [...next.worldEvents, { title: event.title, detail: outcome.text, turn }],
      cooldowns: { ...next.cooldowns, [event.id]: turn }
    },
    entry,
    outcome,
    ruleResult: {
      success: true,
      eventId: event.id,
      choiceId: choice.id,
      resolvedAt: now.toISOString(),
      lifespanCost: pressure.timeResult?.baseLifespanCost ?? 0,
      timeResult: pressure.timeResult
    }
  };
}

export function applyEffects(game, effects) {
  preflightEffects(game, effects);
  return effects.reduce((next, effect) => applyEffect(next, effect), structuredClone(game));
}

export function canAffordEffects(game, effects) {
  try {
    preflightEffects(game, effects);
    return true;
  } catch (error) {
    if (error.message.startsWith('CHOICE_REQUIREMENT_FAILED:')) {
      return false;
    }
    throw error;
  }
}

function applyEffect(game, effect) {
  if (effect.type === 'stat') return updatePath(game, effect.path, effect.delta);
  if (effect.type === 'item') return updateItem(game, effect.path, effect.delta);
  if (effect.type === 'flag') return { ...game, flags: { ...game.flags, [effect.id]: effect.value } };
  if (effect.type === 'treasure') return grantTreasure(game, effect.id);
  if (effect.type === 'technique') return grantTechnique(game, effect.id);
  if (effect.type === 'futureEvent') {
    return {
      ...game,
      karma: {
        ...game.karma,
        futureEventFlags: [...new Set([...(game.karma?.futureEventFlags ?? []), effect.id])]
      }
    };
  }
  if (effect.type === 'relation') {
    return {
      ...game,
      npcs: game.npcs.map((npc) => isTargetNpc(npc, effect.npcId)
        ? { ...npc, affinity: Math.max(0, Math.min(100, npc.affinity + effect.delta)) }
        : npc)
    };
  }
  if (effect.type === 'vitality') {
    const currentHealth = game.player?.health ?? 0;
    const maxHealth = game.player?.maxHealth ?? currentHealth;
    return {
      ...game,
      player: {
        ...game.player,
        health: clamp(currentHealth + effect.delta, 0, maxHealth)
      }
    };
  }
  if (effect.type === 'maxHealth') {
    const maxHealth = Math.max(0, (game.player?.maxHealth ?? 0) + effect.delta);
    return {
      ...game,
      player: {
        ...game.player,
        maxHealth,
        health: clamp(game.player?.health ?? 0, 0, maxHealth)
      }
    };
  }
  if (effect.type === 'lifespan') {
    const currentLifespan = game.player?.lifespan ?? 0;
    const maxLifespan = game.player?.maxLifespan ?? currentLifespan;
    return {
      ...game,
      player: {
        ...game.player,
        lifespan: clamp(currentLifespan + effect.delta, 0, maxLifespan)
      }
    };
  }
  if (effect.type === 'maxLifespan') {
    const maxLifespan = Math.max(0, (game.player?.maxLifespan ?? 0) + effect.delta);
    return {
      ...game,
      player: {
        ...game.player,
        maxLifespan,
        lifespan: clamp(game.player?.lifespan ?? 0, 0, maxLifespan)
      }
    };
  }
  if (effect.type === 'attribute') {
    return applyAttributeEffect(game, effect);
  }
  if (effect.type === 'sect') {
    return {
      ...game,
      player: {
        ...game.player,
        sectRelation: clamp((game.player?.sectRelation ?? 0) + effect.delta, 0, 100)
      }
    };
  }
  if (effect.type === 'karma') return { ...game, karma: { ...game.karma, karma: (game.karma?.karma ?? 0) + effect.delta } };
  if (effect.type === 'evil') return { ...game, karma: { ...game.karma, evil: (game.karma?.evil ?? 0) + effect.delta } };
  throw new Error(`RULE_EFFECT_INVALID:${effect.type}`);
}

function updatePath(game, path, delta) {
  const [scope, key] = path.split('.');
  return { ...game, [scope]: { ...game[scope], [key]: (game[scope]?.[key] ?? 0) + delta } };
}

function updateItem(game, path, delta) {
  const [bucket, id] = path.split('.');
  const inventory = game.inventory ?? { materials: {}, pills: {} };
  const current = inventory[bucket]?.[id] ?? 0;
  return {
    ...game,
    inventory: {
      ...inventory,
      [bucket]: {
        ...inventory[bucket],
        [id]: Math.max(0, current + delta)
      }
    }
  };
}

function preflightEffects(game, effects) {
  const balances = new Map();

  for (const effect of effects) {
    if (effect.type === 'item') {
      const key = effect.path;
      const current = balances.has(key)
        ? balances.get(key)
        : getItemValue(game, effect.path);
      const next = current + effect.delta;

      if (next < 0) {
        throw new Error(`CHOICE_REQUIREMENT_FAILED:${effect.path}`);
      }

      balances.set(key, next);
      continue;
    }

    if (effect.type === 'stat') {
      const key = effect.path;
      const current = balances.has(key)
        ? balances.get(key)
        : getStatValue(game, effect.path);
      const next = current + effect.delta;

      if (next < 0) {
        throw new Error(`CHOICE_REQUIREMENT_FAILED:${effect.path}`);
      }

      balances.set(key, next);
    }
  }
}

function getItemValue(game, path) {
  const [bucket, id] = path.split('.');
  return game.inventory?.[bucket]?.[id] ?? 0;
}

function getStatValue(game, path) {
  const [scope, key] = path.split('.');
  return game[scope]?.[key] ?? 0;
}

function isTargetNpc(npc, npcId) {
  const aliases = {
    lin_shijie: '林师姐',
    xuanheng: '玄衡长老'
  };
  return npc.name === aliases[npcId];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function applyAttributeEffect(game, effect) {
  if (!ATTRIBUTE_KEYS.includes(effect.key)) {
    throw new Error(`RULE_EFFECT_INVALID:attribute:${effect.key}`);
  }

  const attributes = {
    ...(game.character?.attributes ?? {}),
    [effect.key]: clamp(((game.character?.attributes?.[effect.key] ?? 1) + effect.delta), 1, 10)
  };
  const maxHealth = deriveMaxHealth(attributes);
  const maxLifespan = deriveMaxLifespan(game.character?.initialLifespan ?? 0, attributes);
  const derivedBonuses = calculateDerivedBonuses(game);

  return {
    ...game,
    character: {
      ...game.character,
      attributes,
      comprehension: (attributes.comprehension ?? 1) * 9,
      physique: (attributes.rootBone ?? 1) * 9,
      luck: (attributes.fortune ?? 1) * 9
    },
    player: {
      ...game.player,
      maxHealth: maxHealth + (derivedBonuses.maxHealth ?? 0),
      health: clamp(game.player?.health ?? 0, 0, maxHealth + (derivedBonuses.maxHealth ?? 0)),
      maxLifespan: maxLifespan + (derivedBonuses.maxLifespan ?? 0),
      lifespan: clamp(game.player?.lifespan ?? 0, 0, maxLifespan + (derivedBonuses.maxLifespan ?? 0))
    },
    derivedBonuses
  };
}
