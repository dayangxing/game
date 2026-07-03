# Time Pressure Lifespan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add month-based time passage, lifespan pressure, positive longevity recovery, breakthrough lifespan rewards, and player-facing time feedback to the continuous single-player cultivation loop.

**Architecture:** Add focused `backend/src/domain/time/*` modules for calendar math, action time cost, longevity gains, and final time-pressure settlement. Existing action/event/director resolvers keep deciding what happened, then call the time system once to advance calendar, apply net lifespan changes, update warning state, and block further play on lifespan exhaustion. Frontend reads the resulting `timePressure`, `timeResult`, and history metadata without showing internal effect fields.

**Tech Stack:** Node.js ESM, native `node:test`, existing Request/Response backend router, existing SSE stream path, vanilla frontend JS/CSS, no build step.

## Global Constraints

- The LLM generates story text, choices, NPC lines, and vague effect directions only; it never writes final numeric values.
- The backend remains authoritative for elapsed months, calendar labels, lifespan, max lifespan, health, cultivation, breakthrough results, inventory, techniques, foreshadows, ending state, and turn/version changes.
- Time is internally month-based; UI shows readable month/year labels.
- First version implements balance through 金丹后期; 元婴 and 化神 are configuration-only reserves.
- Positive time may restore current lifespan; ordinary rest does not increase `maxLifespan`.
- Ordinary formal actions still carry time/lifespan pressure; tutorial onboarding actions do not consume lifespan.
- Player-facing UI must not show raw ids, prompt content, JSON, `target`, `direction`, `intensity`, `eventId`, `choiceId`, `deltaMonths`, `timeCost`, `effectHints`, schema names, model names, API keys, or debug parameters.
- Home remains the only tab with player action controls; other tabs stay informational.
- Existing streaming story/narration behavior must remain streaming; do not wait for the full backend result before showing prose.
- `main` is release only; implement and commit this work on `dev` unless the user explicitly asks for `main`.
- The working tree currently contains older uncommitted code changes. Stage only files changed by the current task.

---

## File Structure

Create:

- `backend/src/domain/time/calendar.js`
  Owns month arithmetic, season derivation, elapsed-month initialization, and readable labels.

- `backend/src/domain/time/timeCost.js`
  Owns realm time tables, action-category inference, effect-hint time modifiers, and readable duration labels.

- `backend/src/domain/time/longevity.js`
  Owns positive lifespan gains, max-lifespan reward ranges, recovery fatigue, medicine resistance, and breakthrough longevity rewards.

- `backend/src/domain/time/timePressure.js`
  Orchestrates time settlement: compute elapsed months, advance calendar, apply base cost/damage/gain, set `timePressure`, set `lastActionCost`, and create ending state.

- `tests/time-calendar.test.js`
  Unit tests for calendar month math and labels.

- `tests/time-cost.test.js`
  Unit tests for category/realm time cost and effect-hint modifiers.

- `tests/longevity.test.js`
  Unit tests for positive time, anti-farming, medicine resistance, and breakthrough longevity rewards.

- `tests/time-pressure.test.js`
  Unit tests for final settlement, net lifespan changes, warning levels, and lifespan exhaustion ending.

Modify:

- `backend/src/domain/progression.js`
  Add 化神 realm support, breakthrough success lifespan rewards, breakthrough time settlement, and expected-time metadata in previews.

- `backend/src/domain/events/effectResolver.js`
  Replace direct `applyActionCost()` with `applyTimePressure()` for formal event actions.

- `backend/src/domain/director/effectHints.js`
  Add `time` target and keep `lifespan up/down` as vague intent for `timePressure`, not direct user-facing debug data.

- `backend/src/app.js`
  Apply time pressure to director turns, stream state patches with `timePressure`, stop normal turns after `ending`, and include public `timeResult` in rule results.

- `backend/src/llm/prompts/storyDirectorPrompt.js`
  Add compact `timePressure` context and hard constraints that forbid numeric time/lifespan output.

- `src/storyMemory.js`
  Record per-turn time label, net lifespan delta, warning level, and ending state for 天机录/model context.

- `frontend/src/api/gameApi.js`
  Normalize streamed `timeResult`, `timePressure`, `ending`, and choices without exposing raw hints.

- `frontend/src/app.js`
  Show top time/lifespan pressure, readable history summaries, positive/negative time entries, and the lifespan-exhausted end state.

- `frontend/src/styles.css`
  Add warning-state and ending-state styling while keeping cards compact.

- Existing tests under `tests/backend-api.test.js`, `tests/breakthrough.test.js`, `tests/director-effect-hints.test.js`, `tests/story-director-prompt.test.js`, `tests/story-memory.test.js`, `tests/frontend-api.test.js`, `tests/frontend-event-state.test.js`, and `tests/frontend-views.test.js`.

---

### Task 1: Calendar Month Math

**Files:**
- Create: `backend/src/domain/time/calendar.js`
- Create: `tests/time-calendar.test.js`

**Interfaces:**
- Produces: `normalizeElapsedMonths(game: object) => number`
- Produces: `calendarFromElapsedMonths(elapsedMonths: number) => { year: number, season: string, month: number }`
- Produces: `advanceCalendarByMonths(game: object, deltaMonths: number) => { calendar: object, elapsedMonths: number }`
- Produces: `formatCalendarLabel(calendar: object) => string`
- Produces: `formatDurationLabel(deltaMonths: number) => string`

- [ ] **Step 1: Write the failing tests**

Create `tests/time-calendar.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceCalendarByMonths,
  calendarFromElapsedMonths,
  formatCalendarLabel,
  formatDurationLabel,
  normalizeElapsedMonths
} from '../backend/src/domain/time/calendar.js';
import { createGame } from '../src/engine.js';

test('calendar derives seasons and crosses years from elapsed months', () => {
  assert.deepEqual(calendarFromElapsedMonths(24), { year: 3, season: '春', month: 1 });
  assert.deepEqual(calendarFromElapsedMonths(26), { year: 3, season: '春', month: 3 });
  assert.deepEqual(calendarFromElapsedMonths(27), { year: 3, season: '夏', month: 4 });
  assert.deepEqual(calendarFromElapsedMonths(35), { year: 3, season: '冬', month: 12 });
  assert.deepEqual(calendarFromElapsedMonths(36), { year: 4, season: '春', month: 1 });
});

test('advanceCalendarByMonths prefers stored elapsed months and returns readable labels', () => {
  const game = { ...createGame(31), time: { elapsedMonths: 24 } };
  const advanced = advanceCalendarByMonths(game, 14);

  assert.equal(normalizeElapsedMonths(game), 24);
  assert.deepEqual(advanced, {
    elapsedMonths: 38,
    calendar: { year: 4, season: '春', month: 3 }
  });
  assert.equal(formatCalendarLabel(advanced.calendar), '玄历4年 春 第3月');
  assert.equal(formatDurationLabel(1), '一月');
  assert.equal(formatDurationLabel(6), '半年');
  assert.equal(formatDurationLabel(12), '一年');
  assert.equal(formatDurationLabel(18), '一年半');
  assert.equal(formatDurationLabel(30), '二年半');
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/time-calendar.test.js
```

Expected: FAIL because `backend/src/domain/time/calendar.js` does not exist.

- [ ] **Step 3: Implement calendar helpers**

Create `backend/src/domain/time/calendar.js`:

