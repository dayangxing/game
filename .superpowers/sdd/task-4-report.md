# Task 4 Report: Breakthrough Probability

## Status

Verified and ready to commit.

## Requirements Source

- `/Users/ruilifeng/Documents/game/.superpowers/sdd/task-4-brief.md`

## TDD Evidence

### RED

Command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/breakthrough.test.js tests/backend-api.test.js tests/frontend-backend-integration.test.js
```

Observed failure:

- `tests/breakthrough.test.js` failed to import `calculateBreakthroughChance` because `backend/src/domain/progression.js` did not yet export it.
- `tests/backend-api.test.js` failed because cultivation daily actions still returned normal `event` actions instead of a `breakthrough` action.

### GREEN

Targeted command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/breakthrough.test.js tests/backend-api.test.js tests/frontend-backend-integration.test.js
```

Result:

- `32` tests passed
- `0` tests failed

Full suite command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js
```

Result:

- `132` tests passed
- `0` tests failed

## Files Changed

- `backend/src/domain/progression.js`
- `backend/src/domain/events/eventCatalog.js`
- `backend/src/domain/events/eventSelector.js`
- `backend/src/app.js`
- `tests/breakthrough.test.js`
- `tests/backend-api.test.js`

## Implementation Summary

- Added breakthrough readiness, preview math, realm advancement, deterministic seeded resolution, and failure costs in `progression.js`.
- Added a dedicated breakthrough action source seeded from cultivation view selection in `eventSelector.js`.
- Added a lightweight breakthrough event definition in `eventCatalog.js` for shared action metadata.
- Routed `action.source === 'breakthrough'` through `handleTurn` in `backend/src/app.js`, including snapshots and narration handling.
- Added unit coverage for preview math, bonuses, deterministic success/failure, and failure rollback in `tests/breakthrough.test.js`.
- Added backend API coverage for breakthrough action surfacing and turn routing in `tests/backend-api.test.js`.

## Self-Review

- Preserved existing Task 1-3 behavior: all pre-existing tests remained green in the full suite.
- Kept the change scoped to backend progression/action routing and tests only.
- Reused the existing resolved-turn narration/snapshot flow instead of adding a parallel response shape.
- Did not touch frontend UI, prompts, or docs outside the required task report.

## Concerns

- No blocking concerns after verification.

## Fix Report

### Findings addressed

1. Breakthrough-only cultivation action lists now compose `尝试突破` with fallback daily actions when ordinary cultivation event choices are exhausted, while keeping breakthrough first when it is available.
2. Daily-action JSON responses now expose only player-facing action fields. Internal routing/debug fields stay in `pendingActions` for tutorial, fallback, event, and breakthrough handling.

### RED evidence

Command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/backend-api.test.js
```

Result:

- `19` tests passed
- `7` tests failed
- Failures proved two regressions:
  - `POST /api/v1/daily-actions returns breakthrough plus fallback actions when cultivation events are exhausted` returned only `1` action instead of `4`.
  - Public daily-action payload tests failed because responses still included internal fields outside the allowed player-facing shape.

### GREEN evidence

Targeted command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/backend-api.test.js
```

Result:

- `26` tests passed
- `0` tests failed

Task-slice command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/breakthrough.test.js tests/backend-api.test.js tests/frontend-backend-integration.test.js
```

Result:

- `34` tests passed
- `0` tests failed

Full suite command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js
```

Result:

- `134` tests passed
- `0` tests failed

### Files changed

- `backend/src/app.js`
- `backend/src/domain/events/eventResult.js`
- `tests/backend-api.test.js`

## Fix Report 2

### Findings addressed

1. Public daily-action `meta` no longer serializes the internal risk tokens `low`, `medium`, or `high`. Event and breakthrough actions now expose player-facing Chinese risk labels instead.

### RED evidence

Command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/backend-api.test.js
```

Result:

- `26` tests passed
- `1` test failed
- The new regression test failed because at least one public daily-action `meta` field still contained a raw risk token.

### GREEN evidence

Targeted command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/backend-api.test.js
```

Result:

- `27` tests passed
- `0` tests failed

Full suite command:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js
```

Result:

- `135` tests passed
- `0` tests failed

### Files changed

- `backend/src/domain/events/eventSelector.js`
- `tests/backend-api.test.js`
