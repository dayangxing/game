import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('browser app configures the game api for backend-first mode', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /WENDAO_API_BASE_URL/);
  assert.match(source, /baseUrl:\s*BACKEND_BASE_URL/);
  assert.match(source, /preferredMode:\s*initialMode/);
});

test('tab navigation renders immediate actions before refreshing backend actions', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const [, handler] = source.match(/nodes\.topTabs\.addEventListener\('click', \(event\) => \{([\s\S]*?)\n\}\);/) ?? [];

  assert.ok(handler, 'top tab click handler should exist');
  assert.match(handler, /showImmediateActionsForView\(activeViewId\);/);
  assert.match(source, /function showImmediateActionsForView\(viewId\) \{/);
  assert.match(source, /dailyActions = createImmediateViewActions\(game,\s*getView\(viewId\)\);/);
  assert.ok(handler.indexOf('render();') < handler.indexOf('refreshDailyActionsForView(activeViewId)'));
});

test('api mode locks provisional immediate actions until backend actions refresh', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const submitHelper = extractFunction(source, 'submitDailyAction');
  const refreshHelper = extractFunction(source, 'refreshDailyActionsForView');
  const cardBuilder = extractFunction(source, 'buildActionCards');

  assert.match(source, /let pendingApiImmediateActions = false;/);
  assert.ok(submitHelper, 'submitDailyAction helper should exist');
  assert.match(submitHelper, /if \(shouldBlockImmediateApiAction\(action\)\) \{/);
  assert.match(submitHelper, /showToast\('行动尚在刷新，请稍候再试'\);/);
  assert.match(source, /function shouldBlockImmediateApiAction\(action\) \{/);
  assert.match(source, /return game\.mode === 'api' && pendingApiImmediateActions && action\.source === 'immediate';/);
  assert.ok(refreshHelper, 'refreshDailyActionsForView helper should exist');
  assert.match(refreshHelper, /pendingApiImmediateActions = false;/);
  assert.ok(cardBuilder, 'buildActionCards helper should exist');
  assert.match(cardBuilder, /disabled:\s*shouldBlockImmediateApiAction\(action\)/);
});

test('daily action refresh is guarded by request, view, and game context', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const helper = extractFunction(source, 'refreshDailyActionsForView');

  assert.match(source, /let actionRefreshSequence = 0;/);
  assert.ok(helper, 'guarded daily action refresh helper should exist');
  assert.match(helper, /const requestId = \+\+actionRefreshSequence;/);
  assert.match(helper, /const requestGame = game;/);
  assert.match(helper, /const requestView = getView\(viewId\);/);
  assert.match(helper, /const nextActions = await loadDailyActionsForGame\(requestGame,\s*requestView\);/);
  assert.match(helper, /if \(\s*requestId !== actionRefreshSequence\s*\|\|\s*activeViewId !== requestView\.id\s*\|\|\s*!isSameGameSnapshot\(game,\s*requestGame\)\s*\) \{/);
  assert.ok(helper.indexOf('const nextActions') < helper.indexOf('dailyActions = nextActions;'));
});

test('mode and reset transitions load next actions before replacing current state', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const [, resetHandler] = source.match(/nodes\.resetBtn\.addEventListener\('click', async \(\) => \{([\s\S]*?)\n\}\);/) ?? [];
  const setModeBody = extractFunction(source, 'setMode');

  assert.ok(resetHandler, 'reset handler should exist');
  assert.ok(setModeBody, 'setMode helper should exist');

  assert.doesNotMatch(resetHandler, /game = await api\.createGame/);
  assert.match(resetHandler, /const nextGame = await api\.createGame\(game\.mode\);/);
  assert.match(resetHandler, /const nextActions = await loadDailyActionsForGame\(nextGame,\s*getView\(activeViewId\)\);/);
  assert.ok(resetHandler.indexOf('const nextActions') < resetHandler.indexOf('game = nextGame;'));
  assert.ok(resetHandler.indexOf('const nextActions') < resetHandler.indexOf('dailyActions = nextActions;'));

  assert.doesNotMatch(setModeBody, /game = await api\.setMode/);
  assert.match(setModeBody, /const nextGame = await api\.setMode\(game,\s*mode\);/);
  assert.match(setModeBody, /const nextActions = await loadDailyActionsForGame\(nextGame,\s*getView\(activeViewId\)\);/);
  assert.ok(setModeBody.indexOf('const nextActions') < setModeBody.indexOf('game = nextGame;'));
  assert.ok(setModeBody.indexOf('const nextActions') < setModeBody.indexOf('dailyActions = nextActions;'));
});

test('startup api failure notice prevents the guide from covering the error toast', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /if \(startupNotice\) showToast\(startupNotice\);/);
  assert.match(source, /if \(!startupNotice && shouldAutoOpenGuide\(localStorage\)\) openGuide\(\);/);
});

test('first run stage keeps onboarding and character creation inside the main stage', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const helper = extractFunction(source, 'renderFirstRunStage');

  assert.ok(helper, 'renderFirstRunStage should exist');
  assert.match(helper, /const needsOnboarding = game\.onboarding && !game\.onboarding\.completed;/);
  assert.match(helper, /const needsCharacter = shouldShowCharacterCreation\(game\);/);
  assert.match(helper, /nodes\.onboardingPanel\.hidden = !needsOnboarding;/);
  assert.match(helper, /nodes\.characterPanel\.hidden = !needsCharacter;/);
  assert.match(helper, /nodes\.dashboardContent\.hidden = needsOnboarding \|\| needsCharacter;/);
  assert.doesNotMatch(helper, /document\.querySelector\('\.main-stage'\)\.hidden/);
  assert.match(helper, /renderPendingCharacterStatus\(\);/);
  assert.doesNotMatch(helper, /renderCharacterRoll\(/);
});

test('character creation gate uses explicit state instead of literal player name', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const helper = extractFunction(source, 'shouldShowCharacterCreation');
  const predicate = extractFunction(source, 'hasFormalCharacterData');

  assert.ok(helper, 'shouldShowCharacterCreation should exist');
  assert.doesNotMatch(helper, /player\.name === '陆青玄'/);
  assert.match(helper, /if \(!game\.onboarding\?\.completed\) return false;/);
  assert.match(helper, /if \(!game\.onboarding\?\.unlockedCharacterCreation\) return false;/);
  assert.match(helper, /return !game\.characterSeed \|\| !hasFormalCharacterData\(game\.character\);/);
  assert.ok(predicate, 'hasFormalCharacterData should exist');
  assert.match(predicate, /if \(character\.traits\.includes\('新手序章'\)\) return false;/);
  assert.match(predicate, /typeof character\.startingResources\?\.spiritStones === 'number'/);
});

function extractFunction(source, name) {
  const start = source.indexOf(`async function ${name}`) !== -1
    ? source.indexOf(`async function ${name}`)
    : source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }

  assert.fail(`${name} should have a complete function body`);
}
