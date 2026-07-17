import { getChapterDefinition } from '../chapters/chapterCatalog.js';
import { RESONANCE_CATALOG, TECHNIQUE_CATALOG, TREASURE_CATALOG } from '../rewards.js';

export const EMPTY_RESOURCE_RUN = Object.freeze({
  pendingDraft: null,
  activeResonances: [],
  resolvedDraftIds: [],
  acquisitionLog: [],
  finalizedRunId: null,
  lastRunSummary: null
});

export const EMPTY_META_PROGRESS = Object.freeze({
  discoveredTechniques: [],
  discoveredTreasures: [],
  unlockedTechniques: [],
  unlockedTreasures: [],
  runCount: 0,
  bestChapter: null
});

export function normalizeResourceState(game) {
  const source = game ?? {};
  const techniques = normalizeActiveResources(source.techniques, TECHNIQUE_CATALOG);
  const treasures = normalizeActiveResources(source.treasures, TREASURE_CATALOG);

  return {
    ...source,
    techniques,
    treasures,
    resourceRun: normalizeResourceRun(source.resourceRun),
    metaProgress: normalizeMetaProgress(source.metaProgress)
  };
}

export function recordResourceAcquisition(game, { kind, resourceId, eventId, eventTitle, turn }) {
  const normalized = normalizeResourceState(game);
  const resourceKey = normalizeResourceKey(resourceId);
  const resourceCatalog = catalogForKind(kind);
  const isKnownResource = Boolean(resourceCatalog?.[resourceKey]);
  const metaKey = metaKeyForKind(kind);

  const acquisitionLog = [
    ...normalized.resourceRun.acquisitionLog,
    {
      id: buildAcquisitionId(normalized.resourceRun.acquisitionLog, {
        kind,
        resourceId: resourceKey,
        eventId,
        turn
      }),
      kind,
      resourceId: resourceKey,
      eventId,
      eventTitle,
      turn
    }
  ];

  const nextMetaProgress = { ...normalized.metaProgress };
  if (metaKey && isKnownResource) {
    nextMetaProgress[`discovered${metaKey}`] = appendUniqueId(
      nextMetaProgress[`discovered${metaKey}`],
      resourceKey
    );
    nextMetaProgress[`unlocked${metaKey}`] = appendUniqueId(
      nextMetaProgress[`unlocked${metaKey}`],
      resourceKey
    );
  }

  return {
    ...normalized,
    resourceRun: {
      ...normalized.resourceRun,
      acquisitionLog
    },
    metaProgress: nextMetaProgress
  };
}

export function finalizeRun(game, { chapterId }) {
  const normalized = normalizeResourceState(game);
  const currentRunId = getCurrentRunId(normalized);
  if (normalized.resourceRun.finalizedRunId === currentRunId) {
    return game;
  }

  const mergedMetaProgress = mergeRunProgress(normalized.metaProgress, normalized.techniques, normalized.treasures);
  const runCount = mergedMetaProgress.runCount + 1;
  const lastRunSummary = {
    runCount,
    techniques: cloneResourceEntries(normalized.techniques),
    treasures: cloneResourceEntries(normalized.treasures),
    acquisitionLog: normalized.resourceRun.acquisitionLog.map((entry) => ({ ...entry }))
  };
  const finalized = resetRunResources({
    ...normalized,
    resourceRun: {
      ...normalized.resourceRun,
      lastRunSummary
    },
    metaProgress: {
      ...mergedMetaProgress,
      runCount,
      bestChapter: pickBestChapter(mergedMetaProgress.bestChapter, chapterId)
    }
  });

  return {
    ...finalized,
    resourceRun: {
      ...finalized.resourceRun,
      finalizedRunId: currentRunId
    }
  };
}

export function resetRunResources(game) {
  const normalized = normalizeResourceState(game);
  return {
    ...normalized,
    techniques: [],
    treasures: [],
    resourceRun: {
      ...normalized.resourceRun,
      pendingDraft: null,
      activeResonances: [],
      acquisitionLog: []
    }
  };
}

function normalizeResourceRun(resourceRun) {
  const source = resourceRun ?? {};
  return {
    pendingDraft: source.pendingDraft ?? null,
    activeResonances: normalizeActiveResonances(source.activeResonances),
    resolvedDraftIds: uniqueStrings(source.resolvedDraftIds),
    acquisitionLog: normalizeAcquisitionLog(source.acquisitionLog),
    finalizedRunId: source.finalizedRunId ?? null,
    lastRunSummary: normalizeLastRunSummary(source.lastRunSummary)
  };
}

function normalizeLastRunSummary(summary) {
  if (!summary || typeof summary !== 'object') return null;
  return {
    runCount: typeof summary.runCount === 'number' ? summary.runCount : 0,
    techniques: normalizeActiveResources(summary.techniques, TECHNIQUE_CATALOG),
    treasures: normalizeActiveResources(summary.treasures, TREASURE_CATALOG),
    acquisitionLog: normalizeAcquisitionLog(summary.acquisitionLog)
  };
}

function normalizeMetaProgress(metaProgress) {
  const source = metaProgress ?? {};
  return {
    discoveredTechniques: uniqueStrings(source.discoveredTechniques),
    discoveredTreasures: uniqueStrings(source.discoveredTreasures),
    unlockedTechniques: uniqueStrings(source.unlockedTechniques),
    unlockedTreasures: uniqueStrings(source.unlockedTreasures),
    runCount: typeof source.runCount === 'number' ? source.runCount : 0,
    bestChapter: source.bestChapter ?? null
  };
}

