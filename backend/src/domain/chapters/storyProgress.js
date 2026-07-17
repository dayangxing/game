import { getChapterDefinition } from './chapterCatalog.js';
import { getChapterProgress } from './objectiveEvaluator.js';

export const TRUTH_FLAG_KEYS = [
  'lifespan_mark', 'mist_archive', 'bronze_bell',
  'sect_elder_split', 'ascension_contract', 'heaven_gate_key'
];

export function createFormalStoryProgress() {
  return {
    chapterId: 'prologue',
    chapterIndex: 0,
    status: 'active',
    completedObjectiveIds: [],
    truthFlags: [],
    sectPath: null,
    contractStance: null,
    finalChoiceMade: false,
    endingId: null
  };
}

export function mergeTruthFlags(existingFlags = [], gameFlags = {}) {
  return [...new Set([
    ...(Array.isArray(existingFlags) ? existingFlags : []),
    ...TRUTH_FLAG_KEYS.filter((flag) => gameFlags[flag] === true)
  ])];
}

export function normalizeStoryProgress(game = {}) {
  if (game.onboarding?.completed !== true) return null;

  const defaults = createFormalStoryProgress();
  const existing = game.storyProgress ?? {};
  const chapter = getChapterDefinition(existing.chapterId) ?? getChapterDefinition(defaults.chapterId);
  const status = game.ending || existing.status === 'ended' ? 'ended' : 'active';

  return {
    ...defaults,
    ...existing,
    chapterId: chapter.id,
    chapterIndex: chapter.index,
    status,
    completedObjectiveIds: Array.isArray(existing.completedObjectiveIds) ? [...new Set(existing.completedObjectiveIds)] : [],
    truthFlags: mergeTruthFlags(existing.truthFlags, game.flags ?? {}),
    finalChoiceMade: existing.finalChoiceMade === true || game.flags?.final_choice_made === true,
    endingId: game.ending?.id ?? existing.endingId ?? null
  };
}

export function getPublicChapterSnapshot(game = {}) {
  const progress = game.storyProgress;
  if (!progress) return null;

  const chapter = getChapterDefinition(progress.chapterId);
  if (!chapter) return null;

  const evaluated = getChapterProgress(chapter, game);
  const completedObjectiveIds = new Set([
    ...(progress.completedObjectiveIds ?? []),
    ...evaluated.completedObjectiveIds
  ]);
  const objectives = chapter.objectives.map((objective) => ({
    text: objective.publicText,
    completed: completedObjectiveIds.has(objective.id),
    required: objective.required === true
  }));
  const completedCount = objectives.filter((objective) => objective.completed).length;

  return {
    id: chapter.id,
    index: chapter.index,
    title: chapter.title,
    progress: chapter.objectives.length === 0 ? 100 : Math.floor((completedCount / chapter.objectives.length) * 100),
    objectives
  };
}
