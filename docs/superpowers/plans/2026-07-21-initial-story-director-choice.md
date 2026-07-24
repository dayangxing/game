# 第 0 回合连续剧情选项 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the first formal turn use LLM-generated story director choices while preserving rule resolution, narration, and event-catalog fallback.

**Architecture:** Remove the turn-number gate before `createDirectorDailyActions`; the existing helper remains responsible for invoking and normalizing director choices, caching same-turn pending actions, and falling back on errors or non-choice output. Existing `source: 'director'` resolution continues to handle the selected choice.

**Tech Stack:** Node.js ESM, native `node:test`, existing backend app router, existing story director adapter, Svelte frontend API contract.

## Global Constraints

- Keep onboarding actions on the tutorial path.
- Keep public action responses free of internal effect hints and routing fields.
- Keep LLM-generated numeric effects behind `resolveDirectorEffectHints`.
- Use the project directory and project Node.js environment for tests/builds.

### Task 1: Update the regression contract

**Files:**
- Modify: `tests/backend-api.test.js:461-529`

**Interfaces:**
- Consumes: `POST /api/v1/daily-actions`, `POST /api/v1/turns`, and the injected `llm.generateStoryDirector` test seam.
- Produces: assertions that turn 0 invokes the director, returns public choices, resolves a choice, and invokes the director again after the next settlement.

- [x] **Step 1: Change the test to expect the first director call at turn 0.**
- [x] **Step 2: Run the focused test and verify it fails because the current code still gates director generation on `game.turn > 0`.**

Run:

```bash
node --test --test-name-pattern='uses storyDirector from turn zero' tests/backend-api.test.js
```

Expected: FAIL because the first response still contains the event-catalog choice and `directorInputs.length` is `0`.

### Task 2: Remove the first-turn gate

**Files:**
- Modify: `backend/src/app.js:229-246`

**Interfaces:**
- Consumes: `createDirectorDailyActions({ state, viewId, now })`.
- Produces: director-backed daily actions for all completed formal turns, including turn 0.

- [x] **Step 1: Replace the turn-number conditional with an unconditional formal-game director refresh.**

```js
const directorActions = await createDirectorDailyActions({
  state,
  viewId,
  now: now()
});
```

- [x] **Step 2: Update the nearby comment to state that the director is used from turn 0 and the event catalog is fallback behavior.**
- [x] **Step 3: Run the focused regression test and verify it passes.**

Run:

```bash
node --test --test-name-pattern='uses storyDirector from turn zero' tests/backend-api.test.js
```

Expected: PASS.

- [x] **Step 4: Run the affected backend and integration suites.**

Run:

```bash
node --test tests/backend-api.test.js tests/frontend-backend-integration.test.js tests/frontend-api.test.js tests/story-director-prompt.test.js
```

Expected: 0 failures.

- [x] **Step 5: Build the Svelte frontend.**

Run:

```bash
npm run build
```

Expected: Vite exits with status 0.
