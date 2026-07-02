# Character Systems Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual/random character attribute allocation, health and max lifespan, lifespan costs, treasures, techniques, breakthrough probability, history summaries, and player-facing inventory/technique views while keeping LLM narration downstream of deterministic rules.

**Architecture:** Extend backend state with focused domain modules for attributes, derived stats, rewards, and breakthrough math. Keep `/game/new`, `/daily-actions`, and `/turns` as the main API loop. Frontend renders the new state through existing five views without exposing internal ids or debug fields. LLM prompt receives richer state but remains forbidden from changing rule results.

**Tech Stack:** Static HTML/CSS/JavaScript ES modules, Node built-in `node:test`, existing backend Request/Response app, DashScope compatible-mode through the existing Bailian client, no build step.

## Global Constraints

- Final target remains a single-player game, not open world.
- No offline idle rewards or auto-claim timers.
- Formal character creation remains locked until prologue completion.
- Role creation supports manual allocation and random allocation.
- Five attributes are `rootBone`, `comprehension`, `fortune`, `willpower`, and `lifeSeed`.
- Each attribute is an integer from 1 to 10.
- First version allocation total is exactly 25 points.
- Missing attributes in `POST /api/v1/game/new` are allowed for backward compatibility and use deterministic random allocation.
- Every formal action consumes lifespan; realm tier increases the cost.
- LLM output may polish narration but must not add or change treasures, techniques, attributes, health, lifespan, breakthrough success, rewards, flags, or event eligibility.
- Player-facing UI must not show raw internal ids, debug risk strings, schema names, or API field names.
- Run targeted tests during each task and full `node --test` before final handoff.

---

## File Structure

- Create `backend/src/domain/attributes.js`: allocation validation, random allocation, label metadata, derived stat helpers.
- Create `backend/src/domain/progression.js`: realm parsing, lifespan cost, breakthrough chance and result math.
- Create `backend/src/domain/rewards.js`: treasure and technique catalogs plus normalization helpers.
- Modify `backend/src/domain/characterCreation.js`: accept allocation, attach five attributes, health, max lifespan, starter techniques and treasures.
- Modify `backend/src/domain/events/effectResolver.js`: add reward and stat effect types and global action lifespan cost.
- Modify `backend/src/domain/events/eventCatalog.js`: add treasure/technique rewards and breakthrough choices.
- Modify `backend/src/domain/events/eventSelector.js`: prioritize breakthrough action when eligible.
- Modify `backend/src/domain/turnResult.js`: include health, max lifespan, max health and reward summaries in `ruleResult`.
- Modify `backend/src/llm/prompts/narrationPrompt.js`: include new state and forbid mutation.
- Modify `frontend/src/api/gameApi.js`: send manual attributes through `createFormalGame`.
- Modify `frontend/src/ui/characterCreation.js`: allocation helpers and display rows.
- Modify `frontend/index.html`: add allocation controls and richer view containers if needed.
- Modify `frontend/src/app.js`: render allocation, five attributes, health/lifespan, history, bag treasures, and techniques.
- Modify `frontend/src/styles.css`: style allocation cards, treasure/technique cards, breakthrough cards and history summaries.
- Modify tests under `tests/`: add focused unit and integration tests.

---

### Task 1: Attribute Allocation And Character State

**Files:**
- Create: `backend/src/domain/attributes.js`
- Modify: `backend/src/domain/characterCreation.js`
- Modify: `backend/src/app.js`
- Test: `tests/character-attributes.test.js`
- Test: `tests/onboarding-character.test.js`
- Test: `tests/backend-api.test.js`

**Interfaces:**
- Produces: `ATTRIBUTE_KEYS`
- Produces: `ATTRIBUTE_TOTAL`
- Produces: `validateAttributeAllocation(attributes): AttributeAllocation`
- Produces: `rollAttributeAllocation(seed): AttributeAllocation`
- Produces: `deriveMaxHealth(attributes): number`
- Produces: `deriveMaxLifespan(initialLifespan, attributes): number`
- Extends: `rollCharacter({ seed, name, attributes })`
- Extends: `POST /api/v1/game/new` request body with optional `attributes`