```js
const START_YEAR = 3;
const MONTHS_PER_YEAR = 12;

const SEASONS = [
  { name: '春', start: 1, end: 3 },
  { name: '夏', start: 4, end: 6 },
  { name: '秋', start: 7, end: 9 },
  { name: '冬', start: 10, end: 12 }
];

export function normalizeElapsedMonths(game = {}) {
  if (Number.isFinite(game.time?.elapsedMonths)) return Math.max(0, Math.floor(game.time.elapsedMonths));
  const calendar = game.calendar ?? {};
  const year = Number.isFinite(calendar.year) ? calendar.year : START_YEAR;
  const month = Number.isFinite(calendar.month) ? calendar.month : 1;
  return Math.max(0, (year - START_YEAR) * MONTHS_PER_YEAR + (month - 1));
}

export function calendarFromElapsedMonths(elapsedMonths = 0) {
  const safeMonths = Math.max(0, Math.floor(elapsedMonths));
  const year = START_YEAR + Math.floor(safeMonths / MONTHS_PER_YEAR);
  const month = (safeMonths % MONTHS_PER_YEAR) + 1;
  return {
    year,
    season: SEASONS.find((season) => month >= season.start && month <= season.end)?.name ?? '春',
    month
  };
}

export function advanceCalendarByMonths(game = {}, deltaMonths = 0) {
  const elapsedMonths = normalizeElapsedMonths(game) + Math.max(0, Math.floor(deltaMonths));
  return {
    elapsedMonths,
    calendar: calendarFromElapsedMonths(elapsedMonths)
  };
}

export function formatCalendarLabel(calendar = {}) {
  return `玄历${calendar.year ?? START_YEAR}年 ${calendar.season ?? '春'} 第${calendar.month ?? 1}月`;
}

export function formatDurationLabel(deltaMonths = 0) {
  const months = Math.max(0, Math.floor(deltaMonths));
  if (months <= 0) return '片刻';
  if (months === 1) return '一月';
  if (months === 3) return '三月';
  if (months === 6) return '半年';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${toChineseNumber(months)}月`;
  if (rest === 0) return `${toChineseNumber(years)}年`;
  if (rest === 6) return `${toChineseNumber(years)}年半`;
  return `${toChineseNumber(years)}年${toChineseNumber(rest)}月`;
}

function toChineseNumber(value) {
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (value <= 10) return digits[value] ?? String(value);
  if (value < 20) return `十${digits[value - 10]}`;
  return String(value);
}
```

- [ ] **Step 4: Verify Task 1**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/time-calendar.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add backend/src/domain/time/calendar.js tests/time-calendar.test.js
git commit -m "feat: add cultivation calendar math"
```

### Task 2: Realm Time Cost And Categories

**Files:**
- Create: `backend/src/domain/time/timeCost.js`
- Create: `tests/time-cost.test.js`
- Modify: `backend/src/domain/progression.js`

**Interfaces:**
- Consumes: `getRealmTier(realm)` from `backend/src/domain/progression.js`
- Consumes: `formatDurationLabel(deltaMonths)` from `backend/src/domain/time/calendar.js`
- Produces: `ACTION_TIME_CATEGORIES`
- Produces: `getRealmTimeTier(realm: string) => string`
- Produces: `inferActionTimeCategory({ action, command, source, effectHints }) => string`
- Produces: `calculateActionTimeCost({ game, action, category, effectHints }) => { category, baseMonths, modifierMonths, deltaMonths, label }`

- [ ] **Step 1: Write failing time-cost tests**

Create `tests/time-cost.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateActionTimeCost,
  getRealmTimeTier,
  inferActionTimeCategory
} from '../backend/src/domain/time/timeCost.js';
import { createGame } from '../src/engine.js';

function gameAtRealm(realm) {
  return {
    ...createGame(31),
    onboarding: { completed: true },
    player: { ...createGame(31).player, realm }
  };
}

test('realm time tiers cover first version and reserved high realms', () => {
  assert.equal(getRealmTimeTier('炼气九层'), '炼气');
  assert.equal(getRealmTimeTier('筑基后期'), '筑基');
  assert.equal(getRealmTimeTier('金丹中期'), '金丹');
  assert.equal(getRealmTimeTier('元婴初期'), '元婴');
  assert.equal(getRealmTimeTier('化神初期'), '化神');
});

test('action category inference uses command text and source', () => {
  assert.equal(inferActionTimeCategory({ command: '闭关修炼三月' }), 'cultivation');
  assert.equal(inferActionTimeCategory({ command: '前往后山探索灵脉' }), 'explore');
  assert.equal(inferActionTimeCategory({ command: '找林师姐请教旧事' }), 'social');
  assert.equal(inferActionTimeCategory({ command: '炼制聚气丹' }), 'craft');
  assert.equal(inferActionTimeCategory({ source: 'breakthrough', command: '尝试突破' }), 'breakthrough');
  assert.equal(inferActionTimeCategory({ command: '继续' }), 'story');
});

test('time cost grows by realm and accepts vague time hints', () => {
  const qi = calculateActionTimeCost({ game: gameAtRealm('炼气七层'), command: '继续' });
  const foundation = calculateActionTimeCost({ game: gameAtRealm('筑基初期'), command: '继续' });
  const jindanCultivate = calculateActionTimeCost({
    game: gameAtRealm('金丹初期'),
    command: '闭关修炼',
    effectHints: [{ target: 'time', direction: 'up', intensity: 'small' }]
  });
  const fastExplore = calculateActionTimeCost({
    game: gameAtRealm('筑基初期'),
    command: '前往后山探索',
    effectHints: [{ target: 'time', direction: 'down', intensity: 'small' }]
  });

  assert.deepEqual(qi, { category: 'story', baseMonths: 1, modifierMonths: 0, deltaMonths: 1, label: '一月' });
  assert.equal(foundation.deltaMonths, 3);
  assert.equal(jindanCultivate.deltaMonths, 15);
  assert.equal(jindanCultivate.label, '一年三月');
  assert.equal(fastExplore.deltaMonths, 3);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/time-cost.test.js
```

Expected: FAIL because `timeCost.js` does not exist.

- [ ] **Step 3: Extend progression realm constants**

Modify `backend/src/domain/progression.js` so the top constants include 化神:

```js
const REALM_COSTS = {
  炼气: 1,
  筑基: 2,
  金丹: 4,
  元婴: 8,
  化神: 12
};
```

Also add:

```js
const BREAKTHROUGH_BASE_CHANCE = {
  炼气: 55,
  筑基: 40,
  金丹: 28,
  元婴: 18,
  化神: 10
};

const BREAKTHROUGH_FAILURE_COSTS = {
  炼气: { health: 18, lifespan: 1, progressLoss: 40 },
  筑基: { health: 24, lifespan: 2, progressLoss: 45 },
  金丹: { health: 32, lifespan: 4, progressLoss: 50 },
  元婴: { health: 40, lifespan: 8, progressLoss: 60 },
  化神: { health: 52, lifespan: 12, progressLoss: 65 }
};
```

- [ ] **Step 4: Implement time-cost helpers**

Create `backend/src/domain/time/timeCost.js`:

