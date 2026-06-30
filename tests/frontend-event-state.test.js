import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('frontend source renders event state panels through the existing hud resources node', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /function renderKarmaState/);
  assert.match(source, /function renderInventoryState/);
  assert.match(source, /function renderSectState/);
  assert.match(source, /nodes\.hudResources\.innerHTML/);
  assert.match(source, /<h3>寿元压力<\/h3>/);
  assert.match(source, /<h3>因果<\/h3>/);
  assert.match(source, /<h3>门派<\/h3>/);
  assert.match(source, /<h3>丹药\/材料<\/h3>/);
});

test('sect state falls back to the current player sect relation field', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /const sect = game\.sect \?\? \{/);
  assert.match(source, /contribution:\s*game\.player\.sectRelation\s*\?\?\s*0/);
  assert.match(source, /<span>宗门<\/span><strong>\$\{sect\.name\}<\/strong>/);
  assert.match(source, /<span>身份<\/span><strong>\$\{sect\.rank\}<\/strong>/);
});

test('action cards present event-backed choices without backend identifiers', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');

  assert.match(source, /function formatActionMeta\(action\)/);
  assert.match(source, /function displayActionIcon\(action\)/);
  assert.match(source, /meta:\s*formatActionMeta\(action\)/);
  assert.match(source, /icon:\s*displayActionIcon\(action\)/);
  assert.doesNotMatch(source, /<div class="event-meta">\$\{action\.eventId\} \/ \$\{action\.choiceId\}<\/div>/);
});

test('frontend styles include compact event state rows and readable action card styling', () => {
  const css = fs.readFileSync('frontend/src/styles.css', 'utf8');

  assert.match(css, /\.state-row\s*\{/);
  assert.match(css, /justify-content:\s*space-between/);
  assert.match(css, /\.dashboard-content\s*\{/);
  assert.match(css, /\.action-card\s*\{/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
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