- [ ] **Step 1: Write failing allocation tests**

Create `tests/character-attributes.test.js` with tests that assert:

```js
assert.deepEqual(ATTRIBUTE_KEYS, ['rootBone', 'comprehension', 'fortune', 'willpower', 'lifeSeed']);
assert.equal(ATTRIBUTE_TOTAL, 25);
assert.deepEqual(validateAttributeAllocation({
  rootBone: 7,
  comprehension: 6,
  fortune: 4,
  willpower: 4,
  lifeSeed: 4
}), {
  rootBone: 7,
  comprehension: 6,
  fortune: 4,
  willpower: 4,
  lifeSeed: 4
});
```

Also assert invalid totals, values below 1, values above 10 and non-integers throw `ATTRIBUTE_ALLOCATION_INVALID`.

- [ ] **Step 2: Run failing allocation tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/character-attributes.test.js
```

Expected: FAIL because `backend/src/domain/attributes.js` does not exist.

- [ ] **Step 3: Implement allocation helpers**

Create `backend/src/domain/attributes.js` with:

```js
export const ATTRIBUTE_KEYS = ['rootBone', 'comprehension', 'fortune', 'willpower', 'lifeSeed'];
export const ATTRIBUTE_TOTAL = 25;

export function validateAttributeAllocation(attributes) {
  const normalized = {};
  let total = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const value = attributes?.[key];
    if (!Number.isInteger(value) || value < 1 || value > 10) {
      throw new Error(`ATTRIBUTE_ALLOCATION_INVALID:${key}`);
    }
    normalized[key] = value;
    total += value;
  }
  if (total !== ATTRIBUTE_TOTAL) {
    throw new Error(`ATTRIBUTE_ALLOCATION_INVALID:total`);
  }
  return normalized;
}
```

Add deterministic `rollAttributeAllocation(seed)` by starting every attribute at 1 and distributing 20 points with a seeded RNG while no value exceeds 10.

Add:

```js
export function deriveMaxHealth(attributes) {
  return 80 + attributes.rootBone * 8 + attributes.lifeSeed * 2;
}

export function deriveMaxLifespan(initialLifespan, attributes) {
  return initialLifespan + attributes.lifeSeed * 8;
}
```

- [ ] **Step 4: Make character creation use attributes**

Modify `backend/src/domain/characterCreation.js`:

- Import allocation helpers.
- `rollCharacter({ seed, name, attributes })` validates passed attributes or calls `rollAttributeAllocation(seed)`.
- Add `character.attributes`.
- Keep old compatibility fields:
  - `character.comprehension = attributes.comprehension * 9`
  - `character.physique = attributes.rootBone * 9`
  - `character.luck = attributes.fortune * 9`
- `createFormalPlayer(character)` sets `maxHealth`, `health`, `maxLifespan`, `lifespan`.

- [ ] **Step 5: Wire API body**

Modify `handleNewFormalGame` in `backend/src/app.js`:

```js
const character = rollCharacter({ seed, name, attributes: body.attributes });
```

If validation throws `ATTRIBUTE_ALLOCATION_INVALID`, return `400 CHARACTER_ATTRIBUTES_INVALID`.

- [ ] **Step 6: Verify targeted tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/character-attributes.test.js tests/onboarding-character.test.js tests/backend-api.test.js
```

Expected: PASS.

### Task 2: Lifespan Cost And Health Effects

**Files:**
- Create: `backend/src/domain/progression.js`
- Modify: `backend/src/domain/events/effectResolver.js`
- Modify: `backend/src/domain/turnResult.js`
- Test: `tests/progression.test.js`
- Test: `tests/event-engine.test.js`

