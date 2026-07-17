import { compareRealms } from '../progression.js';
import { grantTechnique, grantTreasure } from '../rewards.js';
import {
  RESOURCE_POOL_CATALOG,
  TECHNIQUE_CATALOG,
  TREASURE_CATALOG
} from './resourceCatalog.js';
import {
  normalizeResourceState,
  recordResourceAcquisition
} from './resourceProgress.js';

const COMPENSATION_SPIRIT_STONES = 30;
const RESOURCE_BONUS_TEXT = [
  ['cultivationGain', '修为收益'],
  ['breakthroughChance', '突破'],
  ['maxHealth', '气血上限'],
  ['maxLifespan', '寿元上限'],
  ['damageReduction', '失败损伤减免']
];

export function createResourceDraft({
  game,
  poolId,
  sourceEventId,
  sourceEventTitle,
  reason,
  turn
}) {
  const normalized = normalizeResourceState(game);
  const pool = RESOURCE_POOL_CATALOG[poolId];
  if (!pool) {
    throw new Error(`RESOURCE_DRAFT_UNKNOWN_POOL:${poolId}`);
  }
  if (normalized.resourceRun.pendingDraft) {
    throw new Error('RESOURCE_DRAFT_ALREADY_PENDING');
  }

  const ownedIds = collectOwnedIds(normalized);
  const seed = hashString(`${normalized.seed ?? 'unknown'}:${sourceEventId ?? 'event'}:${turn ?? normalized.turn ?? 0}`);
  const eligibleEntries = collectEligibleEntries(normalized, pool, ownedIds);
  const shuffledEntries = shuffle([...eligibleEntries], seed);
  const candidates = shuffledEntries.slice(0, 3).map((entry) => cloneResourceEntry(entry));

  while (candidates.length < 3) {
    candidates.push(createCompensationCandidate(candidates.length));
  }

  const draftId = `draft_${turn ?? normalized.turn ?? 0}_${hashHex(seed)}`;
  const actions = candidates.map((candidate, index) => createDraftAction({
    candidate,
    draftId,
    index,
    seed
  }));
  const pendingDraft = {
    id: draftId,
    poolId,
    sourceEventId: sourceEventId ?? null,
    sourceEventTitle: sourceEventTitle ?? pool.label,
    reason: reason ?? pool.narrativeReason,
    candidates,
    actions,
    createdTurn: turn ?? normalized.turn ?? 0
  };

  return {
    ...normalized,
    resourceRun: {
      ...normalized.resourceRun,
      pendingDraft
    }
  };
}

export function getPublicResourceDraft(draft) {
  if (!draft) return null;

  return {
    sourceEventTitle: draft.sourceEventTitle ?? '',
    reason: draft.reason ?? '',
    options: (draft.candidates ?? []).map((candidate, index) => {
      const action = draft.actions?.[index];
      return {
        actionId: action?.id ?? '',
        name: candidate.name,
        grade: candidate.grade,
        type: candidate.type,
        tags: [...(candidate.tags ?? [])],
        description: candidate.description,
        detail: candidate.detail,
        bonusText: formatBonusText(candidate)
      };
    })
  };
}

export function resolveResourceDraft({ game, draftActionId, turn }) {
  const normalized = normalizeResourceState(game);
  const draft = normalized.resourceRun.pendingDraft;
  if (!draft) {
    throw new Error('RESOURCE_DRAFT_NO_PENDING');
  }

  const action = draft.actions?.find((candidate) => candidate.id === draftActionId);
  if (!action) {
    throw new Error('RESOURCE_DRAFT_INVALID_ACTION');
  }

  const selected = { ...action };
  const resolutionTurn = turn ?? draft.createdTurn;
  if (!action.resourceId) {
    const nextGame = resolveCompensation(normalized, draft, action);
    return { game: nextGame, selected, entry: null };
  }

  const entry = getCatalogEntry(action.kind, action.resourceId);
  if (!entry) {
    throw new Error('RESOURCE_DRAFT_INVALID_RESOURCE');
  }
  if (collectOwnedIds(normalized).has(entry.id)) {
    throw new Error(`RESOURCE_DRAFT_ALREADY_OWNED:${entry.id}`);
  }

  const granted = action.kind === 'technique'
    ? grantTechnique(normalized, entry.id)
    : grantTreasure(normalized, entry.id);
  const recorded = recordResourceAcquisition(granted, {
    kind: action.kind,
    resourceId: entry.id,
    eventId: draft.sourceEventId,
    eventTitle: draft.sourceEventTitle,
    turn: resolutionTurn
  });
  const nextGame = markDraftResolved(recorded, draft.id);

  return {
    game: nextGame,
    selected,
    entry: cloneResourceEntry(entry)
  };
}

