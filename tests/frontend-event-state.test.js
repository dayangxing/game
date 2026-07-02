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

  assert.match(html, /<button class="active" type="button" data-view="home">洞府<\/button>/);
  assert.match(html, /data-view="cultivation"[^>]*>修炼<\/button>/);
  assert.match(html, /<button type="button" data-view="skills">功法<\/button>/);
  assert.match(html, /<button type="button" data-view="realm">秘境<\/button>/);
  assert.match(html, /<button type="button" data-view="bag">行囊<\/button>/);
  assert.match(source, /let activeViewId = localStorage\.getItem\('wendao-fusheng-active-view'\) \|\| 'home';/);
});

test('洞府 overview does not render all inventory, all techniques, all foreshadows, or full timeline at once', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const homeHelper = extractFunction(source, 'renderHomeView');
  const forbiddenHomeHelpers = [
    'renderSkillsView',
    'renderBagView',
    'renderRealmView',
    'renderCollectionCards',
    'renderTimeline',
    'renderForeshadows',
    'renderViewFocus'
  ];
  const requiredHelpers = [
    'renderHomeView',
    'renderCultivationView',
    'renderSkillsView',
    'renderRealmView',
    'renderBagView'
  ];

  for (const helper of requiredHelpers) {
    assert.match(source, new RegExp(`function ${helper}\\s*\\(`), `${helper} should exist`);
  }

  assert.ok(homeHelper.length > 0);
  for (const forbidden of forbiddenHomeHelpers) {
    assert.doesNotMatch(homeHelper, new RegExp(`\\b${forbidden}\\(`));
  }
  assert.doesNotMatch(homeHelper, /game\.timeline/);
  assert.doesNotMatch(homeHelper, /game\.foreshadows/);
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
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = source.indexOf('{', start);
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
