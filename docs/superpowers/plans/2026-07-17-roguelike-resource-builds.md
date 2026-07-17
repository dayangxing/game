# Roguelike Resource Builds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the fixed technique and treasure rewards into an event-driven Roguelike build system with deterministic three-card drafts, tag resonances, and persisted discovery progress.

**Architecture:** Keep `game.techniques` and `game.treasures` as the authoritative active-run collections for backward compatibility. Add focused resource catalog, draft, and progression modules; event choices request a draft from a named narrative pool, while the server owns candidate selection and resource IDs. Preserve meta discovery when a run ends or resets, and render public resource cards without exposing internal pool rules or random seeds.

**Tech Stack:** Node.js ESM, `node:test`, existing backend event/effect pipeline, vanilla frontend modules, existing save store and HTTP action contract.

## Global Constraints

- This iteration changes only techniques, treasures, their event rewards, and their UI; no sect catalog or sect route system.
- Rule code owns resource IDs, pools, bonuses, random seeds, and acquisition; the LLM only narrates already-authoritative state.
- Ordinary cultivation, breakthroughs, lifespan consumption, and chapter advancement never create a resource draft.
- Existing resource IDs `qingmu_jue`, `mist_step`, `calm_lotus_incense`, and `tiger_bone_guard` remain valid and retain their tested bonuses.
- Draft ordering is deterministic from the game seed, source event ID, and resolved turn.
- A resource draft selection consumes no additional turn and no additional lifespan.
- Run resources are cleared at run end/reset; discovery, unlock lists, run count, and best chapter remain.
- Do not expose resource IDs, pool IDs, random seeds, or internal effect hints in public UI copy.
- Every task is implemented test-first and ends with a focused test command plus a small commit on `dev`.

---

## File Map

| File | Responsibility |
| --- | --- |
| `backend/src/domain/resources/resourceCatalog.js` | Technique/treasure definitions, resource pools, resonance definitions, and bonus-key validation. |
| `backend/src/domain/resources/resourceDraft.js` | Deterministic candidate generation and draft selection metadata. |
| `backend/src/domain/resources/resourceProgress.js` | Run-state normalization, acquisition logs, meta discovery, and run reset/finalization. |
| `backend/src/domain/rewards.js` | Existing grant APIs plus derived bonus and resonance aggregation; re-exports catalog constants for compatibility. |
| `backend/src/domain/characterCreation.js` | Initializes empty active resource collections and resource run/meta state for formal games. |
| `backend/src/domain/events/effectResolver.js` | Accepts `resourceDraft` requests, applies cultivation-gain bonuses, and preserves effect preflight behavior. |
| `backend/src/domain/events/eventCatalog.js` | Adds resource-pool helper and five narrative resource discoveries; keeps fixed anchor rewards explicit. |
| `backend/src/domain/progression.js` | Applies active `damageReduction` to breakthrough failure health loss. |
| `backend/src/app.js` | Normalizes resource state, blocks ordinary actions while a draft is pending, resolves draft actions, and preserves meta progress on reset/endings. |
| `frontend/src/ui/resourceDraft.js` | Pure public draft-card and resonance rendering helpers. |
| `frontend/src/app.js` | Integrates draft rendering, resource source labels, active resonances, and terminal summaries into existing views. |
| `frontend/src/api/gameApi.js` | Preserves public draft fields and sends opaque draft action IDs through the existing turn API. |
| `tests/resource-catalog.test.js` | Catalog size, unique IDs, pool references, and bonus whitelist tests. |
| `tests/resource-draft.test.js` | Deterministic offers, filtering, fallback compensation, and public-field safety tests. |
| `tests/resource-progress.test.js` | Run reset/finalization, acquisition logs, legacy normalization, and meta discovery tests. |
| `tests/rewards.test.js` | Resource grants, derived bonuses, and resonance calculations. |
| `tests/resource-events.test.js` | Event-pool requests and the no-breakthrough-drop contract. |
| `tests/backend-api.test.js` | Pending draft action API, opaque IDs, no extra time cost, and persistence behavior. |
| `tests/frontend-resource-builds.test.js` | Draft card, resource card, source label, resonance, and terminal-summary UI contracts. |

## Task 1: Add the authoritative resource catalog

**Files:**
- Create: `backend/src/domain/resources/resourceCatalog.js`
- Create: `tests/resource-catalog.test.js`

