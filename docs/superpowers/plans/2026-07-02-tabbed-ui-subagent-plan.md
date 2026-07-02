# Tabbed UI Subagent Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` to execute this plan. Dispatch one fresh subagent per task. Each task is intentionally small; do not merge adjacent tasks unless the orchestrator explicitly says so.

**Goal:** Split the current crowded single-page game dashboard into top-tab-driven focused screens, while preserving current gameplay actions, streaming narration, onboarding, character creation, and desktop layout.

**Architecture:** Keep the current five top tabs as the primary navigation. Replace the single overloaded `dashboardContent` composition with tab-specific panels rendered from the existing `activeViewId`. Shared data renderers stay reusable, but each tab owns only the content relevant to that screen.

**Tech Stack:** Vanilla HTML/CSS/JS frontend, existing backend API, Node test runner.

## Global Constraints

- Do not expose backend identifiers, API labels, raw event ids, choice ids, risk strings, schema names, or debug parameters in visible UI.
- Keep the app desktop-only for this pass; do not add mobile adaptation.
- Preserve onboarding and character creation flow exactly: top-tab dashboard is hidden while either first-run panel is active.
- Preserve action submission behavior, backend action refresh guard, and streaming narration behavior.
- Keep the top tabs: `洞府`, `修炼`, `功法`, `秘境`, `行囊`.
- Do not read long docs during implementation. Each subagent should read only the files and ranges listed in its task plus failing test output.
- Do not stage or commit `.idea/`.

---

## Subagent Dispatch Rules

Each subagent gets:

1. This task's section only.
2. The exact files/ranges listed under "Read".
3. The exact test command listed under "Verify".

Each subagent must report:

- Files changed.
- Tests run and result.
- Any follow-up risk.

The orchestrator reviews after every task before dispatching the next one.

---

## Task 1: Add Tab Layout Contract Tests

**Purpose:** Lock the behavior before changing UI structure.

**Read:**
- `tests/frontend-event-state.test.js`
- `tests/frontend-app-wiring.test.js`
- `frontend/index.html:121-165`
- `frontend/src/app.js:394-560`

**Modify:**
- `tests/frontend-event-state.test.js`
- `tests/frontend-app-wiring.test.js`

**Requirements:**
- Add tests that assert `app.js` has a single active-view render entrypoint, named `renderActiveView`.
- Add tests that assert visible dashboard content is selected by `activeViewId`.
- Add tests that assert `洞府` is the overview tab and does not render all inventory, all techniques, all foreshadows, and full timeline at once.
- Add tests that assert `功法`, `行囊`, and `秘境` have dedicated render paths.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js tests/frontend-app-wiring.test.js`
- Expected before implementation: failing tests that mention missing `renderActiveView` or missing tab-specific render paths.

**Stop Point:** Do not edit production code in this task.

---

## Task 2: Restructure Main Dashboard Container

**Purpose:** Give the app a clean target for tab-specific screens.

**Read:**
- `frontend/index.html:121-165`
- `frontend/src/app.js:90-115`
- `frontend/src/styles.css:492-510`

**Modify:**
- `frontend/index.html`
- `frontend/src/app.js`

**Requirements:**
- Replace the four always-visible main sections inside `#dashboardContent` with one main view container:
  - Keep `.hero-scroll`.
  - Keep `#apiBanner`.
  - Add a new container with `id="activeViewContent"`.
- Keep existing onboarding and character panels unchanged.
- Add `activeViewContent: document.querySelector('#activeViewContent')` to `nodes`.
- Change action click delegation from `nodes.actionGrid` to the stable `nodes.activeViewContent`, because tab rendering will recreate `#actionGrid`.
- Do not remove existing sidebar nodes in this task.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js tests/frontend-app-wiring.test.js`
- Expected: tests for container wiring pass; render-path tests may still fail.

---

## Task 3: Add Shared Panel Markup Helpers

**Purpose:** Avoid each tab hand-building large repeated section wrappers.

**Read:**
- `frontend/src/app.js:521-680`

**Modify:**
- `frontend/src/app.js`

**Requirements:**
- Add `renderPanel({ className, title, meta, body })`.
- Add `renderSectionTitle(title, meta)`.
- Add `renderActionPanel()`, returning the existing action section markup using `buildActionCards(dailyActions)`.
- Add `renderHistoryPanel(limit = 5)`, returning history markup using existing `buildRecentHistory`, `historyCardClass`, and `formatHistoryEffectSummary`.
- Do not attach new per-card click handlers. Action clicks must still be delegated, now from `nodes.activeViewContent`.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-app-wiring.test.js tests/frontend-event-state.test.js`

