const RECENT_TURN_LIMIT = 8;
const THREAD_LIMIT = 8;
export const SUMMARY_WINDOW_TURNS = 50;
const UNSUMMARIZED_TURN_LIMIT = 8;
const UNSUMMARIZED_CHAR_LIMIT = 12000;
const LEGACY_LONG_SUMMARY = '雷木双灵根、雾隐秘境与飞升传闻已经成为长期疑云。';
const LEGACY_DEFAULT_ASCENSION_DETAIL = '宗门典籍与长老传闻中对飞升的说法仍有缺口。';

const STAT_KEYS = [
  'qi',
  'mood',
  'cultivationProgress',
  'spiritStones',
  'sectRelation',
  'health',
  'maxHealth',
  'lifespan',
  'maxLifespan'
];

const CORE_THREAD_DEFINITIONS = [
  {
    id: 'ascension_contract',
    title: '飞升骗局伏笔',
    priority: 'major',
    keywords: ['飞升', '天门', '残契', '旧契', '命格签契', '命格为注', '契影']
  },
  {
    id: 'mist_secret',
    title: '雾隐秘境疑云',
    priority: 'major',
    keywords: ['雾隐', '秘境', '雾中', '铜铃', '钟声']
  },
  {
    id: 'lifespan_anomaly',
    title: '寿元异常',
    priority: 'major',
    keywords: ['命火异常', '命火微暗', '寿元异常', '寿元流失', '灰痕', '契印']
  },
  {
    id: 'thunderwood_omen',
    title: '雷木双息异兆',
    priority: 'minor',
    keywords: ['雷木双灵根', '雷木双息', '异常天劫', '雷木反噬']
  },
  {
    id: 'qingyun_shadow',
    title: '青云宗暗线',
    priority: 'minor',
    keywords: ['青云宗暗线', '宗门遮掩', '长老争执', '封门', '开门']
  }
];

export function normalizeStoryMemory(memory, game) {
  const legacyRecentTurns = sanitizeRecentTurns(memory?.recentTurns);
  const recentTurns = legacyRecentTurns.length ? legacyRecentTurns : openingRecentTurns(game);
  const openThreads = sanitizeThreads(memory?.openThreads).filter((thread) => (
    !(thread.id === 'ascension_contract' && thread.detail === LEGACY_DEFAULT_ASCENSION_DETAIL)
  ));
  const characterNotes = sanitizeCharacterNotes(memory?.characterNotes);
  const summaryThroughTurn = Number.isFinite(memory?.summaryThroughTurn)
    ? Math.max(0, normalizeTurnNumber(memory.summaryThroughTurn, 0))
    : (legacyRecentTurns.length
      ? Math.max(0, Math.min(...legacyRecentTurns.map((entry) => entry.turn)) - 1)
      : 0);

  return {
    longSummary: normalizeLongSummary(memory?.longSummary, game),
    recentTurns,
    openThreads: openThreads.length ? openThreads : threadsFromForeshadows(game?.foreshadows),
    resolvedThreads: sanitizeThreads(memory?.resolvedThreads),
    characterNotes: characterNotes.length ? characterNotes : notesFromNpcs(game?.npcs),
    lastUpdatedTurn: Number.isFinite(memory?.lastUpdatedTurn) ? memory.lastUpdatedTurn : (game?.turn ?? 0),
    summaryThroughTurn,
    summaryRevision: Number.isFinite(memory?.summaryRevision)
      ? Math.max(0, normalizeTurnNumber(memory.summaryRevision, 0))
      : 0,
    summaryWindowStartTurn: Number.isFinite(memory?.summaryWindowStartTurn)
      ? Math.max(0, normalizeTurnNumber(memory.summaryWindowStartTurn, 0))
      : 0
  };
}

