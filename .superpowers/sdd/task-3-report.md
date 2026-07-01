# Task 3 Report: Treasures And Techniques

## Scope

Implemented Task 3 only in the assigned backend/event/reward/test files:

- `backend/src/domain/rewards.js`
- `backend/src/domain/events/effectResolver.js`
- `backend/src/domain/events/eventCatalog.js`
- `backend/src/domain/events/eventSelector.js`
- `tests/rewards.test.js`
- `tests/event-engine.test.js`

No breakthrough systems, frontend UI, LLM prompt changes, or docs outside this report were added.

## TDD Evidence

### RED 1: task-targeted reward/event tests

Command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/rewards.test.js tests/event-engine.test.js
```

Observed failure before production code:

- `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/Users/ruilifeng/Documents/game/backend/src/domain/rewards.js'`
- `reward events seed treasure and technique effects into the catalog`
- `effect resolver grants treasure and technique rewards from event choices`

This confirmed the new reward module and event wiring did not exist yet.

### GREEN 1: reward catalogs, helpers, effect wiring

Same command after implementing `rewards.js`, reward effect support, and reward-bearing events:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/rewards.test.js tests/event-engine.test.js
```

Observed result:

- `pass 20`
- `fail 0`

### RED 2: selector exposure for unlocked realm reward event

After adding a selector-focused regression test, the same targeted command failed with:

- `realm selector surfaces the unlocked mist step reward event`
- `false !== true`

This showed the reward event existed but was being buried by selector ordering.

### GREEN 2: selector prioritization

After adjusting event prioritization for featured reward events and unlocked future-event follow-ups, the targeted command passed again:

- `pass 20`
- `fail 0`

### Full-suite regression found and fixed

Full suite command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```

First full-suite run exposed a regression:

- failing test: `POST /api/v1/turns resolves selected event effects deterministically`
- symptom: `0 !== 92`

Root cause:

- reward-state syncing assumed a formal game with `maxHealth`/`maxLifespan`
- backend API test completed onboarding on a mock save, so granting a treasure during `mist_bronze_bell` zeroed missing max-stat bases and clamped lifespan to `0`

Verification after fix:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/backend-api.test.js
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```

Observed result:

- backend API subset: `pass 22`, `fail 0`
- full suite: `pass 122`, `fail 0`

## Exact Commands Run

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/rewards.test.js tests/event-engine.test.js
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/rewards.test.js tests/event-engine.test.js
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/rewards.test.js tests/event-engine.test.js
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/rewards.test.js tests/event-engine.test.js
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/backend-api.test.js
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```

## Files Changed

- `backend/src/domain/rewards.js`
  - added treasure and technique catalogs
  - added `grantTreasure`, `grantTechnique`, `calculateDerivedBonuses`
  - synchronized formal max-health/max-lifespan only when those caps exist
- `backend/src/domain/events/effectResolver.js`
  - added `treasure` and `technique` effect support
  - recalculated derived bonuses during attribute recomputation
- `backend/src/domain/events/eventCatalog.js`
  - added reward effects to `mist_bronze_bell`, `master_guidance`, and `mist_lantern_path`
  - added local helpers for reward effect descriptors
- `backend/src/domain/events/eventSelector.js`
  - prioritized featured reward events and unlocked future-event follow-ups
- `tests/rewards.test.js`
  - added catalog, duplicate-prevention, derived-bonus, and attribute-recompute coverage
- `tests/event-engine.test.js`
  - added catalog reward-effect coverage
  - added event resolution reward-grant coverage
  - added selector coverage for the unlocked `mist_step` reward path

## Self-Review

- Catalog values match the task brief exactly for `calm_lotus_incense`, `tiger_bone_guard`, `qingmu_jue`, and `mist_step`.
- Duplicate granting is blocked for treasures and techniques by `id`.
- Derived bonuses aggregate across both reward families and stay in sync after attribute changes.
- Reward events are reachable through the existing trigger system and visible through the selector where they matter.
- Mock backend saves no longer lose lifespan when a reward is granted before formal character stats exist.

## Concerns

- None at handoff. Full targeted and full-suite verification are green.
