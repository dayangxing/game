const RECENT_TURN_LIMIT = 8;

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

export function normalizeStoryMemory(memory, game) {
  const recentTurns = sanitizeRecentTurns(memory?.recentTurns);
  const openThreads = sanitizeThreads(memory?.openThreads);
  const characterNotes = sanitizeCharacterNotes(memory?.characterNotes);

  return {
    longSummary: meaningfulText(memory?.longSummary, initialLongSummary(game)),
    recentTurns: recentTurns.length ? recentTurns : openingRecentTurns(game),
    openThreads: openThreads.length ? openThreads : threadsFromForeshadows(game?.foreshadows),
    resolvedThreads: sanitizeThreads(memory?.resolvedThreads),
    characterNotes: characterNotes.length ? characterNotes : notesFromNpcs(game?.npcs),
    lastUpdatedTurn: Number.isFinite(memory?.lastUpdatedTurn) ? memory.lastUpdatedTurn : (game?.turn ?? 0)
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
        threadsFromForeshadows(after.foreshadows),
        narrationForeshadow ? [threadFromText(narrationForeshadow)] : []
      ),
      resolvedThreads: baseMemory.resolvedThreads,
      characterNotes: notesFromNpcs(after.npcs),
      lastUpdatedTurn: after.turn ?? memoryEntry.turn
    }
  };
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
    statDelta: diffPlayerStats(before?.player, after?.player)
  };
}

function initialLongSummary(game) {
  const opening = game?.log?.[0]?.body ?? '';
  return truncateText(
    [
      '本局自青云宗外门开篇，主角在寿元压力下求道。',
      opening,
      '雷木双灵根、雾隐秘境与飞升传闻已经成为长期疑云。'
    ].filter(Boolean).join(' '),
    360
  );
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
  const threads = foreshadows.map((text) => threadFromText(text));
  const hasAscensionThread = threads.some((thread) => thread.detail.includes('飞升'));

  if (!hasAscensionThread) {
    threads.push({
      title: '飞升骗局伏笔',
      detail: '宗门典籍与长老传闻中对飞升的说法仍有缺口。',
      status: '未解'
    });
  }

  return threads;
}

function threadFromText(text) {
  const detail = meaningfulText(text, '天机尚未显形。');
  return {
    title: inferThreadTitle(detail),
    detail,
    status: '未解'
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
    statDelta: sanitizeStatDelta(entry.statDelta)
  }));
}

function sanitizeThreads(threads = []) {
  if (!Array.isArray(threads)) return [];

  return threads.map((thread) => ({
    title: meaningfulText(thread.title, '未明天机'),
    detail: meaningfulText(thread.detail, ''),
    status: meaningfulText(thread.status, '未解')
  }));
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
  const seen = new Set();

  for (const group of groups) {
    for (const thread of sanitizeThreads(group)) {
      const key = `${thread.title}:${thread.detail}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(thread);
    }
  }

  return merged.slice(-8);
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