function normalizeActiveResources(entries, catalog) {
  const result = [];
  const seen = new Set();

  for (const entry of entries ?? []) {
    const normalized = normalizeResourceEntry(entry, catalog);
    const key = resourceEntryKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function cloneResourceEntries(entries) {
  return entries.map((entry) => ({
    ...entry,
    tags: [...(entry.tags ?? [])],
    bonuses: { ...(entry.bonuses ?? {}) }
  }));
}

function normalizeAcquisitionLog(entries) {
  const result = [];
  const seen = new Set();

  for (const entry of entries ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    const copy = { ...entry };
    const key = copy.id ?? JSON.stringify(copy);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(copy);
  }

  return result;
}

function normalizeResourceEntry(entry, catalog) {
  if (typeof entry === 'string') {
    return catalog[entry] ?? entry;
  }

  if (!entry || typeof entry !== 'object') {
    return entry;
  }

  return catalog[entry.id] ?? { ...entry };
}

function uniqueStrings(entries) {
  const result = [];
  const seen = new Set();

  for (const entry of entries ?? []) {
    const value = typeof entry === 'string' ? entry : entry?.id ?? entry;
    if (typeof value !== 'string' || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function uniqueKnownResourceIds(entries, knownOnly = false) {
  const result = [];
  const seen = new Set();

  for (const entry of entries ?? []) {
    const resourceId = resourceIdFromEntry(entry);
    if (!resourceId || seen.has(resourceId)) continue;
    if (knownOnly && !isKnownResourceId(resourceId)) continue;
    seen.add(resourceId);
    result.push(resourceId);
  }

  return result;
}

function normalizeActiveResonances(entries) {
  const result = [];
  const seen = new Set();

  for (const entry of entries ?? []) {
    const id = resourceIdFromEntry(entry);
    if (!id || seen.has(id) || !RESONANCE_CATALOG[id]) continue;
    seen.add(id);
    result.push(typeof entry === 'object' ? { ...entry } : { id });
  }

  return result;
}

function resourceIdFromEntry(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return null;
  return typeof entry.id === 'string' ? entry.id : null;
}

function normalizeResourceKey(resourceId) {
  if (typeof resourceId === 'string') return resourceId;
  if (!resourceId || typeof resourceId !== 'object') return null;
  return typeof resourceId.id === 'string' ? resourceId.id : null;
}

function isKnownResourceId(resourceId) {
  return Boolean(TECHNIQUE_CATALOG[resourceId] ?? TREASURE_CATALOG[resourceId]);
}

function resourceEntryKey(entry) {
  if (typeof entry === 'string') return `string:${entry}`;
  if (!entry || typeof entry !== 'object') return `other:${String(entry)}`;
  if (typeof entry.id === 'string') return `id:${entry.id}`;
  return `object:${JSON.stringify(entry)}`;
}

function appendUniqueId(entries, value) {
  return uniqueStrings([...(entries ?? []), value]);
}

function catalogForKind(kind) {
  if (kind === 'technique') return TECHNIQUE_CATALOG;
  if (kind === 'treasure') return TREASURE_CATALOG;
  return null;
}

function metaKeyForKind(kind) {
  if (kind === 'technique') return 'Techniques';
  if (kind === 'treasure') return 'Treasures';
  return null;
}

function mergeRunProgress(metaProgress, techniques, treasures) {
  const next = {
    ...metaProgress,
    discoveredTechniques: appendUniqueIds(metaProgress.discoveredTechniques, extractKnownResourceIds(techniques, TECHNIQUE_CATALOG)),
    discoveredTreasures: appendUniqueIds(metaProgress.discoveredTreasures, extractKnownResourceIds(treasures, TREASURE_CATALOG)),
    unlockedTechniques: appendUniqueIds(metaProgress.unlockedTechniques, extractKnownResourceIds(techniques, TECHNIQUE_CATALOG)),
    unlockedTreasures: appendUniqueIds(metaProgress.unlockedTreasures, extractKnownResourceIds(treasures, TREASURE_CATALOG))
  };

  return next;
}

function extractKnownResourceIds(entries, catalog) {
  const result = [];
  const seen = new Set();

  for (const entry of entries ?? []) {
    const resourceId = resourceIdFromEntry(entry);
    if (!resourceId || seen.has(resourceId) || !catalog[resourceId]) continue;
    seen.add(resourceId);
    result.push(resourceId);
  }

  return result;
}

function appendUniqueIds(existing, additions) {
  return uniqueStrings([...(existing ?? []), ...(additions ?? [])]);
}

function buildAcquisitionId(entries, { kind, resourceId, eventId, turn }) {
  const index = (entries ?? []).length + 1;
  return [kind, resourceId, eventId ?? 'event', turn ?? 'turn', index].join(':');
}

function pickBestChapter(currentBest, candidateChapterId) {
  if (!candidateChapterId) return currentBest ?? null;
  if (!currentBest) return candidateChapterId;

  const currentChapter = getChapterDefinition(currentBest);
  const candidateChapter = getChapterDefinition(candidateChapterId);
  if (!candidateChapter) return currentBest;
  if (!currentChapter) return candidateChapterId;
  return candidateChapter.index > currentChapter.index ? candidateChapterId : currentBest;
}

function getCurrentRunId(game) {
  if (typeof game.id === 'string' && game.id.length > 0) return game.id;
  return `seed:${game.seed ?? 'unknown'}:turn:${game.turn ?? 0}:mode:${game.mode ?? 'unknown'}`;
}
