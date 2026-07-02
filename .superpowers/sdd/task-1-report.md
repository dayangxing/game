# Task 1 Report: Add Tab Layout Contract Tests

## Execution mode
RED-only. Tests were added but no production code was edited.

## Files changed
- `tests/frontend-app-wiring.test.js`
- `tests/frontend-event-state.test.js`

## Test command
`/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js tests/frontend-app-wiring.test.js`

## RED evidence (as requested)
- Failures were observed in:
  - `app rendering is routed through renderActiveView for active tabs`
    - Missing `function renderActiveView(` in `frontend/src/app.js`.
  - `activeViewId selects dedicated render paths for home, 功法, 行囊, and 秘境`
    - Missing `renderActiveView` function body.
  - `洞府 overview does not render all inventory, all techniques, all foreshadows, or full timeline at once`
    - Missing `renderActiveView` required by tab-specific overview contract.
- Run result summary: `19 passed`, `3 failed`, exit code `1`.

## Self-review
- [OK] Task constraints followed: tests-only edits; no production files modified.
- [OK] Contract assertions target the requested behavior:
  - single `renderActiveView` entrypoint,
  - active-view-driven rendering routing,
  - dedicated `功法` / `行囊` / `秘境` render paths,
  - `洞府` default/overview tab behavior.
- [Concern] Current assertions are strict on current naming and string patterns, and will guide implementation to a direct contract shape.

## Fixes applied for review feedback
- Removed over-constrained checks in `frontend-app-wiring.test.js` by dropping exact `activeViewId` condition-copy assertions and exact `nodes.viewFocus*` write assertions.
- Added routing contract that `render()` must call `renderActiveView()` once, and that each `activeViewId` maps to dedicated view helpers (supported for `if` chains, `switch`, or dispatch-style lookups).
- Reworked `frontend-event-state.test.js` to stop brittle branch extraction and instead verify dedicated helper existence for `home/cultivation/skills/realm/bag`, while asserting the home/overview helper does not directly render full collection/world helpers.
- Added explicit top-tab coverage for all five labels including `修炼` in visible HTML.

## Latest verification
- Command: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js tests/frontend-app-wiring.test.js`
- Result: `19 passed`, `3 failed`, exit code `1`
- Expected failing tests in RED state:
  - `app rendering is routed through renderActiveView for active tabs` (no `renderActiveView` in `frontend/src/app.js` yet).
  - `activeViewId selects dedicated render paths for home/cultivation/skills/realm/bag` (no `renderActiveView`/helpers in `frontend/src/app.js` yet).
  - `洞府 overview does not render all inventory, all techniques, all foreshadows, or full timeline at once` (no `renderHomeView` helper yet).

## Review feedback fixes (applied)
- `tests/frontend-app-wiring.test.js`
  - Tightened lookup routing helper detection to reject dead `viewId -> helper` object literals that are never indexed.
  - `routesViaLookup` now requires both a matching mapping entry and an actual index invocation through `activeViewId` (direct map indexing call or aliasing from the map lookup before invocation).
  - Kept `if` and `switch` support intact.
- `tests/frontend-event-state.test.js`
  - Expanded the home overview contract test to forbid the full-detail helpers `renderSkillsView`, `renderBagView`, `renderRealmView`, `renderCollectionCards`, `renderTimeline`, `renderForeshadows`, and `renderViewFocus` inside `renderHomeView`.

## Latest verification output
- Command: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js tests/frontend-app-wiring.test.js`
- Result summary: `19 passed`, `3 failed`, exit code `1` (RED preserved). 

## Review fix follow-up
- Files changed:
  - `tests/frontend-app-wiring.test.js`
  - `tests/frontend-event-state.test.js`
  - `.superpowers/sdd/task-1-report.md`
- Command output summary:
  - Before edits: `19 passed`, `3 failed`, exit code `1`.
  - After edits: `19 passed`, `3 failed`, exit code `1`.
- RED-preserved evidence:
  - `app rendering is routed through renderActiveView for active tabs`
    - still fails because `frontend/src/app.js` does not yet define `renderActiveView`.
  - `activeViewId selects overview and tab-specific render routes without collapsing tabs together`
    - still fails because `renderActiveView` is not present, so tab routing cannot be inspected yet.
  - `洞府 overview does not render all inventory, all techniques, all foreshadows, or full timeline at once`
    - still fails because the overview route now depends on `renderActiveView` and a dedicated home renderer target that production has not added yet.
- Notes:
  - Relaxed per-tab route assertions so only `renderActiveView` remains an exact required entrypoint name.
  - Strengthened the `洞府` overview contract to forbid direct full-detail inventory, techniques, timeline, and foreshadow rendering patterns inside the future home route target.