```js
import { formatDurationLabel } from './calendar.js';
import { getRealmTier } from '../progression.js';

export const ACTION_TIME_CATEGORIES = ['story', 'cultivation', 'explore', 'social', 'craft', 'breakthrough'];

const REALM_TIME_TABLE = {
  炼气: { story: 1, cultivation: 3, explore: 2, social: 1, craft: 2, breakthrough: 6 },
  筑基: { story: 3, cultivation: 6, explore: 4, social: 2, craft: 4, breakthrough: 12 },
  金丹: { story: 6, cultivation: 12, explore: 8, social: 4, craft: 8, breakthrough: 24 },
  元婴: { story: 12, cultivation: 24, explore: 18, social: 8, craft: 18, breakthrough: 48 },
  化神: { story: 24, cultivation: 48, explore: 36, social: 12, craft: 36, breakthrough: 96 }
};

const TIME_HINT_MODIFIER = {
  tiny: 1,
  small: 3,
  medium: 6,
  high: 12,
  critical: 24
};

export function getRealmTimeTier(realm = '') {
  if (realm.includes('化神')) return '化神';
  return getRealmTier(realm);
}

export function inferActionTimeCategory({ action = {}, command = '', source = '', effectHints = [] } = {}) {
  if (source === 'breakthrough' || action.source === 'breakthrough') return 'breakthrough';
  const text = `${command || action.command || ''} ${action.title || ''}`;
  if (text.includes('突破')) return 'breakthrough';
  if (text.includes('闭关') || text.includes('修炼') || text.includes('吐纳') || text.includes('稳固')) return 'cultivation';
  if (text.includes('探索') || text.includes('前往') || text.includes('秘境') || text.includes('后山') || text.includes('远行')) return 'explore';
  if (text.includes('林师姐') || text.includes('长老') || text.includes('请教') || text.includes('拜会') || text.includes('打听')) return 'social';
  if (text.includes('炼丹') || text.includes('丹药') || text.includes('整理') || text.includes('法器') || text.includes('坊市')) return 'craft';
  if (effectHints.some((hint) => hint.target === 'lifespan' && hint.direction === 'up')) return 'cultivation';
  return 'story';
}

export function calculateActionTimeCost({ game = {}, action = {}, command = '', category, effectHints = [] } = {}) {
  const realmTier = getRealmTimeTier(game.player?.realm);
  const resolvedCategory = ACTION_TIME_CATEGORIES.includes(category)
    ? category
    : inferActionTimeCategory({ action, command, source: action.source, effectHints });
  const baseMonths = REALM_TIME_TABLE[realmTier]?.[resolvedCategory] ?? REALM_TIME_TABLE.炼气.story;
  const modifierMonths = calculateTimeHintModifier(effectHints);
  const deltaMonths = Math.max(1, baseMonths + modifierMonths);

  return {
    category: resolvedCategory,
    baseMonths,
    modifierMonths,
    deltaMonths,
    label: formatDurationLabel(deltaMonths)
  };
}

function calculateTimeHintModifier(effectHints = []) {
  return effectHints
    .filter((hint) => hint.target === 'time' && hint.direction !== 'stable')
    .reduce((total, hint) => {
      const value = TIME_HINT_MODIFIER[hint.intensity] ?? TIME_HINT_MODIFIER.small;
      return total + (['down', 'consume', 'lose'].includes(hint.direction) ? -value : value);
    }, 0);
}
```

- [ ] **Step 5: Verify Task 2**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/time-cost.test.js tests/progression.test.js tests/breakthrough.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add backend/src/domain/time/timeCost.js backend/src/domain/progression.js tests/time-cost.test.js
git commit -m "feat: add realm time cost rules"
```

### Task 3: Longevity Gains And Anti-Farming

**Files:**
- Create: `backend/src/domain/time/longevity.js`
- Create: `tests/longevity.test.js`

**Interfaces:**
- Produces: `calculateLongevityChange({ game, category, effectHints, source, breakthrough }) => { longevityGain, maxLifespanDelta, recoveryFatigue, recoverySource, note }`
- Produces: `applyLongevityState(game: object, result: object) => object`
- Produces: `calculateBreakthroughLongevityReward({ fromRealm, targetRealm, success }) => { longevityGain, maxLifespanDelta }`

- [ ] **Step 1: Write failing longevity tests**

Create `tests/longevity.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyLongevityState,
  calculateBreakthroughLongevityReward,
  calculateLongevityChange
} from '../backend/src/domain/time/longevity.js';
import { createGame } from '../src/engine.js';

function gameWithPlayer(overrides = {}) {
  const base = createGame(31);
  return {
    ...base,
    onboarding: { completed: true },
    character: {
      ...base.character,
      attributes: { rootBone: 5, comprehension: 5, fortune: 5, willpower: 5, lifeSeed: 5 }
    },
    player: {
      ...base.player,
      lifespan: 80,
      maxLifespan: 120,
      realm: '炼气七层',
      ...overrides.player
    },
    longevity: overrides.longevity ?? {}
  };
}

test('lifespan up hints restore current lifespan but not max lifespan by default', () => {
  const game = gameWithPlayer();
  const result = calculateLongevityChange({
    game,
    category: 'cultivation',
    effectHints: [{ target: 'lifespan', direction: 'up', intensity: 'small' }]
  });

  assert.equal(result.longevityGain > 0, true);
  assert.equal(result.maxLifespanDelta, 0);
  assert.equal(result.recoverySource, 'rest');
});

test('repeated rest triggers recovery fatigue and lowers gains', () => {
  const first = calculateLongevityChange({
    game: gameWithPlayer(),
    category: 'cultivation',
    effectHints: [{ target: 'lifespan', direction: 'up', intensity: 'medium' }]
  });
  const afterFirst = applyLongevityState(gameWithPlayer(), first);
  const second = calculateLongevityChange({
    game: afterFirst,
    category: 'cultivation',
    effectHints: [{ target: 'lifespan', direction: 'up', intensity: 'medium' }]
  });

  assert.equal(second.recoveryFatigue, first.recoveryFatigue + 1);
  assert.equal(second.longevityGain < first.longevityGain, true);
  assert.match(second.note, /收益降低|久守洞府/);
});

test('medicine resistance lowers repeated pill longevity gains', () => {
  const game = gameWithPlayer({ longevity: { medicineResistance: { longevity_pill: 2 } } });
  const result = calculateLongevityChange({
    game,
    category: 'craft',
    source: 'medicine',
    effectHints: [{ target: 'lifespan', direction: 'up', intensity: 'high', id: 'longevity_pill' }]
  });

  assert.equal(result.longevityGain > 0, true);
  assert.equal(result.recoverySource, 'medicine');
  assert.equal(result.longevityGain < 11, true);
});

