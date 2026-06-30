# Model Guide Prologue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Officially connect the DashScope compatible-mode model, turn the first-run guide into a gameplay feature explanation, and expand 《问道浮生》 with a larger prologue plus a richer Qingyun Sect / Mist Hidden Secret Realm event pool.

**Architecture:** Keep secrets in local ignored environment files, load them before the backend app is created, and expose only masked model health to the frontend. Keep the guide as frontend-only functional onboarding, then use the existing backend onboarding chain as the narrative prologue that must finish before random formal character creation.

**Tech Stack:** Static HTML/CSS/JavaScript ES modules, Node built-in `node:test`, existing backend `Request`/`Response` app, DashScope compatible-mode `/chat/completions`, no build step.

## Global Constraints

- `BASE_URL` is `https://dashscope.aliyuncs.com/compatible-mode/v1`.
- Store the provided model key only in local ignored configuration; never commit it or echo it in logs.
- `.env` and `.env.local` files must be ignored by git.
- The first-run guide is a functional gameplay explanation, not story progression.
- The prologue starts after the guide and before formal character creation.
- Formal character creation remains locked until the full prologue is complete.
- The final game target is single-player, not open world, with no offline idle rewards.
- LLM output may polish narration but must not change rule rewards, items, stats, flags, or event eligibility.
- Do not expose API field names, ids, debug risk labels, or raw provider jargon in player-facing UI copy.
- Run targeted tests during each task and the full `node --test` suite before final handoff.

---

## File Structure

- Create `backend/src/config/env.js`: small `.env.local` / `.env` loader for local secrets.
- Modify `backend/src/server.js`: load local env before `createBackendApp()`.
- Modify `backend/src/app.js`: expose masked `GET /api/v1/model-health`.
- Modify `.gitignore`: ignore local env files.
- Modify `frontend/src/ui/onboardingGuide.js`: replace mixed story/API language with feature explanation.
- Modify `backend/src/domain/onboarding.js`: expand the backend onboarding chain into the prologue.
- Modify `backend/src/domain/events/eventCatalog.js`: add Qingyun, Mist Hidden, lifespan pressure, and ascension scam events.
- Modify tests under `tests/`: add focused red tests for each behavior.
- Modify README / docs: document startup, env setup, and the first-run flow.

---

### Task 1: Local Model Configuration

**Files:**
- Create: `backend/src/config/env.js`
- Modify: `backend/src/server.js`
- Modify: `backend/src/app.js`
- Modify: `.gitignore`
- Test: `tests/model-config.test.js`

**Interfaces:**
- Produces: `loadLocalEnv({ cwd, env }): { loadedFiles: string[] }`
- Produces endpoint: `GET /api/v1/model-health`

- [ ] Write failing tests that `.env.local` loads `BAILIAN_API_KEY`, `.env` is a fallback, `.env*` is ignored, and model-health masks secrets.
- [ ] Run targeted tests and confirm they fail because the loader and endpoint are missing.
- [ ] Implement the loader and endpoint without logging the key.
- [ ] Write the provided key into local `.env.local` only.
- [ ] Run targeted tests and confirm they pass.

### Task 2: Functional First-Run Guide

**Files:**
- Modify: `frontend/src/ui/onboardingGuide.js`
- Test: `tests/frontend-onboarding.test.js`

**Interfaces:**
- Preserves: `guideSteps`, `getGuideStep(index)`, `markGuideCompleted(storage)`, `shouldAutoOpenGuide(storage)`

- [ ] Write failing tests for six functional guide steps: layout, daily actions, state panels, lifespan pressure, prologue/character creation, and save/model narration.
- [ ] Assert guide text does not include API, LLM, backend, schema, ids, or debug wording.
- [ ] Update guide copy to be player-facing and non-story.
- [ ] Run targeted tests and confirm they pass.

### Task 3: Expanded Prologue

**Files:**
- Modify: `backend/src/domain/onboarding.js`
- Test: `tests/onboarding-character.test.js`
- Test: `tests/backend-api.test.js`

**Interfaces:**
- Preserves existing onboarding API names for compatibility.
- Expands `ONBOARDING_STEPS` to 12 prologue chapters.

- [ ] Write failing tests that the prologue has 12 ordered chapters and includes Qingyun Sect, Mist Hidden Secret Realm, lifespan pressure, the ascension contract, and a clear post-prologue character creation handoff.
- [ ] Assert character creation remains locked until all 12 chapters are completed.
- [ ] Implement richer chapter bodies, commands, log npc lines, and truth flags.
- [ ] Run targeted tests and confirm they pass.

### Task 4: Event Library Expansion

**Files:**
- Modify: `backend/src/domain/events/eventCatalog.js`
- Test: `tests/event-engine.test.js`

**Interfaces:**
- Preserves: `EVENT_CATALOG`, `TRUTH_FLAGS`

- [ ] Write failing tests for a larger event pool and required themes: Qingyun Sect politics, Mist archive, lifespan debt, false ascension, and NPC relationship hooks.
- [ ] Add events using existing effect helpers only.
- [ ] Ensure each primary formal view can still produce at least three event actions.
- [ ] Run targeted tests and confirm they pass.

### Task 5: Documentation And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/backend-model-selection.md`

- [ ] Document `.env.local`, the DashScope base URL, model-health, and the first-run guide -> prologue -> character creation flow.
- [ ] Run `node --test`.
- [ ] Start backend and frontend locally, verify `model-health` reports configured without exposing the key.
- [ ] Commit and push `codex/development`.