**Interfaces:**
- Produces: `getRealmTier(realm): string`
- Produces: `calculateLifespanCost(game): number`
- Produces: `applyActionCost(game): GameState`
- Extends effects: `vitality`, `maxHealth`, `lifespan`, `maxLifespan`, `attribute`

- [ ] **Step 1: Write failing progression tests**

Create `tests/progression.test.js` asserting:

- 炼气 action cost is at least 1.
- 筑基 costs more than 炼气.
- Higher `lifeSeed` can reduce cost but never below 1.
- `applyActionCost` reduces `player.lifespan`.
- `vitality` effect clamps health between 0 and `maxHealth`.
- `attribute` effect updates `character.attributes` and derived bonuses are reflected in player max stats.

- [ ] **Step 2: Run failing tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/progression.test.js
```

Expected: FAIL because `progression.js` is missing.

- [ ] **Step 3: Implement progression helpers**

Create `backend/src/domain/progression.js` with:

```js
const REALM_COSTS = { 炼气: 1, 筑基: 2, 金丹: 4, 元婴: 8 };
export function getRealmTier(realm = '') {
  return Object.keys(REALM_COSTS).find((tier) => realm.includes(tier)) ?? '炼气';
}
export function calculateLifespanCost(game) {
  const tier = getRealmTier(game.player?.realm);
  const base = REALM_COSTS[tier];
  const lifeSeed = game.character?.attributes?.lifeSeed ?? 1;
  const reduction = Math.floor(lifeSeed / 4) + (game.derivedBonuses?.lifespanCostReduction ?? 0);
  return Math.max(1, base - reduction);
}
export function applyActionCost(game) {
  const cost = calculateLifespanCost(game);
  return {
    ...game,
    player: {
      ...game.player,
      lifespan: Math.max(0, (game.player?.lifespan ?? 0) - cost)
    },
    lastActionCost: { lifespan: cost }
  };
}
```

- [ ] **Step 4: Apply cost during formal event turns**

Modify `resolveChoice` in `effectResolver.js`:

- Apply choice effects first.
- Apply `applyActionCost` before incrementing turn.
- Include `lifespanCost` in `ruleResult`.
- Do not apply cost to tutorial actions.

- [ ] **Step 5: Add health/stat effect support**

Extend `applyEffect`:

- `vitality`: updates `player.health`, clamped 0..maxHealth.
- `maxHealth`: updates `player.maxHealth`, then clamps health.
- `lifespan`: updates `player.lifespan`, clamped 0..maxLifespan.
- `maxLifespan`: updates `player.maxLifespan`.
- `attribute`: updates `character.attributes[key]`, clamps 1..10, then recalculates derived stats.

- [ ] **Step 6: Verify targeted tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/progression.test.js tests/event-engine.test.js tests/backend-api.test.js
```

Expected: PASS.

### Task 3: Treasures And Techniques

**Files:**
- Create: `backend/src/domain/rewards.js`
- Modify: `backend/src/domain/events/effectResolver.js`
- Modify: `backend/src/domain/events/eventCatalog.js`
- Modify: `backend/src/domain/events/eventSelector.js`
- Test: `tests/rewards.test.js`
- Test: `tests/event-engine.test.js`

**Interfaces:**
- Produces: `TREASURE_CATALOG`
- Produces: `TECHNIQUE_CATALOG`
- Produces: `grantTreasure(game, id): GameState`
- Produces: `grantTechnique(game, id): GameState`
- Produces: `calculateDerivedBonuses(game): DerivedBonuses`
- Extends effects: `treasure`, `technique`

- [ ] **Step 1: Write failing reward tests**

Create `tests/rewards.test.js` asserting:

- Granting `calm_lotus_incense` adds a treasure with name `静心莲香` and `breakthroughChance: 3`.
- Granting same treasure twice does not duplicate it.
- Granting `qingmu_jue` adds a technique and updates `derivedBonuses.cultivationGain`.
- `calculateDerivedBonuses` sums technique and treasure bonuses.

- [ ] **Step 2: Implement reward catalogs**

Create `backend/src/domain/rewards.js` with first catalog:

