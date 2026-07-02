# Cultivation Web Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dependency-free local Web prototype for an LLM-driven text cultivation game.

**Architecture:** Keep game rules in pure functions and browser behavior in a thin DOM layer. The first implementation uses a local mock narrator and persists game state in `localStorage`.

**Tech Stack:** Static HTML, CSS, JavaScript ES modules, Node built-in test runner.

## Global Constraints

- No package installation is required.
- The UI must be Chinese and directly playable as the first screen.
- Rules and random evolution must be deterministic enough to test.
- The mock narrator is the default; API mode is represented as a UI configuration affordance.

---

### Task 1: Game Engine

**Files:**
- Create: `package.json`
- Create: `tests/engine.test.js`
- Create: `src/engine.js`

**Interfaces:**
- Produces: `createGame(seed?: number): GameState`
- Produces: `advanceTurn(state: GameState, command: string): GameState`
- Produces: `exportNovel(state: GameState): string`

- [ ] Write failing tests for initial state, cultivation progress, NPC memory, world event creation, and export text.
- [ ] Run `npm test` and verify tests fail because `src/engine.js` does not exist.
- [ ] Implement the minimal engine functions.
- [ ] Run `npm test` and verify all tests pass.

### Task 2: Web Interface

**Files:**
- Create: `index.html`
- Create: `src/styles.css`
- Create: `src/app.js`

**Interfaces:**
- Consumes: `createGame`, `advanceTurn`, `exportNovel`.

- [ ] Build the three-column app shell.
- [ ] Render character state, narrative log, action suggestions, world events, foreshadowing, and NPC memory.
- [ ] Add command submission, suggested action buttons, reset, save, and export.
- [ ] Persist state in `localStorage`.

### Task 3: Verification

**Files:**
- Modify: none unless defects are found.

- [ ] Run `npm test`.
- [ ] Start a static server with `python3 -m http.server`.
- [ ] Verify the app loads locally and no obvious runtime errors appear.
