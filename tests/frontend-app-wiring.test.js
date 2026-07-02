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
  const renderActiveView = extractNamedCallable(source, 'renderActiveView');

  assert.ok(renderActiveView, 'renderActiveView should exist');
  const renderRoutesThroughActiveView =
    /\brenderActiveView\s*\(\s*activeViewId\s*\)/.test(render)
    || /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*activeViewId\s*;\s*\brenderActiveView\s*\(\s*\1\s*\)/s.test(render)
    || /\bactiveViewId\b/.test(renderActiveView);

  assert.ok(
    renderRoutesThroughActiveView,
    'render() should pass activeViewId to renderActiveView, even through a local alias, or renderActiveView should read activeViewId directly'
  );
  assert.equal((render.match(/\brenderActiveView\s*\(/g) || []).length, 1);
});

test('dashboard content delegates dynamic action clicks from the active view container', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /activeViewContent:\s*document\.querySelector\('#activeViewContent'\)/);
  assert.match(source, /nodes\.activeViewContent\.addEventListener\('click'/);
  assert.doesNotMatch(source, /nodes\.actionGrid\.addEventListener\('click'/);
});

test('shared active-view panel helpers render actions and history without direct card listeners', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const panelHelper = extractFunction(source, 'renderPanel');
  const titleHelper = extractFunction(source, 'renderSectionTitle');
  const actionPanel = extractFunction(source, 'renderActionPanel');
  const historyPanel = extractFunction(source, 'renderHistoryPanel');

  assert.match(source, /function renderHistoryPanel\(limit = 5\)/);
  assert.match(panelHelper, /renderSectionTitle\(title,\s*meta\)/);
  assert.match(titleHelper, /<div class="section-title">/);
  assert.match(actionPanel, /id="actionGrid"/);
  assert.match(actionPanel, /buildActionCards\(dailyActions\)/);
  assert.doesNotMatch(actionPanel, /addEventListener/);
  assert.match(historyPanel, /buildRecentHistory\(limit\)/);
  assert.match(historyPanel, /historyCardClass\(entry\)/);
  assert.match(historyPanel, /formatHistoryEffectSummary\(entry\)/);
});

test('activeViewId selects overview and tab-specific render routes without collapsing tabs together', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderActiveView = extractNamedCallable(source, 'renderActiveView');
  const selectorName = findRouteSelectorName(renderActiveView);
  const routeTargets = Object.fromEntries(
    ['home', 'cultivation', 'skills', 'realm', 'bag'].map((viewId) => [viewId, findViewRouteTarget(renderActiveView, viewId, selectorName)])
  );

  assert.ok(renderActiveView, 'renderActiveView should exist');

  for (const [viewId, routeTarget] of Object.entries(routeTargets)) {
    assert.ok(routeTarget, `${viewId} should have a dedicated render route`);
    assert.notEqual(routeTarget, 'renderActiveView', `${viewId} route should not recurse into renderActiveView`);
  }

  assert.equal(
    new Set(Object.values(routeTargets)).size,
    5,
    'home, cultivation, skills, realm, and bag should resolve to distinct content routes'
  );
});

test('callable extraction keeps the selector signature for function and arrow render routes', () => {
  const functionSource = `
    function renderActiveView(viewId) {
      switch (viewId) {
        case 'home':
          return renderHomeView();
        default:
          return renderBagView();
      }
    }
  `;
  const arrowSource = `
    const renderActiveView = (selectedView) => routeMap[selectedView]?.();
  `;

  const extractedFunction = extractNamedCallable(functionSource, 'renderActiveView');
  const extractedArrow = extractNamedCallable(arrowSource, 'renderActiveView');

  assert.match(extractedFunction, /^function renderActiveView\(viewId\)/);
  assert.match(extractedArrow, /^const renderActiveView = \(selectedView\) =>/);
  assert.equal(findRouteSelectorName(extractedFunction), 'viewId');
  assert.equal(findRouteSelectorName(extractedArrow), 'selectedView');
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
  return extractCallableParts(source, name).body;
}

function extractNamedCallable(source, name) {
  return extractCallableParts(source, name).source;
}

function extractCallableParts(source, name) {
  const callable = extractCallablePartsOrNull(source, name);
  assert.ok(callable, `${name} should exist`);
  return callable;
}

function extractCallablePartsOrNull(source, name) {
  return tryExtractNamedFunction(source, `async function ${name}`)
    || tryExtractNamedFunction(source, `function ${name}`)
    || tryExtractAssignedCallable(source, name);
}

function tryExtractNamedFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) return null;
  return extractCallableFromStart(source, start);
}