test('major breakthrough rewards restore lifespan and raise max lifespan', () => {
  assert.deepEqual(calculateBreakthroughLongevityReward({
    fromRealm: '炼气九层',
    targetRealm: '筑基初期',
    success: true
  }), {
    longevityGain: 25,
    maxLifespanDelta: 40
  });
  assert.deepEqual(calculateBreakthroughLongevityReward({
    fromRealm: '炼气七层',
    targetRealm: '炼气八层',
    success: true
  }), {
    longevityGain: 2,
    maxLifespanDelta: 1
  });
  assert.deepEqual(calculateBreakthroughLongevityReward({
    fromRealm: '炼气七层',
    targetRealm: '炼气八层',
    success: false
  }), {
    longevityGain: 0,
    maxLifespanDelta: 0
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/longevity.test.js
```

Expected: FAIL because `longevity.js` does not exist.

- [ ] **Step 3: Implement longevity rules**

Create `backend/src/domain/time/longevity.js`:

```js
const BASE_BY_INTENSITY = {
  tiny: 1,
  small: 3,
  medium: 6,
  high: 11,
  critical: 16
};

const BREAKTHROUGH_REWARDS = [
  { from: '炼气九层', to: '筑基初期', gain: 25, max: 40 },
  { from: '筑基后期', to: '金丹初期', gain: 65, max: 100 },
  { from: '金丹后期', to: '元婴初期', gain: 150, max: 210 },
  { from: '元婴后期', to: '化神初期', gain: 300, max: 430 }
];

export function calculateLongevityChange({ game = {}, category = 'story', effectHints = [], source = '', breakthrough } = {}) {
  if (breakthrough) {
    return {
      ...calculateBreakthroughLongevityReward(breakthrough),
      recoveryFatigue: 0,
      recoverySource: 'breakthrough',
      note: breakthrough.success ? '突破洗练，寿元重燃。' : ''
    };
  }

  const positiveHints = effectHints.filter((hint) => hint.target === 'lifespan' && ['up', 'gain', 'stable'].includes(hint.direction));
  if (!positiveHints.length) {
    return {
      longevityGain: 0,
      maxLifespanDelta: 0,
      recoveryFatigue: 0,
      recoverySource: '',
      note: ''
    };
  }

  const recoverySource = source === 'medicine' || positiveHints.some((hint) => hint.id?.includes('pill')) ? 'medicine' : 'rest';
  const fatigue = recoverySource === 'rest' ? Math.max(0, game.longevity?.recoveryFatigue ?? 0) : 0;
  const resistance = recoverySource === 'medicine'
    ? Math.max(0, Object.values(game.longevity?.medicineResistance ?? {}).reduce((sum, value) => sum + value, 0))
    : 0;
  const rawGain = positiveHints.reduce((sum, hint) => sum + (BASE_BY_INTENSITY[hint.intensity] ?? BASE_BY_INTENSITY.small), 0);
  const lifeSeedBonus = Math.floor((game.character?.attributes?.lifeSeed ?? 1) / 4);
  const penalty = fatigue * 2 + resistance * 2;
  const longevityGain = Math.max(0, rawGain + lifeSeedBonus - penalty);

  return {
    longevityGain,
    maxLifespanDelta: 0,
    recoveryFatigue: recoverySource === 'rest' ? fatigue + 1 : fatigue,
    recoverySource,
    note: fatigue > 0 ? '久守洞府，调养收益降低。' : category === 'cultivation' ? '命火回稳。' : '药力入脉，命火稍定。'
  };
}

export function applyLongevityState(game = {}, result = {}) {
  const previous = game.longevity ?? {};
  const medicineResistance = { ...(previous.medicineResistance ?? {}) };
  if (result.recoverySource === 'medicine') {
    medicineResistance.longevity_pill = (medicineResistance.longevity_pill ?? 0) + 1;
  }
  return {
    ...game,
    longevity: {
      ...previous,
      recoveryFatigue: result.recoverySource === 'rest' ? result.recoveryFatigue : 0,
      medicineResistance
    }
  };
}

export function calculateBreakthroughLongevityReward({ fromRealm = '', targetRealm = '', success = false } = {}) {
  if (!success) return { longevityGain: 0, maxLifespanDelta: 0 };
  const major = BREAKTHROUGH_REWARDS.find((reward) => reward.from === fromRealm && reward.to === targetRealm);
  if (major) return { longevityGain: major.gain, maxLifespanDelta: major.max };
  return { longevityGain: 2, maxLifespanDelta: 1 };
}
```

- [ ] **Step 4: Verify Task 3**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/longevity.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add backend/src/domain/time/longevity.js tests/longevity.test.js
git commit -m "feat: add longevity recovery rules"
```

### Task 4: Time Pressure Settlement

**Files:**
- Create: `backend/src/domain/time/timePressure.js`
- Create: `tests/time-pressure.test.js`
- Modify: `backend/src/domain/turnResult.js`

**Interfaces:**
- Consumes: `advanceCalendarByMonths()`, `formatCalendarLabel()` from `calendar.js`
- Consumes: `calculateActionTimeCost()` from `timeCost.js`
- Consumes: `calculateLongevityChange()`, `applyLongevityState()` from `longevity.js`
- Produces: `applyTimePressure({ game, action, command, category, effectHints, source, extraLifespanDamage, breakthrough }) => { game, timeResult }`
- Produces: `buildWarningLevel(player) => 'steady' | 'strained' | 'danger' | 'critical' | 'ended'`

- [ ] **Step 1: Write failing time-pressure tests**

Create `tests/time-pressure.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { applyTimePressure, buildWarningLevel } from '../backend/src/domain/time/timePressure.js';
import { createGame } from '../src/engine.js';

function formalGame(overrides = {}) {
  const base = createGame(31);
  return {
    ...base,
    onboarding: { completed: true },
    time: { elapsedMonths: 24 },
    character: {
      ...base.character,
      attributes: { rootBone: 5, comprehension: 5, fortune: 5, willpower: 5, lifeSeed: 1 }
    },
    player: {
      ...base.player,
      realm: '筑基初期',
      lifespan: 40,
      maxLifespan: 100,
      ...overrides.player
    },
    ...overrides
  };
}

test('time pressure advances calendar and applies net lifespan cost', () => {
  const result = applyTimePressure({
    game: formalGame(),
    command: '继续',
    category: 'story'
  });

  assert.equal(result.timeResult.deltaMonths, 3);
  assert.equal(result.timeResult.label, '三月');
  assert.equal(result.timeResult.baseLifespanCost, 3);
  assert.equal(result.timeResult.netLifespanDelta, -3);
  assert.equal(result.game.player.lifespan, 37);
  assert.equal(result.game.time.elapsedMonths, 27);
  assert.deepEqual(result.game.calendar, { year: 3, season: '夏', month: 4 });
  assert.equal(result.game.timePressure.warningLevel, 'danger');
});

test('positive longevity can produce a net lifespan increase without raising max lifespan', () => {
  const result = applyTimePressure({
    game: formalGame({ player: { lifespan: 40, maxLifespan: 100, realm: '炼气七层' } }),
    command: '静坐调息',
    category: 'cultivation',
    effectHints: [{ target: 'lifespan', direction: 'up', intensity: 'high' }]
  });

  assert.equal(result.timeResult.longevityGain > result.timeResult.baseLifespanCost, true);
  assert.equal(result.timeResult.maxLifespanDelta, 0);
  assert.equal(result.game.player.lifespan > 40, true);
  assert.equal(result.game.player.maxLifespan, 100);
});

test('lifespan exhaustion creates ending and blocks further play state', () => {
  const result = applyTimePressure({
    game: formalGame({ player: { lifespan: 2, maxLifespan: 100, realm: '金丹初期' } }),
    command: '强闯雾隐秘境',
    category: 'explore',
    extraLifespanDamage: 10
  });

  assert.equal(result.game.player.lifespan, 0);
  assert.equal(result.game.timePressure.warningLevel, 'ended');
  assert.equal(result.game.ending.type, 'lifespan_exhausted');
  assert.match(result.game.ending.title, /命簿终章/);
});

test('warning levels follow lifespan ratio', () => {
  assert.equal(buildWarningLevel({ lifespan: 80, maxLifespan: 100 }), 'steady');
  assert.equal(buildWarningLevel({ lifespan: 50, maxLifespan: 100 }), 'strained');
  assert.equal(buildWarningLevel({ lifespan: 25, maxLifespan: 100 }), 'danger');
  assert.equal(buildWarningLevel({ lifespan: 10, maxLifespan: 100 }), 'critical');
  assert.equal(buildWarningLevel({ lifespan: 0, maxLifespan: 100 }), 'ended');
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/time-pressure.test.js
```

Expected: FAIL because `timePressure.js` does not exist.

- [ ] **Step 3: Implement time-pressure settlement**

Create `backend/src/domain/time/timePressure.js`:

```js
import { advanceCalendarByMonths, formatCalendarLabel } from './calendar.js';
import { calculateActionTimeCost } from './timeCost.js';
import { applyLongevityState, calculateLongevityChange } from './longevity.js';
import { calculateLifespanCost } from '../progression.js';

export function applyTimePressure({
  game = {},
  action = {},
  command = '',
  category,
  effectHints = [],
  source = '',
  extraLifespanDamage = 0,
  breakthrough
} = {}) {
  if (game.onboarding?.completed === false) {
    return { game, timeResult: emptyTimeResult(game) };
  }

  const timeCost = calculateActionTimeCost({ game, action, command, category, effectHints });
  const calendarResult = advanceCalendarByMonths(game, timeCost.deltaMonths);
  const baseLifespanCost = Math.max(Math.ceil(timeCost.deltaMonths / 12), calculateLifespanCost(game));
  const longevity = calculateLongevityChange({
    game,
    category: timeCost.category,
    effectHints,
    source,
    breakthrough
  });
  const maxLifespan = Math.max(0, (game.player?.maxLifespan ?? 0) + longevity.maxLifespanDelta);
  const netLifespanDelta = longevity.longevityGain - baseLifespanCost - Math.max(0, extraLifespanDamage);
  const lifespan = clamp((game.player?.lifespan ?? 0) + netLifespanDelta, 0, maxLifespan);
  const warningLevel = buildWarningLevel({ lifespan, maxLifespan });
  const timeResult = {
    category: timeCost.category,
    deltaMonths: timeCost.deltaMonths,
    label: timeCost.label,
    baseLifespanCost,
    longevityGain: longevity.longevityGain,
    netLifespanDelta,
    maxLifespanDelta: longevity.maxLifespanDelta,
    warningLevel,
    recoveryFatigue: longevity.recoveryFatigue,
    note: longevity.note
  };
  const withLongevityState = applyLongevityState(game, longevity);
  const nextGame = {
    ...withLongevityState,
    calendar: calendarResult.calendar,
    time: {
      ...(withLongevityState.time ?? {}),
      elapsedMonths: calendarResult.elapsedMonths,
      lastDeltaMonths: timeCost.deltaMonths
    },
    player: {
      ...withLongevityState.player,
      maxLifespan,
      lifespan
    },
    timePressure: {
      calendarLabel: formatCalendarLabel(calendarResult.calendar),
      elapsedYears: Math.floor(calendarResult.elapsedMonths / 12),
      remainingLifespan: lifespan,
      maxLifespan,
      lifespanRatio: maxLifespan > 0 ? lifespan / maxLifespan : 0,
      warningLevel,
      lastDeltaTime: timeCost.label,
      lastLifespanCost: baseLifespanCost,
      lastLongevityGain: longevity.longevityGain,
      lastNetLifespanDelta: netLifespanDelta,
      recentRecoveryFatigue: longevity.recoveryFatigue
    },
    lastActionCost: {
      ...(withLongevityState.lastActionCost ?? {}),
      lifespan: Math.max(0, -netLifespanDelta),
      time: timeCost.deltaMonths,
      timeLabel: timeCost.label
    },
    lastTimeResult: timeResult
  };

  return {
    game: warningLevel === 'ended' ? withLifespanEnding(nextGame) : nextGame,
    timeResult
  };
}

export function buildWarningLevel(player = {}) {
  const lifespan = player.lifespan ?? 0;
  const maxLifespan = Math.max(1, player.maxLifespan ?? lifespan);
  const ratio = lifespan / maxLifespan;
  if (lifespan <= 0) return 'ended';
  if (ratio <= 0.15) return 'critical';
  if (ratio <= 0.35) return 'danger';
  if (ratio <= 0.60) return 'strained';
  return 'steady';
}

function emptyTimeResult(game) {
  return {
    category: 'tutorial',
    deltaMonths: 0,
    label: '片刻',
    baseLifespanCost: 0,
    longevityGain: 0,
    netLifespanDelta: 0,
    maxLifespanDelta: 0,
    warningLevel: buildWarningLevel(game.player),
    recoveryFatigue: 0,
    note: ''
  };
}

function withLifespanEnding(game) {
  return {
    ...game,
    ending: {
      type: 'lifespan_exhausted',
      title: '命簿终章',
      body: '命火在最后一夜熄灭，未解伏笔仍悬于天门之后。'
    }
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
```

- [ ] **Step 4: Extend turn result shape**

Modify `backend/src/domain/turnResult.js`:

```js
export function buildTurnResult({ before, after, actionId, narration, timeResult }) {
  const entry = after.log.at(-1);

  return {
    turn: after.turn,
    actionId,
    ruleResult: {
      success: true,
      statChanges: diffStats(before.player, after.player),
      ...(timeResult ? { timeResult: publicTimeResult(timeResult) } : {})
    },
    narration: narration ?? {
      title: entry.title,
      body: entry.body,
      npcLine: entry.npcLine,
      foreshadow: after.foreshadows.at(-1) ?? ''
    }
  };
}

function publicTimeResult(timeResult = {}) {
  return {
    label: timeResult.label,
    netLifespanDelta: timeResult.netLifespanDelta,
    maxLifespanDelta: timeResult.maxLifespanDelta,
    warningLevel: timeResult.warningLevel,
    note: timeResult.note
  };
}
```

Keep `diffStats()` unchanged.

- [ ] **Step 5: Verify Task 4**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/time-pressure.test.js tests/progression.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add backend/src/domain/time/timePressure.js backend/src/domain/turnResult.js tests/time-pressure.test.js
git commit -m "feat: settle time pressure results"
```

### Task 5: Event And Ordinary Action Integration

**Files:**
- Modify: `backend/src/domain/events/effectResolver.js`
- Modify: `backend/src/app.js`
- Modify: `tests/backend-api.test.js`

**Interfaces:**
- Consumes: `applyTimePressure()` from `backend/src/domain/time/timePressure.js`
- Extends: event `ruleResult` with public `timeResult`
- Extends: game state with `time`, `timePressure`, and `ending`

- [ ] **Step 1: Add backend API regression tests**

Add these tests near the existing `POST /api/v1/turns resolves selected event effects deterministically` tests in `tests/backend-api.test.js`:

```js
test('POST /api/v1/turns advances time and returns public time result for event actions', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: 0
  })));
  const action = actionsPayload.data.actions.find((candidate) => candidate.title === '靠近铜铃');

  const turnPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0
  })));

  assert.equal(turnPayload.ok, true);
  assert.equal(turnPayload.data.game.time.elapsedMonths > 0, true);
  assert.equal(typeof turnPayload.data.game.timePressure.calendarLabel, 'string');
  assert.equal(typeof turnPayload.data.turnResult.ruleResult.timeResult.label, 'string');
  assert.equal('deltaMonths' in turnPayload.data.turnResult.ruleResult.timeResult, false);
  assert.equal('effectHints' in turnPayload.data.turnResult.ruleResult.timeResult, false);
});

