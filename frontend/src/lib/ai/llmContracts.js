export const deterministicResponsibilities = [
  'player_stats',
  'inventory',
  'realm_progression',
  'rule_resolution',
  'random_seed_resolution',
  'save_load',
  'content_safety_gate',
  'payment_and_auth',
  'audit_log'
];

export const llmResponsibilities = [
  'daily_action_generation',
  'narrative_polish',
  'npc_voice',
  'event_description',
  'memory_summary',
  'foreshadow_suggestion'
];

export const llmResponseSchemas = {
  dailyActions: {
    name: 'DailyActionOptions',
    shape: {
      actions: [
        {
          id: 'string',
          title: 'string',
          command: 'string',
          icon: 'string',
          meta: 'string',
          storyHook: 'string',
          risk: 'low | medium | high'
        }
      ]
    }
  },
  narration: {
    name: 'TurnNarration',
    shape: {
      title: 'string',
      body: 'string',
      npcLine: 'string',
      foreshadow: 'string',
      suggestedTone: 'restrained | dramatic | poetic'
    }
  }
};

export function buildDailyActionsRequest(game, view) {
  return {
    task: 'daily_action_generation',
    schema: llmResponseSchemas.dailyActions.name,
    context: {
      player: pickPlayerContext(game),
      calendar: game.calendar,
      view: {
        id: view.id,
        label: view.label,
        title: view.title,
        description: view.description
      },
      recentLog: game.log.slice(-3).map(pickLogContext),
      npcs: game.npcs.map(pickNpcContext),
      worldEvents: game.worldEvents.slice(-5),
      foreshadows: game.foreshadows
    },
    constraints: [
      '只生成每日行动选项，不得直接修改数值。',
      '每个行动必须能转化为一条 command 字符串，由规则引擎结算。',
      '不得生成违法、低俗、现实伤害诱导内容。',
      '行动应符合当前境界和修仙世界观。'
    ]
  };
}

export function buildNarrationRequest(beforeGame, afterGame, action) {
  return {
    task: 'narrative_polish',
    schema: llmResponseSchemas.narration.name,
    context: {
      before: pickGameDeltaContext(beforeGame),
      after: pickGameDeltaContext(afterGame),
      action,
      resolvedEntry: afterGame.log.at(-1),
      npcs: afterGame.npcs.map(pickNpcContext),
      worldEvents: afterGame.worldEvents.slice(-5)
    },
    constraints: [
      '不得改写规则结算结果。',
      '不得增加未在 after 状态中出现的奖励、境界、道具或关系变化。',
      '可以润色环境描写、NPC语气、心理刻画和伏笔表达。',
      '输出必须符合 schema，便于前后端安全解析。'
    ]
  };
}

function pickPlayerContext(game) {
  return {
    name: game.player.name,
    realm: game.player.realm,
    spiritualRoot: game.player.spiritualRoot,
    qi: game.player.qi,
    mood: game.player.mood,
    cultivationProgress: game.player.cultivationProgress,
    sectRelation: game.player.sectRelation,
    location: game.player.location
  };
}

function pickGameDeltaContext(game) {
  return {
    turn: game.turn,
    calendar: game.calendar,
    player: pickPlayerContext(game)
  };
}

function pickNpcContext(npc) {
  return {
    name: npc.name,
    role: npc.role,
    affinity: npc.affinity,
    memories: npc.memories.slice(-3)
  };
}

function pickLogContext(entry) {
  return {
    title: entry.title,
    command: entry.command,
    worldEvent: entry.worldEvent
  };
}