function collectEligibleEntries(game, pool, ownedIds) {
  const primary = collectPoolEntries(game, pool, ownedIds);
  if (primary.length >= 3) return primary;

  const fallback = Object.values(RESOURCE_POOL_CATALOG)
    .filter((candidatePool) => candidatePool.id !== pool.id)
    .filter((candidatePool) => candidatePool.tags.some((tag) => pool.tags.includes(tag)))
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((candidatePool) => collectPoolEntries(game, candidatePool, ownedIds));

  const seen = new Set(primary.map((entry) => entry.id));
  return [...primary, ...fallback.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  })];
}

function collectPoolEntries(game, pool, ownedIds) {
  return pool.resourceIds
    .map((resourceId) => getCatalogEntryById(resourceId))
    .filter(Boolean)
    .filter((entry) => !ownedIds.has(entry.id))
    .filter((entry) => compareRealms(game.player?.realm, entry.realmAtLeast) >= 0)
    .map((entry) => ({
      ...cloneResourceEntry(entry),
      kind: getResourceKind(entry.id)
    }));
}

function collectOwnedIds(game) {
  return new Set([
    ...(game.techniques ?? []).map(resourceIdFromEntry),
    ...(game.treasures ?? []).map(resourceIdFromEntry)
  ].filter(Boolean));
}

function resourceIdFromEntry(entry) {
  if (typeof entry === 'string') return entry;
  return entry?.id;
}

function getCatalogEntryById(id) {
  return TECHNIQUE_CATALOG[id] ?? TREASURE_CATALOG[id];
}

function getCatalogEntry(kind, id) {
  if (kind === 'technique') return TECHNIQUE_CATALOG[id];
  if (kind === 'treasure') return TREASURE_CATALOG[id];
  return undefined;
}

function getResourceKind(id) {
  if (TECHNIQUE_CATALOG[id]) return 'technique';
  if (TREASURE_CATALOG[id]) return 'treasure';
  return undefined;
}

function cloneResourceEntry(entry) {
  if (!entry) return entry;
  return {
    ...entry,
    tags: [...(entry.tags ?? [])],
    bonuses: { ...(entry.bonuses ?? {}) }
  };
}

function createCompensationCandidate(index) {
  return {
    id: `compensation_${index + 1}`,
    kind: 'compensation',
    name: '灵石补偿',
    grade: '补偿',
    type: '灵石',
    tags: ['保底'],
    description: '候选资源已被你收集，遗迹以灵石补偿这次机缘。',
    detail: '这不是新的功法或宝物，只是一笔明确的灵石补偿。',
    bonuses: {},
    spiritStones: COMPENSATION_SPIRIT_STONES
  };
}

function createDraftAction({ candidate, draftId, index, seed }) {
  const actionId = `resource_${draftId}_${index}_${hashHex(hashString(`${seed}:${candidate.id}:${index}`))}`;
  if (candidate.kind === 'compensation') {
    return {
      id: actionId,
      kind: 'compensation',
      spiritStones: candidate.spiritStones
    };
  }

  return {
    id: actionId,
    kind: candidate.kind,
    resourceId: candidate.id
  };
}

function resolveCompensation(game, draft, action) {
  const amount = action.spiritStones ?? COMPENSATION_SPIRIT_STONES;
  const next = {
    ...game,
    player: {
      ...game.player,
      spiritStones: (game.player?.spiritStones ?? 0) + amount
    }
  };
  const acquisitionLog = [
    ...(next.resourceRun.acquisitionLog ?? []),
    {
      id: `compensation:${draft.id}`,
      kind: 'compensation',
      resourceId: null,
      eventId: draft.sourceEventId,
      eventTitle: draft.sourceEventTitle,
      turn: draft.createdTurn,
      amount
    }
  ];

  return markDraftResolved({
    ...next,
    resourceRun: {
      ...next.resourceRun,
      acquisitionLog
    }
  }, draft.id);
}

function markDraftResolved(game, draftId) {
  const resolvedDraftIds = [...new Set([
    ...(game.resourceRun.resolvedDraftIds ?? []),
    draftId
  ])];

  return {
    ...game,
    resourceRun: {
      ...game.resourceRun,
      pendingDraft: null,
      resolvedDraftIds
    }
  };
}

function formatBonusText(candidate) {
  if (candidate.kind === 'compensation') {
    return `灵石 +${candidate.spiritStones ?? COMPENSATION_SPIRIT_STONES}`;
  }

  const text = RESOURCE_BONUS_TEXT
    .filter(([key]) => candidate.bonuses?.[key] !== undefined)
    .map(([key, label]) => `${label} +${candidate.bonuses[key]}`);
  return text.join('、') || '无额外数值加成';
}

function shuffle(entries, seed) {
  let state = seed >>> 0;
  for (let index = entries.length - 1; index > 0; index -= 1) {
    state = nextRandomState(state);
    const swapIndex = state % (index + 1);
    [entries[index], entries[swapIndex]] = [entries[swapIndex], entries[index]];
  }
  return entries;
}

function nextRandomState(state) {
  let next = state || 0x9e3779b9;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashHex(value) {
  return value.toString(16).padStart(8, '0');
}
