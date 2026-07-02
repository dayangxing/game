import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('frontend source renders central status and collection panels without relying on raw backend fields', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(html, /id="statusOverview"/);
  assert.match(html, /id="attributeSummary"/);
  assert.match(html, /id="viewFocusBody"/);
  assert.match(source, /function renderStatusOverview/);
  assert.match(source, /function renderAttributeSummary/);
  assert.match(source, /function renderViewFocus/);
  assert.match(source, /function renderCollectionCards/);
  assert.match(source, /nodes\.statusOverview\.innerHTML/);
  assert.match(source, /nodes\.attributeSummary\.innerHTML/);
  assert.match(source, /nodes\.viewFocusBody\.innerHTML/);
  assert.match(source, /nodes\.hudResources\.innerHTML/);
  assert.match(source, /气血/);
  assert.match(source, /寿元/);
  assert.match(source, /game\.treasures/);
  assert.match(source, /game\.techniques/);
});

test('洞府 is the overview tab and starts as the fallback active view', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(html, /data-view="home"[^>]*>\s*洞府\s*<\/button>/);
  assert.match(html, /class="active"[^>]*data-view="home"|data-view="home"[^>]*class="active"/);
  assert.match(html, /data-view="cultivation"[^>]*>\s*修炼\s*<\/button>/);
  assert.match(html, /data-view="skills"[^>]*>\s*功法\s*<\/button>/);
  assert.match(html, /data-view="realm"[^>]*>\s*秘境\s*<\/button>/);
  assert.match(html, /data-view="bag"[^>]*>\s*行囊\s*<\/button>/);
  assert.ok(hasHomeFallbackActiveView(source), 'activeViewId should fall back to home when no saved view exists');
});

