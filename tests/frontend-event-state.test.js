import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('frontend source renders central status and collection panels without relying on raw backend fields', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(html, /id="activeViewContent"/);
  assert.doesNotMatch(html, /id="statusOverview"/);
  assert.doesNotMatch(html, /id="attributeSummary"/);
  assert.doesNotMatch(html, /id="viewFocusBody"/);
  assert.match(source, /function renderStatusOverview/);
  assert.match(source, /function renderAttributeSummary/);
  assert.match(source, /function renderViewFocus/);
  assert.match(source, /function renderCollectionCards/);
  assert.match(source, /nodes\.statusOverview\.innerHTML/);
  assert.match(source, /nodes\.attributeSummary\.innerHTML/);
  assert.match(source, /nodes\.viewFocusBody\.innerHTML/);
  assert.match(source, /renderResourceLedgerPanel/);
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
  assert.doesNotMatch(html, /data-view="cultivation"[^>]*>\s*修炼\s*<\/button>/);
  assert.match(html, /data-view="skills"[^>]*>\s*命簿\s*<\/button>/);
  assert.match(html, /data-view="realm"[^>]*>\s*天机录\s*<\/button>/);
  assert.match(html, /data-view="bag"[^>]*>\s*行囊\s*<\/button>/);
  assert.ok(hasHomeFallbackActiveView(source), 'activeViewId should fall back to home when no saved view exists');
  assert.match(source, /visibleViewList\.some\(\(view\) => view\.id === viewId\) \? viewId : 'home'/);
});

test('洞府 overview does not render all inventory, all techniques, all foreshadows, or full timeline at once', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderActiveView = extractNamedCallable(source, 'renderActiveView');
  const selectorName = findRouteSelectorName(renderActiveView);
  const homeRouteTarget = findViewRouteTarget(renderActiveView, 'home', selectorName);

  assert.ok(homeRouteTarget, 'home should route through a dedicated overview renderer');
  assertHomeOverviewAvoidsFullDetail(source, homeRouteTarget);
});

test('only 洞府 renders action choices and places history before compact actions', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderHomeView = extractNamedCallable(source, 'renderHomeView');
  const tabRenderers = ['renderCultivationView', 'renderSkillsView', 'renderRealmView', 'renderBagView']
    .map((name) => extractNamedCallable(source, name));

  assert.match(renderHomeView, /renderHistoryPanel\(\s*3\s*\)[\s\S]*renderActionPanel\(\)/);
  assert.ok(
    renderHomeView.indexOf('renderHistoryPanel(3)') < renderHomeView.indexOf('renderActionPanel()'),
    'history should render before action choices on the home screen'
  );
  for (const renderer of tabRenderers) {
    assert.doesNotMatch(renderer, /renderActionPanel\(/);
  }
});

test('hidden cultivation view renders cultivation status and focus without action choices', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderCultivationView = extractNamedCallable(source, 'renderCultivationView');
  const focusPanel = extractCallablePartsOrNull(source, 'renderCultivationFocusPanel')?.source ?? '';
  const cultivationSource = `${renderCultivationView}\n${focusPanel}`;

  assert.doesNotMatch(renderCultivationView, /renderHomeView\(\)/);
  assert.match(renderCultivationView, /renderStatusPanel\(\)/);
  assert.doesNotMatch(renderCultivationView, /renderActionPanel\(/);
  assert.match(renderCultivationView, /renderStatusOverview\(\)/);
  assert.match(renderCultivationView, /renderAttributeSummary\(\)/);
  assert.match(cultivationSource, /闭关要点/);
  assert.match(cultivationSource, /summarizeCultivationFocus\(\)/);
  assert.match(cultivationSource, /buildSuggestionText\(\)/);
  assert.doesNotMatch(cultivationSource, /breakthroughChance|breakthroughRate|successRate/);
});