**Interfaces:**
- Produces `RESOURCE_BONUS_KEYS`, `TECHNIQUE_CATALOG`, `TREASURE_CATALOG`, `RESOURCE_POOL_CATALOG`, `RESONANCE_CATALOG`, `getResourceById(kind, id)`, and `validateResourceCatalog()`.
- `getResourceById('technique', 'qingmu_jue')` returns the catalog entry; unknown IDs return `undefined`.
- Each catalog entry exposes `id`, `name`, `grade`, `type`, `realmAtLeast`, `tags`, `description`, `detail`, and a `bonuses` object containing only keys from `RESOURCE_BONUS_KEYS`.

- [ ] **Step 1: Write the failing catalog tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESOURCE_BONUS_KEYS,
  RESOURCE_POOL_CATALOG,
  TECHNIQUE_CATALOG,
  TREASURE_CATALOG,
  validateResourceCatalog
} from '../backend/src/domain/resources/resourceCatalog.js';

test('catalog contains eight techniques and eight treasures with stable ids', () => {
  assert.equal(Object.keys(TECHNIQUE_CATALOG).length, 8);
  assert.equal(Object.keys(TREASURE_CATALOG).length, 8);
  assert.equal(TECHNIQUE_CATALOG.qingmu_jue.name, '青木诀');
  assert.equal(TREASURE_CATALOG.calm_lotus_incense.name, '静心莲香');
  assert.doesNotThrow(() => validateResourceCatalog());
});

test('every pool has four or more valid resources and every bonus key is whitelisted', () => {
  for (const pool of Object.values(RESOURCE_POOL_CATALOG)) {
    assert.ok(pool.resourceIds.length >= 4);
    assert.ok(pool.narrativeReason.length > 0);
  }
  for (const entry of [...Object.values(TECHNIQUE_CATALOG), ...Object.values(TREASURE_CATALOG)]) {
    assert.ok(entry.tags.length >= 2);
    assert.ok(Object.keys(entry.bonuses).every((key) => RESOURCE_BONUS_KEYS.includes(key)));
  }
});

test('resonance tags have distinct two-item and three-item effects', () => {
  for (const resonance of Object.values(RESONANCE_CATALOG)) {
    assert.equal(resonance.thresholds[2] !== undefined, true);
    assert.equal(resonance.thresholds[3] !== undefined, true);
    assert.notDeepEqual(resonance.thresholds[2], resonance.thresholds[3]);
  }
});
```

- [ ] **Step 2: Run the focused test to verify the missing module fails**

Run: `node --test tests/resource-catalog.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `resourceCatalog.js`.

- [ ] **Step 3: Implement the catalog and validators**

Create the two existing techniques and treasures unchanged, then add the six techniques and six treasures from the approved design. Use these exact additional IDs and bonus profiles:

```js
const TECHNIQUE_BONUSES = {
  thunder_pulse_manual: { cultivationGain: 4, breakthroughChance: 1 },
  crimson_sword_intent: { breakthroughChance: 2, damageReduction: 4 },
  earth_veil_body: { maxHealth: 10, damageReduction: 2 },
  danxin_nourishing: { maxLifespan: 8, cultivationGain: 3 },
  taixu_heart_mirror: { breakthroughChance: 4, damageReduction: 2 },
  moonwater_returning_tide: { maxLifespan: 5, maxHealth: 4 }
};

const TREASURE_BONUSES = {
  bronze_bell_fragment: { breakthroughChance: 2, damageReduction: 2 },
  lifespan_lamp_core: { maxLifespan: 10 },
  danxia_jade_furnace: { cultivationGain: 3, maxHealth: 3 },
  taixu_star_disk: { breakthroughChance: 4 },
  spiritwood_heart: { maxHealth: 5, maxLifespan: 4 },
  mist_veil: { damageReduction: 6, maxHealth: 2 }
};
```

Assign tags so every approved resonance is reachable: `雷法` appears on `thunder_pulse_manual` and `bronze_bell_fragment`; `炼体` appears on `tiger_bone_guard`, `earth_veil_body`, and `crimson_sword_intent`; `雾隐` appears on `mist_step`, `bronze_bell_fragment`, and `mist_veil`; `养元` and `神识` each appear on at least three entries. Define the five pools and five resonance levels exactly as the design document specifies.

- [ ] **Step 4: Run the focused tests to verify the catalog is green**

Run: `node --test tests/resource-catalog.test.js`
Expected: all catalog tests pass.

- [ ] **Step 5: Commit the catalog**

```bash
git add backend/src/domain/resources/resourceCatalog.js tests/resource-catalog.test.js
git commit -m "feat: add roguelike resource catalog"
```

## Task 2: Normalize active-run resources and persistent discovery

**Files:**
- Create: `backend/src/domain/resources/resourceProgress.js`
- Modify: `backend/src/domain/characterCreation.js`
- Create: `tests/resource-progress.test.js`

