import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('browser app configures the game api for backend-first mode', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /WENDAO_API_BASE_URL/);
  assert.match(source, /baseUrl:\s*BACKEND_BASE_URL/);
  assert.match(source, /preferredMode:\s*initialMode/);
});

test('app rendering is routed through renderActiveView for active tabs', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const render = extractFunction(source, 'render');

  assert.match(source, /function renderActiveView\(/);
  assert.match(render, /\s*renderActiveView\(\);\s*/);
  assert.equal((render.match(/\brenderActiveView\(\)/g) || []).length, 1);
});

test('activeViewId selects overview and tab-specific render routes without collapsing tabs together', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderActiveView = extractFunction(source, 'renderActiveView');
  const routeTargets = Object.fromEntries(
    ['home', 'cultivation', 'skills', 'realm', 'bag'].map((viewId) => [viewId, findViewRouteTarget(renderActiveView, viewId)])
  );

  assert.ok(renderActiveView, 'renderActiveView should exist');
  assert.match(renderActiveView, /activeViewId/);

  for (const [viewId, routeTarget] of Object.entries(routeTargets)) {
    assert.ok(routeTarget, `${viewId} should have a dedicated render route`);
    assert.notEqual(routeTarget, 'renderActiveView', `${viewId} route should not recurse into renderActiveView`);
  }

  assert.equal(new Set([routeTargets.skills, routeTargets.realm, routeTargets.bag]).size, 3);
  assert.notEqual(routeTargets.home, routeTargets.skills);
  assert.notEqual(routeTargets.home, routeTargets.realm);
  assert.notEqual(routeTargets.home, routeTargets.bag);
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
  const [, startFormalHandler] = source.match(/nodes\.startFormalGameBtn\.addEventListener\('click', async \(\) => \{([\s\S]*?)\n\}\);/) ?? [];
  const setModeBody = extractFunction(source, 'setMode');

  assert.ok(resetHandler, 'reset handler should exist');
  assert.ok(startFormalHandler, 'formal game handler should exist');
  assert.ok(setModeBody, 'setMode helper should exist');

  assert.doesNotMatch(resetHandler, /game = await api\.createGame/);
  assert.match(resetHandler, /const freshGame = await api\.createGame\(game\.mode\);/);
  assert.match(resetHandler, /rotateHistorySummaryScope\(\);/);
  assert.match(resetHandler, /const nextGame = hydrateHistorySummaries\(freshGame\);/);
  assert.match(resetHandler, /const nextActions = await loadDailyActionsForGame\(nextGame,\s*getView\(activeViewId\)\);/);
  assert.ok(resetHandler.indexOf('const nextActions') < resetHandler.indexOf('game = nextGame;'));
  assert.ok(resetHandler.indexOf('const nextActions') < resetHandler.indexOf('dailyActions = nextActions;'));
  assert.ok(resetHandler.indexOf('rotateHistorySummaryScope();') < resetHandler.indexOf('const nextGame = hydrateHistorySummaries(freshGame);'));

  assert.doesNotMatch(setModeBody, /game = await api\.setMode/);
  assert.match(setModeBody, /const modeGame = await api\.setMode\(game,\s*mode\);/);
  assert.match(setModeBody, /rotateHistorySummaryScope\(\);/);
  assert.match(setModeBody, /const nextGame = hydrateHistorySummaries\(modeGame\);/);
  assert.match(setModeBody, /const nextActions = await loadDailyActionsForGame\(nextGame,\s*getView\(activeViewId\)\);/);
  assert.ok(setModeBody.indexOf('const nextActions') < setModeBody.indexOf('game = nextGame;'));
  assert.ok(setModeBody.indexOf('const nextActions') < setModeBody.indexOf('dailyActions = nextActions;'));
  assert.ok(setModeBody.indexOf('rotateHistorySummaryScope();') < setModeBody.indexOf('const nextGame = hydrateHistorySummaries(modeGame);'));

  assert.match(startFormalHandler, /rotateHistorySummaryScope\(\);/);
  assert.ok(startFormalHandler.indexOf('rotateHistorySummaryScope();') < startFormalHandler.indexOf('game = hydrateHistorySummaries(game);'));
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
  assert.match(helper, /renderStatusOverview\(\);/);
  assert.match(helper, /renderViewFocus\(\);/);
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

test('daily action submission enriches history with player-facing summaries before saving', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const helper = extractFunction(source, 'submitDailyAction');

  assert.ok(helper, 'submitDailyAction should exist');
  assert.match(source, /function enrichGameHistory\(/);
  assert.match(helper, /const previousGame = game;/);
  assert.match(helper, /beginStreamingNarration\(action\);/);
  assert.match(helper, /api\.submitDailyActionStream\(/);
  assert.match(helper, /onNarrationPreview:\s*updateStreamingNarration/);
  assert.match(helper, /game = enrichGameHistory\(game,\s*previousGame\);/);
  assert.match(helper, /markHistoryRefreshed\(game\);/);
  assert.match(helper, /saveGame\(\);/);
});

test('api reload rehydrates cached player-facing history summaries onto durable log entries', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const submitHelper = extractFunction(source, 'submitDailyAction');
  const loadGameHelper = extractFunction(source, 'loadGame');
  const setModeHelper = extractFunction(source, 'setMode');
  const historySummaryKey = source.match(/const HISTORY_SUMMARY_KEY = '([^']+)';/);
  const historySummaryScopeKey = source.match(/const HISTORY_SUMMARY_SCOPE_KEY = '([^']+)';/);

  assert.ok(historySummaryKey, 'history summary storage key should exist');
  assert.ok(historySummaryScopeKey, 'history summary scope storage key should exist');
  assert.match(source, /function historyEntryCacheKey\(/);
  assert.match(source, /function getHistorySummaryScopeId\(/);
  assert.match(source, /function rotateHistorySummaryScope\(/);
  assert.match(source, /function normalizeEffectSummary\(/);
  assert.match(source, /function persistHistorySummaryCache\(/);
  assert.match(source, /function hydrateHistorySummaries\(/);
  assert.match(submitHelper, /persistHistorySummaryCache\(game\);/);
  assert.match(loadGameHelper, /hydrateHistorySummaries\(/);
  assert.match(setModeHelper, /hydrateHistorySummaries\(/);
  assert.match(setModeHelper, /rotateHistorySummaryScope\(\);/);

  const sandbox = { result: null };
  vm.runInNewContext(`
    ${historySummaryKey[0]}
    ${historySummaryScopeKey[0]}
    ${extractFunctionDeclaration(source, 'normalizeEffectSummary')}
    ${extractFunctionDeclaration(source, 'createHistorySummaryScopeId')}
    ${extractFunctionDeclaration(source, 'getHistorySummaryScopeId')}
    ${extractFunctionDeclaration(source, 'rotateHistorySummaryScope')}
    ${extractFunctionDeclaration(source, 'historyEntryCacheKey')}
    ${extractFunctionDeclaration(source, 'readHistorySummaryCache')}
    ${extractFunctionDeclaration(source, 'persistHistorySummaryCache')}
    ${extractFunctionDeclaration(source, 'hydrateHistorySummaries')}
    result = {
      getHistorySummaryScopeId,
      rotateHistorySummaryScope,
      persistHistorySummaryCache,
      hydrateHistorySummaries
    };
  `, sandbox);

  const storage = createStorageDouble();
  sandbox.result.persistHistorySummaryCache({
    log: [
      { id: 'opening', title: '山门初醒', command: '开局', body: '晨雾未散。' },
      {
        id: 'turn-1',
        title: '命火微暗',
        command: '闭关修炼一日',
        body: '经脉略有刺痛。',
        effectsSummary: ['寿元 -1', '修为 +8']
      }
    ]
  }, storage);

  const reloaded = sandbox.result.hydrateHistorySummaries({
    log: [
      { id: 'opening', title: '山门初醒', command: '开局', body: '晨雾未散。' },
      { id: 'turn-1', title: '命火微暗', command: '闭关修炼一日', body: '经脉略有刺痛。' }
    ]
  }, storage);

  assert.deepEqual(Array.from(reloaded.log[1].effectsSummary), ['寿元 -1', '修为 +8']);
});

test('history summary hydration ignores stale cache entries after the playthrough scope rotates', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const historySummaryKey = source.match(/const HISTORY_SUMMARY_KEY = '([^']+)';/);
  const historySummaryScopeKey = source.match(/const HISTORY_SUMMARY_SCOPE_KEY = '([^']+)';/);

  assert.ok(historySummaryKey, 'history summary storage key should exist');
  assert.ok(historySummaryScopeKey, 'history summary scope storage key should exist');

  const sandbox = { result: null };
  vm.runInNewContext(`
    ${historySummaryKey[0]}
    ${historySummaryScopeKey[0]}
    ${extractFunctionDeclaration(source, 'normalizeEffectSummary')}
    ${extractFunctionDeclaration(source, 'createHistorySummaryScopeId')}
    ${extractFunctionDeclaration(source, 'getHistorySummaryScopeId')}
    ${extractFunctionDeclaration(source, 'rotateHistorySummaryScope')}
    ${extractFunctionDeclaration(source, 'historyEntryCacheKey')}
    ${extractFunctionDeclaration(source, 'readHistorySummaryCache')}
    ${extractFunctionDeclaration(source, 'persistHistorySummaryCache')}
    ${extractFunctionDeclaration(source, 'hydrateHistorySummaries')}
    result = {
      getHistorySummaryScopeId,
      rotateHistorySummaryScope,
      persistHistorySummaryCache,
      hydrateHistorySummaries
    };
  `, sandbox);

  const storage = createStorageDouble();
  const firstScopeId = sandbox.result.getHistorySummaryScopeId(storage);

  sandbox.result.persistHistorySummaryCache({
    log: [
      {
        id: 'turn-1',
        title: '命火微暗',
        command: '闭关修炼一日',
        body: '经脉略有刺痛。',
        effectsSummary: ['寿元 -1', '修为 +8']
      }
    ]
  }, storage);

  const secondScopeId = sandbox.result.rotateHistorySummaryScope(storage);
  const freshRun = sandbox.result.hydrateHistorySummaries({
    log: [
      { id: 'turn-1', title: '命火微暗', command: '闭关修炼一日', body: '经脉略有刺痛。' }
    ]
  }, storage);

  assert.notEqual(secondScopeId, firstScopeId);
  assert.equal(freshRun.log[0].effectsSummary, undefined);
});

function extractFunction(source, name) {
  const start = source.indexOf(`async function ${name}`) !== -1
    ? source.indexOf(`async function ${name}`)
    : source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const signatureEnd = source.indexOf(')', start);
  const bodyStart = source.indexOf('{', signatureEnd);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }

  assert.fail(`${name} should have a complete function body`);
}

function extractFunctionDeclaration(source, name) {
  const start = source.indexOf(`async function ${name}`) !== -1
    ? source.indexOf(`async function ${name}`)
    : source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const signatureEnd = source.indexOf(')', start);
  const bodyStart = source.indexOf('{', signatureEnd);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  assert.fail(`${name} should have a complete declaration`);
}

function findViewRouteTarget(renderActiveView, viewId) {
  return (
    findLookupRouteTarget(renderActiveView, viewId) ||
    findIfRouteTarget(renderActiveView, viewId) ||
    findSwitchRouteTarget(renderActiveView, viewId)
  );
}

function findLookupRouteTarget(renderActiveView, viewId) {
  const escapedView = escapeRegex(viewId);
  const lookupBodyPattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;

  let match;
  while ((match = lookupBodyPattern.exec(renderActiveView)) !== null) {
    const mapName = match[1];
    const mapBodyStart = renderActiveView.indexOf('{', match.index);
    const mapBody = extractBraceBody(renderActiveView, mapBodyStart);
    if (!mapBody) continue;
    const targetMatch = mapBody.match(new RegExp(`(?:^|[\\s,])(?:['"]${escapedView}['"]|${escapedView})\\s*:\\s*([A-Za-z_$][\\w$]*)\\b`));
    if (!targetMatch) continue;

    const sectionStart = match.index;
    const afterMap = renderActiveView.slice(sectionStart);
    const lookupIndexPattern = new RegExp(`\\b${escapeRegex(mapName)}\\s*\\[\\s*activeViewId\\s*\\]`, 'g');
    if (!lookupIndexPattern.test(afterMap)) continue;

    const directInvocationPattern = new RegExp(`\\b${escapeRegex(mapName)}\\s*\\[\\s*activeViewId\\s*\\](?:\\?\\.|\\.)?\\(`, 'g');
    if (directInvocationPattern.test(afterMap)) return targetMatch[1];

    const aliasPattern = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegex(mapName)}\\s*\\[\\s*activeViewId\\s*\\](?:\\s*[\\|\\?][\\|\\?]\\s*[^\\n;]+)?;?`, 'g');
    let aliasMatch;
    while ((aliasMatch = aliasPattern.exec(afterMap)) !== null) {
      const alias = escapeRegex(aliasMatch[1]);
      const callPattern = new RegExp(`\\b${alias}\\s*\\(`, 'g');
      if (callPattern.test(afterMap.slice(aliasMatch.index + aliasMatch[0].length))) return targetMatch[1];
    }
  }

  return '';
}

function findIfRouteTarget(renderActiveView, viewId) {
  const escapedView = escapeRegex(viewId);
  const condition = new RegExp(`if\\s*\\(\\s*(?:activeViewId\\s*(?:===|==)\\s*['"]${escapedView}['"]|['"]${escapedView}['"]\\s*(?:===|==)\\s*activeViewId)\\s*\\)`, 'g');
  const match = condition.exec(renderActiveView);
  if (!match) return '';

  const branch = extractBraceBody(renderActiveView, renderActiveView.indexOf('{', match.index));
  return findRouteInvocation(branch);
}

function findSwitchRouteTarget(renderActiveView, viewId) {
  if (!/switch\s*\(\s*activeViewId\s*\)/.test(renderActiveView)) return '';

  const escapedView = escapeRegex(viewId);
  const casePattern = new RegExp(`case\\s*(?:['"]${escapedView}['"]|${escapedView})\\s*:`, 'g');
  const match = casePattern.exec(renderActiveView);
  if (!match) return '';

  const caseStart = match.index + match[0].length;
  const afterCase = renderActiveView.slice(caseStart);
  const nextCase = afterCase.search(/\n\s*(?:case\s*(?:['"][^'"]+['"]|[A-Za-z_$][\w$]+)\s*:|default\s*:)/);
  const caseBody = nextCase === -1 ? afterCase : afterCase.slice(0, nextCase);
  return findRouteInvocation(caseBody);
}

function findRouteInvocation(branch) {
  const ignoredCalls = new Set([
    'if',
    'switch',
    'for',
    'while',
    'renderActiveView',
    'renderTabs',
    'renderPlayer',
    'renderStory',
    'renderWorld',
    'renderMode',
    'renderFirstRunStage',
    'getView'
  ]);

  for (const [, name] of branch.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
    if (!ignoredCalls.has(name)) return name;
  }

  return '';
}

function extractBraceBody(source, openIndex) {
  if (openIndex < 0 || source[openIndex] !== '{') return '';
  let depth = 0;

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, index);
      }
    }
  }

  return '';
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createStorageDouble() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}
