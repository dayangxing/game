import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const store = () => fs.readFileSync('frontend/src/lib/stores/gameStore.svelte.js', 'utf8');
const app = () => fs.readFileSync('frontend/src/App.svelte', 'utf8');
const resourceDraft = () => fs.readFileSync('frontend/src/components/ResourceDraft.svelte', 'utf8');
const actionPanel = () => fs.readFileSync('frontend/src/components/ActionPanel.svelte', 'utf8');
const archive = () => fs.readFileSync('frontend/src/components/StoryArchive.svelte', 'utf8');
const ending = () => fs.readFileSync('frontend/src/components/EndingPanel.svelte', 'utf8');
const chapter = () => fs.readFileSync('frontend/src/components/ChapterProgress.svelte', 'utf8');
const helpers = () => fs.readFileSync('frontend/src/lib/utils/helpers.js', 'utf8');
const styles = () => fs.readFileSync('frontend/src/styles.css', 'utf8');
const dashboard = () => fs.readFileSync('frontend/src/components/Dashboard.svelte', 'utf8');

test('Svelte resource draft submits the real backend action identity', () => {
  const source = resourceDraft();

  assert.match(source, /actionId|category\s*:\s*['"]resource['"]/);
  assert.match(source, /submitDailyAction\(\{[\s\S]*id:/);
});

test('Svelte onboarding uses the shared streamed daily action submission', () => {
  const source = store();

  const onboarding = source.slice(source.indexOf('export async function submitOnboardingAction'));
  assert.match(onboarding, /submitDailyActionStream/);
  assert.match(onboarding, /onNarrationPreview/);
  assert.match(onboarding, /onNarrationReset/);
  assert.doesNotMatch(onboarding.slice(0, onboarding.indexOf('export async function submitStoryStep')), /fetch\(/);
});

test('Svelte streaming actions clear partial output when an LLM retry begins', () => {
  const source = store();
  const refresh = source.slice(source.indexOf('export async function refreshDailyActionsForView'));
  const daily = source.slice(source.indexOf('export async function submitDailyAction'));
  const story = source.slice(source.indexOf('export async function submitStoryStep'));

  assert.match(refresh, /onStoryReset/);
  assert.match(daily, /onNarrationReset/);
  assert.match(story, /onStoryReset/);
  assert.match(source, /function handleStreamingReset/);
  assert.match(source, /正在重试第/);
});

test('Svelte mode persistence does not force local games back to API mode', () => {
  const source = store();

  assert.doesNotMatch(source, /api\.setMode\(_game,\s*['"]api['"]\)/);
  assert.match(source, /localStorage\.setItem\(MODE_KEY,\s*_game\.mode/);
  assert.match(source, /resetForCharacterCreation\(_game\?\.mode/);
});

test('Svelte tab switching persists the selected view and refreshes its actions', () => {
  const source = store();

  const setter = source.slice(source.indexOf('export function setActiveViewId'));
  assert.match(setter, /localStorage\.setItem/);
  assert.match(setter, /location\.hash|window\.location\.hash/);
  assert.match(setter, /refreshDailyActionsForView/);
  assert.match(source, /let _actionRefreshSequence = \$state\(0\)/);
});

test('Svelte initialization restores the model-config prompt and startup notice', () => {
  const source = store();
  const entry = app();

  assert.match(source, /shouldPromptModelConfig/);
  assert.match(source, /_showModelConfig\s*=\s*true/);
  assert.match(entry, /getStartupNotice\(\)/);
  assert.match(entry, /startupNotice/);
});

test('Svelte local save reload normalizes legacy story memory before rendering', () => {
  const source = store();
  const loadGame = source.slice(source.indexOf('async function loadGame'));

  assert.match(source, /from ['"]\$lib\/storyMemory\.js['"]/);
  assert.match(loadGame, /storyMemory:\s*normalizeStoryMemory\(parsed\.storyMemory,\s*parsed\)/);
});

test('Svelte API reload normalizes legacy story memory before rendering', () => {
  const source = store();
  const loadGame = source.slice(source.indexOf('async function loadGame'));

  assert.match(loadGame, /storyMemory:\s*normalizeStoryMemory\(apiGame\.storyMemory,\s*apiGame\)/);
});

test('Svelte action cards keep immediate fallback actions clickable in local mode', () => {
  const source = actionPanel();

  assert.match(source, /pendingApiImmediateActions/);
  assert.match(source, /pendingApiImmediateActions\s*&&\s*action\.source === ['"]immediate['"]/);
});

test('Svelte archive and ending keep the old story-memory and resource summaries', () => {
  assert.match(archive(), /storyMemory|recentTurns|characterNotes|longSummary/);
  assert.match(ending(), /lastRunSummary|metaProgress|资源轨迹/);
});

test('Svelte chapter objectives retain the legacy completion classes', () => {
  assert.match(chapter(), /chapter-objective/);
  assert.match(chapter(), /is-complete/);
});

test('Svelte top time and pressure helpers retain lifespan and danger copy', () => {
  const source = helpers();

  assert.match(source, /余寿/);
  assert.match(source, /大限/);
  assert.match(source, /strained/);
  assert.match(source, /danger/);
  assert.match(source, /ending/);
});

test('history and daily action cards share the same desktop grid and base sizing', () => {
  const source = styles();
  const baseLogList = source.match(/(?:^|\n)\.log-list\s*\{([^}]*)\}/)?.[1] ?? '';

  assert.doesNotMatch(baseLogList, /grid-template-columns:/);
  assert.match(source, /\.log-card\s*\{[\s\S]*min-height:\s*var\(--action-card-min-height\)/);
  assert.match(source, /\.log-card\s*\{[\s\S]*padding:\s*10px/);
  assert.match(source, /\.log-list,\s*\.action-grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('home removes current focus and stacks history above daily actions responsively', () => {
  const dashboardSource = dashboard();
  const css = styles();

  assert.doesNotMatch(dashboardSource, /FocusPanel|当前见闻/);
  assert.ok(dashboardSource.indexOf('<HistoryPanel') < dashboardSource.indexOf('<ActionPanel'));
  assert.match(dashboardSource, /class="home-story-actions"/);
  assert.match(css, /\.active-view-content\[data-active-view="home"\]\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.active-view-content\[data-active-view="home"\]\s*>\s*\.story-section,[\s\S]*\.active-view-content\[data-active-view="home"\]\s*>\s*\.action-section\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(css, /\.home-story-actions\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.active-view-content\[data-active-view="home"\] \.log-list\s*\{[\s\S]*max-height:\s*clamp\(/);
});