**Interfaces:**
- `normalizeResourceState(game)` returns a game with `techniques`, `treasures`, `resourceRun`, and `metaProgress`.
- `recordResourceAcquisition(game, { kind, resourceId, eventId, eventTitle, turn })` adds one acquisition log and first-time discovery/unlock IDs without duplicating them.
- `finalizeRun(game, { chapterId })` merges active-run IDs into meta progress, increments `runCount`, updates `bestChapter`, then clears active resources and pending drafts.
- `resetRunResources(game)` clears only active techniques, treasures, acquisition log, active resonances, and pending draft.

- [ ] **Step 1: Write failing normalization and lifecycle tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.js';
import {
  finalizeRun,
  normalizeResourceState,
  recordResourceAcquisition,
  resetRunResources
} from '../backend/src/domain/resources/resourceProgress.js';

test('legacy games receive empty resource run and meta progress state', () => {
  const normalized = normalizeResourceState({ ...createGame(17), techniques: undefined, treasures: undefined });
  assert.deepEqual(normalized.techniques, []);
  assert.deepEqual(normalized.treasures, []);
  assert.deepEqual(normalized.resourceRun.pendingDraft, null);
  assert.deepEqual(normalized.metaProgress.discoveredTechniques, []);
});

test('first acquisition is logged and discovered once', () => {
  const game = normalizeResourceState(createGame(17));
  const next = recordResourceAcquisition(game, {
    kind: 'technique',
    resourceId: 'qingmu_jue',
    eventId: 'master_guidance',
    eventTitle: '长老指点',
    turn: 4
  });
  const twice = recordResourceAcquisition(next, {
    kind: 'technique',
    resourceId: 'qingmu_jue',
    eventId: 'master_guidance',
    eventTitle: '长老指点',
    turn: 5
  });
  assert.equal(twice.resourceRun.acquisitionLog.length, 2);
  assert.deepEqual(twice.metaProgress.discoveredTechniques, ['qingmu_jue']);
  assert.deepEqual(twice.metaProgress.unlockedTechniques, ['qingmu_jue']);
});

test('finalizing and resetting a run preserves meta progress but clears active resources', () => {
  const game = normalizeResourceState({ ...createGame(17), techniques: [{ id: 'qingmu_jue' }], treasures: [] });
  const finalized = finalizeRun(game, { chapterId: 'foundation' });
  assert.deepEqual(finalized.techniques, []);
  assert.deepEqual(finalized.treasures, []);
  assert.deepEqual(finalized.metaProgress.discoveredTechniques, ['qingmu_jue']);
  assert.equal(finalized.metaProgress.runCount, 1);
  assert.equal(finalized.metaProgress.bestChapter, 'foundation');
  assert.equal(resetRunResources(finalized).metaProgress.runCount, 1);
});
```

- [ ] **Step 2: Run the tests to verify the lifecycle functions are absent**

Run: `node --test tests/resource-progress.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `resourceProgress.js`.

- [ ] **Step 3: Implement normalization and lifecycle functions**

Use these exact initial shapes:

```js
const EMPTY_RESOURCE_RUN = {
  pendingDraft: null,
  activeResonances: [],
  resolvedDraftIds: [],
  acquisitionLog: [],
  finalizedRunId: null
};

const EMPTY_META_PROGRESS = {
  discoveredTechniques: [],
  discoveredTreasures: [],
  unlockedTechniques: [],
  unlockedTreasures: [],
  runCount: 0,
  bestChapter: null
};
```

Normalize arrays with `new Set`, copy objects before mutation, and keep unknown legacy resource entries in active arrays while excluding them from discovery and resonance lookup. In `applyCharacterToGame`, initialize `techniques: []`, `treasures: []`, `resourceRun: EMPTY_RESOURCE_RUN`, and `metaProgress: EMPTY_META_PROGRESS`. `finalizeRun` must return the existing game unchanged when `finalizedRunId` already matches the current run ID, then set that marker when it first merges the run.

- [ ] **Step 4: Run the lifecycle tests and the existing character tests**

Run: `node --test tests/resource-progress.test.js tests/onboarding-character.test.js`
Expected: all focused and existing character tests pass.

- [ ] **Step 5: Commit the run-state boundary**

```bash
git add backend/src/domain/resources/resourceProgress.js backend/src/domain/characterCreation.js tests/resource-progress.test.js
git commit -m "feat: persist roguelike resource discovery"
```

## Task 3: Add derived resource bonuses and resonances

**Files:**
- Modify: `backend/src/domain/rewards.js`
- Modify: `backend/src/domain/events/effectResolver.js`
- Modify: `backend/src/domain/progression.js`
- Modify: `tests/rewards.test.js`
- Create: `tests/resource-bonuses.test.js`