test('POST /api/v1/turns rejects normal actions after lifespan ending', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  app.getState().game.ending = { type: 'lifespan_exhausted', title: '命簿终章', body: '命火已熄。' };
  const actionsPayload = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'home',
    gameVersion: 0
  })));
  const [action] = actionsPayload.data.actions;

  const response = await app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: action.id,
    clientTurn: 0
  }));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.error.code, 'GAME_ENDED');
});
```

- [ ] **Step 2: Run failing backend API tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/backend-api.test.js
```

Expected: FAIL because event actions still use `applyActionCost()` and normal actions do not reject `ending`.

- [ ] **Step 3: Replace event action cost with time pressure**

Modify the top of `backend/src/domain/events/effectResolver.js`:

```js
import { applyTimePressure } from '../time/timePressure.js';
```

Remove:

```js
import { applyActionCost } from '../progression.js';
```

Inside `resolveChoice()` replace:

```js
const next = game.onboarding?.completed === false ? withEffects : applyActionCost(withEffects);
```

with:

```js
const pressure = game.onboarding?.completed === false
  ? { game: withEffects, timeResult: null }
  : applyTimePressure({
    game: withEffects,
    action: { title: choice.label, command: choice.command, source: 'event' },
    command: choice.command,
    category: event.category === 'realm' ? 'explore' : undefined,
    source: 'event'
  });
const next = pressure.game;
```

Then extend `ruleResult`:

```js
timeResult: pressure.timeResult,
lifespanCost: pressure.timeResult?.baseLifespanCost ?? 0
```

- [ ] **Step 4: Block actions when the game has ended**

In `backend/src/app.js`, add this helper:

```js
function rejectIfGameEnded({ requestId, state }) {
  if (!state.game.ending) return null;
  return errorResponse(409, requestId, 'GAME_ENDED', '命簿已结，请重开后再行动。');
}
```

At the beginning of `handleDailyActions()`, `resolveTurnRules()`, and `validateDirectorTurnRequest()`, call it after onboarding checks where appropriate:

```js
const ended = rejectIfGameEnded({ requestId, state });
if (ended) return ended;
```

Do not block `GET /api/v1/game/state`, `POST /api/v1/game/reset`, or `POST /api/v1/export-story`.

