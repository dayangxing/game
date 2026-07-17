import { getChapterDefinition } from './chapterCatalog.js';
import { getChapterProgress } from './objectiveEvaluator.js';
import { getPublicChapterSnapshot, mergeTruthFlags } from './storyProgress.js';

export function resolveChapterProgress({ before: _before, after, turn }) {
  if (!after.storyProgress || after.storyProgress.status === 'ended' || after.ending) {
    return {
      game: after,
      completedObjectiveIds: [],
      transition: null,
      milestone: null,
      ending: after.ending ?? null
    };
  }

  const current = getChapterDefinition(after.storyProgress.chapterId);
  if (!current) throw new Error(`CHAPTER_CONFIG_INVALID:${after.storyProgress.chapterId}`);

  const withTruth = {
    ...after,
    storyProgress: {
      ...after.storyProgress,
      truthFlags: mergeTruthFlags(after.storyProgress.truthFlags, after.flags ?? {})
    }
  };
  const progress = getChapterProgress(current, withTruth);
  const completedObjectiveIds = [...new Set([
    ...(withTruth.storyProgress.completedObjectiveIds ?? []),
    ...progress.completedObjectiveIds
  ])];
  const withProgress = {
    ...withTruth,
    storyProgress: { ...withTruth.storyProgress, completedObjectiveIds }
  };

  if (!progress.requiredCompleted || !current.nextChapterId) {
    return {
      game: { ...withProgress, chapter: getPublicChapterSnapshot(withProgress) },
      completedObjectiveIds: progress.completedObjectiveIds,
      transition: null,
      milestone: null,
      ending: withProgress.ending ?? null
    };
  }

  const next = getChapterDefinition(current.nextChapterId);
  if (!next) throw new Error(`CHAPTER_CONFIG_INVALID_NEXT:${current.id}`);

  const nextGame = {
    ...withProgress,
    storyProgress: {
      ...withProgress.storyProgress,
      chapterId: next.id,
      chapterIndex: next.index,
      chapterStartedTurn: turn,
      chapterStartedElapsedMonths: withProgress.time?.elapsedMonths ?? 0,
      completedObjectiveIds: []
    },
    chapterHistory: [
      ...(withProgress.chapterHistory ?? []),
      {
        chapterId: current.id,
        index: current.index,
        startedTurn: withProgress.storyProgress.chapterStartedTurn ?? 0,
        completedTurn: turn,
        startedElapsedMonths: withProgress.storyProgress.chapterStartedElapsedMonths ?? 0,
        completedElapsedMonths: withProgress.time?.elapsedMonths ?? 0,
        completedObjectiveIds: progress.completedObjectiveIds
      }
    ]
  };

  return {
    game: { ...nextGame, chapter: getPublicChapterSnapshot(nextGame) },
    completedObjectiveIds: progress.completedObjectiveIds,
    transition: {
      fromChapterId: current.id,
      toChapterId: next.id,
      fromTitle: current.title,
      toTitle: next.title,
      completedObjectiveIds: progress.completedObjectiveIds
    },
    milestone: { id: `${current.id}_complete`, chapterId: current.id },
    ending: null
  };
}
