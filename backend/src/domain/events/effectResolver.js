export function resolveChoice({ game, event, choice, now }) {
  const outcome = choice.success;
  const next = applyEffects(game, outcome.effects);
  const turn = game.turn + 1;
  const entry = {
    id: `turn-${turn}`,
    title: event.title,
    command: choice.command,
    body: outcome.text,
    npcLine: '林师姐道：“因果既落，后面的路便会变。”',
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
      resolvedAt: now.toISOString()
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
  const itemBalances = new Map();

  for (const effect of effects) {
    if (effect.type !== 'item' || effect.delta >= 0) continue;
    const [bucket, id] = effect.path.split('.');
    const key = `${bucket}.${id}`;
    const current = itemBalances.has(key)
      ? itemBalances.get(key)
      : game.inventory?.[bucket]?.[id] ?? 0;
    const next = current + effect.delta;

    if (next < 0) {
      throw new Error(`CHOICE_REQUIREMENT_FAILED:${bucket}.${id}`);
    }

    itemBalances.set(key, next);
  }
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
