# 角色背景内容池扩充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans (recommended) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the formal character background pools to 18 origins, 18 spiritual roots, and 24 traits while preserving deterministic seeded generation.

**Architecture:** Modify only the authoritative constants in `backend/src/domain/characterCreation.js`. Keep `rollCharacter` and all API/UI contracts unchanged; existing preview and formal creation automatically consume the expanded pools. Add focused domain tests for cardinality, uniqueness, deterministic generation, and the existing 2–3 trait rule.

**Tech Stack:** Node.js ES modules and the built-in `node:test` runner.

## Global Constraints

- Do not change the character object field names or seed algorithm.
- Do not add numeric effects to background strings.
- Keep each generated character at 2–3 traits.
- Preserve existing saved character values.

### Task 1: Add failing pool-capacity regression tests

**Files:**
- Test: `tests/onboarding-character.test.js`

- [ ] **Step 1: Add the test**

Generate a broad deterministic sample, collect `origin`, `spiritualRoot`, and trait values, and assert the expected pool sizes are reachable. Also assert every generated trait list has 2–3 unique values and the same seed produces the same complete character.

- [ ] **Step 2: Run the test and verify red**

```bash
node --test tests/onboarding-character.test.js
```

Expected: the new cardinality assertions fail against the current 6/6/8 pools.

### Task 2: Expand the authoritative content pools

**Files:**
- Modify: `backend/src/domain/characterCreation.js`

- [ ] **Step 1: Replace the three arrays**

Use 18 unique Chinese labels for each of `ORIGINS` and `ROOTS`, and 24 unique labels for `TRAITS`. Keep `const traits = pickUnique(TRAITS, 2 + Math.floor(rng() * 2), rng);` unchanged.

- [ ] **Step 2: Run the domain tests**

```bash
node --test tests/onboarding-character.test.js tests/character-attributes.test.js
```

Expected: all tests pass and the new capacities are reachable.

### Task 3: Regression verification

**Files:**
- Verify: `backend/src/domain/characterCreation.js`, API, frontend preview, prompt, and tests

- [ ] **Step 1: Run background-related tests**

```bash
node --test tests/backend-api.test.js tests/frontend-character-creation.test.js tests/story-director-prompt.test.js
```

- [ ] **Step 2: Build and check formatting**

```bash
npm run build
git diff --check
```

- [ ] **Step 3: Report migration-era failures separately**

Do not change legacy static HTML tests that still assert the pre-Svelte inline DOM.