test('洞府 overview does not render all inventory, all techniques, all foreshadows, or full timeline at once', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderActiveView = extractNamedCallable(source, 'renderActiveView');
  const selectorName = findRouteSelectorName(renderActiveView);
  const homeRouteTarget = findViewRouteTarget(renderActiveView, 'home', selectorName);
  const homeHelper = extractNamedCallable(source, homeRouteTarget);
  const forbiddenHomeCalls = [
    'renderBagView',
    'renderSkillsView',
    'renderRealmView'
  ];
  const forbiddenHomeData = [
    /renderCollectionCards\s*\(\s*game\.(?:treasures|techniques)\b/,
    /renderCollectionCards\s*\(\s*buildInventoryCollection\s*\(/,
    /renderCollectionCards\s*\(\s*(?:game\.foreshadows|\(game\.foreshadows)/,
    /(?:game\.timeline|\(game\.timeline)[^;\n]*\.slice\(\s*-?\d{2,}\s*\)/,
    /(?:game\.foreshadows|\(game\.foreshadows)[^;\n]*\.slice\(\s*-?\d{2,}\s*\)/,
    /(?:game\.techniques|\(game\.techniques)[^;\n]*\.slice\(\s*-?\d{2,}\s*\)/,
    /(?:game\.treasures|\(game\.treasures)[^;\n]*\.slice\(\s*-?\d{2,}\s*\)/
  ];

  assert.ok(homeRouteTarget, 'home should route through a dedicated overview renderer');
  assert.ok(homeHelper.length > 0);
  for (const forbidden of forbiddenHomeCalls) {
    assert.doesNotMatch(homeHelper, new RegExp(`\\b${forbidden}\\(`));
  }
  for (const forbidden of forbiddenHomeData) {
    assert.doesNotMatch(homeHelper, forbidden);
  }
});

test('sect state falls back to the current player sect relation field', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /const sect = game\.sect \?\? \{/);
  assert.match(source, /contribution:\s*game\.player\.sectRelation\s*\?\?\s*0/);
  assert.match(source, /<span>宗门<\/span><strong>\$\{sect\.name\}<\/strong>/);
  assert.match(source, /<span>身份<\/span><strong>\$\{sect\.rank\}<\/strong>/);
});

test('history cards and action cards stay player-facing without backend identifiers or schema labels', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /function formatHistoryEffectSummary/);
  assert.match(source, /function buildRecentHistory/);
  assert.match(source, /function beginStreamingNarration/);
  assert.match(source, /function updateStreamingNarration/);
  assert.match(source, /历史行为/);
  assert.match(source, /effects-summary/);
  assert.match(source, /log-card streaming is-new/);
  assert.match(source, /function formatActionMeta\(action\)/);
  assert.match(source, /function displayActionIcon\(action\)/);
  assert.match(source, /meta:\s*formatActionMeta\(action\)/);
  assert.match(source, /icon:\s*displayActionIcon\(action\)/);
  assert.doesNotMatch(source, /<div class="event-meta">\$\{action\.eventId\} \/ \$\{action\.choiceId\}<\/div>/);
  assert.doesNotMatch(source, /ruleResult|statChanges|choiceId|eventId|derivedBonuses/);
});

test('status overview renders sect reputation as a normal metric card', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /const sectRelation = game\.player\.sectRelation \?\? 0;/);
  assert.match(source, /label:\s*'宗门声望'/);
  assert.match(source, /value:\s*`\$\{sectRelation\}\/100`/);
  assert.match(source, /tone:\s*'sect'/);
  assert.match(source, /note:\s*`\s*所在 \$\{game\.player\.location\}`/);
  assert.doesNotMatch(source, /label:\s*'所在'[\s\S]*note:\s*`宗门声望/);
});

test('frontend styles include dense center-stage status, collection, and history layouts', () => {
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');

  assert.match(css, /\.state-row\s*\{/);
  assert.match(css, /justify-content:\s*space-between/);
  assert.match(css, /\.dashboard-content\s*\{/);
  assert.match(css, /\.status-overview\s*\{/);
  assert.match(css, /\.attribute-summary\s*\{/);
  assert.match(css, /\.collection-grid\s*\{/);
  assert.match(css, /\.effects-summary\s*\{/);
  assert.match(css, /\.action-card\s*\{/);
  assert.match(css, /\.log-card\.is-new\s*\{/);
  assert.match(css, /@keyframes history-card-refresh/);
  assert.match(css, /\.log-card\.streaming\s*\{/);
});

test('status cards keep a stable wide card ratio instead of stretching tall', () => {
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');

  assert.match(css, /--main-card-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /--hero-scroll-width:\s*100%/);
  assert.match(css, /--status-card-min-height:\s*104px/);
  assert.match(css, /--action-card-min-height:\s*122px/);
  assert.match(css, /\.stage-status\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.hero-scroll\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--hero-scroll-width\)\)/);
  assert.match(css, /\.status-overview\s*\{[\s\S]*grid-template-columns:\s*var\(--main-card-columns\)/);
  assert.match(css, /\.action-grid\s*\{[\s\S]*grid-template-columns:\s*var\(--main-card-columns\)/);
  assert.match(css, /\.status-card\s*\{[\s\S]*min-height:\s*var\(--status-card-min-height\)/);
  assert.match(css, /\.action-card\s*\{[\s\S]*min-height:\s*var\(--action-card-min-height\)/);
  assert.match(css, /\.status-card\s*\{[\s\S]*grid-template-rows:\s*auto\s+8px\s+1fr/);
  assert.match(css, /\.status-card-head\s+strong\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
});

test('visible frontend copy avoids api labels and debug parameters', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.doesNotMatch(html, />Mock</);
  assert.doesNotMatch(html, />API</);
  assert.doesNotMatch(html, /接口|调试|前端操作|每日行动接口|mock API|后端 API/);
  assert.doesNotMatch(source, /后端 API|本地 Mock|Mock 推演|API 模式|后端存档由服务端维护|后端行动刷新中|后端连接失败|后端 API 暂不可用/);
  assert.doesNotMatch(source, /\/\s*\$\{action\.choiceId\}/);
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
    if (depth === 0) {
      return source.slice(bodyStart + 1, index);
    }
  }

  assert.fail(`${name} should have a complete function body`);
}

function hasHomeFallbackActiveView(source) {
  if (!/activeViewId/.test(source) || !/['"]home['"]/.test(source)) return false;

  const directFallbackPatterns = [
    /(?:const|let|var)\s+activeViewId\s*=\s*localStorage\.getItem\(['"]wendao-fusheng-active-view['"]\)\s*(?:\|\||\?\?)\s*['"]home['"]/,
    /(?:const|let|var)\s+\w+\s*=\s*localStorage\.getItem\(['"]wendao-fusheng-active-view['"]\)[\s\S]{0,200}?(?:const|let|var)\s+activeViewId\s*=\s*\w+\s*(?:\|\||\?\?)\s*['"]home['"]/,
    /(?:const|let|var)\s+activeViewId\s*=\s*(?:read|get|resolve)\w*ActiveView\([^)]*\)[\s\S]{0,200}?(?:return|=>|[?][?]|[|][|])[\s\S]{0,80}['"]home['"]/i
  ];

  return directFallbackPatterns.some((pattern) => pattern.test(source));
}

function extractNamedCallable(source, name) {
  assert.ok(name, 'route target should exist');

  const functionBody = tryExtractNamedFunction(source, `async function ${name}`)
    || tryExtractNamedFunction(source, `function ${name}`)
    || tryExtractAssignedCallable(source, name);

  assert.ok(functionBody, `${name} should be declared as a callable renderer`);
  return functionBody;
}

function tryExtractNamedFunction(source, signature) {
  const start = source.indexOf(signature);
  if (start === -1) return '';
  const signatureEnd = source.indexOf(')', start);
  return extractBraceBody(source, source.indexOf('{', signatureEnd));
}

function tryExtractAssignedCallable(source, name) {
  const patterns = [
    new RegExp(`(?:const|let|var)\\s+${escapeRegex(name)}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[A-Za-z_$][\\w$]*)\\s*=>`),
    new RegExp(`(?:const|let|var)\\s+${escapeRegex(name)}\\s*=\\s*(?:async\\s*)?function\\s*\\([^)]*\\)`)
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(source);
    if (!match) continue;
    const openIndex = source.indexOf('{', match.index + match[0].length);
    return extractBraceBody(source, openIndex);
  }

  return '';
}

function findViewRouteTarget(renderActiveView, viewId, selectorName) {
  return findLookupRouteTarget(renderActiveView, viewId, selectorName)
    || findIfRouteTarget(renderActiveView, viewId, selectorName)
    || findSwitchRouteTarget(renderActiveView, viewId, selectorName);
}

function findLookupRouteTarget(renderActiveView, viewId, selectorName) {
  const escapedView = escapeRegex(viewId);
  const escapedSelector = escapeRegex(selectorName || 'activeViewId');
  const lookupBodyPattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;

  let match;
  while ((match = lookupBodyPattern.exec(renderActiveView)) !== null) {
    const mapName = match[1];
    const mapBody = extractBraceBody(renderActiveView, renderActiveView.indexOf('{', match.index));
    if (!mapBody) continue;

    const targetMatch = mapBody.match(new RegExp(`(?:^|[\\s,])(?:['"]${escapedView}['"]|${escapedView})\\s*:\\s*([A-Za-z_$][\\w$]*)\\b`));
    if (!targetMatch) continue;

    const afterMap = renderActiveView.slice(match.index);
    if (!new RegExp(`\\b${escapeRegex(mapName)}\\s*\\[\\s*${escapedSelector}\\s*\\]`).test(afterMap)) continue;
    if (new RegExp(`\\b${escapeRegex(mapName)}\\s*\\[\\s*${escapedSelector}\\s*\\](?:\\?\\.|\\.)?\\(`).test(afterMap)) return targetMatch[1];

    const aliasPattern = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegex(mapName)}\\s*\\[\\s*${escapedSelector}\\s*\\](?:\\s*[\\|\\?][\\|\\?]\\s*[^\\n;]+)?;?`, 'g');
    let aliasMatch;
    while ((aliasMatch = aliasPattern.exec(afterMap)) !== null) {
      const alias = escapeRegex(aliasMatch[1]);
      const callPattern = new RegExp(`\\b${alias}\\s*\\(`);
      if (callPattern.test(afterMap.slice(aliasMatch.index + aliasMatch[0].length))) return targetMatch[1];
    }
  }

  return '';
}

function findIfRouteTarget(renderActiveView, viewId, selectorName) {
  const escapedView = escapeRegex(viewId);
  const escapedSelector = escapeRegex(selectorName || 'activeViewId');
  const condition = new RegExp(`if\\s*\\(\\s*(?:${escapedSelector}\\s*(?:===|==)\\s*['"]${escapedView}['"]|['"]${escapedView}['"]\\s*(?:===|==)\\s*${escapedSelector})\\s*\\)`, 'g');
  const match = condition.exec(renderActiveView);
  if (!match) return '';
  return findRouteInvocation(extractBraceBody(renderActiveView, renderActiveView.indexOf('{', match.index)));
}

function findSwitchRouteTarget(renderActiveView, viewId, selectorName) {
  const escapedSelector = escapeRegex(selectorName || 'activeViewId');
  if (!new RegExp(`switch\\s*\\(\\s*${escapedSelector}\\s*\\)`).test(renderActiveView)) return '';

  const escapedView = escapeRegex(viewId);
  const casePattern = new RegExp(`case\\s*(?:['"]${escapedView}['"]|${escapedView})\\s*:`, 'g');
  const match = casePattern.exec(renderActiveView);
  if (!match) return '';

  const caseStart = match.index + match[0].length;
  const afterCase = renderActiveView.slice(caseStart);
  const nextCase = afterCase.search(/\n\s*(?:case\s*(?:['"][^'"]+['"]|[A-Za-z_$][\w$]+)\s*:|default\s*:)/);
  return findRouteInvocation(nextCase === -1 ? afterCase : afterCase.slice(0, nextCase));
}

function findRouteSelectorName(renderActiveView) {
  const functionMatch = renderActiveView.match(/^\s*(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(\s*([A-Za-z_$][\w$]*)/m);
  if (functionMatch) return functionMatch[1];

  const arrowMatch = renderActiveView.match(/^\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?\(\s*([A-Za-z_$][\w$]*)/m);
  if (arrowMatch) return arrowMatch[1];

  const conciseArrowMatch = renderActiveView.match(/^\s*(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s*)?[A-Za-z_$][\w$]*\s*=>/m);
  if (conciseArrowMatch) {
    const bareMatch = conciseArrowMatch[0].match(/=\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>$/);
    if (bareMatch) return bareMatch[1];
  }

  return 'activeViewId';
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
  assert.ok(openIndex >= 0, 'callable body should start with an opening brace');
  let depth = 0;

  for (let index = openIndex; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex + 1, index);
    }
  }

  assert.fail('callable body should have balanced braces');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