**Interfaces:**
- `calculateResonances(game)` returns `{ activeResonances, bonuses }` using catalog tags and highest threshold per tag.
- `calculateDerivedBonuses(game)` sums known resource bonuses and resonance bonuses.
- Existing `grantTechnique` and `grantTreasure` continue to reject unknown IDs and remain idempotent.

- [ ] **Step 1: Write failing bonus and resonance tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.js';
import { calculateDerivedBonuses, calculateResonances } from '../backend/src/domain/rewards.js';
import { applyEffects } from '../backend/src/domain/events/effectResolver.js';
import { resolveBreakthrough } from '../backend/src/domain/progression.js';

test('two matching tags activate the small resonance without mutating catalog entries', () => {
  const game = {
    ...createGame(31),
    techniques: [{ id: 'thunder_pulse_manual' }],
    treasures: [{ id: 'bronze_bell_fragment' }]
  };
  const result = calculateResonances(game);
  assert.deepEqual(result.activeResonances.map((entry) => entry.id), ['thunder_resonance']);
  assert.equal(result.bonuses.breakthroughChance, 4);
});

test('cultivation gain applies only to positive cultivation progress effects', () => {
  const game = {
    ...createGame(31),
    techniques: [{ id: 'thunder_pulse_manual' }],
    player: { ...createGame(31).player, cultivationProgress: 10 }
  };
  const gained = applyEffects(game, [{ type: 'stat', path: 'player.cultivationProgress', delta: 8 }]);
  const lost = applyEffects(gained, [{ type: 'stat', path: 'player.cultivationProgress', delta: -8 }]);
  assert.equal(gained.player.cultivationProgress, 14);
  assert.equal(lost.player.cultivationProgress, 6);
});

test('damage reduction lowers breakthrough failure health cost but never removes it', () => {
  const base = {
    ...createGame(31),
    techniques: [{ id: 'earth_veil_body' }],
    player: { ...createGame(31).player, cultivationProgress: 100, health: 100, maxHealth: 100 }
  };
  const result = resolveBreakthrough(base, new Date('2026-07-17T00:00:00.000Z'));
  assert.ok(result.game.player.health <= 100);
  assert.ok(result.game.player.health >= 99);
});
```

- [ ] **Step 2: Run the focused tests to verify the new behavior fails**

Run: `node --test tests/rewards.test.js tests/resource-bonuses.test.js`
Expected: the new resonance and bonus assertions fail while the existing reward tests continue to identify the old baseline behavior.

- [ ] **Step 3: Implement derived bonus aggregation and numeric hooks**

Import the catalogs into `rewards.js`, preserve existing deep-equal output for games without resonances, append `calculateResonances(game).bonuses` after item bonuses, and write the returned `activeResonances` into `game.resourceRun.activeResonances` whenever `syncRewardState` runs. In `effectResolver.js`, when applying a positive `player.cultivationProgress` stat effect, add `derivedBonuses.cultivationGain` before updating the path. In `progression.js`, calculate the effective failure health cost as:

```js
const mitigation = Math.floor((game.derivedBonuses?.damageReduction ?? 0) / 2);
const healthLoss = Math.max(1, failureCost.health - mitigation);
```

Keep `breakthroughChance`, `maxHealth`, and `maxLifespan` on their existing paths.

- [ ] **Step 4: Run all reward and progression tests**

Run: `node --test tests/rewards.test.js tests/resource-bonuses.test.js tests/progression.test.js tests/breakthrough.test.js`
Expected: all tests pass with existing values unchanged for the old two resources.

- [ ] **Step 5: Commit the bonus system**

```bash
git add backend/src/domain/rewards.js backend/src/domain/events/effectResolver.js backend/src/domain/progression.js tests/rewards.test.js tests/resource-bonuses.test.js
git commit -m "feat: add resource resonances and build bonuses"
```

## Task 4: Implement deterministic resource drafts

**Files:**
- Create: `backend/src/domain/resources/resourceDraft.js`
- Create: `tests/resource-draft.test.js`

**Interfaces:**
- `createResourceDraft({ game, poolId, sourceEventId, sourceEventTitle, reason, turn })` returns a normalized game with `resourceRun.pendingDraft` and three internal candidates.
- `resourceRun.pendingDraft` has `{ id, poolId, sourceEventId, sourceEventTitle, reason, candidates, actions, createdTurn }`; each internal action has an opaque `id` and a server-only `resourceId`.
- `getPublicResourceDraft(draft)` returns source text and card display fields but no `resourceId`, `poolId`, seed, bonuses object, or internal rule fields.
- `resolveResourceDraft({ game, draftActionId, turn })` returns `{ game, selected, entry }` and records the acquisition without changing time/lifespan.

- [ ] **Step 1: Write failing deterministic draft tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.js';
import {
  createResourceDraft,
  getPublicResourceDraft,
  resolveResourceDraft
} from '../backend/src/domain/resources/resourceDraft.js';

test('same seed, event and turn produce the same three candidates', () => {
  const game = createGame(73);
  const first = createResourceDraft({ game, poolId: 'mistRelics', sourceEventId: 'mist_relic_cache', sourceEventTitle: '雾中遗物', reason: '雾灯下的遗物', turn: 6 });
  const second = createResourceDraft({ game, poolId: 'mistRelics', sourceEventId: 'mist_relic_cache', sourceEventTitle: '雾中遗物', reason: '雾灯下的遗物', turn: 6 });
  assert.deepEqual(first.resourceRun.pendingDraft.candidates, second.resourceRun.pendingDraft.candidates);
  assert.equal(first.resourceRun.pendingDraft.candidates.length, 3);
});

test('owned resources are filtered before filling the draft', () => {
  const game = { ...createGame(73), techniques: [{ id: 'mist_step' }], treasures: [{ id: 'calm_lotus_incense' }] };
  const next = createResourceDraft({ game, poolId: 'mistRelics', sourceEventId: 'mist_relic_cache', sourceEventTitle: '雾中遗物', reason: '雾灯下的遗物', turn: 6 });
  assert.equal(next.resourceRun.pendingDraft.candidates.some((entry) => entry.id === 'mist_step'), false);
  assert.equal(next.resourceRun.pendingDraft.candidates.some((entry) => entry.id === 'calm_lotus_incense'), false);
});

test('public draft fields are player-facing and resource selection does not advance time', () => {
  const game = createResourceDraft({ game: createGame(73), poolId: 'mistRelics', sourceEventId: 'mist_relic_cache', sourceEventTitle: '雾中遗物', reason: '雾灯下的遗物', turn: 6 });
  const publicDraft = getPublicResourceDraft(game.resourceRun.pendingDraft);
  assert.equal(publicDraft.reason, '雾灯下的遗物');
  assert.equal(publicDraft.options.length, 3);
  assert.equal(JSON.stringify(publicDraft).includes('poolId'), false);
  assert.equal(JSON.stringify(publicDraft).includes('seed'), false);
  const selected = resolveResourceDraft({ game, draftActionId: game.resourceRun.pendingDraft.actions[0].id, turn: 6 });
  assert.equal(selected.game.turn, game.turn);
  assert.equal(selected.game.resourceRun.pendingDraft, null);
});
```

