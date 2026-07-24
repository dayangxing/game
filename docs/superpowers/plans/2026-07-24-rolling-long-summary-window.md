# Rolling Long Summary Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound the LLM-facing `longSummary` to a rolling 50-formal-turn window without deleting authoritative `game.log` history or creating a context gap while a rebase summary is pending.

**Architecture:** Persist `summaryWindowStartTurn` beside the existing summary checkpoint. Normal summaries continue asynchronously, but once the rolling window moves, the scheduler rebases the summary from the authoritative last 50 turns instead of inheriting the old summary. During a stale or failed rebase, narration and story-director prompts omit the stale long summary and receive the bounded raw rolling window plus authoritative character facts.

**Tech Stack:** Node.js ES modules, Svelte mirror memory contract, existing Bailian JSON client, Node built-in tests, Vite.

## Global Constraints

- `game.log` remains lossless and is never deleted by this feature.
- Exactly the latest 50 formal turns are the rolling summary input; opening turn zero remains an anchor fact.
- `longSummary` must be bounded to 420 Chinese characters before it is persisted or exposed.
- A stale/failed rebase must not advance `summaryThroughTurn` or `summaryWindowStartTurn`.
- During a stale rebase, prompts must not send the old `longSummary` as if it were current.
- Existing game version, summary revision, latest-wins, timeout, retry, Mock-mode, and persistence behavior remains intact.
- Mirror pure memory helpers in `src/storyMemory.js` and `frontend/src/lib/storyMemory.js`.

## File Map

| File | Responsibility |
|---|---|
| `src/storyMemory.js` | Window metadata, rolling-turn projection, stale-context detection |
| `frontend/src/lib/storyMemory.js` | Browser/Mock mirror of the pure memory contract |
| `backend/src/llm/prompts/longSummaryPrompt.js` | Rolling-window prompt and rebase instructions |
| `backend/src/llm/bailianClient.js` | Enforce the persisted summary length bound |
| `backend/src/memory/longSummaryScheduler.js` | Detect window rollover and commit rebased metadata safely |
| `backend/src/llm/prompts/narrationPrompt.js` | Replace stale summary with bounded rolling raw turns |
| `backend/src/llm/prompts/storyDirectorPrompt.js` | Same freshness behavior for continuous story generation |
| `tests/story-memory.test.js` | Window selection, migration, and stale context |
| `tests/long-summary-prompt.test.js` | Rolling prompt payload and 420-char contract |
| `tests/bailian-client.test.js` | Long summary length validation |
| `tests/long-summary-scheduler.test.js` | Rebase scheduling, commit metadata, failure safety |
| `tests/narration-prompt.test.js` | Stale-summary fallback context |
| `tests/story-director-prompt.test.js` | Stale-summary fallback context |

## Interfaces

```js
const SUMMARY_WINDOW_TURNS = 50;

normalizeStoryMemory(memory, game) -> {
  ...memory,
  summaryThroughTurn: number,
  summaryRevision: number,
  summaryWindowStartTurn: number
}

selectRollingSummaryTurns(game, { maxTurns = 50 } = {}) -> {
  turns: Array<{ turn, title, action, outcome, npcLine, worldEvent }>,
  startTurn: number,
  endTurn: number,
  truncated: boolean
}

getStoryMemoryPromptContext(game) -> {
  longSummary: string,
  summaryThroughTurn: number,
  summaryWindowStartTurn: number,
  summaryWindowStale: boolean,
  unsummarizedTurns: Array<object>,
  rollingWindowTurns: Array<object>
}
```

## Task 1: Extend the pure memory contract with a 50-turn window

**Files:** `src/storyMemory.js`, `frontend/src/lib/storyMemory.js`, `tests/story-memory.test.js`

