# 角色背景设定恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore deterministic character-background previews during formal creation and pass origin, spiritual root, and traits into every story-director prompt.

**Architecture:** Add a read-only backend preview endpoint that calls the existing authoritative `rollCharacter` function. The frontend store requests that preview for the pending seed, renders it in `CharacterCreation.svelte`, and keeps formal creation authoritative on `/game/new`. Extend `pickContext` with a compact `characterBackground` object.

**Tech Stack:** Node.js built-in test runner, Node HTTP `Request`/`Response`, Svelte 5 runes, Vite, existing backend domain modules.

## Global Constraints

- Keep origin, spiritual root, and traits backend-generated; only five-dimensional attributes remain manually allocated.
- Preview must not mutate game state, turn, pending actions, or persisted save data.
- Formal creation must continue to use the same `rollCharacter` implementation as preview.
- LLM receives background as context only; it cannot authorize numeric or state mutations.
- Run commands from `/Users/ruilifeng/Documents/game` using the project Node environment.

### Task 1: Backend character preview contract

**Files:**
- Modify: `backend/src/app.js`
- Test: `tests/backend-api.test.js`

**Interfaces:**
- Consumes: `rollCharacter({ seed, name, attributes })` and `canCreateFormalCharacter`.
- Produces: `POST /api/v1/game/character-preview` returning `{ data: { character } }` without changing `state.game`.

- [ ] **Step 1: Write failing backend tests**

Add tests that complete onboarding, call the preview endpoint with seed `52` and the manual allocation, and assert the returned `origin`, `spiritualRoot`, `traits`, and `attributes` match the subsequent `/game/new` result. Snapshot `turn`, `version`, `character`, and pending-action count before preview and assert they are unchanged afterward. Add an invalid-allocation assertion using the existing `CHARACTER_ATTRIBUTES_INVALID` contract.

- [ ] **Step 2: Run the focused backend tests and verify the expected failure**

Run:

```bash
node --test tests/backend-api.test.js
```

Expected: the new preview tests fail because the route currently returns `404 NOT_FOUND`.

- [ ] **Step 3: Implement the minimal route and handler**

Register the route immediately before `/api/v1/game/new`:

```js
if (route === 'POST /api/v1/game/character-preview') {
  const body = await readJson(request);
  return handleCharacterPreview({ body, requestId, state });
}
```

Implement the handler so it checks `canCreateFormalCharacter(state.game.onboarding)`, validates the optional name length and seed, calls `rollCharacter`, and returns the character. Map attribute-validation errors to `CHARACTER_ATTRIBUTES_INVALID`; do not assign to `state.game` or mutate pending maps.

- [ ] **Step 4: Run the focused backend tests**

Run:

```bash
node --test tests/backend-api.test.js
```

Expected: all backend tests, including the new preview tests, pass.

### Task 2: Story-director background context

**Files:**
- Modify: `backend/src/llm/prompts/storyDirectorPrompt.js`
- Test: `tests/story-director-prompt.test.js`

**Interfaces:**
- Consumes: `game.character.origin`, `game.character.spiritualRoot`, and `game.character.traits`.
- Produces: `user.context.characterBackground` with only the three public background fields.

- [ ] **Step 1: Write the failing prompt test**

Extend the existing prompt test fixture with a known character and assert:

```js
assert.deepEqual(user.context.characterBackground, {
  origin: game.character.origin,
  spiritualRoot: game.character.spiritualRoot,
  traits: game.character.traits
});
```

Also assert the hard constraints mention preserving established character background.

- [ ] **Step 2: Run the prompt test and verify it fails**

Run:

```bash
node --test tests/story-director-prompt.test.js
```

Expected: failure because `characterBackground` is absent.

- [ ] **Step 3: Add the compact context and constraint**

Add this sibling to `attributes` in `pickContext`:

```js
characterBackground: {
  origin: text(game.character?.origin),
  spiritualRoot: text(game.character?.spiritualRoot),
  traits: Array.isArray(game.character?.traits)
    ? game.character.traits.slice(0, 6).map((trait) => text(trait)).filter(Boolean)
    : []
},
```