- [ ] **Step 2: Run the draft tests to verify the module is missing**

Run: `node --test tests/resource-draft.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `resourceDraft.js`.

- [ ] **Step 3: Implement seeded candidate generation and opaque actions**

Use a local deterministic hash/RNG derived from `${game.seed}:${sourceEventId}:${turn}`. Filter by `realmAtLeast`, current active IDs, and pool membership. Shuffle candidates with the seeded RNG, select three, and create opaque action IDs such as `resource_${turn}_${index}_${hash}`. If the pool has fewer than three eligible entries, backfill from pools sharing the event pool tags; if still short, append a clearly labeled `灵石补偿` option with no resource ID.

- [ ] **Step 4: Run the draft tests and legacy reward tests**

Run: `node --test tests/resource-draft.test.js tests/rewards.test.js tests/resource-progress.test.js`
Expected: all tests pass and no catalog object is mutated with acquisition data.

- [ ] **Step 5: Commit the draft engine**

```bash
git add backend/src/domain/resources/resourceDraft.js tests/resource-draft.test.js
git commit -m "feat: add deterministic resource drafts"
```

## Task 5: Connect resource drafts to narrative events

**Files:**
- Modify: `backend/src/domain/events/effectResolver.js`
- Modify: `backend/src/domain/events/eventCatalog.js`
- Create: `tests/resource-events.test.js`

**Interfaces:**
- Event helper `resourceDraft(poolId, reason)` returns `{ type: 'resourceDraft', poolId, reason }`.
- `resolveChoice` turns a `resourceDraft` request into a pending draft only after the normal event effects and time result are applied.
- Five new resource discoveries are available through the existing event selector: `mist_relic_cache`, `scripture_archive_cache`, `alchemy_hidden_fire`, `beast_bone_reliquary`, and `ancient_ruins_starfall`.

- [ ] **Step 1: Write failing event tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_CATALOG } from '../backend/src/domain/events/eventCatalog.js';
import { resolveChoice } from '../backend/src/domain/events/effectResolver.js';
import { createGame } from '../src/engine.js';

test('each resource discovery event references a valid resource pool', () => {
  const ids = ['mist_relic_cache', 'scripture_archive_cache', 'alchemy_hidden_fire', 'beast_bone_reliquary', 'ancient_ruins_starfall'];
  for (const id of ids) {
    const event = EVENT_CATALOG.find((entry) => entry.id === id);
    assert.ok(event);
    assert.ok(event.choices.some((choice) => choice.success.effects.some((effect) => effect.type === 'resourceDraft')));
  }
});

test('an event resource draft is pending after the event but breakthrough has no draft', () => {
  const event = EVENT_CATALOG.find((entry) => entry.id === 'mist_relic_cache');
  const resolved = resolveChoice({ game: createGame(73), event, choice: event.choices[0], now: new Date('2026-07-17T00:00:00.000Z') });
  assert.equal(resolved.game.resourceRun.pendingDraft.poolId, 'mistRelics');
  assert.equal(resolved.game.resourceRun.pendingDraft.sourceEventId, 'mist_relic_cache');
});
```