- [ ] **Step 5: Pass `timeResult` through finalizeTurn**

In `resolveTurnRules()` return `timeResult: resolution.ruleResult?.timeResult` for event actions. In `finalizeTurn()` pass it to `buildTurnResult()`:

```js
const baseTurnResult = buildTurnResult({
  before: resolved.before,
  after: state.game,
  actionId: resolved.action.id,
  narration: resolved.narration,
  timeResult: resolved.ruleResult?.timeResult
});
```

- [ ] **Step 6: Verify Task 5**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/backend-api.test.js tests/time-pressure.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add backend/src/domain/events/effectResolver.js backend/src/app.js tests/backend-api.test.js
git commit -m "feat: apply time pressure to event turns"
```

### Task 6: Breakthrough Time And Longevity Rewards

**Files:**
- Modify: `backend/src/domain/progression.js`
- Modify: `backend/src/app.js`
- Modify: `tests/breakthrough.test.js`
- Modify: `tests/backend-api.test.js`

**Interfaces:**
- Consumes: `applyTimePressure()` from `backend/src/domain/time/timePressure.js`
- Consumes: `calculateActionTimeCost()` for breakthrough preview label
- Extends: `calculateBreakthroughChance(game)` with `expectedTimeLabel`, `successLongevity`, `successMaxLifespan`
- Extends: `resolveBreakthrough(game, now)` rule result with public `timeResult`

- [ ] **Step 1: Add breakthrough reward tests**

Add to `tests/breakthrough.test.js`:

```js
test('successful breakthroughs spend time and restore lifespan', () => {
  const base = {
    ...createFormalGame({ seed: 52, realm: '炼气九层' }),
    time: { elapsedMonths: 24 },
    player: {
      ...createFormalGame({ seed: 52, realm: '炼气九层' }).player,
      realm: '炼气九层',
      lifespan: 40,
      maxLifespan: 100,
      cultivationProgress: 100
    }
  };
  const result = resolveBreakthrough(base, new Date('2026-07-01T08:00:00.000Z'));

  assert.equal(result.ruleResult.success, true);
  assert.equal(result.game.player.realm, '筑基初期');
  assert.equal(result.game.player.maxLifespan, 140);
  assert.equal(result.game.player.lifespan > 40, true);
  assert.equal(result.ruleResult.timeResult.label, '半年');
  assert.equal(result.ruleResult.timeResult.maxLifespanDelta, 40);
});

test('breakthrough preview includes expected time and success lifespan rewards', () => {
  const preview = calculateBreakthroughChance(createFormalGame({ realm: '炼气九层' }));

  assert.equal(preview.expectedTimeLabel, '半年');
  assert.equal(preview.successLongevity, 25);
  assert.equal(preview.successMaxLifespan, 40);
});
```

- [ ] **Step 2: Run failing breakthrough tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/breakthrough.test.js
```

Expected: FAIL because `resolveBreakthrough()` does not apply breakthrough longevity rewards.

- [ ] **Step 3: Extend breakthrough preview**

In `backend/src/domain/progression.js`, import:

```js
import { calculateActionTimeCost } from './time/timeCost.js';
import { applyTimePressure } from './time/timePressure.js';
import { calculateBreakthroughLongevityReward } from './time/longevity.js';
```

Update `calculateBreakthroughChance(game)`:

```js
const targetRealm = nextRealm(game.player?.realm);
const expectedTime = calculateActionTimeCost({ game, category: 'breakthrough', command: '尝试突破' });
const successReward = calculateBreakthroughLongevityReward({
  fromRealm: game.player?.realm,
  targetRealm,
  success: true
});

return {
  targetRealm,
  chance,
  failureCost: describeFailureCost(game),
  expectedTimeLabel: expectedTime.label,
  successLongevity: successReward.longevityGain,
  successMaxLifespan: successReward.maxLifespanDelta
};
```

- [ ] **Step 4: Apply time pressure inside breakthrough resolution**

In `resolveBreakthrough()`, stop calling `applyActionCost(game)`. Compute success from the original `game`, create the post-breakthrough player, then call `applyTimePressure()`:

```js
const fromRealm = game.player?.realm;
const roll = breakthroughRoll(game);
const success = roll < preview.chance;
const playerAfterBreakthrough = success
  ? { ...game.player, realm: preview.targetRealm, cultivationProgress: 0 }
  : applyBreakthroughFailure(game.player, preview.failureCost);
const pressure = applyTimePressure({
  game: { ...game, player: playerAfterBreakthrough },
  action: { title: '尝试突破', command: '尝试突破', source: 'breakthrough' },
  command: '尝试突破',
  category: 'breakthrough',
  source: 'breakthrough',
  extraLifespanDamage: success ? 0 : preview.failureCost.lifespan,
  breakthrough: {
    fromRealm,
    targetRealm: preview.targetRealm,
    success
  }
});
```

Use `pressure.game` as the base for the returned game and set:

```js
const lastActionCost = {
  lifespan: Math.max(0, -(pressure.timeResult?.netLifespanDelta ?? 0)),
  time: pressure.timeResult?.deltaMonths ?? 0,
  timeLabel: pressure.timeResult?.label ?? ''
};
```

Add `timeResult: pressure.timeResult` to `ruleResult`.

- [ ] **Step 5: Update breakthrough action meta**

In `backend/src/app.js` where breakthrough pending actions are created, extend public `meta` text to include:

```text
预计耗时 {preview.expectedTimeLabel} · 成功续命 +{preview.successLongevity} · 大限 +{preview.successMaxLifespan}
```

Keep it player-facing; do not expose `targetRealm`, `failureCost`, or raw ids as separate UI fields.

- [ ] **Step 6: Verify Task 6**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/breakthrough.test.js tests/backend-api.test.js tests/time-pressure.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```bash
git add backend/src/domain/progression.js backend/src/app.js tests/breakthrough.test.js tests/backend-api.test.js
git commit -m "feat: add breakthrough time rewards"
```

### Task 7: Director Time Hints And Story Memory Context

**Files:**
- Modify: `backend/src/domain/director/effectHints.js`
- Modify: `backend/src/app.js`
- Modify: `backend/src/llm/prompts/storyDirectorPrompt.js`
- Modify: `src/storyMemory.js`
- Modify: `tests/director-effect-hints.test.js`
- Modify: `tests/story-director-prompt.test.js`
- Modify: `tests/story-memory.test.js`
- Modify: `tests/backend-api.test.js`

**Interfaces:**
- Extends: `ALLOWED_EFFECT_TARGETS` with `time`
- Extends: `resolveDirectorEffectHints()` result with `accepted`
- Consumes: `applyTimePressure()` in `resolveDirectorTurn()`
- Extends: story memory recent turn with `timeLabel`, `netLifespanDelta`, `warningLevel`
- Extends: prompt context with `timePressure`

- [ ] **Step 1: Add director hint and prompt tests**

Add to `tests/director-effect-hints.test.js`:

```js
test('accepts time hints without converting them into direct stat effects', () => {
  const game = createGame(31);
  const result = resolveDirectorEffectHints({
    game,
    effectHints: [
      { target: 'time', direction: 'up', intensity: 'small' },
      { target: 'lifespan', direction: 'up', intensity: 'small' }
    ],
    now: new Date('2026-07-01T08:00:00.000Z')
  });

  assert.deepEqual(result.accepted.map((hint) => hint.target), ['time', 'lifespan']);
  assert.equal(result.appliedEffects.some((effect) => effect.type === 'lifespan'), false);
});
```

Add to `tests/story-director-prompt.test.js`:

```js
assert.equal(user.context.timePressure.warningLevel, 'strained');
assert.match(JSON.stringify(user.context.timePressure), /remainingLifespan|maxLifespan|lastDeltaTime/);
assert.match(system, /必须承认时间流逝|不要让连续剧情都像同一天/);
assert.match(system, /不得输出具体数值/);
```