export function selectUnsummarizedTurns(game, options = {}) {
  const normalizedMemory = normalizeStoryMemory(game?.storyMemory, game);
  const summaryThroughTurn = normalizedMemory.summaryThroughTurn;
  const sourceTurns = (Array.isArray(game?.log) ? game.log : [])
    .map((entry, index) => ({ entry, turn: normalizeLogTurn(entry, index) }))
    .filter(({ turn }) => turn > summaryThroughTurn)
    .map(({ entry, turn }) => projectNarrativeTurn(entry, turn));

  const maxTurns = Number.isFinite(options.maxTurns)
    ? Math.max(0, Math.floor(options.maxTurns))
    : UNSUMMARIZED_TURN_LIMIT;
  const maxChars = Number.isFinite(options.maxChars)
    ? Math.max(0, Math.floor(options.maxChars))
    : UNSUMMARIZED_CHAR_LIMIT;
  const preserveNewest = options.preserveNewest !== false;
  let turns = sourceTurns;
  let truncated = false;

  if (turns.length > maxTurns) {
    turns = maxTurns === 0 ? [] : preserveNewest ? turns.slice(-maxTurns) : turns.slice(0, maxTurns);
    truncated = true;
  }

  if (turns.length) {
    let usedChars = 0;
    const boundedTurns = [];

    const indexes = preserveNewest
      ? Array.from({ length: turns.length }, (_, index) => turns.length - 1 - index)
      : Array.from({ length: turns.length }, (_, index) => index);

    for (const index of indexes) {
      const turn = turns[index];
      const turnChars = JSON.stringify(turn).length;
      if (boundedTurns.length && usedChars + turnChars > maxChars) {
        truncated = true;
        break;
      }
      if (preserveNewest) boundedTurns.unshift(turn);
      else boundedTurns.push(turn);
      usedChars += turnChars;
    }

    turns = boundedTurns;
    if (sourceTurns.length > 0 && !turns.length) truncated = true;
  }

  return { turns, truncated };
}

export function selectRollingSummaryTurns(game, options = {}) {
  const maxTurns = Number.isFinite(options.maxTurns)
    ? Math.max(0, Math.floor(options.maxTurns))
    : SUMMARY_WINDOW_TURNS;
  const sourceEntries = (Array.isArray(game?.log) ? game.log : [])
    .map((entry, index) => ({ entry, turn: normalizeLogTurn(entry, index), index }));
  const openingAnchor = sourceEntries.find(({ turn }) => turn === 0);
  const formalByTurn = new Map();

  for (const item of sourceEntries) {
    if (item.turn <= 0 || isResourceLogEntry(item.entry)) continue;
    formalByTurn.set(item.turn, projectNarrativeTurn(item.entry, item.turn));
  }

  const formalTurns = [...formalByTurn.values()].sort((left, right) => left.turn - right.turn);
  const selectedFormalTurns = maxTurns === 0 ? [] : formalTurns.slice(-maxTurns);
  const turns = openingAnchor
    ? [projectNarrativeTurn(openingAnchor.entry, openingAnchor.turn), ...selectedFormalTurns]
    : selectedFormalTurns;
  const windowMoves = formalTurns.length > selectedFormalTurns.length;

  return {
    turns,
    startTurn: windowMoves ? (selectedFormalTurns[0]?.turn ?? 0) : 0,
    endTurn: selectedFormalTurns.at(-1)?.turn ?? 0,
    truncated: windowMoves
  };
}

export function getStoryMemoryPromptContext(game) {
  const memory = normalizeStoryMemory(game?.storyMemory, game);
  const rollingWindow = selectRollingSummaryTurns({ ...game, storyMemory: memory });
  const summaryWindowStale = memory.summaryWindowStartTurn < rollingWindow.startTurn;
  const unsummarized = selectUnsummarizedTurns({ ...game, storyMemory: memory });

  return {
    longSummary: summaryWindowStale ? '' : memory.longSummary,
    summaryThroughTurn: memory.summaryThroughTurn,
    summaryWindowStartTurn: memory.summaryWindowStartTurn,
    summaryWindowStale,
    unsummarizedTurns: summaryWindowStale ? [] : unsummarized.turns,
    unsummarizedTurnsTruncated: summaryWindowStale ? false : unsummarized.truncated,
    rollingWindowTurns: rollingWindow.turns
  };
}

export function withInitialStoryMemory(game) {
  return {
    ...game,
    storyMemory: normalizeStoryMemory(game.storyMemory, game)
  };
}

export function recordStoryMemoryTurn({ before, after, action, entry, narration }) {
  const baseMemory = normalizeStoryMemory(after.storyMemory ?? before?.storyMemory, before ?? after);
  const memoryEntry = buildRecentTurn({ before, after, action, entry, narration });
  const withoutSameTurn = baseMemory.recentTurns.filter((item) => item.turn !== memoryEntry.turn);
  const combinedTurns = [...withoutSameTurn, memoryEntry].sort((left, right) => left.turn - right.turn);
  const overflow = combinedTurns.slice(0, Math.max(0, combinedTurns.length - RECENT_TURN_LIMIT));
  const recentTurns = combinedTurns.slice(-RECENT_TURN_LIMIT);
  const longSummary = appendOverflowSummary(baseMemory.longSummary, overflow);
  const narrationForeshadow = meaningfulText(narration?.foreshadow, '');

  return {
    ...after,
    storyMemory: {
      longSummary,
      recentTurns,
      openThreads: mergeThreads(
        baseMemory.openThreads,
        admittedThreadsFromTurn({ before, after, action, entry, narration, narrationForeshadow })
      ),
      resolvedThreads: baseMemory.resolvedThreads,
      characterNotes: notesFromNpcs(after.npcs),
      lastUpdatedTurn: after.turn ?? memoryEntry.turn,
      summaryThroughTurn: baseMemory.summaryThroughTurn,
      summaryRevision: baseMemory.summaryRevision,
      summaryWindowStartTurn: baseMemory.summaryWindowStartTurn
    }
  };
}

