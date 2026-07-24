import { formatTimePressureSummary } from './helpers.js';

const HISTORY_SUMMARY_KEY = 'wendao-fusheng-history-summary-v1';
const HISTORY_SUMMARY_SCOPE_KEY = 'wendao-fusheng-history-summary-scope-v1';

function createHistorySummaryScopeId() {
  return `scope-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getHistorySummaryScopeId(storage = localStorage) {
  const existingScopeId = storage?.getItem?.(HISTORY_SUMMARY_SCOPE_KEY);
  if (existingScopeId) return existingScopeId;
  const nextScopeId = createHistorySummaryScopeId();
  storage?.setItem?.(HISTORY_SUMMARY_SCOPE_KEY, nextScopeId);
  return nextScopeId;
}

export function rotateHistorySummaryScope(storage = localStorage) {
  const nextScopeId = createHistorySummaryScopeId();
  storage?.setItem?.(HISTORY_SUMMARY_SCOPE_KEY, nextScopeId);
  storage?.setItem?.(HISTORY_SUMMARY_KEY, JSON.stringify({
    scopeId: nextScopeId,
    entries: {}
  }));
  return nextScopeId;
}

function historyEntryCacheKey(entry = {}) {
  return JSON.stringify({
    id: entry.id ?? '',
    title: entry.title ?? '',
    command: entry.command ?? '',
    body: entry.body ?? '',
    worldEvent: entry.worldEvent ?? ''
  });
}

function readHistorySummaryCache(storage = localStorage) {
  try {
    const scopeId = getHistorySummaryScopeId(storage);
    const raw = storage?.getItem?.(HISTORY_SUMMARY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    if (parsed.scopeId !== scopeId) return {};
    return parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {};
  } catch {
    return {};
  }
}

function normalizeEffectSummary(effectsSummary) {
  if (Array.isArray(effectsSummary)) {
    return effectsSummary.map((line) => String(line ?? '').trim()).filter(Boolean);
  }
  const line = String(effectsSummary ?? '').trim();
  return line ? [line] : [];
}

export function persistHistorySummaryCache(targetGame, storage = localStorage) {
  if (!storage?.setItem || !targetGame?.log?.length) return {};
  const scopeId = getHistorySummaryScopeId(storage);
  const nextCache = { ...readHistorySummaryCache(storage) };
  for (const entry of targetGame.log) {
    const lines = normalizeEffectSummary(entry.effectsSummary);
    if (!lines.length) continue;
    nextCache[historyEntryCacheKey(entry)] = lines;
  }
  storage.setItem(HISTORY_SUMMARY_KEY, JSON.stringify({ scopeId, entries: nextCache }));
  return nextCache;
}

export function hydrateHistorySummaries(targetGame, storage = localStorage) {
  if (!targetGame?.log?.length) return targetGame;
  const cache = readHistorySummaryCache(storage);
  if (!Object.keys(cache).length) return targetGame;
  return {
    ...targetGame,
    log: targetGame.log.map((entry) => {
      const existing = normalizeEffectSummary(entry.effectsSummary);
      if (existing.length) return { ...entry, effectsSummary: existing };
      const cached = normalizeEffectSummary(cache[historyEntryCacheKey(entry)]);
      return cached.length ? { ...entry, effectsSummary: cached } : entry;
    })
  };
}

export function enrichGameHistory(currentGame, previousGame) {
  if (!currentGame?.log?.length) return currentGame;
  const latestEntry = currentGame.log.at(-1);
  const effectsSummary = [
    ...buildTimeResultSummary(currentGame.timePressure),
    ...summarizeHistoryChanges(previousGame, currentGame)
  ].slice(0, 5);
  if (!effectsSummary.length) return currentGame;
  return {
    ...currentGame,
    log: [...currentGame.log.slice(0, -1), { ...latestEntry, effectsSummary }]
  };
}

function buildTimeResultSummary(source = {}) {
  const label = source.label || source.lastDeltaTime || '';
  const netLifespanDelta = Number.isFinite(source.netLifespanDelta)
    ? source.netLifespanDelta
    : Number.isFinite(source.lastNetLifespanDelta) ? source.lastNetLifespanDelta : 0;
  const maxLifespanDelta = Number.isFinite(source.maxLifespanDelta) ? source.maxLifespanDelta : 0;
  const parts = [];
  if (label) parts.push(`历时${label}`);
  if (netLifespanDelta) parts.push(`寿元 ${netLifespanDelta > 0 ? '+' : ''}${netLifespanDelta}`);
  if (maxLifespanDelta) parts.push(`大限 ${maxLifespanDelta > 0 ? '+' : ''}${maxLifespanDelta}`);
  if (source.note) parts.push(source.note);
  return parts.length ? [parts.join(' · ')] : [];
}

function summarizeHistoryChanges(previousGame, currentGame) {
  const changes = [];
  changes.push(...summarizePlayerChanges(previousGame?.player, currentGame?.player));
  changes.push(...summarizeInventoryChanges(previousGame?.inventory, currentGame?.inventory));
  changes.push(...summarizeCollectionChanges(previousGame?.treasures, currentGame?.treasures, '获珍'));
  changes.push(...summarizeCollectionChanges(previousGame?.techniques, currentGame?.techniques, '习得'));
  if ((previousGame?.player?.realm ?? '') !== (currentGame?.player?.realm ?? '')) {
    changes.push(`境界稳入 ${currentGame.player.realm}`);
  }
  if ((previousGame?.player?.location ?? '') !== (currentGame?.player?.location ?? '')) {
    changes.push(`行止转到 ${currentGame.player.location}`);
  }
  return changes.slice(0, 5);
}

function summarizePlayerChanges(previousPlayer = {}, currentPlayer = {}) {
  return [
    describeDelta('气血', currentPlayer.health, previousPlayer.health),
    describeDelta('寿元', currentPlayer.lifespan, previousPlayer.lifespan),
    describeDelta('灵气', currentPlayer.qi, previousPlayer.qi),
    describeDelta('心境', currentPlayer.mood, previousPlayer.mood),
    describeDelta('修为', currentPlayer.cultivationProgress, previousPlayer.cultivationProgress),
    describeDelta('灵石', currentPlayer.spiritStones, previousPlayer.spiritStones),
    describeDelta('宗门声望', currentPlayer.sectRelation, previousPlayer.sectRelation)
  ].filter(Boolean);
}

function describeDelta(label, nextValue, previousValue) {
  if (!Number.isFinite(nextValue) || !Number.isFinite(previousValue)) return '';
  const delta = nextValue - previousValue;
  if (!delta) return '';
  const prefix = delta > 0 ? '+' : '';
  return `${label} ${prefix}${delta}`;
}

function summarizeInventoryChanges(previousInventory = {}, currentInventory = {}) {
  return [
    ...summarizeNamedCounts(previousInventory.materials, currentInventory.materials, '得材'),
    ...summarizeNamedCounts(previousInventory.pills, currentInventory.pills, '得丹')
  ];
}

function summarizeNamedCounts(previousEntries = {}, currentEntries = {}, label) {
  return Object.entries(currentEntries ?? {}).flatMap(([name, count]) => {
    const before = previousEntries?.[name] ?? 0;
    const delta = count - before;
    return delta > 0 ? [`${label} ${name} x${delta}`] : [];
  });
}

function summarizeCollectionChanges(previousEntries = [], currentEntries = [], verb) {
  const owned = new Set((previousEntries ?? []).map((item) => item?.name ?? item));
  return (currentEntries ?? [])
    .filter((item) => !owned.has(item?.name ?? item))
    .map((item) => `${verb} ${item.name}`);
}