Set `game.timePressure` in that test fixture before calling `buildStoryDirectorMessages()`.

- [ ] **Step 2: Run failing director tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/director-effect-hints.test.js tests/story-director-prompt.test.js
```

Expected: FAIL because `time` is not allowed and prompt context has no `timePressure`.

- [ ] **Step 3: Extend effect hint target and split lifespan hints**

In `backend/src/domain/director/effectHints.js` add `'time'` to `ALLOWED_EFFECT_TARGETS` and `SUMMARY_LABELS`:

```js
time: '时间'
```

Change `hintToRuleEffect()` so `time` returns `null`, and positive/negative `lifespan` hints return `null` for director resolution:

```js
if (hint.target === 'time') return null;
if (hint.target === 'lifespan') return null;
```

Return accepted hints from `resolveDirectorEffectHints()`:

```js
return {
  game: nextGame,
  summary: summarizeEffects(normalized.accepted),
  accepted: normalized.accepted,
  appliedEffects: effects,
  rejected: normalized.rejected,
  resolvedAt: now.toISOString()
};
```

- [ ] **Step 4: Apply time pressure in director turns**

In `backend/src/app.js`, import `applyTimePressure`. In `resolveDirectorTurn()` after `effectResolution`:

```js
const pressure = applyTimePressure({
  game: effectResolution.game,
  action: { title: directorOutput.mode === 'choice' ? '命途分岔' : '命火微澜', command: input.type === 'choice' ? input.choiceText : '继续', source: 'director' },
  command: input.type === 'choice' ? input.choiceText : '继续',
  category: 'story',
  effectHints: effectResolution.accepted,
  source: 'director'
});
```

Use `pressure.game` instead of `effectResolution.game` when building `nextGame`. Add `timeResult: pressure.timeResult` to `turnResult.ruleResult`.

- [ ] **Step 5: Add time pressure to prompt context**

In `backend/src/llm/prompts/storyDirectorPrompt.js`, add system constraints:

```js
'必须承认时间流逝，不要让连续剧情都像同一天。',
'寿元低于 45% 时，要体现命火、白发、闭关成本或大限压力。',
'寿元低于 20% 时，选项要更强调取舍：冒险推进、闭关续命、求助 NPC。',
'可以暗示耗时更久、风险更高、可能养命，但不得输出具体数值。',
```

Add to `pickContext(game)`:

```js
timePressure: pickTimePressure(game.timePressure, game)
```

Implement:

```js
function pickTimePressure(timePressure = {}, game = {}) {
  const player = game.player ?? {};
  const maxLifespan = player.maxLifespan ?? timePressure.maxLifespan ?? 1;
  const remainingLifespan = player.lifespan ?? timePressure.remainingLifespan ?? 0;
  return {
    calendarLabel: text(timePressure.calendarLabel),
    elapsedYears: Number.isFinite(timePressure.elapsedYears) ? timePressure.elapsedYears : 0,
    remainingLifespan,
    maxLifespan,
    lifespanRatio: maxLifespan > 0 ? remainingLifespan / maxLifespan : 0,
    warningLevel: text(timePressure.warningLevel || 'steady'),
    lastDeltaTime: text(timePressure.lastDeltaTime),
    lastLifespanCost: Number.isFinite(timePressure.lastLifespanCost) ? timePressure.lastLifespanCost : 0,
    lastLongevityGain: Number.isFinite(timePressure.lastLongevityGain) ? timePressure.lastLongevityGain : 0,
    lastNetLifespanDelta: Number.isFinite(timePressure.lastNetLifespanDelta) ? timePressure.lastNetLifespanDelta : 0,
    recentRecoveryFatigue: Number.isFinite(timePressure.recentRecoveryFatigue) ? timePressure.recentRecoveryFatigue : 0
  };
}
```

- [ ] **Step 6: Record time in story memory**

In `src/storyMemory.js`, extend `buildRecentTurn()`:

```js
timeLabel: meaningfulText(after?.timePressure?.lastDeltaTime, ''),
netLifespanDelta: Number.isFinite(after?.timePressure?.lastNetLifespanDelta) ? after.timePressure.lastNetLifespanDelta : 0,
warningLevel: meaningfulText(after?.timePressure?.warningLevel, '')
```

Extend `sanitizeRecentTurns()` and `openingRecentTurns()` with those same fields. Extend `pickRecentTurn()` in the prompt to include the three fields.

- [ ] **Step 7: Verify Task 7**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/director-effect-hints.test.js tests/story-director-prompt.test.js tests/story-memory.test.js tests/backend-api.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit Task 7**

```bash
git add backend/src/domain/director/effectHints.js backend/src/app.js backend/src/llm/prompts/storyDirectorPrompt.js src/storyMemory.js tests/director-effect-hints.test.js tests/story-director-prompt.test.js tests/story-memory.test.js tests/backend-api.test.js
git commit -m "feat: feed time pressure into story director"
```

### Task 8: Frontend Time Pressure And History UI

**Files:**
- Modify: `frontend/src/api/gameApi.js`
- Modify: `frontend/src/app.js`
- Modify: `frontend/src/styles.css`
- Modify: `tests/frontend-api.test.js`
- Modify: `tests/frontend-event-state.test.js`
- Modify: `tests/frontend-views.test.js`

**Interfaces:**
- Consumes: `game.timePressure`, `game.ending`, and `turnResult.ruleResult.timeResult`
- Produces: player-facing history lines like `历时半年 · 寿元 +2`
- Produces: ending panel with `查看传记` and `重开`

- [ ] **Step 1: Add frontend API and source tests**

Add to `tests/frontend-api.test.js`:

```js
test('frontend api preserves public time result without raw backend fields', async () => {
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: async () => sseResponse([
      ['done', {
        ok: true,
        data: {
          game: {
            mode: 'api',
            turn: 4,
            version: 4,
            player: { name: '顾清河', lifespan: 42, maxLifespan: 116 },
            timePressure: { lastDeltaTime: '半年', warningLevel: 'strained' },
            log: [{ id: 'turn-4', title: '调息养命', command: '继续', body: '命火回稳。' }]
          },
          turnResult: {
            ruleResult: {
              timeResult: { label: '半年', netLifespanDelta: 2, maxLifespanDelta: 0, warningLevel: 'strained', note: '命火回稳。', deltaMonths: 6 }
            },
            choices: []
          }
        },
        error: null,
        requestId: 'req_time'
      }]
    ])
  });

  const result = await api.continueStoryStream({ mode: 'api', turn: 3, version: 3 });

  assert.equal(result.turnResult.ruleResult.timeResult.label, '半年');
  assert.equal(result.turnResult.ruleResult.timeResult.netLifespanDelta, 2);
  assert.equal('deltaMonths' in result.turnResult.ruleResult.timeResult, false);
});
```

Add source assertions to `tests/frontend-event-state.test.js`:

```js
assert.match(source, /function formatTimePressureSummary/);
assert.match(source, /function renderEndingPanel/);
assert.match(source, /命簿终章/);
assert.doesNotMatch(source, /deltaMonths|timeCost|effectHints/);
```

- [ ] **Step 2: Run failing frontend tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-api.test.js tests/frontend-event-state.test.js tests/frontend-views.test.js
```

Expected: FAIL because the frontend does not normalize/display time pressure yet.

- [ ] **Step 3: Normalize public time result in frontend API**

In `frontend/src/api/gameApi.js`, add:

```js
function normalizePublicTimeResult(timeResult = {}) {
  return {
    label: String(timeResult.label ?? ''),
    netLifespanDelta: Number.isFinite(timeResult.netLifespanDelta) ? timeResult.netLifespanDelta : 0,
    maxLifespanDelta: Number.isFinite(timeResult.maxLifespanDelta) ? timeResult.maxLifespanDelta : 0,
    warningLevel: String(timeResult.warningLevel ?? ''),
    note: String(timeResult.note ?? '')
  };
}
```