function projectNarrativeTurn(entry = {}, turn) {
  return {
    turn,
    title: meaningfulText(entry.title, `第${turn}回合`),
    action: meaningfulText(entry.command, meaningfulText(entry.action, '')),
    outcome: meaningfulText(entry.body, meaningfulText(entry.outcome, '')),
    npcLine: meaningfulText(entry.npcLine, ''),
    worldEvent: meaningfulText(entry.worldEvent, '')
  };
}

function normalizeLogTurn(entry = {}, index = 0) {
  const explicitTurn = typeof entry.turn === 'string' && entry.turn.trim()
    ? Number(entry.turn)
    : entry.turn;
  if (Number.isFinite(explicitTurn)) return normalizeTurnNumber(explicitTurn, index);

  const id = meaningfulText(entry.id, '');
  const match = id.match(/(?:turn|resource)[-_]?(\d+)/i);
  if (match) return normalizeTurnNumber(match[1], index);

  return index;
}

function isResourceLogEntry(entry = {}) {
  const id = meaningfulText(entry.id, '');
  return /^resource[-_]/i.test(id) || entry.source === 'resource' || entry.type === 'resource';
}

function normalizeTurnNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function buildRecentTurn({ before, after, action, entry, narration }) {
  const title = meaningfulText(narration?.title, entry?.title ?? `第${after?.turn ?? 0}回合`);
  const outcome = meaningfulText(narration?.body, entry?.body ?? '');

  return {
    turn: after?.turn ?? entry?.turn ?? 0,
    title,
    action: meaningfulText(action?.command, entry?.command ?? action?.title ?? '静观其变'),
    outcome,
    npcLine: meaningfulText(narration?.npcLine, entry?.npcLine ?? ''),
    worldEvent: meaningfulText(entry?.worldEvent, ''),
    timeLabel: meaningfulText(after?.timePressure?.lastDeltaTime, ''),
    netLifespanDelta: Number.isFinite(after?.timePressure?.lastNetLifespanDelta) ? after.timePressure.lastNetLifespanDelta : 0,
    warningLevel: meaningfulText(after?.timePressure?.warningLevel, ''),
    statDelta: diffPlayerStats(before?.player, after?.player)
  };
}

function initialLongSummary(game) {
  const opening = game?.log?.[0]?.body ?? '';
  return truncateText(
    [
      '本局自青云宗外门开篇，主角在寿元压力下求道。',
      characterIdentitySummary(game),
      opening,
    ].filter(Boolean).join(' '),
    360
  );
}

function normalizeLongSummary(summary, game) {
  const existing = meaningfulText(summary, '');
  if (!existing) return initialLongSummary(game);
  if (!existing.includes(LEGACY_LONG_SUMMARY)) return truncateText(existing, 420);

  return truncateText(
    existing.replace(LEGACY_LONG_SUMMARY, characterIdentitySummary(game)).trim(),
    420
  );
}

function characterIdentitySummary(game) {
  const character = game?.character ?? {};
  const player = game?.player ?? {};
  const name = meaningfulText(character.name, meaningfulText(player.name, '主角'));
  const origin = meaningfulText(character.origin, meaningfulText(player.origin, ''));
  const spiritualRoot = meaningfulText(character.spiritualRoot, meaningfulText(player.spiritualRoot, ''));
  const traits = Array.isArray(character.traits)
    ? character.traits.map((trait) => meaningfulText(trait, '')).filter(Boolean)
    : [];
  const identity = origin && spiritualRoot
    ? `${name}出身${origin}，以${spiritualRoot}踏入青云山门。`
    : origin
      ? `${name}出身${origin}。`
      : spiritualRoot
        ? `${name}以${spiritualRoot}踏入青云山门。`
        : '主角的出身、灵根与命格天赋尚未入册。';

  return traits.length ? `${identity} 命格天赋为${traits.join('、')}。` : identity;
}