- [ ] **Step 2: Run the event tests to verify the helper and events are absent**

Run: `node --test tests/resource-events.test.js`
Expected: FAIL because the five event IDs and `resourceDraft` effect do not exist.

- [ ] **Step 3: Add the resource effect and five event definitions**

Add `resourceDraft(poolId, reason)` beside the existing event helpers. In `applyEffect`, store a request under `resourceRun.draftRequest` without granting a resource. In `resolveChoice`, after the turn is assigned, call `createResourceDraft` using the request, the resolved event ID/title, and the new turn, then clear `draftRequest`.

Add one claim choice and one non-claim choice for each event. Use these exact pool bindings and story locations: `mist_relic_cache -> mistRelics` in 雾隐秘境, `scripture_archive_cache -> scriptureArchive` in 藏经阁, `alchemy_hidden_fire -> alchemyFinds` in 丹房, `beast_bone_reliquary -> beastSpoils` in 巡山遗迹, and `ancient_ruins_starfall -> ancientRuins` in 古修遗府. The claim choice text must name the discovered scene and the non-claim choice must not create a draft.

- [ ] **Step 4: Run event, selector, and breakthrough tests**

Run: `node --test tests/resource-events.test.js tests/event-catalog.test.js tests/event-engine.test.js tests/breakthrough.test.js`
Expected: all tests pass; no `resolveBreakthrough` result contains a new pending draft.

- [ ] **Step 5: Commit event integration**

```bash
git add backend/src/domain/events/effectResolver.js backend/src/domain/events/eventCatalog.js tests/resource-events.test.js
git commit -m "feat: connect resource drafts to adventure events"
```

## Task 6: Expose and resolve pending draft actions through the backend

**Files:**
- Modify: `backend/src/app.js`
- Modify: `backend/src/domain/resources/resourceProgress.js`
- Modify: `tests/backend-api.test.js`

**Interfaces:**
- `GET /api/v1/daily-actions` returns only resource draft actions while `game.resourceRun.pendingDraft` exists.
- `POST /api/v1/turns` accepts an opaque resource draft action ID and resolves it without changing `turn`, lifespan, or time-pressure fields.
- Public resource actions include `category: 'resource'`, `title`, `command`, `meta`, and a player-facing preview; they omit `resourceId`, `poolId`, `seed`, `bonuses`, and internal effect hints.

- [ ] **Step 1: Write failing backend API tests**

Add these tests to `tests/backend-api.test.js` using the existing test app factory and request helpers:

```js
test('pending resource draft blocks ordinary actions and exposes three public choices', async () => {
  const app = createBackendApp({ seed: 73, now: fixedNow });
  const state = app.getState();
  state.game = createResourceDraft({
    game: state.game,
    poolId: 'mistRelics',
    sourceEventId: 'mist_relic_cache',
    sourceEventTitle: '雾中遗物',
    reason: '雾灯下的遗物',
    turn: state.game.turn
  });
  const response = await app.handle(makeRequest('GET', '/api/v1/daily-actions'));
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.data.actions.length, 3);
  assert.equal(payload.data.actions.every((action) => action.category === 'resource'), true);
  assert.equal(JSON.stringify(payload).includes('poolId'), false);
});

test('selecting a resource draft changes the collection without spending a turn', async () => {
  const app = createBackendApp({ seed: 73, now: fixedNow });
  const state = app.getState();
  state.game = createResourceDraft({
    game: state.game,
    poolId: 'mistRelics',
    sourceEventId: 'mist_relic_cache',
    sourceEventTitle: '雾中遗物',
    reason: '雾灯下的遗物',
    turn: state.game.turn
  });
  const before = state.game;
  const actionsResponse = await app.handle(makeRequest('GET', '/api/v1/daily-actions'));
  const actions = await actionsResponse.json();
  const selectedResponse = await app.handle(makeRequest('POST', '/api/v1/turns', {
    actionId: actions.data.actions[0].id,
    clientTurn: before.turn
  }));
  const selected = await selectedResponse.json();
  assert.equal(selectedResponse.status, 200);
  assert.equal(selected.data.game.turn, before.turn);
  assert.equal(selected.data.game.resourceRun.pendingDraft, null);
  assert.equal((selected.data.game.techniques.length + selected.data.game.treasures.length), 1);
});
```