---

## Task 4: Render 洞府 as Focused Overview

**Purpose:** Make the default screen readable instead of showing everything.

**Read:**
- `frontend/src/app.js:394-560`
- `frontend/src/app.js:601-680`

**Modify:**
- `frontend/src/app.js`

**Requirements:**
- Add `renderActiveView()` and call it from `render()`.
- For `activeViewId === 'home'`, render only:
  - 命途状态 panel.
  - 今日行动 panel.
  - 历史行为 panel limited to 3 entries.
  - 当前见闻 panel using the existing home/default `renderViewFocus` content.
- The overview must not render full inventory collections, full technique collections, full timeline, or all foreshadows.
- Existing `renderStatusOverview`, `renderAttributeSummary`, and history streaming card behavior must keep working.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-app-wiring.test.js tests/frontend-event-state.test.js`

---

## Task 5: Render 修炼 as Cultivation Screen

**Purpose:** Move cultivation-specific stats and breakthrough context into the 修炼 tab.

**Read:**
- `frontend/src/app.js:440-520`
- `frontend/src/app.js:622-630`
- `frontend/src/ui/views.js`

**Modify:**
- `frontend/src/app.js`

**Requirements:**
- Add `renderCultivationView()`.
- It must render:
  - 命途状态 panel with status cards and attribute summary.
  - 闭关要点 panel using `summarizeCultivationFocus()` and `buildSuggestionText()`.
  - 今日修行 action panel.
  - 历史行为 panel limited to cultivation-relevant recent entries if easy, otherwise latest 5 entries.
- Do not invent backend fields for breakthrough chance. If current data lacks a ready chance value, show existing progress and advice only.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js tests/frontend-daily-actions.test.js`

---

## Task 6: Render 功法 as Techniques Screen

**Purpose:** Move technique collection out of the main overview.

**Read:**
- `frontend/src/app.js:612-620`
- `frontend/src/app.js:641-680`

**Modify:**
- `frontend/src/app.js`

**Requirements:**
- Add `renderSkillsView()`.
- It must render:
  - 已得功法 panel using `renderCollectionCards(game.techniques, ...)`.
  - 修习节奏 panel using `renderTrainingAdvice()`.
  - 功法行动 panel using the shared action panel.
- Empty state must remain player-facing and not mention data structures.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js`

---

## Task 7: Render 行囊 as Inventory Screen

**Purpose:** Move treasure, pill, and material collections out of the overview.

**Read:**
- `frontend/src/app.js:602-610`
- `frontend/src/app.js:641-680`
- `frontend/src/app.js:1010-1045`

**Modify:**
- `frontend/src/app.js`

**Requirements:**
- Add `renderBagView()`.
- It must render:
  - 奇珍法器 panel using `renderCollectionCards(game.treasures, ...)`.
  - 丹药与材料 panel using `renderCollectionCards(buildInventoryCollection(game.inventory), ...)`.
  - 行囊行动 panel using the shared action panel.
- Keep item text player-facing; do not show raw ids.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js`

---

## Task 8: Render 秘境 as World and Foreshadow Screen

**Purpose:** Move timeline and foreshadow density into the 秘境 tab.

**Read:**
- `frontend/src/app.js:632-640`
- `frontend/src/app.js:687-696`
- `frontend/index.html:180-195`

**Modify:**
- `frontend/src/app.js`

**Requirements:**
- Add `renderRealmView()`.
- It must render:
  - 秘境线索 panel using the existing latest event and foreshadow summary.
  - 天机事件 panel using `game.timeline.slice(-6).reverse()`.
  - 长期伏笔 panel using `game.foreshadows`.
  - 秘境行动 panel using the shared action panel.
