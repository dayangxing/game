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
  assert.match(handler, /createImmediateViewActions\(game,\s*getView\(activeViewId\)\)/);
  assert.ok(handler.indexOf('render();') < handler.indexOf('refreshDailyActionsForView(activeViewId)'));
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

function extractFunction(source, name) {
  const start = source.indexOf(`async function ${name}`);
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
