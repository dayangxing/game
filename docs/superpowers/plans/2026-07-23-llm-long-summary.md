# LLM Long Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mechanical long-summary concatenation with a non-blocking, version-safe LLM summary pipeline using the configured fast model while guaranteeing that the next narrative request receives all current unsummarized context.

**Architecture:** Keep `game.log` and rule-owned game state authoritative. Extend `storyMemory` with a persisted summary checkpoint, add a backend-only single-flight latest-wins scheduler, call `qwen3.6-flash` through the existing JSON client, and attach unsummarized log deltas to narration/director prompts whenever the LLM summary is behind. A summary result may replace only `longSummary` after an exact game-version and summary-revision compare-and-swap check.

**Tech Stack:** Node.js ES modules, Svelte 5 mirror state, existing Bailian/OpenAI-compatible JSON client, Node built-in test runner, Vite build.

## Global Constraints

- The action and streamed narration response must not await long-summary generation.
- `game.character`, `game.player`, rule results, inventory, chapter state, and NPC relationship values remain authoritative; the summary model may not mutate them.
- The summary model is `fastModel`, defaulting to `qwen3.6-flash`; narration and story-director calls continue using `chatModel`.
- Existing three-attempt LLM retry behavior remains available; summary failure preserves the old summary and does not block gameplay.
- A stale summary result must never overwrite a newer game version or summary revision.
- `game.log` remains the lossless source for later summary jobs; summary windows may be bounded for model input.
- Mock mode does not call the summary model and continues using deterministic fallback memory behavior.
- Mirror all pure story-memory contract changes in `src/storyMemory.js` and `frontend/src/lib/storyMemory.js`.
- Preserve unrelated dirty-worktree changes; stage only files belonging to this feature when committing.

---

## File Map

| File | Responsibility |
|---|---|
| `src/storyMemory.js` | Summary checkpoint fields, legacy migration, unsummarized-turn selection, fallback memory |
| `frontend/src/lib/storyMemory.js` | Browser/Mock mirror of the pure memory contract |
| `backend/src/llm/prompts/longSummaryPrompt.js` | Strict summary prompt and input projection |
| `backend/src/llm/bailianClient.js` | `generateLongSummary()` using `selection.fastModel` |
| `backend/src/memory/longSummaryScheduler.js` | Single-flight latest-wins scheduling, timeout, CAS commit, failure handling |
| `backend/src/app.js` | Scheduler construction, trigger hooks, and persistence wiring |
| `backend/src/llm/prompts/narrationPrompt.js` | Unsummarized delta in normal narration context |
| `backend/src/llm/prompts/storyDirectorPrompt.js` | Unsummarized delta in continuous-story context |
| `frontend/src/lib/stores/gameStore.svelte.js` | API/local reload normalization for new metadata |
| `tests/story-memory.test.js` | Checkpoint migration and delta selection |
| `tests/long-summary-prompt.test.js` | Prompt facts, schema, and forbidden mutations |
| `tests/bailian-client.test.js` | Fast-model selection |
| `tests/long-summary-scheduler.test.js` | Async response, CAS, coalescing, timeout, failure |
| `tests/narration-prompt.test.js` | Fresh delta in narration context |
| `tests/story-director-prompt.test.js` | Fresh delta in director context |
| `tests/backend-api.test.js` | Backend integration and response timing |
| `tests/backend-desktop-runtime.test.js` | Background persistence |
| `tests/frontend-svelte-migration.test.js` | Frontend metadata migration |

## Interfaces Introduced by the Plan

Pure memory helpers:

```js
normalizeStoryMemory(memory, game) -> StoryMemory
selectUnsummarizedTurns(game, options = {}) -> {
  turns: Array<{
    turn: number,
    title: string,
    action: string,
    outcome: string,
    npcLine: string,
    worldEvent: string
  }>,
  truncated: boolean
}
```

Normalized memory adds:

```js
summaryThroughTurn: number
summaryRevision: number
```

Summary client:

```js
llm.generateLongSummary({
  game,
  previousSummary,
  sourceTurns
}) -> Promise<{
  summary: string,
  coveredThroughTurn: number
}>
```

Scheduler:

```js
createLongSummaryScheduler({
  getGame,
  commitGame,
  summarize,
  persistGame,
  now,
  thresholdTurns = 4,
  timeoutMs = 8000
}) -> {
  consider({ reason } = {}): void,
  flush(): Promise<void>,
  dispose(): void
}
```