- After this task, the right sidebar may still show timeline and foreshadows; cleanup happens in Task 10.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js`

---

## Task 9: Add Hash Routing and Back/Refresh Stability

**Purpose:** Clicking tabs should feel like entering a screen, not just swapping cards.

**Read:**
- `frontend/src/app.js:48-52`
- `frontend/src/app.js:133-141`
- `frontend/src/ui/views.js`

**Modify:**
- `frontend/src/app.js`

**Requirements:**
- Add `viewIdFromHash()` and `setActiveView(viewId, { updateHash = true })`.
- Initial `activeViewId` should prefer `location.hash` when valid, then localStorage, then `home`.
- Top tab clicks must call `setActiveView(button.dataset.view)`.
- Browser back/forward via `hashchange` must update `activeViewId`, refresh immediate actions, render, and trigger backend action refresh.
- Invalid hash falls back to `home`.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-app-wiring.test.js tests/frontend-event-state.test.js`

---

## Task 10: Reduce Sidebar Duplication

**Purpose:** Once tabs own detailed content, sidebars should stop repeating too much information.

**Read:**
- `frontend/index.html:70-196`
- `frontend/src/app.js:404-432`
- `frontend/src/app.js:687-696`

**Modify:**
- `frontend/index.html`
- `frontend/src/app.js`

**Requirements:**
- Left sidebar stays as role summary, meters, main tasks, NPC ties.
- Right sidebar becomes compact resources only:
  - Keep 气血与寿元.
  - Keep 因果.
  - Keep 门派.
  - Keep 丹药与材料 as one compact text summary.
- Remove always-visible full timeline and full foreshadow sections from sidebar.
- `renderWorld()` should no longer be required for sidebar rendering. If kept, it must only feed tab content.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js tests/frontend-app-wiring.test.js`

---

## Task 11: CSS for Tab-Specific Screens

**Purpose:** Give each tab a readable layout without nested card clutter.

**Read:**
- `frontend/src/styles.css:492-520`
- `frontend/src/styles.css:793-1010`

**Modify:**
- `frontend/src/styles.css`

**Requirements:**
- Add `.view-screen`, `.view-grid`, `.view-grid.compact`, `.view-grid.split`, or equivalent classes.
- Action panels and status panels must use `--main-card-columns`, `--status-card-min-height`, and `--action-card-min-height` when they render card grids.
- Do not create cards inside cards.
- Avoid large blank center areas.
- Preserve existing hero width/height tuning variables.
- Preserve history refresh animation.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-event-state.test.js`

---

## Task 12: Browser Smoke Check and Final Integration Tests

**Purpose:** Catch visual regressions after all small tasks land.

**Read:**
- No docs. Use current app only.

**Modify:**
- Tests only if browser smoke reveals a missing assertion.

**Requirements:**
- Start backend and frontend if not already running.
- Open `http://127.0.0.1:5173/frontend/`.
- Verify each top tab:
  - `洞府`: overview only, no full inventory/technique/timeline dump.
  - `修炼`: status and cultivation action content.
  - `功法`: technique content.
  - `秘境`: timeline and foreshadows.
  - `行囊`: treasures, pills, materials.
- Verify no visible raw API/debug/internal identifiers.
- Verify one action still submits and history animation still appears.

**Verify:**
- Run: `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test`
- Expected: all tests pass.

---

## Recommended Subagent Batching

Use 12 implementer subagents, one per task. If the orchestrator wants fewer review cycles, only these pairs may be batched:

- Task 6 + Task 7, because both are collection screens.
- Task 10 + Task 11, only if the same agent is specifically focused on layout cleanup.

Do not batch Task 4, Task 9, or Task 12. They are integration-risk tasks.

## Expected Final Commit Shape

Prefer 4-6 commits:

1. `test: cover tabbed dashboard routing`
2. `feat: add active tab dashboard renderer`
3. `feat: split cultivation skills bag and realm screens`
4. `feat: add hash navigation for top tabs`
5. `style: reduce dashboard density`
6. `test: verify tabbed dashboard integration`
