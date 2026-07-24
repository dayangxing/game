const LONG_SUMMARY_SYSTEM_PROMPT = [
  '你是《问道浮生》的长期记忆压缩 agent。',
  '请把输入中的已知剧情事实压缩为简洁、连贯的中文长期摘要，供后续剧情模型读取。',
  '这是一个最近 50 个正式回合的 rolling window（滚动窗口）；摘要不能让上下文随回合无限膨胀。',
  '输出只能是合法 JSON object，不得包含 Markdown、代码块、解释文字或额外字段。',
  '',
  '事实边界：',
  '1. 只能重组和压缩输入中明确出现的事实，不得创造事实，不得创造人物、事件、因果、奖励、道具、功法、伏笔或主线真相。',
  '2. 不得改变数字状态，不得推测或重新计算任何数字；game.player 和当前事实中的数值以规则状态为准。',
  '3. 必须保留角色的出身（身世）、灵根、命格天赋，以及输入中仍未解决的主线和伏笔。',
  '4. 必须区分已经发生的结果、当前状态和未解决线索，不得把传闻写成已证实事实。',
  '5. sourceTurns 是当前 rolling window 内的回合事实；不得补写窗口外未提供的回合。',
  '6. rebase=true 表示重建窗口：不得继承或引用窗口外的 previousSummary，只能依据 sourceTurns、openingAnchor（如有）和 currentFacts 生成。',
  '7. 必须保留 currentFacts 中的当前权威事实；不得用旧摘要或剧情推断覆盖规则状态。',
  '',
  '写作要求：',
  '1. 使用中文，优先保留身份事实、重要因果、关键人物关系和未解决主线。',
  '2. 只保留对后续剧情有用的长期信息，避免逐字复述普通行动。',
  '3. summary 必须控制在 420 个字符以内。',
  '4. coveredThroughTurn 必须是实际被摘要覆盖的 sourceTurns 中最高回合号；没有可覆盖回合时返回 0。',
  '',
  '输出 schema：',
  '{',
  '  "summary": "string，420 字符以内的中文长期剧情事实摘要",',
  '  "coveredThroughTurn": "integer，实际覆盖的最高 sourceTurns.turn，不得超过输入回合"',
  '}'
].join('\n');

export function buildLongSummaryMessages({
  game = {},
  previousSummary = '',
  sourceTurns = [],
  summaryWindowStartTurn = 0,
  summaryWindowEndTurn,
  rebase = false,
  openingAnchor = null
} = {}) {
  const turns = Array.isArray(sourceTurns)
    ? sourceTurns
    : Array.isArray(sourceTurns?.turns)
      ? sourceTurns.turns
      : [];
  const storyMemory = game.storyMemory ?? {};
  const windowStart = normalizeTurn(summaryWindowStartTurn, 0);
  const windowEnd = normalizeTurn(
    summaryWindowEndTurn,
    turns.reduce((highest, turn) => Math.max(highest, normalizeTurn(turn?.turn, 0)), normalizeTurn(game.turn, 0))
  );
  const isRebase = rebase === true;

  return [
    {
      role: 'system',
      content: LONG_SUMMARY_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'long_story_summary',
        instruction: isRebase
          ? '重建最近 50 个正式回合的 rolling window 摘要。只依据 sourceTurns、openingAnchor 和 currentFacts，不继承窗口外旧摘要。'
          : '根据当前事实、旧摘要和 rolling window 内新增回合生成长期剧情事实摘要。只压缩事实，不改变规则状态。',
        summaryWindowStartTurn: windowStart,
        summaryWindowEndTurn: windowEnd,
        rebase: isRebase,
        openingAnchor: openingAnchor ?? null,
        currentFacts: pickCurrentFacts(game),
        previousSummary: isRebase ? '' : text(previousSummary),
        sourceTurns: turns,
        openThreads: isRebase
          ? []
          : (Array.isArray(storyMemory.openThreads) ? storyMemory.openThreads : []),
        outputSchema: {
          summary: 'string，420 字符以内的中文长期剧情事实摘要',
          coveredThroughTurn: 'integer，实际覆盖的最高 sourceTurns.turn；不得超过输入回合'
        },
        hardConstraints: [
          'sourceTurns 必须被视为最近 50 个正式回合的 rolling window，不能从窗口外补写事实。',
          '不得创造输入中没有的事实，不得把推测、传闻或未解线索写成已证实结果。',
          '不得改变 game.player 或其他当前事实中的数字状态。',
          '必须保留角色出身、灵根、命格天赋和未解决主线。',
          '必须保留 currentFacts 中的当前权威事实。',
          'summary 必须不超过 420 个字符。',
          ...(isRebase ? ['rebase=true 时不得使用 previousSummary，只能依据 sourceTurns、openingAnchor 和 currentFacts。'] : []),
          'coveredThroughTurn 只能表示本次实际摘要覆盖到的输入回合。'
        ]
      })
    }
  ];
}