```js
export const TREASURE_CATALOG = {
  calm_lotus_incense: {
    id: 'calm_lotus_incense',
    name: '静心莲香',
    rarity: '良品',
    description: '点燃后可令识海宁静，突破时更易定神。',
    bonuses: { breakthroughChance: 3 }
  },
  tiger_bone_guard: {
    id: 'tiger_bone_guard',
    name: '虎骨护腕',
    rarity: '良品',
    description: '赤焰虎骨制成，大幅增强体魄。',
    bonuses: { damageReduction: 8, maxHealth: 8 }
  }
};
```

Add techniques:

```js
export const TECHNIQUE_CATALOG = {
  qingmu_jue: {
    id: 'qingmu_jue',
    name: '青木诀',
    grade: '凡品',
    type: '心法',
    level: 1,
    description: '以木息滋养经脉。',
    bonuses: { cultivationGain: 6, maxHealth: 6 }
  },
  mist_step: {
    id: 'mist_step',
    name: '雾隐步',
    grade: '良品',
    type: '身法',
    level: 1,
    description: '借雾线藏身，秘境中更易避开杀机。',
    bonuses: { damageReduction: 5, breakthroughChance: 2 }
  }
};
```

- [ ] **Step 3: Wire reward effects**

Extend `effectResolver.js`:

- `treasure`: call `grantTreasure`.
- `technique`: call `grantTechnique`.
- Recompute `derivedBonuses` after reward and attribute effects.

- [ ] **Step 4: Add reward events**

Modify `eventCatalog.js`:

- `mist_bronze_bell` or a new event can grant `calm_lotus_incense`.
- A skills event can grant `qingmu_jue`.
- A realm event can grant `mist_step`.
- Use existing trigger system.

- [ ] **Step 5: Verify targeted tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/rewards.test.js tests/event-engine.test.js
```

Expected: PASS.

### Task 4: Breakthrough Probability

**Files:**
- Modify: `backend/src/domain/progression.js`
- Modify: `backend/src/domain/events/eventCatalog.js`
- Modify: `backend/src/domain/events/eventSelector.js`
- Modify: `backend/src/domain/events/effectResolver.js`
- Test: `tests/breakthrough.test.js`
- Test: `tests/backend-api.test.js`

**Interfaces:**
- Produces: `canAttemptBreakthrough(game): boolean`
- Produces: `calculateBreakthroughChance(game): BreakthroughPreview`
- Produces: `resolveBreakthrough(game, now): BreakthroughResolution`

- [ ] **Step 1: Write failing breakthrough tests**

Create `tests/breakthrough.test.js` asserting:

- Progress below 100 cannot attempt breakthrough.
- At 100 progress, preview includes target realm, chance and failure cost.
- Higher comprehension/rootBone/willpower increases chance.
- Treasure and technique bonuses increase chance.
- Deterministic seed can produce success and failure paths.
- Failure costs health and lifespan and rolls progress back.

- [ ] **Step 2: Implement breakthrough math**

In `progression.js`, implement:

```js
export function calculateBreakthroughChance(game) {
  const attributes = game.character?.attributes ?? {};
  const bonuses = game.derivedBonuses ?? {};
  const base = realmBaseChance(game.player.realm);
  const attributeBonus = attributes.comprehension * 2
    + attributes.rootBone
    + attributes.willpower
    + Math.floor(attributes.fortune / 2);
  const stateBonus = Math.floor((game.player.mood ?? 0) / 20)
    + Math.floor((game.player.qi ?? 0) / 25);
  const penalty = breakthroughPenalty(game);
  const chance = clamp(base + attributeBonus + stateBonus + (bonuses.breakthroughChance ?? 0) - penalty, 5, 95);
  return { targetRealm: nextRealm(game.player.realm), chance, failureCost: describeFailureCost(game) };
}
```

- [ ] **Step 3: Add breakthrough action**

Modify `eventSelector.js`:

- If view is `cultivation` and `canAttemptBreakthrough(game)` is true, insert a breakthrough event/action before normal events.
- The action title should be `尝试突破`.
- Player-facing meta shows success rate, not internal ids.

- [ ] **Step 4: Resolve breakthrough**

Add a special event source or effect type:

- Prefer event source `breakthrough` with `action.source === 'breakthrough'`.
- In `handleTurn`, route it to `resolveBreakthrough`.
- Save snapshots and call narration like normal resolved events.

- [ ] **Step 5: Verify targeted tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/breakthrough.test.js tests/backend-api.test.js tests/frontend-backend-integration.test.js
```

