export function buildTurnResult({ before, after, actionId, narration }) {
  const entry = after.log.at(-1);

  return {
    turn: after.turn,
    actionId,
    ruleResult: {
      success: true,
      statChanges: diffStats(before.player, after.player)
    },
    narration: narration ?? {
      title: entry.title,
      body: entry.body,
      npcLine: entry.npcLine,
      foreshadow: after.foreshadows.at(-1) ?? ''
    }
  };
}

function diffStats(beforePlayer, afterPlayer) {
  const numericStats = ['qi', 'mood', 'cultivationProgress', 'spiritStones', 'sectRelation', 'health', 'maxHealth', 'lifespan', 'maxLifespan'];
  const changes = {};

  for (const key of numericStats) {
    const before = beforePlayer[key];
    const after = afterPlayer[key];
    if (typeof before === 'number' && typeof after === 'number' && before !== after) {
      changes[key] = after - before;
    }
  }

  if (beforePlayer.realm !== afterPlayer.realm) {
    changes.realm = afterPlayer.realm;
  }

  return changes;
}