- [x] **Step 1: Add failing tests** for default/migrated `summaryWindowStartTurn`, selecting exactly the latest 50 formal turns while keeping turn zero as an anchor, and returning raw rolling turns when the stored summary window is stale.
- [x] **Step 2: Run `node --test tests/story-memory.test.js`** and confirm the new exports/fields fail.
- [x] **Step 3: Implement** `SUMMARY_WINDOW_TURNS`, `selectRollingSummaryTurns()`, and `getStoryMemoryPromptContext()`. Keep `summaryThroughTurn` and `summaryRevision` unchanged on ordinary turn recording. Treat missing legacy window metadata conservatively as window start zero.
- [x] **Step 4: Run the focused story-memory tests** and confirm all pass for both backend and frontend mirrors.

## Task 2: Make summary output bounded and explicitly rolling

**Files:** `backend/src/llm/prompts/longSummaryPrompt.js`, `backend/src/llm/bailianClient.js`, `tests/long-summary-prompt.test.js`, `tests/bailian-client.test.js`

- [x] **Step 1: Add failing tests** asserting the prompt says the source is a rolling 50-turn window and the client rejects summaries longer than 420 characters.
- [x] **Step 2: Run the prompt/client tests** and confirm the length/rebase contract fails.
- [x] **Step 3: Implement** prompt fields `summaryWindowStartTurn`, `summaryWindowEndTurn`, `rebase`, and `openingAnchor`; require the model to omit facts outside the supplied window while preserving current authoritative facts. Add a 420-character validation bound in `validateLongSummaryResult()`.
- [x] **Step 4: Run `node --test tests/long-summary-prompt.test.js tests/bailian-client.test.js`** and confirm pass.

## Task 3: Rebase the asynchronous scheduler safely

**Files:** `backend/src/memory/longSummaryScheduler.js`, `tests/long-summary-scheduler.test.js`

- [x] **Step 1: Add failing tests** for rollover detection after turn 50, a successful rebase setting `summaryWindowStartTurn` and `summaryThroughTurn`, and a failed/timed-out rebase leaving both old fields unchanged.
- [x] **Step 2: Run scheduler tests** and confirm the new behavior fails.
- [x] **Step 3: Implement** job snapshots with `rollingWindowTurns`, `targetWindowStartTurn`, and `rebase`. Schedule a rebase when the desired latest-50 start exceeds the stored start, use an empty previous summary for rebase jobs, require the accepted result to cover the snapshot end turn, and commit the new window metadata only after existing CAS checks pass.
- [x] **Step 4: Run scheduler and backend integration tests** to confirm latest-wins and persistence still pass.

## Task 4: Prevent stale summary context in narration and director prompts

**Files:** `backend/src/llm/prompts/narrationPrompt.js`, `backend/src/llm/prompts/storyDirectorPrompt.js`, `tests/narration-prompt.test.js`, `tests/story-director-prompt.test.js`

- [x] **Step 1: Add failing tests** with a game at turn 55 whose stored summary window starts at turn zero; assert the prompt omits the stale `longSummary`, includes at most 50 rolling turns, and marks the context stale.
- [x] **Step 2: Run both prompt test files** and confirm failure.
- [x] **Step 3: Use `getStoryMemoryPromptContext()`** in both builders. For fresh windows preserve current summary plus unsummarized delta; for stale windows send empty `longSummary`, `summaryWindowStale: true`, and only `rollingWindowTurns`.
- [x] **Step 4: Run both focused prompt tests** and confirm pass.

## Task 5: Full verification

- [x] Run the complete feature regression set:

```bash
node --test \
  tests/story-memory.test.js \
  tests/long-summary-prompt.test.js \
  tests/long-summary-scheduler.test.js \
  tests/long-summary-backend.test.js \
  tests/narration-prompt.test.js \
  tests/story-director-prompt.test.js \
  tests/bailian-client.test.js \
  tests/backend-api.test.js \
  tests/backend-desktop-runtime.test.js \
  tests/frontend-svelte-migration.test.js
```

- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Review the final diff and confirm no `game.log` deletion or unrelated dirty-worktree cleanup occurred.
