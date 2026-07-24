import {
  ALLOWED_EFFECT_DIRECTIONS,
  ALLOWED_EFFECT_INTENSITIES,
  ALLOWED_EFFECT_TARGETS
} from '../../domain/director/effectHints.js';
import { getStoryMemoryPromptContext } from '../../../../src/storyMemory.js';

const SYSTEM_PROMPT = [
  '你是《问道浮生》的连续剧情导演。',
  '你负责根据角色状态、近期剧情、人物关系和伏笔，生成下一段连续剧情。',
  '你可以生成行动选项，但只能给 effectHints 这种模糊影响判断。',
  '不得输出具体数值，例如寿元-3、好感+5、灵力+12。',
  '必须承认时间流逝，不要让连续剧情都像同一天。',
  '寿元低于 45% 时，要体现命火、白发、闭关成本或大限压力。',
  '寿元低于 20% 时，选项要更强调取舍：冒险推进、闭关续命、求助 NPC。',
  '可以暗示耗时更久、风险更高、可能养命，但不得输出具体数值。',
  '不得让玩家获得未授权高阶功法、宝物、境界或主线真相。',
  'NPC 没有剧情必要时不要出场；出场时只能使用已知 NPC。',
  '章节由后端规则层决定。你只能描写当前章节和后端已经提供的章节转场。',
  '不得创建章节、完成章节目标、修改真相旗标、修改契约立场或宣布结局 id。',
  '角色既定的身世、灵根和命格天赋是连续剧情事实，不得无依据改写或自相矛盾。',
  '如果当前状态已经结束，不得生成新的行动或继续推进剧情。',
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
  '  "choices": [{"id":"string","title":"string，2到8字短标题","text":"string，玩家可执行的行动描述","tone":"string","effectHints":[...]}],',
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
          '章节由后端规则层决定。你只能描写当前章节和后端已经提供的章节转场。',
          '不得创建章节、完成章节目标、修改真相旗标、修改契约立场或宣布结局 id。',
          '角色背景中的身世、灵根和命格天赋是既定事实，不得无依据改写。',
          '如果 storyMemory.summaryWindowStale 为 true，必须忽略 longSummary，只依据 rollingWindowTurns 和当前权威状态生成剧情。',
          '如果当前状态已经结束，不得生成新的行动或继续推进剧情。',
          '没有 NPC 参与时 npcLines 必须为空数组。',
          'mode 为 choice 时 choices 必须有 2 到 4 项。',
          '每个 choice 的 title 是简短摘要，不要直接重复 text；text 是完整的玩家行动描述。',
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
  const memoryContext = getStoryMemoryPromptContext(game);
  const summaryWindowStale = memoryContext.summaryWindowStale === true;
  return {
    turn: game.turn,
    calendar: game.calendar,
    chapter: pickChapter(game),
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
    characterBackground: {
      origin: text(game.character?.origin),
      spiritualRoot: text(game.character?.spiritualRoot),
      traits: Array.isArray(game.character?.traits)
        ? game.character.traits.slice(0, 6).map((trait) => text(trait)).filter(Boolean)
        : []
    },
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
      longSummary: memoryContext.longSummary,
      openThreads: (memory.openThreads ?? []).slice(-8).map(pickThread),
      characterNotes: (memory.characterNotes ?? []).slice(-6).map(pickCharacterNote),
      summaryThroughTurn: memoryContext.summaryThroughTurn,
      summaryWindowStartTurn: memoryContext.summaryWindowStartTurn,
      summaryWindowStale,
      unsummarizedTurns: memoryContext.unsummarizedTurns,
      unsummarizedTurnsTruncated: memoryContext.unsummarizedTurnsTruncated,
      ...(summaryWindowStale ? { rollingWindowTurns: memoryContext.rollingWindowTurns } : {})
    },
    timePressure: pickTimePressure(game.timePressure, game),
    recentTurns: summaryWindowStale ? [] : (memory.recentTurns ?? []).slice(-10).map(pickRecentTurn)
  };
}

function pickChapter(game) {
  const chapter = game.chapter;
  if (!chapter) return null;
  return {
    title: text(chapter.title),
    progress: Number.isFinite(chapter.progress) ? chapter.progress : 0,
    objectives: (chapter.objectives ?? []).map((objective) => ({
      text: text(objective?.text),
      completed: objective?.completed === true,
      required: objective?.required === true
    }))
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
    worldEvent: text(turn?.worldEvent),
    timeLabel: text(turn?.timeLabel),
    netLifespanDelta: Number.isFinite(turn?.netLifespanDelta) ? turn.netLifespanDelta : 0,
    warningLevel: text(turn?.warningLevel)
  };
}

function pickTimePressure(timePressure = {}, game = {}) {
  const player = game.player ?? {};
  const maxLifespan = Number.isFinite(player.maxLifespan)
    ? player.maxLifespan
    : Number.isFinite(timePressure.maxLifespan)
      ? timePressure.maxLifespan
      : 1;
  const remainingLifespan = Number.isFinite(player.lifespan)
    ? player.lifespan
    : Number.isFinite(timePressure.remainingLifespan)
      ? timePressure.remainingLifespan
      : 0;

  return {
    calendarLabel: text(timePressure.calendarLabel),
    elapsedYears: Number.isFinite(timePressure.elapsedYears) ? timePressure.elapsedYears : 0,
    remainingLifespan,
    maxLifespan,
    lifespanRatio: maxLifespan > 0 ? remainingLifespan / maxLifespan : 0,
    warningLevel: text(timePressure.warningLevel || 'steady'),
    lastDeltaTime: text(timePressure.lastDeltaTime),
    lastLifespanCost: Number.isFinite(timePressure.lastLifespanCost) ? timePressure.lastLifespanCost : 0,
    lastLongevityGain: Number.isFinite(timePressure.lastLongevityGain) ? timePressure.lastLongevityGain : 0,
    lastNetLifespanDelta: Number.isFinite(timePressure.lastNetLifespanDelta) ? timePressure.lastNetLifespanDelta : 0,
    recentRecoveryFatigue: Number.isFinite(timePressure.recentRecoveryFatigue) ? timePressure.recentRecoveryFatigue : 0
  };
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}
