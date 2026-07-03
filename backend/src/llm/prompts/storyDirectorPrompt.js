import {
  ALLOWED_EFFECT_DIRECTIONS,
  ALLOWED_EFFECT_INTENSITIES,
  ALLOWED_EFFECT_TARGETS
} from '../../domain/director/effectHints.js';

const SYSTEM_PROMPT = [
  '你是《问道浮生》的连续剧情导演。',
  '你负责根据角色状态、近期剧情、人物关系和伏笔，生成下一段连续剧情。',
  '你可以生成行动选项，但只能给 effectHints 这种模糊影响判断。',
  '不得输出具体数值，例如寿元-3、好感+5、灵力+12。',
  '不得让玩家获得未授权高阶功法、宝物、境界或主线真相。',
  'NPC 没有剧情必要时不要出场；出场时只能使用已知 NPC。',
  '输出必须是合法 JSON object，不要 Markdown、代码块、解释文字或系统提示。',
  '',
  '允许的 effectHints target：',
  ALLOWED_EFFECT_TARGETS.join(', '),
  '允许的 direction：',
  ALLOWED_EFFECT_DIRECTIONS.join(', '),
  '允许的 intensity：',
  ALLOWED_EFFECT_INTENSITIES.join(', '),
  '',
  '输出 schema：',
  '{',
  '  "scene": "string，120到260个汉字，连续剧情正文",',
  '  "mode": "continue 或 choice",',
  '  "npcLines": [{"npcId":"string","speaker":"string","line":"string"}],',
  '  "effectHints": [{"target":"string","direction":"string","intensity":"string","topic":"string"}],',
  '  "choices": [{"id":"string","text":"string","tone":"string","effectHints":[...]}],',
  '  "memoryHints": ["string"]',
  '}'
].join('\n');

export function buildStoryDirectorMessages({ game, input }) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'continuous_story_director',
        instruction: '生成连续剧情。选择可以由你生成，具体数值由后端规则结算。',
        input: pickInput(input),
        context: pickContext(game),
        hardConstraints: [
          '不得输出具体数值。',
          '不得生成与近期剧情无关的选项。',
          '不得暴露 JSON 字段给玩家。',
          '没有 NPC 参与时 npcLines 必须为空数组。',
          'mode 为 choice 时 choices 必须有 2 到 4 项。',
          'mode 为 continue 时 choices 必须为空数组。'
        ]
      })
    }
  ];
}

function pickInput(input = {}) {
  return {
    type: input.type === 'choice' ? 'choice' : 'continue',
    choiceText: text(input.choiceText),
    previousScene: text(input.previousScene)
  };
}

function pickContext(game) {
  const memory = game.storyMemory ?? {};
  return {
    turn: game.turn,
    calendar: game.calendar,
    player: {
      name: game.player?.name,
      realm: game.player?.realm,
      location: game.player?.location,
      health: game.player?.health,
      maxHealth: game.player?.maxHealth,
      lifespan: game.player?.lifespan,
      maxLifespan: game.player?.maxLifespan,
      qi: game.player?.qi,
      mood: game.player?.mood,
      cultivationProgress: game.player?.cultivationProgress,
      sectRelation: game.player?.sectRelation
    },
    attributes: game.character?.attributes ?? {},
    resources: {
      treasures: (game.treasures ?? []).slice(-4).map((item) => item.name),
      techniques: (game.techniques ?? []).slice(-4).map((item) => item.name),
      pills: Object.keys(game.inventory?.pills ?? {}).slice(0, 6),
      materials: Object.keys(game.inventory?.materials ?? {}).slice(0, 6)
    },
    npcs: (game.npcs ?? []).map((npc) => ({
      name: npc.name,
      role: npc.role,
      affinity: npc.affinity,
      tone: npc.tone,
      memories: (npc.memories ?? []).slice(-3)
    })),
    storyMemory: {
      longSummary: text(memory.longSummary),
      openThreads: (memory.openThreads ?? []).slice(-8).map(pickThread),
      characterNotes: (memory.characterNotes ?? []).slice(-6).map(pickCharacterNote)
    },
    recentTurns: (memory.recentTurns ?? []).slice(-10).map(pickRecentTurn)
  };
}

function pickThread(thread) {
  return {
    title: text(thread?.title),
    detail: text(thread?.detail),
    status: text(thread?.status)
  };
}

function pickCharacterNote(note) {
  return {
    name: text(note?.name),
    role: text(note?.role),
    affinity: Number.isFinite(note?.affinity) ? note.affinity : 0,
    tone: text(note?.tone),
    memories: Array.isArray(note?.memories) ? note.memories.slice(-3).map(text) : []
  };
}

function pickRecentTurn(turn) {
  return {
    turn: Number.isFinite(turn?.turn) ? turn.turn : 0,
    title: text(turn?.title),
    action: text(turn?.action),
    outcome: text(turn?.outcome),
    npcLine: text(turn?.npcLine),
    worldEvent: text(turn?.worldEvent)
  };
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}
