import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ONBOARDING_STEPS,
  canCreateFormalCharacter,
  completeOnboardingStep,
  createOnboardingState,
  getCurrentOnboardingStep
} from '../backend/src/domain/onboarding.js';
import {
  applyCharacterToGame,
  assertPlayableCharacter,
  rollCharacter
} from '../backend/src/domain/characterCreation.js';
import { createGame } from '../src/engine.js';

test('onboarding exposes the fixed tutorial task chain in order', () => {
  assert.deepEqual(ONBOARDING_STEPS.map((step) => step.id), [
    'awakening',
    'qingyun_rules',
    'breathing',
    'lifespan_lamp',
    'sect_contact',
    'alchemy_trial',
    'sect_trial',
    'mist_bell',
    'karma_choice',
    'mist_archive',
    'heaven_contract',
    'formal_life'
  ]);
  assert.equal(ONBOARDING_STEPS[0].protagonist, '陆青玄');
  assert.equal(ONBOARDING_STEPS.length, 12);
  assert.ok(ONBOARDING_STEPS.every((step) => step.body.length >= 70));
  assert.match(ONBOARDING_STEPS.map((step) => step.body).join('\n'), /青云宗/);
  assert.match(ONBOARDING_STEPS.map((step) => step.body).join('\n'), /雾隐秘境/);
  assert.match(ONBOARDING_STEPS.map((step) => step.body).join('\n'), /寿元/);
  assert.match(ONBOARDING_STEPS.map((step) => step.body).join('\n'), /天门残契|天门契/);
  assert.match(ONBOARDING_STEPS.at(-1).body, /创建.*角色/);
});

test('onboarding completes one step at a time before character creation unlocks', () => {
  let state = createOnboardingState();

  assert.equal(state.completed, false);
  assert.equal(canCreateFormalCharacter(state), false);
  assert.equal(getCurrentOnboardingStep(state).id, 'awakening');

  for (const step of ONBOARDING_STEPS) {
    state = completeOnboardingStep(state, step.id);
  }

  assert.equal(state.completed, true);
  assert.equal(state.unlockedCharacterCreation, true);
  assert.equal(canCreateFormalCharacter(state), true);
  assert.deepEqual(state.completedStepIds, ONBOARDING_STEPS.map((step) => step.id));
});

test('character generation is seeded and stays in playable ranges', () => {
  const first = rollCharacter({ seed: 91, name: '沈问星' });
  const second = rollCharacter({ seed: 91, name: '沈问星' });

  assert.deepEqual(first, second);
  assert.equal(first.name, '沈问星');
  assert.ok(first.origin.length > 0);
  assert.ok(first.spiritualRoot.length > 0);
  assert.ok(first.traits.length >= 2);
  assert.deepEqual(first.attributes, {
    rootBone: 7,
    comprehension: 3,
    fortune: 6,
    willpower: 5,
    lifeSeed: 4
  });
  assert.equal(first.comprehension, 27);
  assert.equal(first.physique, 63);
  assert.equal(first.luck, 54);
  assert.ok(first.comprehension >= 20 && first.comprehension <= 90);
  assert.ok(first.physique >= 20 && first.physique <= 90);
  assert.ok(first.luck >= 10 && first.luck <= 95);
  assert.ok(first.initialLifespan >= 60 && first.initialLifespan <= 140);
  assert.doesNotThrow(() => assertPlayableCharacter(first));
});

test('character generation accepts a validated manual attribute allocation', () => {
  const character = rollCharacter({
    seed: 52,
    name: '顾清河',
    attributes: {
      rootBone: 7,
      comprehension: 6,
      fortune: 4,
      willpower: 4,
      lifeSeed: 4
    }
  });

  assert.deepEqual(character.attributes, {
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  });
  assert.equal(character.comprehension, 54);
  assert.equal(character.physique, 63);
  assert.equal(character.luck, 36);
});

test('different character seeds produce meaningfully different formal characters', () => {
  const characters = [11, 12, 13].map((seed) => rollCharacter({ seed, name: `角色${seed}` }));
  const signatures = new Set(characters.map((character) => [
    character.origin,
    character.spiritualRoot,
    character.traits.join('/'),
    character.comprehension,
    character.physique,
    character.luck
  ].join('|')));

  assert.equal(signatures.size, 3);
});

test('formal character is applied without inheriting tutorial protagonist stats', () => {
  const game = createGame(31);
  const character = rollCharacter({
    seed: 52,
    name: '顾清河',
    attributes: {
      rootBone: 7,
      comprehension: 6,
      fortune: 4,
      willpower: 4,
      lifeSeed: 4
    }
  });
  const formalGame = applyCharacterToGame(game, character, 52);

  assert.equal(formalGame.characterSeed, 52);
  assert.equal(formalGame.character.name, '顾清河');
  assert.deepEqual(formalGame.character.attributes, {
    rootBone: 7,
    comprehension: 6,
    fortune: 4,
    willpower: 4,
    lifeSeed: 4
  });
  assert.equal(formalGame.player.name, '顾清河');
  assert.notEqual(formalGame.player.name, '陆青玄');
  assert.deepEqual(formalGame.player, {
    name: '顾清河',
    origin: character.origin,
    realm: '炼气一层',
    spiritualRoot: character.spiritualRoot,
    maxHealth: 144,
    health: 144,
    maxLifespan: character.initialLifespan + 32,
    lifespan: character.initialLifespan + 32,
    spiritStones: character.startingResources.spiritStones,
    qi: 50,
    mood: 50,
    cultivationProgress: 0,
    sectRelation: 0,
    location: '青云宗山门'
  });
  assert.notEqual(formalGame.player.realm, game.player.realm);
  assert.notEqual(formalGame.player.qi, game.player.qi);
  assert.notEqual(formalGame.player.mood, game.player.mood);
  assert.notEqual(formalGame.player.sectRelation, game.player.sectRelation);
  assert.notEqual(formalGame.player.location, game.player.location);
  assert.equal(formalGame.player.health, formalGame.player.maxHealth);
  assert.equal(formalGame.player.lifespan, formalGame.player.maxLifespan);
  assert.deepEqual(formalGame.inventory.materials, character.startingResources.materials);
  assert.equal(formalGame.npcs.length, 2);
  assert.ok(formalGame.npcs.every((npc) => !JSON.stringify(npc).includes('陆青玄')));
  assert.ok(formalGame.foreshadows.every((entry) => !entry.includes('陆青玄')));
  assert.ok(formalGame.worldEvents.every((entry) => !JSON.stringify(entry).includes('陆青玄')));
  assert.ok(formalGame.timeline.every((entry) => !JSON.stringify(entry).includes('陆青玄')));
  assert.ok(formalGame.suggestions.every((entry) => !entry.includes('陆青玄')));
  assert.ok(formalGame.log.every((entry) => !JSON.stringify(entry).includes('陆青玄')));
  assert.equal(formalGame.log[0].title, '命簿初开');
  assert.match(formalGame.log[0].body, /顾清河/);
  assert.match(formalGame.log[0].body, /青云山门/);
});