In `withStoryResult(data, mode)` and daily-action stream result normalization, wrap:

```js
ruleResult: {
  ...(data.turnResult?.ruleResult ?? {}),
  timeResult: normalizePublicTimeResult(data.turnResult?.ruleResult?.timeResult)
}
```

Ensure `normalizePublicChoices()` still strips `effectHints`.

- [ ] **Step 4: Render top time pressure summary**

In `frontend/src/app.js`, update `renderStory()` so top date uses:

```js
nodes.gameDate.textContent = formatTopTimeLabel(game);
```

Add:

```js
function formatTopTimeLabel(targetGame = game) {
  const calendar = targetGame.timePressure?.calendarLabel || formatDate(targetGame.calendar);
  const lifespanNow = targetGame.player?.lifespan ?? targetGame.player?.maxLifespan ?? 0;
  const lifespanMax = targetGame.player?.maxLifespan ?? lifespanNow;
  return `${calendar} | 余寿 ${lifespanNow}年 / 大限 ${lifespanMax}年`;
}
```

Update the lifespan metric note in `renderStatusOverview()`:

```js
note: formatTimePressureSummary(game)
```

Add:

```js
function formatTimePressureSummary(targetGame = game) {
  const pressure = targetGame.timePressure ?? {};
  if (targetGame.ending) return targetGame.ending.body;
  const level = pressure.warningLevel ?? 'steady';
  const prefix = pressure.lastDeltaTime ? `本回合历时${pressure.lastDeltaTime}。` : '';
  const textByLevel = {
    steady: '命火尚盛，仍有余地布局。',
    strained: '命火渐弱，行事务必克制。',
    danger: '大限逼近，需尽快破局。',
    critical: '命火将熄，每一步都在折损余寿。',
    ended: '命火已尽。'
  };
  return `${prefix}${textByLevel[level] ?? textByLevel.steady}`;
}
```

- [ ] **Step 5: Add time summaries to history cards**

In `markHistoryRefreshed(targetGame)`, attach `effectsSummary` from the latest `timeResult` when available:

```js
function decorateLatestHistoryWithTimeResult(targetGame, turnResult) {
  const latest = targetGame.log.at(-1);
  const timeResult = turnResult?.ruleResult?.timeResult;
  if (!latest || !timeResult) return targetGame;
  return {
    ...targetGame,
    log: [
      ...targetGame.log.slice(0, -1),
      {
        ...latest,
        effectsSummary: buildTimeResultSummary(timeResult)
      }
    ]
  };
}
```

Call it when applying results from `submitDailyActionStream()`, `continueStoryStream()`, and `chooseStoryStream()`.

Add:

```js
function buildTimeResultSummary(timeResult = {}) {
  const parts = [];
  if (timeResult.label) parts.push(`历时${timeResult.label}`);
  if (timeResult.netLifespanDelta) {
    parts.push(`寿元 ${timeResult.netLifespanDelta > 0 ? '+' : ''}${timeResult.netLifespanDelta}`);
  }
  if (timeResult.maxLifespanDelta) {
    parts.push(`大限 ${timeResult.maxLifespanDelta > 0 ? '+' : ''}${timeResult.maxLifespanDelta}`);
  }
  if (timeResult.note) parts.push(timeResult.note);
  return parts.length ? [parts.join(' · ')] : [];
}
```

- [ ] **Step 6: Render ending state**

In `renderHomeView()` or the central active view router, if `game.ending` exists, render `renderEndingPanel()` above history and do not render active action buttons:

```js
function renderEndingPanel() {
  return renderPanel({
    className: 'ending-section',
    title: game.ending?.title ?? '命簿终章',
    meta: '本局已结',
    body: `
      <p>${game.ending?.body ?? '命火已尽。'}</p>
      <div class="ending-actions">
        <button type="button" data-export-story="true">查看传记</button>
        <button type="button" data-reset-game="true">重开</button>
      </div>
    `
  });
}
```

Wire `data-reset-game` to the existing reset flow and `data-export-story` to existing export behavior.

- [ ] **Step 7: Add compact styles**

In `frontend/src/styles.css`, add:

```css
.ending-section {
  border-color: rgba(168, 69, 55, 0.34);
  background: rgba(255, 248, 238, 0.92);
}

.ending-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.ending-actions button {
  min-height: 44px;
  padding: 0 18px;
}

.effects-summary span {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
}
```

- [ ] **Step 8: Verify Task 8**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-api.test.js tests/frontend-event-state.test.js tests/frontend-views.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit Task 8**

```bash
git add frontend/src/api/gameApi.js frontend/src/app.js frontend/src/styles.css tests/frontend-api.test.js tests/frontend-event-state.test.js tests/frontend-views.test.js
git commit -m "feat: show time pressure in frontend"
```

### Task 9: Full Integration Sweep And README Notes

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: documented gameplay rule summary and dev commands
- Produces: full regression evidence

- [ ] **Step 1: Add README gameplay and command notes**

Append or update a concise section in `README.md`:

````md
## 时间与寿元规则

- 正式角色进入洞府后，每次主页推进都会消耗一段游戏内时间。
- 境界越高，闭关、探秘、推演剧情和突破耗时越长。
- 后端按规则结算寿元、寿元上限、突破成功率、调养递减和死亡结局；大模型只负责剧情和模糊选项意图。
- 调息、灵药、功法和关键奇遇可以恢复当前寿元；普通调息不会提高寿元上限。
- 突破成功会恢复寿元并提高寿元上限，突破失败会消耗时间、气血、寿元和修为进度。
- 寿元归零进入“命簿终章”，玩家可以查看传记或重开。

## 本地调试命令

后端：

```bash
pnpm start:backend
```

前端：

```bash
pnpm start:frontend
```

测试：

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```
````

- [ ] **Step 2: Run targeted backend suite**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/time-calendar.test.js tests/time-cost.test.js tests/longevity.test.js tests/time-pressure.test.js tests/progression.test.js tests/breakthrough.test.js tests/director-effect-hints.test.js tests/story-director-prompt.test.js tests/story-memory.test.js tests/backend-api.test.js
```

Expected: PASS.

- [ ] **Step 3: Run targeted frontend suite**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-api.test.js tests/frontend-event-state.test.js tests/frontend-views.test.js tests/frontend-app-wiring.test.js tests/frontend-layout.test.js
```

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```

Expected: PASS with all tests passing.

- [ ] **Step 5: Check player-facing source for forbidden raw fields**

Run:

```bash
rg -n "deltaMonths|timeCost|effectHints|eventId|choiceId|target|direction|intensity|apiKey|baseUrl|debug" frontend/src frontend/index.html
```

Expected: no player-facing render path exposes these strings. Test code and backend files may still contain internal field names.

- [ ] **Step 6: Check diff hygiene**

Run:

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors. Status may still show pre-existing unrelated uncommitted files; stage only files changed for this time-pressure implementation.

- [ ] **Step 7: Commit Task 9**

```bash
git add README.md
git commit -m "docs: document time pressure gameplay"
```

---

## Self-Review Checklist

- Spec coverage:
  - Month-based time model: Tasks 1, 2, 4.
  - Realm time scaling through 金丹 with high-realm reserves: Tasks 2, 6.
  - Positive time and longevity recovery: Tasks 3, 4, 8.
  - Anti-farming and medicine resistance: Task 3.
  - Breakthrough lifespan rewards/failure pressure: Task 6.
  - Director context and vague effect hints: Task 7.
  - Frontend history/top-status/end-state UX: Task 8.
  - README/dev command documentation: Task 9.
- No placeholder task remains; every task has concrete files, commands, and expected results.
- Public UI remains protected from backend/debug fields by Task 8 tests and Task 9 search.
- Implementation should proceed task-by-task with one commit per task; do not batch unrelated dirty work into these commits.