function openingRecentTurns(game) {
  const opening = game?.log?.[0];
  if (!opening) return [];

  return [
    {
      turn: 0,
      title: meaningfulText(opening.title, '山门初醒'),
      action: meaningfulText(opening.command, '开局'),
      outcome: meaningfulText(opening.body, ''),
      npcLine: meaningfulText(opening.npcLine, ''),
      worldEvent: meaningfulText(opening.worldEvent, ''),
      timeLabel: meaningfulText(game?.timePressure?.lastDeltaTime, ''),
      netLifespanDelta: Number.isFinite(game?.timePressure?.lastNetLifespanDelta) ? game.timePressure.lastNetLifespanDelta : 0,
      warningLevel: meaningfulText(game?.timePressure?.warningLevel, ''),
      statDelta: {}
    }
  ];
}

function appendOverflowSummary(summary, overflow) {
  if (!overflow.length) return truncateText(summary, 420);

  const compact = overflow
    .map((entry) => `第${entry.turn}回合「${entry.title}」：${truncateText(entry.outcome, 44)}`)
    .join('；');

  return truncateText(`${summary} 早前 ${compact}`, 420);
}

function threadsFromForeshadows(foreshadows = []) {
  const threads = foreshadows
    .map((text) => threadFromText(text, { turn: 0, allowGeneric: true }))
    .filter(Boolean);
  return threads;
}

function admittedThreadsFromTurn({ before, after, entry, narrationForeshadow }) {
  const turn = after?.turn ?? entry?.turn ?? 0;
  const candidates = [
    narrationForeshadow,
    entry?.worldEvent,
    ...(after?.foreshadows ?? []).slice(-1),
    ...futureEventFlagDetails(after?.karma?.futureEventFlags, before?.karma?.futureEventFlags)
  ];

  return candidates
    .map((text) => threadFromText(text, { turn, allowGeneric: false }))
    .filter(Boolean);
}

function futureEventFlagDetails(afterFlags = [], beforeFlags = []) {
  const previous = new Set(Array.isArray(beforeFlags) ? beforeFlags : []);
  return (Array.isArray(afterFlags) ? afterFlags : [])
    .filter((flag) => !previous.has(flag))
    .map((flag) => {
      if (flag === 'director_ascension_thread') return '天门残契与飞升传闻出现新的矛盾。';
      if (flag === 'director_mist_thread') return '雾隐秘境的线索被进一步推进。';
      return '';
    })
    .filter(Boolean);
}

function threadFromText(text, { turn = 0, allowGeneric = false } = {}) {
  const detail = meaningfulText(text, '天机尚未显形。');
  const definition = resolveThreadDefinition(detail, { allowGeneric });
  if (!definition) return null;

  return {
    id: definition.id,
    title: definition.title,
    detail,
    status: '未解',
    priority: definition.priority,
    introducedTurn: turn,
    updatedTurn: turn,
    clues: [detail]
  };
}

function resolveThreadDefinition(detail, { allowGeneric = false } = {}) {
  const matched = CORE_THREAD_DEFINITIONS.find((definition) => (
    definition.keywords.some((keyword) => detail.includes(keyword))
  ));

  if (matched) return matched;
  if (!allowGeneric) return null;
  return {
    id: `thread_${hashText(detail)}`,
    title: inferThreadTitle(detail),
    priority: 'minor',
    keywords: []
  };
}

function inferThreadTitle(detail) {
  if (detail.includes('飞升')) return '飞升骗局伏笔';
  if (detail.includes('雾隐秘境')) return '雾隐秘境疑云';
  if (detail.includes('雷木')) return '雷木双息异兆';
  if (detail.includes('青云宗')) return '青云宗暗线';
  return '未明天机';
}

function notesFromNpcs(npcs = []) {
  return npcs.map((npc) => ({
    name: meaningfulText(npc.name, '无名道友'),
    role: meaningfulText(npc.role, '道友'),
    affinity: Number.isFinite(npc.affinity) ? npc.affinity : 0,
    tone: meaningfulText(npc.tone, '态度未明'),
    memories: Array.isArray(npc.memories) ? npc.memories.slice(-4).map((item) => meaningfulText(item, '')) : []
  }));
}