- [ ] **Step 2: Run the backend tests to verify pending drafts are not exposed**

Run: `node --test tests/backend-api.test.js`
Expected: the new tests fail because daily actions do not yet read `pendingDraft`.

- [ ] **Step 3: Add the pending-draft action path**

At the start of daily action construction, normalize resource state and return draft actions when `pendingDraft` exists. In turn resolution, branch on `action.source === 'resourceDraft'` before normal event/breakthrough logic; call `resolveResourceDraft`, persist the returned game, and create a player-facing acquisition entry without calling `applyTimePressure`. Keep the existing stale-turn, consumed-action, and terminal-game checks.

- [ ] **Step 4: Run backend API and persistence tests**

Run: `node --test tests/backend-api.test.js tests/backend-desktop-runtime.test.js tests/resource-progress.test.js`
Expected: all tests pass, including reloads with a pending draft and selection after reload.

- [ ] **Step 5: Commit the backend action contract**

```bash
git add backend/src/app.js backend/src/domain/resources/resourceProgress.js tests/backend-api.test.js
git commit -m "feat: expose resource draft actions"
```

## Task 7: Preserve discovery on endings and resets

**Files:**
- Modify: `backend/src/app.js`
- Modify: `backend/src/domain/endings/endingResolver.js`
- Modify: `tests/ending-resolver.test.js`
- Modify: `tests/resource-progress.test.js`

**Interfaces:**
- Terminal application calls `finalizeRun` exactly once before returning the terminal snapshot.
- `POST /api/v1/game/reset` preserves `metaProgress` but starts a new character shell with empty active resources.
- Repeating terminal resolution or reset is idempotent and does not increment `runCount` twice.

- [ ] **Step 1: Write failing terminal lifecycle tests**

```js
test('terminal resolution records the run once and keeps discovered resources after reset', () => {
  const game = normalizeResourceState({
    ...createGame(41),
    techniques: [{ id: 'taixu_heart_mirror' }],
    ending: { id: 'lifespan_end', status: 'terminal' }
  });
  const once = finalizeRun(game, { chapterId: 'finale' });
  const twice = finalizeRun(once, { chapterId: 'finale' });
  assert.equal(once.metaProgress.runCount, 1);
  assert.equal(twice.metaProgress.runCount, 1);
  assert.deepEqual(twice.metaProgress.unlockedTechniques, ['taixu_heart_mirror']);
  assert.deepEqual(twice.techniques, []);
});
```

- [ ] **Step 2: Run the focused terminal tests to verify duplicate finalization**

Run: `node --test tests/ending-resolver.test.js tests/resource-progress.test.js`
Expected: the new idempotence assertion fails because terminal paths do not yet finalize the resource run.

- [ ] **Step 3: Integrate finalization at the single terminal boundary**

Call `finalizeRun` in the existing terminal-resolution path immediately before storing the terminal game. Add a terminal marker such as `resourceRun.finalizedRunId` so repeated `applyEnding` calls return the already-finalized game. In the reset handler, save the current `metaProgress`, create the existing character shell, and seed the new shell with that meta object only.

- [ ] **Step 4: Run ending, reset, and full state tests**

Run: `node --test tests/ending-resolver.test.js tests/resource-progress.test.js tests/backend-api.test.js tests/game-save-store.test.js`
Expected: all tests pass and existing reset semantics remain intact for saves with no meta progress.

- [ ] **Step 5: Commit lifecycle persistence**

```bash
git add backend/src/app.js backend/src/domain/endings/endingResolver.js tests/ending-resolver.test.js tests/resource-progress.test.js
git commit -m "feat: preserve resource discoveries across runs"
```

## Task 8: Add resource draft and resonance UI