---

## Task 1: Add summary checkpoints and safe delta selection

**Files:**
- Modify: `src/storyMemory.js`
- Modify: `frontend/src/lib/storyMemory.js`
- Test: `tests/story-memory.test.js`

**Interfaces:**
- Consumes: existing `game.log`, `storyMemory`, `game.turn`, and `recordStoryMemoryTurn()`.
- Produces: normalized `summaryThroughTurn`, `summaryRevision`, and `selectUnsummarizedTurns()` for the summary service and prompt builders.

- [ ] **Step 1: Write the failing tests**

Add these behaviors to `tests/story-memory.test.js`:

```js
test('new memory starts with a turn-zero summary checkpoint', () => {
  const game = createGame(1);
  assert.equal(game.storyMemory.summaryThroughTurn, 0);
  assert.equal(game.storyMemory.summaryRevision, 0);
});

test('legacy memory gets a conservative checkpoint without losing recent turns', () => {
  const game = createGame(2);
  const normalized = normalizeStoryMemory({
    longSummary: '旧摘要',
    recentTurns: [
      { turn: 4, title: '四', action: 'a', outcome: 'o' },
      { turn: 5, title: '五', action: 'b', outcome: 'p' }
    ]
  }, { ...game, turn: 5 });

  assert.equal(normalized.summaryThroughTurn, 3);
  assert.equal(normalized.summaryRevision, 0);
  assert.deepEqual(normalized.recentTurns.map((item) => item.turn), [4, 5]);
});

test('unsummarized turn selection reads the authoritative log after the checkpoint', () => {
  const game = {
    turn: 5,
    storyMemory: { summaryThroughTurn: 3, summaryRevision: 2 },
    log: [
      { id: 'turn-3', title: '旧', command: '旧', body: '旧' },
      { id: 'turn-4', title: '新一', command: '行动一', body: '结果一' },
      { id: 'turn-5', title: '新二', command: '行动二', body: '结果二' }
    ]
  };

  assert.deepEqual(
    selectUnsummarizedTurns(game).turns.map((item) => item.turn),
    [4, 5]
  );
});
```

- [ ] **Step 2: Run the focused tests to verify the expected failure**

Run:

```bash
node --test tests/story-memory.test.js
```

Expected: FAIL because the checkpoint fields and `selectUnsummarizedTurns()` do not exist.

- [ ] **Step 3: Implement the minimal pure memory contract**

Update `normalizeStoryMemory()` so new memory starts at turn 0 and legacy memory uses the first retained recent turn minus one as a conservative checkpoint. Always default `summaryRevision` to zero.

Implement `selectUnsummarizedTurns()` by filtering `game.log` entries whose normalized turn is greater than `game.storyMemory.summaryThroughTurn`, projecting only narrative-safe fields, and applying a bounded input budget from the oldest side while preserving the newest entries. Return `truncated: true` when the budget removes older delta entries.

Update `recordStoryMemoryTurn()` to preserve checkpoint metadata while adding recent turns and deterministic fallback summary text. It must not advance `summaryThroughTurn`; only an accepted LLM summary may advance that field.

Mirror the same pure behavior in `frontend/src/lib/storyMemory.js`.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run:

```bash
node --test tests/story-memory.test.js
```

Expected: all story-memory tests pass, including the new checkpoint and delta tests.

- [ ] **Step 5: Commit the isolated memory-contract change**

```bash
git add src/storyMemory.js frontend/src/lib/storyMemory.js tests/story-memory.test.js
git commit -m "feat: add long summary checkpoints"
```

## Task 2: Add the fast-model summary prompt and client method

**Files:**
- Create: `backend/src/llm/prompts/longSummaryPrompt.js`
- Modify: `backend/src/llm/bailianClient.js`
- Create: `tests/long-summary-prompt.test.js`
- Modify: `tests/bailian-client.test.js`

**Interfaces:**
- Consumes: `game`, `storyMemory.longSummary`, and `selectUnsummarizedTurns()` output.
- Produces: `buildLongSummaryMessages()` and `llm.generateLongSummary()` using `selection.fastModel`.

- [ ] **Step 1: Write the failing prompt and model-selection tests**

The prompt test must assert that the user payload includes character background, player state, old summary, source turns, open threads, and the required output schema. It must also assert that constraints forbid creating facts or mutating numeric state.