Expected: PASS.

### Task 5: Frontend Creation, Bag, Skills And History UI

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/app.js`
- Modify: `frontend/src/ui/characterCreation.js`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/api/gameApi.js`
- Test: `tests/frontend-character-creation.test.js`
- Test: `tests/frontend-event-state.test.js`
- Test: `tests/frontend-views.test.js`

**Interfaces:**
- Produces: `createDefaultAllocation()`
- Produces: `randomizeAllocation(seed)`
- Produces: `formatAttributeCards(attributes)`
- Extends: `api.createFormalGame({ name, rerollSeed, attributes })`

- [ ] **Step 1: Write failing frontend tests**

Extend tests to assert:

- Character creation page includes five allocation controls.
- Random allocation keeps total 25.
- Start action sends attributes to `api.createFormalGame`.
- Bag view renders treasures without raw ids.
- Skills view renders techniques without raw ids.
- Main stage renders history behavior list.

- [ ] **Step 2: Implement allocation UI**

Modify `frontend/index.html` character panel with:

- `#attributeAllocation`
- `#remainingAttributePoints`
- Existing random/start buttons.

Modify `frontend/src/app.js`:

- Track `pendingAttributes`.
- `+` and `-` controls adjust values.
- `随机分配` calls frontend helper.
- `开始修行` passes attributes to backend.

- [ ] **Step 3: Render bag and techniques**

Modify `renderWorld` or add view-specific render helpers:

- When active view is `bag`, action note area shows inventory sections.
- When active view is `skills`, action note area shows techniques sections.
- Keep daily actions visible.

- [ ] **Step 4: Render health/lifespan/five attributes/history**

Modify `renderPlayer` and `renderStory`:

- Add health and max lifespan bars.
- Add five attribute row.
- Rename or supplement `天机札记` with `历史行为`.
- Show effect summary from log/ruleResult where available.

- [ ] **Step 5: Verify frontend tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-character-creation.test.js tests/frontend-event-state.test.js tests/frontend-views.test.js tests/frontend-app-wiring.test.js
```

Expected: PASS.

### Task 6: LLM Context And Documentation

**Files:**
- Modify: `backend/src/llm/prompts/narrationPrompt.js`
- Modify: `tests/narration-prompt.test.js`
- Modify: `README.md`
- Modify: `docs/architecture/backend-model-selection.md`

- [ ] **Step 1: Write failing prompt tests**

Assert prompt context includes:

- attributes.
- health/maxHealth.
- lifespan/maxLifespan.
- techniques.
- treasures.
- breakthrough chance/result when present.

Assert system prompt forbids changing:

- treasures.
- techniques.
- attributes.
- health.
- max lifespan.
- breakthrough success/failure.

- [ ] **Step 2: Update prompt context**

Modify `pickNarrationContext(game)` to include the new state slices, limited to compact fields.

- [ ] **Step 3: Update docs**

Document:

- Manual/random creation.
- Five attribute meanings.
- Lifespan/health.
- Breakthrough probability.
- Bag and techniques.
- LLM boundary remains deterministic-first.

- [ ] **Step 4: Full verification**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```

Then start backend/frontend and verify:

- `GET /api/v1/model-health` is configured.
- Frontend opens at `http://127.0.0.1:5173/frontend/`.
- A real model turn returns `narration.status === "generated"` after the new state is present.

Expected: PASS.