**Files:**
- Create: `frontend/src/ui/resourceDraft.js`
- Modify: `frontend/src/app.js`
- Modify: `frontend/src/api/gameApi.js`
- Create: `tests/frontend-resource-builds.test.js`

**Interfaces:**
- `renderResourceDraft(draft)` returns a player-facing HTML fragment for three candidate cards and source reason.
- `renderResourceCard(resource, source)` returns a card with grade, type, tags, and formatted bonuses without raw IDs.
- `renderResonancePanel(resonances)` returns active and next-threshold resonance text.
- Existing API mode sends the opaque action ID exactly as received and does not invent or forward resource IDs.

- [ ] **Step 1: Write failing frontend rendering tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderResourceCard, renderResourceDraft, renderResonancePanel } from '../frontend/src/ui/resourceDraft.js';

test('resource draft renders source context and three player-facing cards', () => {
  const html = renderResourceDraft({
    reason: '你在雾灯下找到三件可以带走的遗物。',
    options: [
      { actionId: 'opaque-a', name: '雾隐步', grade: '良品', type: '身法', tags: ['雾隐'], bonusText: '突破 +2' },
      { actionId: 'opaque-b', name: '静心莲香', grade: '良品', type: '香', tags: ['养元'], bonusText: '突破 +3' },
      { actionId: 'opaque-c', name: '青铜铃片', grade: '上品', type: '法器', tags: ['雾隐'], bonusText: '失败损失减免' }
    ]
  });
  assert.match(html, /雾灯下找到/);
  assert.equal((html.match(/resource-draft-card/g) ?? []).length, 3);
  assert.doesNotMatch(html, /opaque-a/);
});

test('resonance panel explains active threshold and next threshold', () => {
  const html = renderResonancePanel([{ name: '养元共鸣', count: 2, next: 3, effectText: '寿元上限 +4' }]);
  assert.match(html, /养元共鸣/);
  assert.match(html, /还需 1 件/);
});
```

- [ ] **Step 2: Run the frontend tests to verify the new module is missing**

Run: `node --test tests/frontend-resource-builds.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `frontend/src/ui/resourceDraft.js`.

- [ ] **Step 3: Implement pure render helpers and wire the active views**

Escape all player-facing strings with the existing frontend escape helper. Render `bonusText` from server-provided public text, not from an arbitrary client-side bonus object. Add the pending draft section before ordinary action choices, bind its buttons to the existing delegated action handler, and display acquisition sources in technique/treasure collection cards. Add the active resonance panel to the personal/resource view and add run resources/discoveries to the terminal summary.

- [ ] **Step 4: Preserve opaque action IDs in the API client**

When the API client sees `category === 'resource'`, preserve the action object and submit only `action.id` plus the authoritative client turn. Do not add `resourceId`, `poolId`, `seed`, or bonuses to request bodies or DOM attributes. Keep mock mode able to render an empty draft state.

- [ ] **Step 5: Run frontend-focused and full tests**

Run: `node --test tests/frontend-resource-builds.test.js tests/frontend-api.test.js tests/frontend-app-wiring.test.js tests/frontend-views.test.js`
Expected: all frontend tests pass without exposing backend identifiers in visible copy.

- [ ] **Step 6: Commit the frontend build UI**

```bash
git add frontend/src/ui/resourceDraft.js frontend/src/app.js frontend/src/api/gameApi.js tests/frontend-resource-builds.test.js
git commit -m "feat: render roguelike resource builds"
```

## Task 9: Full verification and handoff

**Files:**
- Modify: `README.md` only if the final user-facing behavior needs a short local-development note.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`
Expected: all tests pass with zero failures, cancellations, skips, or todos.

- [ ] **Step 2: Run repository checks**

Run: `git diff --check && git status --short --branch`
Expected: no whitespace errors; only pre-existing untracked `.idea/` remains outside the feature commits.

- [ ] **Step 3: Exercise the event-driven flow manually through existing APIs**

Start the project with the project-local command `npm run start:all`, create a formal game, resolve one ordinary cultivation action, confirm no resource draft appears, then resolve one resource discovery event, confirm exactly three narrative candidates appear, select one, and confirm the active collection and resonance panel update without a second turn cost. Stop services using the existing startup script flow.

- [ ] **Step 4: Review the final diff against the approved spec**

Confirm that the diff contains no sect files, no LLM resource-generation path, no breakthrough auto-drop, no public internal IDs, and no forced main-branch changes.

- [ ] **Step 5: Commit only any approved README wording change**

```bash
git add README.md
git commit -m "docs: explain roguelike resource discoveries"
```

Do not push `main`; development remains on `dev` unless the user explicitly requests synchronization.