function normalizeTurn(value, fallback) {
  const turn = Number(value);
  return Number.isFinite(turn) ? Math.max(0, Math.trunc(turn)) : fallback;
}

function pickCurrentFacts(game) {
  const character = game.character ?? {};
  const player = game.player ?? {};

  return {
    turn: integerOrZero(game.turn),
    calendar: game.calendar ?? null,
    characterBackground: {
      name: text(character.name ?? player.name),
      origin: text(character.origin ?? player.origin),
      spiritualRoot: text(character.spiritualRoot ?? player.spiritualRoot),
      traits: arrayOfText(character.traits),
      attributes: character.attributes && typeof character.attributes === 'object'
        ? character.attributes
        : {}
    },
    player: {
      name: text(player.name),
      realm: text(player.realm),
      location: text(player.location),
      health: numberOrZero(player.health),
      maxHealth: numberOrZero(player.maxHealth),
      lifespan: numberOrZero(player.lifespan),
      maxLifespan: numberOrZero(player.maxLifespan),
      qi: numberOrZero(player.qi),
      mood: numberOrZero(player.mood),
      cultivationProgress: numberOrZero(player.cultivationProgress),
      spiritStones: numberOrZero(player.spiritStones),
      sectRelation: numberOrZero(player.sectRelation)
    },
    chapter: pickChapter(game.chapter),
    resources: {
      treasures: Array.isArray(game.treasures)
        ? game.treasures.map((item) => text(item?.name)).filter(Boolean)
        : [],
      techniques: Array.isArray(game.techniques)
        ? game.techniques.map((item) => text(item?.name)).filter(Boolean)
        : [],
      pills: Object.keys(game.inventory?.pills ?? {}),
      materials: Object.keys(game.inventory?.materials ?? {})
    },
    npcs: Array.isArray(game.npcs)
      ? game.npcs.map((npc) => ({
        name: text(npc?.name),
        role: text(npc?.role),
        affinity: numberOrZero(npc?.affinity),
        tone: text(npc?.tone),
        memories: arrayOfText(npc?.memories).slice(-3)
      }))
      : [],
    foreshadows: arrayOfText(game.foreshadows),
    worldEvents: Array.isArray(game.worldEvents) ? game.worldEvents.slice(-8) : []
  };
}

function pickChapter(chapter) {
  if (!chapter || typeof chapter !== 'object') return null;
  return {
    title: text(chapter.title),
    progress: numberOrZero(chapter.progress),
    objectives: Array.isArray(chapter.objectives)
      ? chapter.objectives.map((objective) => ({
        text: text(objective?.text),
        completed: objective?.completed === true,
        required: objective?.required === true
      }))
      : []
  };
}

function arrayOfText(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function numberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function integerOrZero(value) {
  return Number.isInteger(value) ? value : 0;
}
