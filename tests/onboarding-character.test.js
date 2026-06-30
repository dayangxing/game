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
    'breathing',
    'sect_contact',
    'alchemy_trial',
    'mist_bell',
    'karma_choice',
    'heaven_contract',
    'formal_life'
  ]);
  assert.equal(ONBOARDING_STEPS[0].protagonist, '陆青玄');
  assert.match(ONBOARDING_STEPS[6].body, /天门契/);
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
  assert.ok(first.comprehension >= 20 && first.comprehension <= 90);
  assert.ok(first.physique >= 20 && first.physique <= 90);
  assert.ok(first.luck >= 10 && first.luck <= 95);
  assert.ok(first.initialLifespan >= 60 && first.initialLifespan <= 140);
  assert.doesNotThrow(() => assertPlayableCharacter(first));
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
  const character = rollCharacter({ seed: 52, name: '顾清河' });
  const formalGame = applyCharacterToGame(game, character, 52);

  assert.equal(formalGame.characterSeed, 52);
  assert.equal(formalGame.character.name, '顾清河');
  assert.equal(formalGame.player.name, '顾清河');
  assert.notEqual(formalGame.player.name, '陆青玄');
  assert.equal(formalGame.player.lifespan, character.initialLifespan);
  assert.deepEqual(formalGame.inventory.materials, character.startingResources.materials);
});