function tryExtractAssignedCallable(source, name) {
  const patterns = [
    new RegExp(`(?:const|let|var)\\s+${escapeRegex(name)}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>`),
    new RegExp(`(?:const|let|var)\\s+${escapeRegex(name)}\\s*=\\s*(?:async\\s*)?function\\s*\\([^)]*\\)`)
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (!match) continue;
    const arrowIndex = source.indexOf('=>', match.index);
    if (arrowIndex !== -1) {
      const braceIndex = source.indexOf('{', arrowIndex + 2);
      if (braceIndex !== -1) {
        return extractCallableFromStart(source, match.index);
      }

      const expressionStart = arrowIndex + 2;
      const expressionEnd = findStatementBoundary(source, expressionStart);
      const sourceEnd = findStatementTerminator(source, expressionEnd);
      return {
        source: source.slice(match.index, sourceEnd).trim(),
        body: source.slice(expressionStart, expressionEnd).trim()
      };
    }

    return extractCallableFromStart(source, match.index);
  }

  return null;
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

function findViewRouteTarget(renderActiveView, viewId, selectorName) {
  const selectorNames = findRouteSelectorNames(renderActiveView, selectorName);
  return (
    findLookupRouteTarget(renderActiveView, viewId, selectorNames) ||
    findIfRouteTarget(renderActiveView, viewId, selectorNames) ||
    findSwitchRouteTarget(renderActiveView, viewId, selectorNames)
  );
}

function findLookupRouteTarget(renderActiveView, viewId, selectorNames) {
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
    for (const selectorName of selectorNames) {
      const escapedSelector = escapeRegex(selectorName);
      const lookupIndexPattern = new RegExp(`\\b${escapeRegex(mapName)}\\s*\\[\\s*${escapedSelector}\\s*\\]`, 'g');
      if (!lookupIndexPattern.test(afterMap)) continue;

      const directInvocationPattern = new RegExp(`\\b${escapeRegex(mapName)}\\s*\\[\\s*${escapedSelector}\\s*\\](?:\\?\\.|\\.)?\\(`, 'g');
      if (directInvocationPattern.test(afterMap)) return targetMatch[1];

      const aliasPattern = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegex(mapName)}\\s*\\[\\s*${escapedSelector}\\s*\\](?:\\s*[\\|\\?][\\|\\?]\\s*[^\\n;]+)?;?`, 'g');
      let aliasMatch;
      while ((aliasMatch = aliasPattern.exec(afterMap)) !== null) {
        const alias = escapeRegex(aliasMatch[1]);
        const callPattern = new RegExp(`\\b${alias}\\s*\\(`, 'g');
        if (callPattern.test(afterMap.slice(aliasMatch.index + aliasMatch[0].length))) return targetMatch[1];
      }
    }
  }

  return '';
}

function findIfRouteTarget(renderActiveView, viewId, selectorNames) {
  const escapedView = escapeRegex(viewId);
  for (const selectorName of selectorNames) {
    const escapedSelector = escapeRegex(selectorName);
    const condition = new RegExp(`if\\s*\\(\\s*(?:${escapedSelector}\\s*(?:===|==)\\s*['"]${escapedView}['"]|['"]${escapedView}['"]\\s*(?:===|==)\\s*${escapedSelector})\\s*\\)`, 'g');
    const match = condition.exec(renderActiveView);
    if (!match) continue;

    const branch = extractBraceBody(renderActiveView, renderActiveView.indexOf('{', match.index));
    return findRouteInvocation(branch);
  }

  return '';
}

function findSwitchRouteTarget(renderActiveView, viewId, selectorNames) {
  const escapedView = escapeRegex(viewId);
  const casePattern = new RegExp(`case\\s*(?:['"]${escapedView}['"]|${escapedView})\\s*:`, 'g');

  for (const selectorName of selectorNames) {
    const escapedSelector = escapeRegex(selectorName);
    if (!new RegExp(`switch\\s*\\(\\s*${escapedSelector}\\s*\\)`).test(renderActiveView)) continue;

    const match = casePattern.exec(renderActiveView);
    if (!match) continue;

    const caseStart = match.index + match[0].length;
    const afterCase = renderActiveView.slice(caseStart);
    const nextCase = afterCase.search(/\n\s*(?:case\s*(?:['"][^'"]+['"]|[A-Za-z_$][\w$]+)\s*:|default\s*:)/);
    const caseBody = nextCase === -1 ? afterCase : afterCase.slice(0, nextCase);
    return findRouteInvocation(caseBody);
  }

  return '';
}

function findRouteSelectorName(renderActiveView) {
  const functionMatch = renderActiveView.match(/^\s*(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(\s*([A-Za-z_$][\w$]*)/m);
  if (functionMatch) return functionMatch[1];

  const arrowMatch = renderActiveView.match(/^\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\(\s*([A-Za-z_$][\w$]*)/m);
  if (arrowMatch) return arrowMatch[1];

  const conciseArrowMatch = renderActiveView.match(/^\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?[A-Za-z_$][\w$]*\s*=>/m);
  if (conciseArrowMatch) {
    const header = conciseArrowMatch[0];
    const bareMatch = header.match(/=\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>$/);
    if (bareMatch) return bareMatch[1];
  }

  return 'activeViewId';
}

function findRouteSelectorNames(renderActiveView, selectorName) {
  const names = new Set([selectorName || 'activeViewId', 'activeViewId']);
  const aliasPattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/g;
  let changed = true;

  while (changed) {
    changed = false;
    aliasPattern.lastIndex = 0;

    for (const match of renderActiveView.matchAll(aliasPattern)) {
      const [, alias, sourceName] = match;
      if (names.has(sourceName) && !names.has(alias)) {
        names.add(alias);
        changed = true;
      }
    }
  }

  return [...names];
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

function findStatementBoundary(source, startIndex) {
  let depth = 0;
  let quote = '';

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (character === '\\') {
        index += 1;
        continue;
      }
      if (character === quote) quote = '';
      continue;
    }

    if (character === '\'' || character === '"' || character === '`') {
      quote = character;
      continue;
    }

    if (character === '(' || character === '[' || character === '{') {
      depth += 1;
      continue;
    }

    if (character === ')' || character === ']' || character === '}') {
      depth = Math.max(0, depth - 1);
      continue;
    }

    if (depth === 0 && (character === ';' || character === '\n')) {
      return index;
    }
  }

  return source.length;
}

function findStatementTerminator(source, endIndex) {
  let index = endIndex;
  while (index < source.length && /\s/.test(source[index])) index += 1;
  return source[index] === ';' ? index + 1 : index;
}

function extractCallableFromStart(source, start) {
  const signatureEnd = source.indexOf(')', start);
  const bodyStart = source.indexOf('{', signatureEnd);
  const body = extractBraceBody(source, bodyStart);
  if (!body) return null;

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        const sourceEnd = findStatementTerminator(source, index + 1);
        return {
          source: source.slice(start, sourceEnd).trim(),
          body
        };
      }
    }
  }

  return null;
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