The client test must capture the request body and assert:

```js
assert.equal(captured.body.model, 'qwen3.6-flash');
assert.equal(captured.body.response_format.type, 'json_object');
```

- [ ] **Step 2: Run focused tests to verify the expected failure**

Run:

```bash
node --test tests/long-summary-prompt.test.js tests/bailian-client.test.js
```

Expected: FAIL because the prompt module and `generateLongSummary()` do not exist.

- [ ] **Step 3: Implement the strict summary prompt and client method**

Create `buildLongSummaryMessages({ game, previousSummary, sourceTurns })` with a system prompt that requires factual compression, JSON-only output, no new facts, no numeric mutations, and preservation of character background and unresolved major threads. The user payload must include the current facts, previous summary, source turns, open threads, and the output schema `{ summary, coveredThroughTurn }`.

Require a concise Chinese summary within the agreed length limit. `coveredThroughTurn` must be the highest source turn actually summarized.

Add `generateLongSummary()` to `createBailianClient()`. It must call the existing `chatJson()` with `model: selection.fastModel` and a low temperature, validate an object result, and return only `summary` and `coveredThroughTurn`. Reuse the existing retry behavior.

- [ ] **Step 4: Run focused tests to verify they pass**

Run:

```bash
node --test tests/long-summary-prompt.test.js tests/bailian-client.test.js
```

Expected: all focused prompt and client tests pass.

- [ ] **Step 5: Commit the prompt/client change**

```bash
git add backend/src/llm/prompts/longSummaryPrompt.js backend/src/llm/bailianClient.js tests/long-summary-prompt.test.js tests/bailian-client.test.js
git commit -m "feat: add fast long summary model client"
```

## Task 3: Implement the single-flight latest-wins scheduler

**Files:**
- Create: `backend/src/memory/longSummaryScheduler.js`
- Modify: `backend/src/app.js`
- Create: `tests/long-summary-scheduler.test.js`

**Interfaces:**
- Consumes: `getGame()`, `commitGame(nextGame)`, `llm.generateLongSummary()`, and optional `persistGame()`.
- Produces: `createLongSummaryScheduler()` with `consider()`, `flush()`, and `dispose()`.

- [ ] **Step 1: Write failing scheduler tests**

Use deferred fake summarizers to cover:

```js
test('consider returns without waiting for the summary promise', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const scheduler = makeScheduler({ summarize: () => pending });

  const start = Date.now();
  scheduler.consider({ reason: 'threshold' });
  assert.ok(Date.now() - start < 100);

  release({ summary: '新摘要', coveredThroughTurn: 4 });
  await scheduler.flush();
});

test('a stale summary cannot overwrite a newer game version', async () => {
  const deferred = deferredPromise();
  let game = makeGame({ version: 4, summaryThroughTurn: 0 });
  const scheduler = makeScheduler({ getGame: () => game, summarize: () => deferred.promise });

  scheduler.consider({ reason: 'threshold' });
  game = makeGame({ version: 5, summaryThroughTurn: 0 });
  deferred.resolve({ summary: '过期摘要', coveredThroughTurn: 4 });
  await scheduler.flush();

  assert.equal(game.storyMemory.longSummary, '旧摘要');
});

test('multiple updates coalesce to one latest follow-up task', async () => {
  let game = makeGame({ version: 4, summaryThroughTurn: 0 });
  const calls = [];
  const deferreds = [];
  const scheduler = makeScheduler({
    getGame: () => game,
    summarize: ({ game: snapshot }) => {
      calls.push(snapshot.version);
      const deferred = deferredPromise();
      deferreds.push(deferred);
      return deferred.promise;
    }
  });

  scheduler.consider({ reason: 'threshold' });
  game = makeGame({ version: 5, summaryThroughTurn: 0 });
  scheduler.consider({ reason: 'threshold' });
  game = makeGame({ version: 6, summaryThroughTurn: 0 });
  scheduler.consider({ reason: 'threshold' });

  deferreds[0].resolve({ summary: '过期摘要', coveredThroughTurn: 4 });
  await Promise.resolve();
  deferreds[1].resolve({ summary: '最新摘要', coveredThroughTurn: 6 });
  await scheduler.flush();

  assert.deepEqual(calls, [4, 6]);
});

test('failure and timeout keep the old summary and checkpoint', async () => {
  const committed = [];
  const scheduler = makeScheduler({
    timeoutMs: 1,
    summarize: () => new Promise(() => {}),
    commitGame: (nextGame) => committed.push(nextGame)
  });

  scheduler.consider({ reason: 'threshold' });
  await scheduler.flush();

  assert.deepEqual(committed, []);
});
```

