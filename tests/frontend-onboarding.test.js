import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  GUIDE_STORAGE_KEY,
  getGuideStep,
  guideSteps,
  markGuideCompleted,
  shouldAutoOpenGuide
} from '../frontend/src/ui/onboardingGuide.js';

test('onboarding has a clear first-visit trigger', () => {
  const storage = new Map();

  assert.equal(shouldAutoOpenGuide(storage), true);
  storage.set(GUIDE_STORAGE_KEY, 'completed');
  assert.equal(shouldAutoOpenGuide(storage), false);
});

test('onboarding trigger works with browser localStorage API', () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };

  assert.equal(shouldAutoOpenGuide(storage), true);
  storage.setItem(GUIDE_STORAGE_KEY, 'completed');
  assert.equal(shouldAutoOpenGuide(storage), false);
});

test('onboarding completion writes through browser localStorage API', () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };

  markGuideCompleted(storage);

  assert.equal(storage.getItem(GUIDE_STORAGE_KEY), 'completed');
});

test('onboarding guide defines concrete steps for the main desktop flow', () => {
  assert.ok(guideSteps.length >= 4);
  assert.deepEqual(guideSteps.map((step) => step.id), ['tabs', 'actions', 'story', 'state']);
  assert.equal(getGuideStep(99).id, 'state');
});

test('frontend page exposes manual onboarding trigger and modal shell', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');

  assert.match(html, /id="guideBtn"/);
  assert.match(html, /id="guideOverlay"/);
  assert.match(html, /id="guideNextBtn"/);
  assert.match(html, /id="guideSkipBtn"/);
});