Add a hard constraint that the director must treat these fields as established facts and must not contradict them.

- [ ] **Step 4: Run the prompt test**

Run:

```bash
node --test tests/story-director-prompt.test.js
```

Expected: all prompt tests pass.

### Task 3: Frontend preview API and store state

**Files:**
- Modify: `frontend/src/lib/api/gameApi.js`
- Modify: `frontend/src/api/gameApi.js`
- Modify: `frontend/src/lib/stores/gameStore.svelte.js`
- Test: `tests/frontend-api.test.js`
- Test: `tests/frontend-character-creation.test.js`

**Interfaces:**
- Produces from both API clients: `getCharacterPreview({ name, rerollSeed, attributes }) -> character`.
- Produces from store: `getPendingCharacterPreview()` and `refreshCharacterPreview()`.

- [ ] **Step 1: Write failing frontend API tests**

Add a fetch-backed test asserting `getCharacterPreview` posts to `/api/v1/game/character-preview` with `{ name, rerollSeed, attributes }` and returns the character. Add a mock-mode test asserting the fallback contains string `origin`, string `spiritualRoot`, and an array `traits`.

- [ ] **Step 2: Run the focused frontend tests and verify failure**

Run:

```bash
node --test tests/frontend-api.test.js tests/frontend-character-creation.test.js
```

Expected: failure because neither API client exposes `getCharacterPreview`.

- [ ] **Step 3: Implement API clients**

Add the backend request to both duplicated API clients using the same body as formal creation. For mock mode, reuse `createMockFormalCharacter` with the current game shell and pending attributes, returning only the character-shaped preview.

- [ ] **Step 4: Add store preview lifecycle**

Create `_pendingCharacterPreview` and getter. On initialization/reset, once the game is a character-creation shell, call `refreshCharacterPreview`; on reroll, update the seed and refresh. Keep the current preview on transient errors and set it to `null` only when there is no previous preview. Do not await preview in `createFormalGame`; the create button must retain the existing immediate transition behavior.

- [ ] **Step 5: Run frontend API tests**

Run:

```bash
node --test tests/frontend-api.test.js tests/frontend-character-creation.test.js
```

Expected: all API and creation tests pass.

### Task 4: Restore creation-page background card

**Files:**
- Modify: `frontend/src/components/CharacterCreation.svelte`
- Test: `tests/frontend-character-creation.test.js`

**Interfaces:**
- Consumes: `getPendingCharacterPreview()` and existing pending attribute getters.
- Produces: visible creation-page fields for origin, spiritual root, and traits.

- [ ] **Step 1: Write the failing component contract test**

Extend the source-level component test to assert the component references `getPendingCharacterPreview`, renders `origin`, `spiritualRoot`, and `traits`, and includes loading/fallback copy for the preview card.

- [ ] **Step 2: Run the focused component test and verify failure**

Run:

```bash
node --test tests/frontend-character-creation.test.js
```

Expected: failure because the current component has no preview state or background card.

- [ ] **Step 3: Implement the minimal Svelte card**

Import the getter, derive the preview, and render a card between the name input and attribute allocation. Use `preview?.origin ?? '入山门后揭晓'`, `preview?.spiritualRoot ?? '入山门后揭晓'`, and `preview?.traits?.join('、') ?? '命格尚未落定'`; keep the card non-interactive.

- [ ] **Step 4: Run the component test and build**

Run:

```bash
node --test tests/frontend-character-creation.test.js
npm run build
```

Expected: relevant tests pass and Vite exits with code 0.

### Task 5: Full verification and review

**Files:**
- Verify: all modified files above

- [ ] **Step 1: Run the full core regression suite**

```bash
node --test tests/backend-api.test.js tests/frontend-backend-integration.test.js tests/frontend-api.test.js tests/story-director-prompt.test.js
```

- [ ] **Step 2: Check the diff**

```bash
git diff --check
git status --short
```

- [ ] **Step 3: Report known legacy failures separately**

Do not change the two migration-era static HTML assertions that still expect inline DOM in `frontend/index.html`; report them separately if the broader legacy test command includes them.