function sanitizeRecentTurns(turns = []) {
  if (!Array.isArray(turns)) return [];

  return turns.slice(-RECENT_TURN_LIMIT).map((entry) => ({
    turn: Number.isFinite(entry.turn) ? entry.turn : 0,
    title: meaningfulText(entry.title, '无题回合'),
    action: meaningfulText(entry.action, ''),
    outcome: meaningfulText(entry.outcome, ''),
    npcLine: meaningfulText(entry.npcLine, ''),
    worldEvent: meaningfulText(entry.worldEvent, ''),
    timeLabel: meaningfulText(entry.timeLabel, ''),
    netLifespanDelta: Number.isFinite(entry.netLifespanDelta) ? entry.netLifespanDelta : 0,
    warningLevel: meaningfulText(entry.warningLevel, ''),
    statDelta: sanitizeStatDelta(entry.statDelta)
  }));
}

function sanitizeThreads(threads = []) {
  if (!Array.isArray(threads)) return [];

  return threads.map((thread, index) => {
    const detail = meaningfulText(thread.detail, '');
    const definition = thread.id
      ? CORE_THREAD_DEFINITIONS.find((item) => item.id === thread.id)
      : resolveThreadDefinition(`${thread.title ?? ''} ${detail}`, { allowGeneric: true });
    const clues = Array.isArray(thread.clues) && thread.clues.length
      ? thread.clues.map((item) => meaningfulText(item, '')).filter(Boolean)
      : [detail].filter(Boolean);
    const introducedTurn = Number.isFinite(thread.introducedTurn) ? thread.introducedTurn : 0;

    return {
      id: meaningfulText(thread.id, definition?.id ?? `legacy_${index}_${hashText(detail)}`),
      title: meaningfulText(thread.title, definition?.title ?? '未明天机'),
      detail,
      status: meaningfulText(thread.status, '未解'),
      priority: meaningfulText(thread.priority, definition?.priority ?? 'minor'),
      introducedTurn,
      updatedTurn: Number.isFinite(thread.updatedTurn) ? thread.updatedTurn : introducedTurn,
      clues: dedupeTexts(clues).slice(-4)
    };
  });
}

function sanitizeCharacterNotes(notes = []) {
  if (!Array.isArray(notes)) return [];

  return notes.map((note) => ({
    name: meaningfulText(note.name, '无名道友'),
    role: meaningfulText(note.role, '道友'),
    affinity: Number.isFinite(note.affinity) ? note.affinity : 0,
    tone: meaningfulText(note.tone, '态度未明'),
    memories: Array.isArray(note.memories) ? note.memories.slice(-4).map((item) => meaningfulText(item, '')) : []
  }));
}

function mergeThreads(...groups) {
  const merged = [];
  const byKey = new Map();

  for (const group of groups) {
    for (const thread of sanitizeThreads(group)) {
      const key = thread.id || `${thread.title}:${thread.detail}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, thread);
        merged.push(thread);
        continue;
      }

      existing.detail = thread.detail || existing.detail;
      existing.status = thread.status || existing.status;
      existing.priority = thread.priority || existing.priority;
      existing.introducedTurn = Math.min(existing.introducedTurn ?? 0, thread.introducedTurn ?? 0);
      existing.updatedTurn = Math.max(existing.updatedTurn ?? 0, thread.updatedTurn ?? 0);
      existing.clues = dedupeTexts([...(existing.clues ?? []), ...(thread.clues ?? [])]).slice(-4);
    }
  }

  return merged.slice(-THREAD_LIMIT);
}

function dedupeTexts(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = meaningfulText(value, '');
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function hashText(text) {
  let hash = 0;
  for (const char of String(text)) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function diffPlayerStats(beforePlayer = {}, afterPlayer = {}) {
  const diff = {};

  for (const key of STAT_KEYS) {
    if (typeof beforePlayer[key] === 'number' && typeof afterPlayer[key] === 'number') {
      const delta = afterPlayer[key] - beforePlayer[key];
      if (delta !== 0) diff[key] = delta;
    }
  }

  if (beforePlayer.realm && afterPlayer.realm && beforePlayer.realm !== afterPlayer.realm) {
    diff.realm = afterPlayer.realm;
  }

  return diff;
}

function sanitizeStatDelta(statDelta = {}) {
  const result = {};

  for (const key of STAT_KEYS) {
    if (typeof statDelta[key] === 'number' && statDelta[key] !== 0) {
      result[key] = statDelta[key];
    }
  }

  if (typeof statDelta.realm === 'string' && statDelta.realm) {
    result.realm = statDelta.realm;
  }

  return result;
}

function meaningfulText(value, fallback) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return text || fallback;
}

function truncateText(value, maxLength) {
  const text = meaningfulText(value, '');
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
