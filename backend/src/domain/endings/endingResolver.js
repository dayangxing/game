import { ENDING_CATALOG } from './endingCatalog.js';

export function resolveEnding(game = {}) {
  const progress = game.storyProgress ?? {};
  if (progress.chapterId !== 'finale' || progress.finalChoiceMade !== true) return null;
  if (progress.status === 'ended' || game.ending) return null;

  const candidate = [...ENDING_CATALOG]
    .sort((left, right) => right.priority - left.priority)
    .find((ending) => ending.requires.fallback || meetsRequirements(ending.requires, game));

  return candidate ? structuredClone(candidate) : null;
}

export function isTerminalGame(game = {}) {
  return Boolean(game.ending || game.storyProgress?.status === 'ended');
}

export function applyEnding(game, candidate, turn) {
  if (!candidate || game.ending || game.storyProgress?.status === 'ended') return game;

  const { requires: _requires, priority: _priority, ...publicCandidate } = candidate;
  const ending = {
    ...publicCandidate,
    type: 'story_ending',
    status: 'ended',
    resolvedTurn: turn,
    resolvedChapterId: game.storyProgress?.chapterId ?? null,
    unlocks: candidate.id === 'break_contract' ? ['truth_breaker'] : [],
    summary: buildEndingSummary(game)
  };

  return {
    ...game,
    ending,
    storyProgress: game.storyProgress
      ? { ...game.storyProgress, status: 'ended', endingId: candidate.id }
      : game.storyProgress
  };
}

export function createLifespanEnding(game = {}) {
  return {
    type: 'lifespan_exhausted',
    title: '命簿终章',
    status: 'ended',
    resolvedTurn: game.turn,
    resolvedChapterId: game.storyProgress?.chapterId ?? null,
    body: '命火在最后一夜熄灭，未解伏笔仍悬于天门之后。',
    unlocks: [],
    summary: {
      finalRealm: game.player?.realm ?? '',
      truthFlags: game.storyProgress?.truthFlags?.length ?? 0,
      unresolvedThreads: (game.storyMemory?.openThreads ?? [])
        .filter((thread) => thread.status !== 'resolved')
        .slice(-6)
        .map((thread) => thread.title)
    }
  };
}

function meetsRequirements(requires, game) {
  const progress = game.storyProgress ?? {};
  if ((requires.minTruthFlags ?? 0) > (progress.truthFlags?.length ?? 0)) return false;
  if (requires.contractStance !== undefined && progress.contractStance !== requires.contractStance) return false;
  if (requires.sectPath !== undefined && progress.sectPath !== requires.sectPath) return false;
  return (requires.requiredFlags ?? []).every((flag) => game.flags?.[flag] === true);
}

function buildEndingSummary(game) {
  return {
    finalRealm: game.player?.realm ?? '',
    truthFlags: game.storyProgress?.truthFlags?.length ?? 0,
    unresolvedThreads: (game.storyMemory?.openThreads ?? [])
      .filter((thread) => thread.status !== 'resolved')
      .slice(-6)
      .map((thread) => thread.title)
  };
}