- [ ] **Step 2: Run scheduler tests to verify the expected failure**

Run:

```bash
node --test tests/long-summary-scheduler.test.js
```

Expected: FAIL because the scheduler module and methods do not exist.

- [ ] **Step 3: Implement the scheduler state machine**

Implement one in-flight job, one `latestPendingVersion`, and one promise used by `flush()` for tests. `consider()` only schedules when the game is API/Electron-capable, the LLM exposes `generateLongSummary()`, and either four or more turns are unsummarized or the reason is marked major.

Each job snapshots:

```js
{
  gameId: game.id,
  sourceGameVersion: game.version ?? game.turn,
  sourceSummaryRevision: game.storyMemory.summaryRevision,
  sourceSummaryThroughTurn: game.storyMemory.summaryThroughTurn,
  game: structuredClone(game),
  sourceTurns: selectUnsummarizedTurns(game)
}
```

On completion:

1. Reject invalid output and late results.
2. Read the current game through `getGame()`.
3. Compare game id, current version, and current summary revision with the snapshot.
4. If any differs, do not commit; schedule the latest current version.
5. If all match, commit a copy of the current game with the new summary, `summaryThroughTurn`, and incremented `summaryRevision`.
6. Call `persistGame()` after a successful commit when provided.

Use an 8000 ms scheduler deadline. Timeout is treated like failure and cannot mutate game state. Late provider results are ignored by the job token and version check.

- [ ] **Step 4: Wire scheduler creation and triggers into the backend**

Create the scheduler inside `createBackendApp()` after the authoritative state exists. Pass:

```js
getGame: () => state.game,
commitGame: (nextGame) => { state.game = nextGame; },
summarize: ({ game, previousSummary, sourceTurns }) => (
  state.llm.generateLongSummary({ game, previousSummary, sourceTurns })
),
persistGame: state.persistGame
```

After successful state-changing POST handlers, call `state.longSummaryScheduler.consider({ reason })` without awaiting it. Exclude model-config requests and ensure Mock games are ignored. Mark turn completion, chapter transition, new major foreshadow, and ending-related changes as major reasons.

- [ ] **Step 5: Run scheduler and backend tests**

Run:

```bash
node --test tests/long-summary-scheduler.test.js tests/backend-api.test.js
```

Expected: scheduler race tests and existing backend API tests pass; no endpoint waits for the deferred summary promise.

- [ ] **Step 6: Commit the scheduler change**

```bash
git add backend/src/memory/longSummaryScheduler.js backend/src/app.js tests/long-summary-scheduler.test.js
git commit -m "feat: schedule versioned long summary updates"
```

## Task 4: Add unsummarized deltas to all narrative contexts

**Files:**
- Modify: `backend/src/llm/prompts/narrationPrompt.js`
- Modify: `backend/src/llm/prompts/storyDirectorPrompt.js`
- Modify: `tests/narration-prompt.test.js`
- Modify: `tests/story-director-prompt.test.js`

**Interfaces:**
- Consumes: `selectUnsummarizedTurns(game)` and `storyMemory.summaryThroughTurn`.
- Produces: `unsummarizedTurns` in both narrative and director user contexts.

- [ ] **Step 1: Write failing prompt-context tests**

Build a game with `summaryThroughTurn: 2`, `turn: 4`, and log entries for turns 3 and 4. Assert both prompt builders include those entries and the checkpoint value, while still including the existing long summary and character background.

- [ ] **Step 2: Run tests to verify the expected failure**

Run:

```bash
node --test tests/narration-prompt.test.js tests/story-director-prompt.test.js
```

Expected: FAIL because neither context currently contains `unsummarizedTurns`.

- [ ] **Step 3: Add the delta projection**

Add a bounded `unsummarizedTurns` array to:

```js
buildNarrationMessages().user.content.narrativeContext.storyMemory
buildStoryDirectorMessages().user.content.context.storyMemory
```

Keep existing whitelist projections and do not pass the full game object to the model. Include `summaryThroughTurn` so the model knows which content is already compressed. Preserve the newest entries when the input budget is exceeded.

