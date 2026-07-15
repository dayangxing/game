import { compareRealms } from '../progression.js';

export function evaluateObjective(objective, game = {}) {
  const predicate = objective?.predicate ?? {};
  const flags = game.flags ?? {};
  const progress = game.storyProgress ?? {};
  const npcs = game.npcs ?? [];

  if (predicate.type === 'flag') return flags[predicate.flag] === true;
  if (predicate.type === 'anyFlag') return (predicate.flags ?? []).some((flag) => flags[flag] === true);
  if (predicate.type === 'allFlags') return (predicate.flags ?? []).every((flag) => flags[flag] === true);
  if (predicate.type === 'realmAtLeast') return compareRealms(game.player?.realm, predicate.realm) >= 0;
  if (predicate.type === 'npcAffinityAtLeast') {
    return npcs.some((npc) => npc.name === predicate.npcName && (npc.affinity ?? 0) >= predicate.value);
  }
  if (predicate.type === 'anyNpcAffinityAtLeast') return npcs.some((npc) => (npc.affinity ?? 0) >= predicate.value);
  if (predicate.type === 'truthFlagCountAtLeast') return (progress.truthFlags ?? []).length >= predicate.value;
  if (predicate.type === 'sectPathSelected') return Boolean(progress.sectPath);
  if (predicate.type === 'contractStanceSelected') return Boolean(progress.contractStance);
  if (predicate.type === 'finalChoiceMade') return progress.finalChoiceMade === true;
  return false;
}

export function getChapterProgress(chapter, game = {}) {
  const objectives = chapter?.objectives ?? [];
  const completedObjectiveIds = objectives
    .filter((objective) => evaluateObjective(objective, game))
    .map((objective) => objective.id);
  const requiredObjectives = objectives.filter((objective) => objective.required);
  const requiredCompleted = requiredObjectives.every((objective) => completedObjectiveIds.includes(objective.id));

  return {
    completedObjectiveIds,
    requiredCompleted,
    progress: objectives.length === 0 ? 100 : Math.floor((completedObjectiveIds.length / objectives.length) * 100)
  };
}