test('命簿 tab renders a detailed character sheet without bag duplicates or action choices', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderSkillsView = extractNamedCallable(source, 'renderSkillsView');
  const personalPanel = extractCallablePartsOrNull(source, 'renderPersonalPanel')?.source ?? '';
  const profileSection = extractCallablePartsOrNull(source, 'renderPersonalProfileSection')?.source ?? '';
  const sectSection = extractCallablePartsOrNull(source, 'renderPersonalSectSection')?.source ?? '';
  const attributeSection = extractCallablePartsOrNull(source, 'renderPersonalAttributeSection')?.source ?? '';
  const statusSection = extractCallablePartsOrNull(source, 'renderPersonalStatusSection')?.source ?? '';
  const relationshipSection = extractCallablePartsOrNull(source, 'renderPersonalRelationshipSection')?.source ?? '';
  const techniqueSection = extractCallablePartsOrNull(source, 'renderPersonalTechniqueSection')?.source ?? '';
  const skillsSource = [
    renderSkillsView,
    personalPanel,
    profileSection,
    sectSection,
    attributeSection,
    statusSection,
    relationshipSection,
    techniqueSection
  ].join('\n');

  assert.doesNotMatch(renderSkillsView, /renderHomeView\(\)/);
  assert.doesNotMatch(renderSkillsView, /renderActionPanel\(/);
  assert.match(renderSkillsView, /renderPersonalPanel\(\)/);
  assert.doesNotMatch(renderSkillsView, /renderTreasureCollectionPanel\(\)/);
  assert.doesNotMatch(renderSkillsView, /renderInventoryCollectionPanel\(\)/);
  assert.doesNotMatch(renderSkillsView, /renderStatusPanel\(\)/);
  assert.match(skillsSource, /个人面板/);
  assert.match(skillsSource, /人物/);
  assert.match(skillsSource, /五维/);
  assert.match(skillsSource, /生命与修行/);
  assert.match(skillsSource, /宗门/);
  assert.match(skillsSource, /道友牵绊/);
  assert.match(skillsSource, /已修功法/);
  assert.match(skillsSource, /气血与寿元/);
  assert.match(skillsSource, /game\.npcs\.map/);
  assert.match(skillsSource, /game\.techniques/);
  assert.doesNotMatch(skillsSource, /奇珍法器|丹药与材料/);
  assert.doesNotMatch(renderSkillsView, /renderCollectionCards\(\s*game\.treasures/);
  assert.doesNotMatch(renderSkillsView, /renderCollectionCards\(\s*buildInventoryCollection\(game\.inventory\)/);
  assert.match(renderSkillsView, /syncActiveViewNodes\(\)/);
});

test('行囊 tab renders treasures, inventory stores, and bag actions', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderBagView = extractNamedCallable(source, 'renderBagView');
  const treasurePanel = extractCallablePartsOrNull(source, 'renderTreasureCollectionPanel')?.source ?? '';
  const inventoryPanel = extractCallablePartsOrNull(source, 'renderInventoryCollectionPanel')?.source ?? '';
  const bagSource = `${renderBagView}\n${treasurePanel}\n${inventoryPanel}`;

  assert.doesNotMatch(renderBagView, /renderHomeView\(\)/);
  assert.doesNotMatch(renderBagView, /renderActionPanel\(/);
  assert.match(bagSource, /奇珍法器/);
  assert.match(bagSource, /renderCollectionCards\(\s*game\.treasures\s*,\s*'暂无奇珍入囊。'\s*\)/);
  assert.match(bagSource, /丹药与材料/);
  assert.match(bagSource, /renderCollectionCards\(\s*buildInventoryCollection\(game\.inventory\)\s*,\s*'行囊里仍空空如也。'\s*\)/);
  assert.match(renderBagView, /syncActiveViewNodes\(\)/);
});

test('天机录 tab renders story memory, context records, and no action choices', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderRealmView = extractNamedCallable(source, 'renderRealmView');
  const archivePanel = extractCallablePartsOrNull(source, 'renderStoryArchivePanel')?.source ?? '';
  const overviewSection = extractCallablePartsOrNull(source, 'renderArchiveOverviewSection')?.source ?? '';
  const recentSection = extractCallablePartsOrNull(source, 'renderArchiveRecentTurnsSection')?.source ?? '';
  const threadSection = extractCallablePartsOrNull(source, 'renderArchiveThreadSection')?.source ?? '';
  const npcSection = extractCallablePartsOrNull(source, 'renderArchiveNpcMemorySection')?.source ?? '';
  const worldSection = extractCallablePartsOrNull(source, 'renderArchiveWorldRecordSection')?.source ?? '';
  const contextSection = extractCallablePartsOrNull(source, 'renderArchiveModelContextSection')?.source ?? '';
  const realmSource = [
    renderRealmView,
    archivePanel,
    overviewSection,
    recentSection,
    threadSection,
    npcSection,
    worldSection,
    contextSection
  ].join('\n');

  assert.doesNotMatch(renderRealmView, /renderHomeView\(\)/);
  assert.doesNotMatch(renderRealmView, /renderActionPanel\(/);
  assert.match(renderRealmView, /renderStoryArchivePanel\(\)/);
  assert.match(realmSource, /天机录/);
  assert.match(realmSource, /本局总纲/);
  assert.match(realmSource, /近期回合/);
  assert.match(realmSource, /未解伏笔/);
  assert.match(realmSource, /人物记忆/);
  assert.match(realmSource, /世界记录/);
  assert.match(realmSource, /模型上下文/);
  assert.match(realmSource, /game\.storyMemory/);
  assert.match(realmSource, /recentTurns/);
  assert.match(realmSource, /openThreads/);
  assert.match(realmSource, /thread\.clues/);
  assert.match(realmSource, /最近线索/);
  assert.match(realmSource, /updatedTurn/);
  assert.match(realmSource, /characterNotes/);
  assert.doesNotMatch(realmSource, /eventId|choiceId|act_|debug|schema/i);
  assert.match(renderRealmView, /syncActiveViewNodes\(\)/);
});

test('overview guard rejects forbidden helper calls through local aliases', () => {
  const source = `
    function renderWorld() {
      nodes.foreshadows.innerHTML = game.foreshadows.join('');
    }

    function renderHomeView() {
      const showAll = renderWorld;
      showAll();
    }
  `;

  assert.throws(
    () => assertHomeOverviewAvoidsFullDetail(source, 'renderHomeView'),
    /renderWorld/
  );
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
  assert.match(source, /data-streaming-narration/);
  assert.match(source, /function updateStreamingNarrationDom/);
  assert.match(source, /log-card streaming/);
  assert.doesNotMatch(source, /log-card streaming is-new/);
  assert.match(source, /function formatActionMeta\(action\)/);
  assert.match(source, /function displayActionIcon\(action\)/);
  assert.match(source, /meta:\s*formatActionMeta\(action\)/);
  assert.match(source, /icon:\s*displayActionIcon\(action\)/);
  assert.doesNotMatch(source, /<div class="event-meta">\$\{action\.eventId\} \/ \$\{action\.choiceId\}<\/div>/);
  assert.doesNotMatch(source, /ruleResult|statChanges|choiceId|eventId|derivedBonuses/);
});

test('streaming history preview patches only the active log body', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const helper = extractFunction(source, 'updateStreamingNarration');

  assert.match(helper, /streamingNarration\.body === body/);
  assert.match(helper, /updateStreamingNarrationDom\(body\)/);
  assert.doesNotMatch(helper, /renderStory\(\);/);
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
  assert.match(css, /\.personal-panel\s*\{/);
  assert.match(css, /\.personal-sheet\s*\{/);
  assert.match(css, /\.personal-attribute-grid\s*\{/);
  assert.match(css, /\.story-archive-panel\s*\{/);
  assert.match(css, /\.archive-sheet\s*\{/);
  assert.match(css, /\.archive-section\s*\{/);
  assert.match(css, /\.archive-recent-list\s*\{/);
  assert.match(css, /\.action-card\s*\{/);
  assert.match(css, /\.log-card\.is-new:not\(\.streaming\)\s*\{/);
  assert.match(css, /@keyframes history-card-refresh/);
  assert.match(css, /\.log-card\.streaming\s*\{/);
  assert.match(css, /\.log-card\.streaming\s+p\s*\{[\s\S]*max-height:/);
});

test('status cards keep a stable wide card ratio instead of stretching tall', () => {
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');

  assert.match(css, /--main-card-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /--hero-scroll-width:\s*100%/);
  assert.match(css, /--status-card-min-height:\s*82px/);
  assert.match(css, /--action-card-min-height:\s*86px/);
  assert.match(css, /\.stage-status\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.hero-scroll\s*\{[\s\S]*width:\s*min\(100%,\s*var\(--hero-scroll-width\)\)/);
  assert.match(css, /\.status-overview\s*\{[\s\S]*grid-template-columns:\s*var\(--main-card-columns\)/);
  assert.match(css, /\.action-grid\s*\{[\s\S]*grid-template-columns:\s*var\(--main-card-columns\)/);
  assert.match(css, /\.status-card\s*\{[\s\S]*min-height:\s*var\(--status-card-min-height\)/);
  assert.match(css, /\.action-card\s*\{[\s\S]*min-height:\s*var\(--action-card-min-height\)/);
  assert.match(css, /\.status-card\s*\{[\s\S]*grid-template-rows:\s*auto\s+8px\s+1fr/);
  assert.match(css, /\.status-card-head\s+strong\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(css, /\.active-view-content\[data-active-view="home"\]\s+\.summary-card\s*\{[^}]*display:\s*flex/);
  assert.match(css, /\.active-view-content\[data-active-view="home"\]\s+\.summary-card\s*\{[^}]*align-items:\s*baseline/);
  assert.match(css, /\.active-view-content\[data-active-view="home"\]\s+\.summary-card\s*\{[^}]*justify-content:\s*space-between/);
});

test('tab screens use full-width readable grids without losing tuning hooks', () => {
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');

  assert.match(css, /\.active-view-content\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.active-view-content\s*\{[\s\S]*display:\s*grid/);
  assert.match(css, /\.active-view-content\s*\{[\s\S]*grid-template-columns:\s*var\(--main-card-columns\)/);
  assert.match(css, /\.view-screen\s*\{/);
  assert.match(css, /\.view-grid\s*\{/);
  assert.match(css, /\.view-grid\.compact\s*\{/);
  assert.match(css, /\.view-grid\.split\s*\{/);
  assert.match(css, /\.active-view-content\s*>\s*\.stage-status\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.active-view-content\s*>\s*\.action-section\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.active-view-content\s*>\s*\.story-section\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /--hero-scroll-width:\s*100%/);
  assert.match(css, /--status-card-min-height:\s*82px/);
  assert.match(css, /--action-card-min-height:\s*86px/);
  assert.match(css, /@keyframes history-card-refresh/);
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

test('sidebars are removed and character state moves to the 命簿 tab', () => {
  const html = fs.readFileSync('frontend/index.html', 'utf8');
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const render = extractFunction(source, 'render');

  assert.doesNotMatch(html, /class="sidebar/);
  assert.doesNotMatch(html, /id="hudResources"/);
  assert.doesNotMatch(html, /id="npcList"/);
  assert.doesNotMatch(html, /id="meters"/);
  assert.doesNotMatch(html, /id="sectRelationLabel"/);
  assert.doesNotMatch(html, /id="playerName"/);
  assert.match(html, /id="resetBtn"/);
  assert.match(html, /id="sampleBtn"/);
  assert.doesNotMatch(html, /id="timeline"/);
  assert.doesNotMatch(html, /id="foreshadows"/);
  assert.doesNotMatch(html, /<h3>天机事件<\/h3>/);
  assert.doesNotMatch(html, /<h3>长期伏笔<\/h3>/);
  assert.doesNotMatch(source, /hudResources:\s*document\.querySelector/);
  assert.doesNotMatch(source, /npcList:\s*document\.querySelector/);
  assert.doesNotMatch(source, /timeline:\s*document\.querySelector\('#timeline'\)/);
  assert.doesNotMatch(source, /foreshadows:\s*document\.querySelector\('#foreshadows'\)/);
  assert.doesNotMatch(render, /renderPlayer\(\)/);
  assert.doesNotMatch(render, /renderNpcs\(\)/);
  assert.doesNotMatch(render, /renderWorld\(\)/);
  assert.doesNotMatch(source, /function renderWorld\(/);
  assert.match(source, /renderHealthState\(\)/);
  assert.match(source, /renderKarmaState\(\)/);
  assert.match(source, /renderSectState\(\)/);
  assert.match(source, /renderInventoryState\(\)/);
});

function extractFunction(source, name) {
  return extractCallableParts(source, name).body;
}

function hasHomeFallbackActiveView(source) {
  if (!/activeViewId/.test(source) || !/['"]home['"]/.test(source)) return false;

  if (
    /(?:const|let|var)\s+activeViewId\s*=\s*readInitialActiveViewId\(\);/.test(source)
    && /function readInitialActiveViewId\(\)\s*\{[\s\S]*return resolveViewId\(localStorage\.getItem\(['"]wendao-fusheng-active-view['"]\)\);[\s\S]*?\}/.test(source)
    && /function resolveViewId\(viewId\)\s*\{[\s\S]*:\s*['"]home['"]/.test(source)
  ) {
    return true;
  }

  const directFallbackPatterns = [
    /(?:const|let|var)\s+activeViewId\s*=\s*localStorage\.getItem\(['"]wendao-fusheng-active-view['"]\)\s*(?:\|\||\?\?)\s*['"]home['"]/,
    /(?:const|let|var)\s+\w+\s*=\s*localStorage\.getItem\(['"]wendao-fusheng-active-view['"]\)[\s\S]{0,200}?(?:const|let|var)\s+activeViewId\s*=\s*\w+\s*(?:\|\||\?\?)\s*['"]home['"]/,
    /(?:const|let|var)\s+activeViewId\s*=\s*(?:read|get|resolve)\w*ActiveView\([^)]*\)[\s\S]{0,200}?(?:return|=>|[?][?]|[|][|])[\s\S]{0,80}['"]home['"]/i
  ];

  return directFallbackPatterns.some((pattern) => pattern.test(source));
}

function extractNamedCallable(source, name) {
  return extractCallableParts(source, name).source;
}

function extractCallableParts(source, name) {
  assert.ok(name, 'route target should exist');
  const callable = extractCallablePartsOrNull(source, name);
  assert.ok(callable, `${name} should be declared as a callable renderer`);
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

function findViewRouteTarget(renderActiveView, viewId, selectorName) {
  const selectorNames = findRouteSelectorNames(renderActiveView, selectorName);
  return findLookupRouteTarget(renderActiveView, viewId, selectorNames)
    || findIfRouteTarget(renderActiveView, viewId, selectorNames)
    || findSwitchRouteTarget(renderActiveView, viewId, selectorNames);
}

function findLookupRouteTarget(renderActiveView, viewId, selectorNames) {
  const escapedView = escapeRegex(viewId);
  const lookupBodyPattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;

  let match;
  while ((match = lookupBodyPattern.exec(renderActiveView)) !== null) {
    const mapName = match[1];
    const mapBody = extractBraceBody(renderActiveView, renderActiveView.indexOf('{', match.index));
    if (!mapBody) continue;

    const targetMatch = mapBody.match(new RegExp(`(?:^|[\\s,])(?:['"]${escapedView}['"]|${escapedView})\\s*:\\s*([A-Za-z_$][\\w$]*)\\b`));
    if (!targetMatch) continue;

    const afterMap = renderActiveView.slice(match.index);
    for (const selectorName of selectorNames) {
      const escapedSelector = escapeRegex(selectorName);
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
    return findRouteInvocation(extractBraceBody(renderActiveView, renderActiveView.indexOf('{', match.index)));
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
    return findRouteInvocation(nextCase === -1 ? afterCase : afterCase.slice(0, nextCase));
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
    const bareMatch = conciseArrowMatch[0].match(/=\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>$/);
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

function assertHomeOverviewAvoidsFullDetail(source, homeRouteTarget) {
  const visited = new Set();
  const pending = [homeRouteTarget];
  const forbiddenHomeCalls = [
    'renderBagView',
    'renderSkillsView',
    'renderRealmView',
    'renderWorld'
  ];
  const forbiddenHomeData = [
    /renderCollectionCards\s*\(\s*game\.(?:treasures|techniques)\b/,
    /renderCollectionCards\s*\(\s*buildInventoryCollection\s*\(/,
    /renderCollectionCards\s*\(\s*(?:game\.foreshadows|\(game\.foreshadows)/,
    /render[A-Za-z_$]*Timeline[A-Za-z_$]*\s*\(\s*(?:game\.timeline|\(game\.timeline\))\s*(?:[,)]|$)/,
    /render[A-Za-z_$]*Foreshadow[A-Za-z_$]*\s*\(\s*(?:game\.foreshadows|\(game\.foreshadows\))\s*(?:[,)]|$)/,
    /nodes\.foreshadows\.innerHTML\s*=\s*game\.foreshadows\b/
  ];

  while (pending.length) {
    const helperName = pending.pop();
    if (!helperName || visited.has(helperName)) continue;
    visited.add(helperName);

    const helperBody = extractFunction(source, helperName);
    assert.ok(helperBody.length > 0, `${helperName} should have a non-empty body`);

    for (const forbidden of forbiddenHomeCalls) {
      assert.doesNotMatch(helperBody, new RegExp(`\\b${forbidden}\\(`));
    }
    for (const forbidden of forbiddenHomeData) {
      assert.doesNotMatch(helperBody, forbidden);
    }

    for (const callee of findLocalHelperCalls(source, helperBody)) {
      assert.ok(!forbiddenHomeCalls.includes(callee), `${helperName} should not call forbidden helper ${callee}`);
      if (!visited.has(callee) && hasNamedCallable(source, callee)) pending.push(callee);
    }
  }
}

function findLocalHelperCalls(source, body) {
  const ignoredCalls = new Set([
    'if',
    'switch',
    'for',
    'while',
    'map',
    'filter',
    'slice',
    'join',
    'at'
  ]);
  const localAliases = new Map();
  const aliasPattern = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([A-Za-z_$][\w$]*)\s*;/g;

  for (const match of body.matchAll(aliasPattern)) {
    const [, alias, target] = match;
    if (ignoredCalls.has(alias) || ignoredCalls.has(target)) continue;
    localAliases.set(alias, target);
  }

  return [...new Set(
    [...body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)]
      .map(([, name]) => resolveLocalHelperAlias(name, localAliases, source, ignoredCalls))
      .filter(Boolean)
  )];
}

function resolveLocalHelperAlias(name, localAliases, source, ignoredCalls) {
  const seen = new Set();
  let current = name;

  while (current && !seen.has(current)) {
    seen.add(current);
    if (ignoredCalls.has(current)) return '';

    const aliasTarget = localAliases.get(current);
    if (!aliasTarget) return hasNamedCallable(source, current) ? current : '';
    current = aliasTarget;
  }

  return '';
}

function hasNamedCallable(source, name) {
  return Boolean(extractCallablePartsOrNull(source, name));
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

  assert.fail('callable source should have balanced braces');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