- [ ] **Step 4: Run focused prompt tests**

Run:

```bash
node --test tests/narration-prompt.test.js tests/story-director-prompt.test.js
```

Expected: all prompt tests pass.

- [ ] **Step 5: Commit the context freshness change**

```bash
git add backend/src/llm/prompts/narrationPrompt.js backend/src/llm/prompts/storyDirectorPrompt.js tests/narration-prompt.test.js tests/story-director-prompt.test.js
git commit -m "feat: include unsummarized story deltas in prompts"
```

## Task 5: Complete persistence, migration, and full verification

**Files:**
- Modify: `frontend/src/lib/stores/gameStore.svelte.js`
- Modify: `tests/frontend-svelte-migration.test.js`
- Modify: `tests/backend-desktop-runtime.test.js`
- Modify: `tests/backend-api.test.js`
- Modify: `tests/story-memory.test.js`

**Interfaces:**
- Consumes: new checkpoint fields and backend summary commits.
- Produces: safe API/local reload behavior, desktop persistence coverage, and release verification evidence.

- [ ] **Step 1: Write failing migration and persistence tests**

Add tests that assert:

```text
API reload preserves summaryThroughTurn and summaryRevision.
Local reload migrates missing metadata without removing recent turns.
An accepted background summary is written through the desktop persistGame callback.
Mock mode never invokes generateLongSummary.
```

- [ ] **Step 2: Run focused tests to verify the expected failure**

Run:

```bash
node --test tests/frontend-svelte-migration.test.js tests/backend-desktop-runtime.test.js tests/backend-api.test.js
```

Expected: new assertions fail until state adapters and persistence hooks are updated.

- [ ] **Step 3: Update state adapters**

Ensure all API and local game load paths pass `storyMemory` through the mirrored `normalizeStoryMemory()` contract. Do not add a frontend summary request or wait for background completion. The next API state/action response remains the source of the updated summary.

- [ ] **Step 4: Verify desktop persistence and Mock isolation**

Use a fake `persistGame` callback and a fake LLM. Resolve one accepted summary and assert that persisted game contains the new `longSummary`, `summaryThroughTurn`, and `summaryRevision`. Resolve a Mock game and assert that no summary call occurred.

- [ ] **Step 5: Run all feature tests**

Run:

```bash
node --test \
  tests/story-memory.test.js \
  tests/long-summary-prompt.test.js \
  tests/long-summary-scheduler.test.js \
  tests/narration-prompt.test.js \
  tests/story-director-prompt.test.js \
  tests/backend-api.test.js \
  tests/backend-desktop-runtime.test.js \
  tests/frontend-svelte-migration.test.js
```

Expected: all selected tests pass with zero failures.

- [ ] **Step 6: Build and inspect the diff**

Run:

```bash
npm run build
git diff --check
```

Expected: Vite exits with code 0 and `git diff --check` emits no whitespace errors.

- [ ] **Step 7: Commit the completed implementation**

```bash
git add src/storyMemory.js frontend/src/lib/storyMemory.js \
  backend/src/memory/longSummaryScheduler.js \
  backend/src/llm/prompts/longSummaryPrompt.js \
  backend/src/llm/bailianClient.js backend/src/app.js \
  backend/src/llm/prompts/narrationPrompt.js \
  backend/src/llm/prompts/storyDirectorPrompt.js \
  frontend/src/lib/stores/gameStore.svelte.js \
  tests/story-memory.test.js tests/long-summary-prompt.test.js \
  tests/long-summary-scheduler.test.js tests/narration-prompt.test.js \
  tests/story-director-prompt.test.js tests/backend-api.test.js \
  tests/backend-desktop-runtime.test.js tests/frontend-svelte-migration.test.js
git commit -m "feat: add async llm long-term story summaries"
```

## Plan Self-Review

- Spec coverage: covers fast-model selection, asynchronous execution, latest-wins version checks, delta context freshness, timeout/failure behavior, Mock/API/Electron boundaries, migration, and tests.
- Placeholder scan: no TBD/TODO or unspecified implementation step remains.
- Interface consistency: `selectUnsummarizedTurns()` feeds both prompt builders and the scheduler; `generateLongSummary()` is the only LLM summary entry point; scheduler commit metadata matches the `storyMemory` fields.
- Scope: no vector database, no new frontend polling loop, and no unrelated story-thread lifecycle refactor.
