# Continuous Story Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed home action cards with a continuous story loop where the LLM generates narrative choices and vague effect hints while backend rules compute all numeric state changes.

**Architecture:** Add a focused story-director layer beside the existing event system. The director produces player-visible prose, optional choices, and normalized `effectHints`; the backend validates those hints and resolves concrete deltas through deterministic rules before writing game state and story memory. The frontend consumes the same SSE path, but the home tab renders a `继续` / choice state machine instead of daily action cards.

**Tech Stack:** Node.js ESM, native `node:test`, Fetch `Response`/`ReadableStream`, existing backend app router, existing frontend vanilla JS modules, existing localStorage save model.

## Global Constraints

- The LLM generates story text, choices, NPC lines, and vague effect directions only; it never writes final numeric values.
- The backend remains authoritative for lifespan, health, spirit, cultivation, attributes, NPC affinity, inventory, techniques, treasures, foreshadows, and turn/version changes.
- The frontend must never display raw ids, prompt content, JSON, `target`, `direction`, `intensity`, `eventId`, `choiceId`, schema names, model names, API keys, or debug parameters.
- Home is the only tab with player action controls; other tabs stay informational.
- Streaming narration must still reach the frontend before the final turn result is complete.
- Existing onboarding and character creation gates must remain ahead of the dashboard.
- Existing `/api/v1/turns/stream` action-id flow must remain compatible while the new continue/choice flow is added.
- `main` is release only; implement and commit this work on `dev`.
- The working tree currently contains older uncommitted code changes. Stage only files changed by the current task.

---

## File Structure

Create:

- `backend/src/domain/director/effectHints.js`  
  Owns allowed enums, hint normalization, rejection reasons, intensity-to-base-unit mapping, and deterministic conversion from vague hints into concrete rule deltas.

- `backend/src/agents/storyDirector.js`  
  Owns story-director output normalization, safe fallback output, and the high-level `invoke` / `stream` adapter used by `backend/src/app.js`.

- `backend/src/llm/prompts/storyDirectorPrompt.js`  
  Builds the compact context package and prompt constraints for continuous story generation.

- `tests/director-effect-hints.test.js`  
  Unit tests for hint validation and deterministic numeric resolution.

- `tests/story-director-prompt.test.js`  
  Unit tests for prompt boundaries, context compression, and forbidden numeric authority.

Modify:

- `backend/src/app.js`  
  Add pending director choices to app state and extend `/api/v1/turns/stream` to accept `{ type: "continue" }` and `{ type: "choice", choiceId }`.

- `backend/src/llm/bailianClient.js`  
  Add `streamStoryDirector()` and `generateStoryDirector()` wrappers that use the new prompt while preserving existing narration methods.

- `backend/src/llm/prompts/narrationPrompt.js`  
  Keep existing post-resolution narration for old action flow unchanged in the first implementation pass.

- `frontend/src/api/gameApi.js`  
  Add `continueStoryStream(game, input, handlers)` and SSE parsing for `story_delta`, `choices_ready`, `state_patch`, and `done`.

- `frontend/src/app.js`  
  Replace the home action-card controls with story controls and wire `继续` / generated choice clicks to the new API method.

- `frontend/src/styles.css`  
  Add compact story-control, choice, and streaming states without changing non-home tabs into action surfaces.

- `frontend/src/mock/engine.js` and `src/engine.js`  
  Route mock story progression through existing `advanceTurn()` so file-protocol mode remains usable.

- Existing tests under `tests/backend-api.test.js`, `tests/frontend-api.test.js`, `tests/frontend-event-state.test.js`, `tests/frontend-views.test.js`, `tests/narration-prompt.test.js`, and `tests/backend-server-stream.test.js`.

---

### Task 1: Effect Hint Contract And Deterministic Resolver

**Files:**
- Create: `backend/src/domain/director/effectHints.js`
- Create: `tests/director-effect-hints.test.js`
- Modify: `backend/src/domain/events/effectResolver.js`

**Interfaces:**
- Produces: `ALLOWED_EFFECT_TARGETS: string[]`
- Produces: `ALLOWED_EFFECT_DIRECTIONS: string[]`
- Produces: `ALLOWED_EFFECT_INTENSITIES: string[]`
- Produces: `normalizeEffectHints(effectHints: unknown[], game: object) => { accepted: object[], rejected: object[] }`
- Produces: `resolveDirectorEffectHints({ game: object, effectHints: object[], now: Date }) => { game: object, summary: string, appliedEffects: object[], rejected: object[] }`
- Consumes: `applyEffects(game, effects)` from `backend/src/domain/events/effectResolver.js`

- [ ] **Step 1: Write failing tests for normalization**

Add this to `tests/director-effect-hints.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeEffectHints,
  resolveDirectorEffectHints
} from '../backend/src/domain/director/effectHints.js';
import { createGame } from '../src/engine.js';

function formalGame(overrides = {}) {
  return {
    ...createGame(31),
    onboarding: { completed: true, stepId: 'formal_life', completedStepIds: [], unlockedCharacterCreation: true },
    character: {
      name: '顾清河',
      origin: '山野孤子',
      spiritualRoot: '雷木双灵根',
      traits: ['早慧', '命火绵长'],
      attributes: {
        rootBone: 6,
        comprehension: 7,
        fortune: 4,
        willpower: 5,
        lifeSeed: 3
      }
    },
    inventory: { materials: { 凝露草: 2 }, pills: {} },
    karma: { karma: 0, evil: 0, fate: 0, debts: [], vendettas: [], futureEventFlags: [] },
    flags: {},
    cooldowns: {},
    ...overrides
  };
}

test('normalizes allowed story director effect hints and rejects unknown internal fields', () => {
  const game = formalGame();
  const result = normalizeEffectHints([
    { target: 'lifespan', direction: 'down', intensity: 'medium', amount: 999 },
    { target: 'comprehension', direction: 'up', intensity: 'critical' },
    { target: 'debugSecret', direction: 'up', intensity: 'high' },
    { target: 'health', direction: 'sideways', intensity: 'strange' }
  ], game);

  assert.deepEqual(result.accepted, [
    { target: 'lifespan', direction: 'down', intensity: 'medium' },
    { target: 'comprehension', direction: 'up', intensity: 'small' },
    { target: 'health', direction: 'stable', intensity: 'small' }
  ]);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].target, 'debugSecret');
  assert.doesNotMatch(JSON.stringify(result), /999/);
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/director-effect-hints.test.js
```

Expected: FAIL with module-not-found for `backend/src/domain/director/effectHints.js`.

- [ ] **Step 3: Implement normalization**

Create `backend/src/domain/director/effectHints.js`:

```js
export const ALLOWED_EFFECT_TARGETS = [
  'lifespan',
  'health',
  'spirit',
  'cultivation',
  'rootBone',
  'comprehension',
  'fortune',
  'willpower',
  'lifeSeed',
  'mind',
  'fate',
  'npc_affinity',
  'item',
  'technique',
  'foreshadow',
  'sect_reputation',
  'injury',
  'karma'
];

export const ALLOWED_EFFECT_DIRECTIONS = [
  'up',
  'down',
  'advance',
  'reveal',
  'consume',
  'gain',
  'lose',
  'stable'
];

export const ALLOWED_EFFECT_INTENSITIES = [
  'tiny',
  'small',
  'medium',
  'high',
  'critical'
];

const ATTRIBUTE_TARGETS = new Set(['rootBone', 'comprehension', 'fortune', 'willpower', 'lifeSeed']);
const TARGETS = new Set(ALLOWED_EFFECT_TARGETS);
const DIRECTIONS = new Set(ALLOWED_EFFECT_DIRECTIONS);
const INTENSITIES = new Set(ALLOWED_EFFECT_INTENSITIES);

export function normalizeEffectHints(effectHints = [], game = {}) {
  const accepted = [];
  const rejected = [];

  if (!Array.isArray(effectHints)) {
    return { accepted, rejected: [{ reason: 'not_array' }] };
  }

  for (const rawHint of effectHints) {
    const target = String(rawHint?.target ?? '').trim();
    if (!TARGETS.has(target)) {
      rejected.push({ target, reason: 'unknown_target' });
      continue;
    }

    const direction = DIRECTIONS.has(rawHint?.direction) ? rawHint.direction : 'stable';
    let intensity = INTENSITIES.has(rawHint?.intensity) ? rawHint.intensity : 'small';

    if (ATTRIBUTE_TARGETS.has(target) && intensity !== 'tiny') {
      intensity = hasAttributeStoryAuthorization(rawHint, game) ? 'small' : 'small';
    }

    if (intensity === 'critical' && !hasCriticalStoryAuthorization(rawHint, game)) {
      intensity = 'high';
    }

    const normalized = { target, direction, intensity };
    if (target === 'npc_affinity' && typeof rawHint?.npcId === 'string') normalized.npcId = rawHint.npcId;
    if (target === 'foreshadow' && typeof rawHint?.topic === 'string') normalized.topic = rawHint.topic.slice(0, 24);
    if ((target === 'item' || target === 'technique') && typeof rawHint?.id === 'string') normalized.id = rawHint.id;

    accepted.push(normalized);
  }

  return { accepted, rejected };
}

function hasCriticalStoryAuthorization(rawHint, game) {
  return Boolean(rawHint?.storyAuthorized === true || game?.flags?.critical_story_authorized);
}

function hasAttributeStoryAuthorization(rawHint, game) {
  return Boolean(rawHint?.storyAuthorized === true || game?.flags?.attribute_story_authorized);
}
```

- [ ] **Step 4: Run normalization test and verify it passes**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/director-effect-hints.test.js
```

Expected: PASS for the normalization test.

- [ ] **Step 5: Write failing tests for deterministic numeric resolution**

Append:

```js
test('resolves vague lifespan and comprehension hints into bounded backend state changes', () => {
  const game = formalGame({
    player: {
      ...createGame(31).player,
      lifespan: 93,
      maxLifespan: 120,
      health: 136,
      maxHealth: 136,
      qi: 60,
      mood: 50,
      cultivationProgress: 40,
      sectRelation: 20
    }
  });

  const result = resolveDirectorEffectHints({
    game,
    effectHints: [
      { target: 'lifespan', direction: 'down', intensity: 'medium' },
      { target: 'cultivation', direction: 'up', intensity: 'small' },
      { target: 'npc_affinity', npcId: 'lin_shijie', direction: 'up', intensity: 'small' }
    ],
    now: new Date('2026-07-03T08:00:00.000Z')
  });

  assert.equal(result.game.player.lifespan, 89);
  assert.equal(result.game.player.cultivationProgress, 43);
  assert.equal(result.game.npcs.find((npc) => npc.name === '林师姐').affinity, 37);
  assert.match(result.summary, /寿元|修行|林师姐/);
  assert.deepEqual(result.appliedEffects.map((effect) => effect.type), ['lifespan', 'stat', 'relation']);
});
```

- [ ] **Step 6: Implement numeric resolution**

Extend `backend/src/domain/director/effectHints.js`:

```js
import { applyEffects } from '../events/effectResolver.js';

const BASE_BY_INTENSITY = {
  tiny: 1,
  small: 3,
  medium: 6,
  high: 11,
  critical: 16
};

const PLAYER_STAT_TARGETS = {
  spirit: 'player.qi',
  cultivation: 'player.cultivationProgress',
  mind: 'player.mood',
  sect_reputation: 'player.sectRelation'
};

export function resolveDirectorEffectHints({ game, effectHints = [], now = new Date() }) {
  const normalized = normalizeEffectHints(effectHints, game);
  const effects = normalized.accepted
    .map((hint) => hintToRuleEffect(game, hint))
    .filter(Boolean);
  const nextGame = applyEffects(game, effects);

  return {
    game: nextGame,
    summary: summarizeEffects(normalized.accepted, effects),
    appliedEffects: effects,
    rejected: normalized.rejected,
    resolvedAt: now.toISOString()
  };
}

function hintToRuleEffect(game, hint) {
  const magnitude = signedMagnitude(game, hint);

  if (hint.target === 'lifespan') return { type: 'lifespan', delta: magnitude };
  if (hint.target === 'health') return { type: 'vitality', delta: magnitude };
  if (hint.target === 'karma') return { type: 'karma', delta: magnitude };
  if (hint.target === 'npc_affinity' && hint.npcId) return { type: 'relation', npcId: hint.npcId, delta: magnitude };
  if (PLAYER_STAT_TARGETS[hint.target]) return { type: 'stat', path: PLAYER_STAT_TARGETS[hint.target], delta: magnitude };
  if (['rootBone', 'comprehension', 'fortune', 'willpower', 'lifeSeed'].includes(hint.target)) {
    return { type: 'attribute', key: hint.target, delta: Math.sign(magnitude) || 0 };
  }
  if (hint.target === 'foreshadow' && (hint.direction === 'advance' || hint.direction === 'reveal')) {
    return { type: 'futureEvent', id: normalizeForeshadowFlag(hint.topic) };
  }

  return null;
}

function signedMagnitude(game, hint) {
  const base = BASE_BY_INTENSITY[hint.intensity] ?? BASE_BY_INTENSITY.small;
  const directionSign = ['down', 'consume', 'lose'].includes(hint.direction) ? -1 : 1;
  if (hint.direction === 'stable') return 0;

  const attributes = game.character?.attributes ?? {};
  const adjusted = applyAttributeAdjustment(base, hint.target, directionSign, attributes);
  return directionSign * Math.max(1, Math.round(adjusted));
}

function applyAttributeAdjustment(base, target, directionSign, attributes) {
  if (directionSign < 0 && target === 'lifespan') return Math.max(1, base - Math.floor((attributes.lifeSeed ?? 1) / 3));
  if (directionSign < 0 && target === 'health') return Math.max(1, base - Math.floor((attributes.rootBone ?? 1) / 3));
  if (directionSign > 0 && target === 'cultivation') return base + Math.floor((attributes.comprehension ?? 1) / 4);
  if (directionSign > 0 && target === 'npc_affinity') return base;
  return base;
}

function normalizeForeshadowFlag(topic = 'story_thread') {
  const text = String(topic || 'story_thread');
  if (text.includes('飞升')) return 'director_ascension_thread';
  if (text.includes('雾隐')) return 'director_mist_thread';
  return `director_${text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'story_thread'}`;
}

function summarizeEffects(hints, effects) {
  const labels = {
    lifespan: '寿元',
    health: '气血',
    cultivation: '修行',
    spirit: '灵力',
    npc_affinity: '林师姐',
    foreshadow: '伏笔'
  };
  const parts = hints
    .filter((hint) => hint.direction !== 'stable')
    .map((hint) => labels[hint.target] ?? hint.target);
  return parts.length ? `${[...new Set(parts)].join('、')}发生变化。` : '气机平稳，没有明显变化。';
}
```

- [ ] **Step 7: Keep event resolver changes scoped**

Do not export private helpers from `backend/src/domain/events/effectResolver.js` during this task. `resolveDirectorEffectHints()` must call the existing public `applyEffects()` function only, and it must not add realm advancement.

- [ ] **Step 8: Run focused tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/director-effect-hints.test.js tests/event-engine.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit task 1 only**

Run:

```bash
git add backend/src/domain/director/effectHints.js backend/src/domain/events/effectResolver.js tests/director-effect-hints.test.js
git commit -m "feat: add story director effect hints"
```

---

### Task 2: Story Director Prompt And Output Normalization

**Files:**
- Create: `backend/src/llm/prompts/storyDirectorPrompt.js`
- Create: `backend/src/agents/storyDirector.js`
- Create: `tests/story-director-prompt.test.js`
- Modify: `backend/src/llm/bailianClient.js`

**Interfaces:**
- Consumes: `normalizeEffectHints(effectHints, game)`
- Produces: `buildStoryDirectorMessages({ game, input }) => Array<{ role: string, content: string }>`
- Produces: `normalizeDirectorOutput(rawOutput: unknown, game: object) => { status, scene, mode, npcLines, choices, effectHints, memoryHints }`
- Produces: `createStoryDirector({ llm }) => { invoke(input), stream(input) }`
- Produces: `llm.generateStoryDirector({ game, input })`
- Produces: `llm.streamStoryDirector({ game, input })`

- [ ] **Step 1: Write failing prompt boundary tests**

Add `tests/story-director-prompt.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStoryDirectorMessages } from '../backend/src/llm/prompts/storyDirectorPrompt.js';
import { normalizeDirectorOutput } from '../backend/src/agents/storyDirector.js';
import { createGame } from '../src/engine.js';

test('story director prompt sends compact context and forbids numeric authority', () => {
  const game = {
    ...createGame(31),
    onboarding: { completed: true },
    storyMemory: {
      longSummary: '顾清河在青云宗追查雾隐秘境与飞升骗局。',
      recentTurns: [{ turn: 1, title: '命火微澜', action: '继续', outcome: '命火异常。' }],
      openThreads: [{ title: '飞升骗局伏笔', detail: '飞升传闻前后矛盾。', status: '未解' }],
      characterNotes: [{ name: '林师姐', role: '内门弟子', affinity: 34, tone: '谨慎', memories: ['提醒过命火异常。'] }],
      resolvedThreads: [],
      lastUpdatedTurn: 1
    }
  };
  const messages = buildStoryDirectorMessages({ game, input: { type: 'continue' } });
  const system = messages.find((message) => message.role === 'system').content;
  const user = JSON.parse(messages.find((message) => message.role === 'user').content);

  assert.match(system, /连续剧情导演/);
  assert.match(system, /不得输出具体数值/);
  assert.match(system, /effectHints/);
  assert.match(system, /target/);
  assert.match(system, /direction/);
  assert.match(system, /intensity/);
  assert.equal(user.task, 'continuous_story_director');
  assert.equal(user.input.type, 'continue');
  assert.equal(user.context.storyMemory.longSummary.includes('飞升骗局'), true);
  assert.equal(user.context.recentTurns.length, 1);
  assert.doesNotMatch(JSON.stringify(user), /apiKey|baseUrl|prompt|debug/i);
});
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/story-director-prompt.test.js
```

Expected: FAIL with module-not-found for the new prompt/agent files.

- [ ] **Step 3: Implement prompt builder**

Create `backend/src/llm/prompts/storyDirectorPrompt.js`:

```js
import {
  ALLOWED_EFFECT_DIRECTIONS,
  ALLOWED_EFFECT_INTENSITIES,
  ALLOWED_EFFECT_TARGETS
} from '../../domain/director/effectHints.js';

const SYSTEM_PROMPT = [
  '你是《问道浮生》的连续剧情导演。',
  '你负责根据角色状态、近期剧情、人物关系和伏笔，生成下一段连续剧情。',
  '你可以生成行动选项，但只能给 effectHints 这种模糊影响判断。',
  '不得输出具体数值，例如寿元-3、好感+5、灵力+12。',
  '不得让玩家获得未授权高阶功法、宝物、境界或主线真相。',
  'NPC 没有剧情必要时不要出场；出场时只能使用已知 NPC。',
  '输出必须是合法 JSON object，不要 Markdown、代码块、解释文字或系统提示。',
  '',
  '允许的 effectHints target：',
  ALLOWED_EFFECT_TARGETS.join(', '),
  '允许的 direction：',
  ALLOWED_EFFECT_DIRECTIONS.join(', '),
  '允许的 intensity：',
  ALLOWED_EFFECT_INTENSITIES.join(', '),
  '',
  '输出 schema：',
  '{',
  '  "scene": "string，120到260个汉字，连续剧情正文",',
  '  "mode": "continue 或 choice",',
  '  "npcLines": [{"npcId":"string","speaker":"string","line":"string"}],',
  '  "effectHints": [{"target":"string","direction":"string","intensity":"string","topic":"string"}],',
  '  "choices": [{"id":"string","text":"string","tone":"string","effectHints":[...]}],',
  '  "memoryHints": ["string"]',
  '}'
].join('\n');

export function buildStoryDirectorMessages({ game, input }) {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'continuous_story_director',
        instruction: '生成连续剧情。选择可以由你生成，具体数值由后端规则结算。',
        input: pickInput(input),
        context: pickContext(game),
        hardConstraints: [
          '不得输出具体数值。',
          '不得生成与近期剧情无关的选项。',
          '不得暴露 JSON 字段给玩家。',
          '没有 NPC 参与时 npcLines 必须为空数组。',
          'mode 为 choice 时 choices 必须有 2 到 4 项。',
          'mode 为 continue 时 choices 必须为空数组。'
        ]
      })
    }
  ];
}

function pickInput(input = {}) {
  return {
    type: input.type === 'choice' ? 'choice' : 'continue',
    choiceText: text(input.choiceText),
    previousScene: text(input.previousScene)
  };
}

function pickContext(game) {
  const memory = game.storyMemory ?? {};
  return {
    turn: game.turn,
    calendar: game.calendar,
    player: {
      name: game.player?.name,
      realm: game.player?.realm,
      location: game.player?.location,
      health: game.player?.health,
      maxHealth: game.player?.maxHealth,
      lifespan: game.player?.lifespan,
      maxLifespan: game.player?.maxLifespan,
      qi: game.player?.qi,
      mood: game.player?.mood,
      cultivationProgress: game.player?.cultivationProgress,
      sectRelation: game.player?.sectRelation
    },
    attributes: game.character?.attributes ?? {},
    resources: {
      treasures: (game.treasures ?? []).slice(-4).map((item) => item.name),
      techniques: (game.techniques ?? []).slice(-4).map((item) => item.name),
      pills: Object.keys(game.inventory?.pills ?? {}).slice(0, 6),
      materials: Object.keys(game.inventory?.materials ?? {}).slice(0, 6)
    },
    npcs: (game.npcs ?? []).map((npc) => ({
      name: npc.name,
      role: npc.role,
      affinity: npc.affinity,
      tone: npc.tone,
      memories: (npc.memories ?? []).slice(-3)
    })),
    storyMemory: {
      longSummary: text(memory.longSummary),
      openThreads: (memory.openThreads ?? []).slice(-8),
      characterNotes: (memory.characterNotes ?? []).slice(-6)
    },
    recentTurns: (memory.recentTurns ?? []).slice(-10)
  };
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}
```

- [ ] **Step 4: Implement director output normalization**

Create `backend/src/agents/storyDirector.js`:

```js
import { normalizeEffectHints } from '../domain/director/effectHints.js';
import { buildStoryDirectorMessages } from '../llm/prompts/storyDirectorPrompt.js';

export function createStoryDirector({ llm }) {
  return {
    async invoke({ game, input }) {
      if (!llm.generateStoryDirector) return buildFallbackDirectorOutput({ game, input });
      const raw = await llm.generateStoryDirector({ game, input });
      return normalizeDirectorOutput(raw, game);
    },
    async *stream({ game, input }) {
      if (!llm.streamStoryDirector) {
        yield { type: 'director_result', data: await this.invoke({ game, input }) };
        return;
      }
      let rawText = '';
      for await (const chunk of llm.streamStoryDirector({ game, input })) {
        const text = String(chunk ?? '');
        if (!text) continue;
        rawText += text;
        yield { type: 'story_delta', data: { text } };
      }
      yield { type: 'director_result', data: normalizeDirectorOutput(JSON.parse(rawText), game) };
    }
  };
}

export function normalizeDirectorOutput(rawOutput, game) {
  const raw = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : (rawOutput ?? {});
  const mode = raw.mode === 'choice' ? 'choice' : 'continue';
  const choices = mode === 'choice' ? normalizeChoices(raw.choices, game).slice(0, 4) : [];
  const rootHints = normalizeEffectHints(raw.effectHints, game);

  return {
    status: 'generated',
    scene: text(raw.scene, '你静坐片刻，命火在丹田深处微微摇曳。'),
    mode: choices.length >= 2 ? 'choice' : 'continue',
    npcLines: normalizeNpcLines(raw.npcLines, game),
    effectHints: rootHints.accepted,
    rejectedEffectHints: rootHints.rejected,
    choices: choices.length >= 2 ? choices : [],
    memoryHints: Array.isArray(raw.memoryHints) ? raw.memoryHints.slice(0, 4).map((item) => text(item, '')).filter(Boolean) : []
  };
}

export function buildFallbackDirectorOutput({ game, input }) {
  return {
    status: 'fallback',
    scene: '你收束心神，沿经脉缓缓运转一周天。今日并无惊变，唯有命火在灵台深处轻轻摇晃，提醒你求道之路仍受寿元所限。',
    mode: 'continue',
    npcLines: [],
    effectHints: [{ target: 'lifespan', direction: 'down', intensity: 'tiny' }],
    rejectedEffectHints: [],
    choices: [],
    memoryHints: ['命火与寿元压力仍在持续。']
  };
}

export function buildStoryDirectorRequest({ game, input }) {
  return buildStoryDirectorMessages({ game, input });
}

function normalizeChoices(choices = [], game) {
  if (!Array.isArray(choices)) return [];
  return choices.map((choice, index) => {
    const normalized = normalizeEffectHints(choice?.effectHints, game);
    return {
      id: safeChoiceId(choice?.id, index),
      text: text(choice?.text, `顺势观察第${index + 1}处异动`),
      tone: text(choice?.tone, 'mystery'),
      effectHints: normalized.accepted,
      rejectedEffectHints: normalized.rejected
    };
  }).filter((choice) => choice.text.length > 0);
}

function normalizeNpcLines(lines = [], game) {
  if (!Array.isArray(lines)) return [];
  const knownNames = new Set((game.npcs ?? []).map((npc) => npc.name));
  return lines.slice(0, 2)
    .map((line) => ({
      npcId: text(line?.npcId, ''),
      speaker: text(line?.speaker, ''),
      line: text(line?.line, '')
    }))
    .filter((line) => line.line && knownNames.has(line.speaker));
}

function safeChoiceId(value, index) {
  const id = text(value, `choice_${index + 1}`).toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return id || `choice_${index + 1}`;
}

function text(value, fallback = '') {
  const normalized = value === undefined || value === null ? '' : String(value).trim();
  return normalized || fallback;
}
```

- [ ] **Step 5: Add Bailian client wrappers**

Modify `backend/src/llm/bailianClient.js` by importing `buildStoryDirectorMessages` and adding methods next to the existing narration methods:

```js
import { buildStoryDirectorMessages } from './prompts/storyDirectorPrompt.js';

async function generateStoryDirector({ game, input }) {
  return parseJsonObject(await completeChat(buildStoryDirectorMessages({ game, input }), { stream: false }));
}

async function* streamStoryDirector({ game, input }) {
  yield* streamChat(buildStoryDirectorMessages({ game, input }));
}
```

Return both functions from `createBailianClient()`. Reuse existing helper names if the file already has equivalent `completeChat`, `streamChat`, or parse helpers; do not duplicate HTTP code.

- [ ] **Step 6: Run focused tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/story-director-prompt.test.js tests/narration-prompt.test.js tests/bailian-client.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit task 2 only**

Run:

```bash
git add backend/src/agents/storyDirector.js backend/src/llm/prompts/storyDirectorPrompt.js backend/src/llm/bailianClient.js tests/story-director-prompt.test.js tests/narration-prompt.test.js tests/bailian-client.test.js
git commit -m "feat: add continuous story director prompt"
```

---

### Task 3: Backend Continue And Choice Stream Flow

**Files:**
- Modify: `backend/src/app.js`
- Modify: `src/storyMemory.js`
- Modify: `tests/backend-api.test.js`
- Modify: `tests/backend-server-stream.test.js`

**Interfaces:**
- Consumes: `createStoryDirector({ llm })`
- Consumes: `resolveDirectorEffectHints({ game, effectHints, now })`
- Produces: `/api/v1/turns/stream` support for `{ type: "continue", clientTurn }`
- Produces: `/api/v1/turns/stream` support for `{ type: "choice", choiceId, clientTurn }`
- Produces: `state.pendingDirectorChoices: Map<string, object>`

- [ ] **Step 1: Write failing backend API test for continue**

Append to `tests/backend-api.test.js`:

```js
test('POST /api/v1/turns/stream continues story through director without daily action id', async () => {
  const streamedChunks = [
    '{"scene":"顾清河闭目内观，命火忽明忽暗，雾隐秘境的钟声在识海深处响起。',
    '他没有立刻起身，只把这份异动压入丹田，等待下一次回响。","mode":"continue",',
    '"npcLines":[],"effectHints":[{"target":"lifespan","direction":"down","intensity":"tiny"}],"choices":[],"memoryHints":["命火异常继续。"]}'
  ];
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async *streamStoryDirector() {
        for (const chunk of streamedChunks) yield chunk;
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();

  const response = await app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    type: 'continue',
    clientTurn: 0
  }));
  const body = await response.text();
  const donePayload = parseSseEvent(body, 'done');

  assert.equal(response.status, 200);
  assert.ok(body.indexOf('event: story_delta') > -1);
  assert.ok(body.indexOf('event: story_delta') < body.indexOf('event: done'));
  assert.equal(donePayload.ok, true);
  assert.equal(donePayload.data.game.turn, 1);
  assert.equal(donePayload.data.game.player.lifespan, 92);
  assert.match(donePayload.data.game.log.at(-1).body, /命火忽明忽暗/);
  assert.equal(donePayload.data.turnResult.narration.status, 'generated');
});
```

- [ ] **Step 2: Write failing backend API test for generated choices**

Append:

```js
test('POST /api/v1/turns/stream stores LLM generated choices and resolves selected choice through backend rules', async () => {
  const outputs = [
    {
      scene: '雾中钟声压近洞府，顾清河意识到今夜必须决定是否追查。',
      mode: 'choice',
      npcLines: [],
      effectHints: [],
      choices: [
        {
          id: 'follow_bell',
          text: '循着钟声前往后山',
          tone: 'explore',
          effectHints: [{ target: 'lifespan', direction: 'down', intensity: 'small' }]
        },
        {
          id: 'ask_elder',
          text: '先向玄衡长老禀报',
          tone: 'sect',
          effectHints: [{ target: 'sect_reputation', direction: 'up', intensity: 'small' }]
        }
      ],
      memoryHints: ['雾中钟声逼近。']
    },
    {
      scene: '顾清河循声入山，草叶上的雾露映出残缺符纹。',
      mode: 'continue',
      npcLines: [],
      effectHints: [{ target: 'foreshadow', direction: 'advance', intensity: 'small', topic: '雾隐秘境' }],
      choices: [],
      memoryHints: ['雾隐秘境符纹出现。']
    }
  ];
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateStoryDirector() {
        return outputs.shift();
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();

  const first = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    type: 'continue',
    clientTurn: 0
  })));
  const [choice] = first.data.turnResult.choices;

  assert.equal(first.data.turnResult.mode, 'choice');
  assert.equal(choice.text, '循着钟声前往后山');
  assert.equal('effectHints' in choice, false);
  assert.equal(app.getState().pendingDirectorChoices.size, 2);

  const second = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    type: 'choice',
    choiceId: choice.id,
    clientTurn: 1
  })));

  assert.equal(second.data.game.turn, 2);
  assert.ok(second.data.game.karma.futureEventFlags.includes('director_mist_thread'));
  assert.equal(app.getState().pendingDirectorChoices.size, 0);
});
```

- [ ] **Step 3: Run the new backend tests and verify they fail**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/backend-api.test.js
```

Expected: FAIL because `/turns/stream` does not understand `type: "continue"` or `type: "choice"`.

- [ ] **Step 4: Extend backend state**

Modify `backend/src/app.js` imports and state initialization:

```js
import { createStoryDirector, buildFallbackDirectorOutput } from './agents/storyDirector.js';
import { resolveDirectorEffectHints } from './domain/director/effectHints.js';
```

Add to `state`:

```js
pendingDirectorChoices: new Map(),
storyDirector: options.storyDirector ?? createStoryDirector({ llm })
```

Clear `pendingDirectorChoices` in `handleNewFormalGame()`.

- [ ] **Step 5: Route new body types before legacy action-id flow**

At the start of `handleTurnStream({ body, requestId, state, now })`, add:

```js
if (body.type === 'continue' || body.type === 'choice') {
  return handleDirectorTurnStream({ body, requestId, state, now });
}
```

Keep existing action-id behavior unchanged.

- [ ] **Step 6: Implement director turn streaming**

Add focused helpers in `backend/src/app.js`:

```js
function handleDirectorTurnStream({ body, requestId, state, now }) {
  const validation = validateDirectorTurnRequest({ body, requestId, state, now });
  if (validation instanceof Response) return validation;

  return sseResponse(async (emit) => {
    const before = state.game;
    const input = buildDirectorInput({ body, pendingChoice: validation.pendingChoice });
    let directorOutput = null;

    try {
      for await (const event of state.storyDirector.stream({ game: before, input })) {
        if (event.type === 'story_delta') emit('story_delta', event.data);
        if (event.type === 'director_result') directorOutput = event.data;
      }
    } catch (error) {
      directorOutput = buildFallbackDirectorOutput({ game: before, input });
    }

    const resolution = resolveDirectorTurn({ before, directorOutput, input, state, now: now() });
    state.game = normalizeGame(resolution.game);
    state.turnSnapshots.set(state.game.turn, {
      beforeGame: before,
      afterGame: state.game,
      action: resolution.action,
      ruleEntry: resolution.entry
    });

    emit('state_patch', resolution.publicStatePatch);
    if (resolution.turnResult.choices.length) emit('choices_ready', { choices: resolution.turnResult.choices });
    emit('done', {
      ok: true,
      data: {
        game: state.game,
        turnResult: resolution.turnResult
      },
      error: null,
      requestId
    });
  });
}
```

Implement these helpers below existing turn helpers:

```js
function validateDirectorTurnRequest({ body, requestId, state, now }) {
  if (!state.game.onboarding?.completed) {
    return errorResponse(409, requestId, 'ONBOARDING_REQUIRED', '完成新手任务后才能进入连续剧情。');
  }
  if (body.clientTurn !== state.game.turn) {
    return errorResponse(409, requestId, 'TURN_MISMATCH', '客户端回合已过期，请刷新游戏状态。');
  }
  if (body.type === 'choice') {
    const pendingChoice = state.pendingDirectorChoices.get(body.choiceId);
    if (!pendingChoice || pendingChoice.turn !== state.game.turn) {
      return errorResponse(404, requestId, 'CHOICE_NOT_FOUND', '该选择已失效，请继续推演。');
    }
    return { pendingChoice };
  }
  return {};
}

function buildDirectorInput({ body, pendingChoice }) {
  if (body.type === 'choice') {
    return {
      type: 'choice',
      choiceId: pendingChoice.id,
      choiceText: pendingChoice.text,
      previousScene: pendingChoice.scene
    };
  }
  return { type: 'continue' };
}
```

- [ ] **Step 7: Implement deterministic turn resolution**

Add:

```js
function resolveDirectorTurn({ before, directorOutput, input, state, now }) {
  const choiceHints = input.type === 'choice'
    ? state.pendingDirectorChoices.get(input.choiceId)?.effectHints ?? []
    : [];
  const effectHints = input.type === 'choice' ? [...choiceHints, ...directorOutput.effectHints] : directorOutput.effectHints;
  const effectResolution = resolveDirectorEffectHints({ game: before, effectHints, now });
  const turn = before.turn + 1;
  const entry = {
    id: `turn-${turn}`,
    title: directorOutput.mode === 'choice' ? '命途分岔' : '命火微澜',
    command: input.type === 'choice' ? input.choiceText : '继续',
    body: directorOutput.scene,
    npcLine: formatDirectorNpcLines(directorOutput.npcLines),
    worldEvent: effectResolution.summary
  };
  let nextGame = {
    ...effectResolution.game,
    turn,
    version: turn,
    log: [...effectResolution.game.log, entry],
    timeline: [...effectResolution.game.timeline, { type: 'director', title: entry.title, detail: directorOutput.scene }],
    worldEvents: [...effectResolution.game.worldEvents, { title: entry.title, detail: effectResolution.summary, turn }]
  };

  nextGame = recordStoryMemoryTurn({
    before,
    after: nextGame,
    action: { title: entry.title, command: entry.command },
    entry,
    narration: {
      status: directorOutput.status,
      title: entry.title,
      body: directorOutput.scene,
      npcLine: entry.npcLine,
      foreshadow: directorOutput.memoryHints.at(0) ?? ''
    }
  });

  const publicChoices = storeDirectorChoices({ state, directorOutput, turn });
  if (input.type === 'choice') state.pendingDirectorChoices.clear();

  return {
    game: nextGame,
    entry,
    action: { id: `director-${turn}`, title: entry.title, command: entry.command, source: 'director' },
    publicStatePatch: pickPublicStatePatch(before, nextGame),
    turnResult: {
      turn,
      actionId: `director-${turn}`,
      mode: publicChoices.length ? 'choice' : 'continue',
      narration: {
        status: directorOutput.status,
        title: entry.title,
        body: directorOutput.scene,
        npcLine: entry.npcLine,
        foreshadow: directorOutput.memoryHints.at(0) ?? ''
      },
      summary: effectResolution.summary,
      choices: publicChoices,
      ruleResult: {
        success: true,
        eventId: 'story_director',
        choiceId: input.type === 'choice' ? input.choiceId : 'continue',
        resolvedAt: now.toISOString(),
        rejectedEffectHints: effectResolution.rejected.length
      }
    }
  };
}
```

Add:

```js
function storeDirectorChoices({ state, directorOutput, turn }) {
  state.pendingDirectorChoices.clear();
  if (directorOutput.mode !== 'choice') return [];

  return directorOutput.choices.slice(0, 4).map((choice, index) => {
    const id = `choice_${turn}_${index}_${choice.id}`;
    const pending = {
      ...choice,
      id,
      scene: directorOutput.scene,
      turn,
      consumed: false
    };
    state.pendingDirectorChoices.set(id, pending);
    return { id, text: choice.text };
  });
}

function formatDirectorNpcLines(lines = []) {
  return lines.map((line) => `${line.speaker}道：“${line.line}”`).join('\n');
}

function pickPublicStatePatch(before, after) {
  return {
    turn: after.turn,
    player: {
      health: after.player.health,
      lifespan: after.player.lifespan,
      qi: after.player.qi,
      mood: after.player.mood,
      cultivationProgress: after.player.cultivationProgress,
      sectRelation: after.player.sectRelation
    }
  };
}
```

- [ ] **Step 8: Ensure JSON endpoint compatibility in tests**

If `jsonResponse(app.handle(... /turns/stream ...))` cannot parse SSE, update the test to use `response.text()` and `parseSseEvent(body, 'done')` for both new cases.

- [ ] **Step 9: Run focused backend tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/backend-api.test.js tests/backend-server-stream.test.js tests/director-effect-hints.test.js tests/story-director-prompt.test.js
```

Expected: PASS.

- [ ] **Step 10: Commit task 3 only**

Run:

```bash
git add backend/src/app.js src/storyMemory.js tests/backend-api.test.js tests/backend-server-stream.test.js
git commit -m "feat: stream continuous story turns"
```

---

### Task 4: Frontend API Contract For Continue And Choice

**Files:**
- Modify: `frontend/src/api/gameApi.js`
- Modify: `frontend/src/mock/engine.js`
- Modify: `src/engine.js`
- Modify: `tests/frontend-api.test.js`

**Interfaces:**
- Produces: `api.continueStoryStream(game, input, handlers) => Promise<{ game, turnResult } | game>`
- Consumes: backend SSE events `story_delta`, `choices_ready`, `state_patch`, `done`

- [ ] **Step 1: Write failing frontend API tests**

Append to `tests/frontend-api.test.js`:

```js
test('frontend api streams continuous story deltas and returns backend game result', async () => {
  const chunks = [
    'event: story_delta\ndata: {"text":"顾清河闭目内观"}\n\n',
    'event: choices_ready\ndata: {"choices":[{"id":"choice_1","text":"追查钟声"}]}\n\n',
    'event: done\ndata: {"ok":true,"data":{"game":{"mode":"api","turn":1,"player":{"name":"顾清河"},"log":[]},"turnResult":{"mode":"choice","choices":[{"id":"choice_1","text":"追查钟声"}]}},"error":null,"requestId":"req_1"}\n\n'
  ];
  const seen = { delta: '', choices: [] };
  const api = createGameApi({
    baseUrl: 'http://backend.test',
    preferredMode: 'api',
    fetchImpl: async () => new Response(new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      }
    }), { status: 200, headers: { 'content-type': 'text/event-stream' } })
  });

  const result = await api.continueStoryStream({ mode: 'api', turn: 0 }, { type: 'continue' }, {
    onStoryDelta(delta, fullText) {
      seen.delta = fullText;
    },
    onChoicesReady(choices) {
      seen.choices = choices;
    }
  });

  assert.equal(seen.delta, '顾清河闭目内观');
  assert.deepEqual(seen.choices, [{ id: 'choice_1', text: '追查钟声' }]);
  assert.equal(result.turnResult.mode, 'choice');
  assert.equal(result.game.mode, 'api');
});
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-api.test.js
```

Expected: FAIL because `continueStoryStream` is not defined.

- [ ] **Step 3: Implement frontend API method**

In `frontend/src/api/gameApi.js`, add method inside returned object:

```js
async continueStoryStream(game, input = { type: 'continue' }, handlers = {}) {
  if (shouldUseBackend(game, canUseBackend)) {
    const data = await requestEventStream({
      baseUrl,
      fetchImpl,
      path: '/api/v1/turns/stream',
      method: 'POST',
      body: {
        type: input.type === 'choice' ? 'choice' : 'continue',
        choiceId: input.choiceId,
        clientTurn: game.turn
      },
      handlers
    });
    return {
      game: withMode(data.game, 'api'),
      turnResult: data.turnResult
    };
  }

  const nextGame = withMode(advanceTurn(game, input.type === 'choice' ? input.choiceText : '继续'), 'mock');
  return {
    game: nextGame,
    turnResult: {
      mode: 'continue',
      choices: [],
      narration: {
        status: 'mock',
        title: nextGame.log.at(-1)?.title,
        body: nextGame.log.at(-1)?.body,
        npcLine: nextGame.log.at(-1)?.npcLine
      }
    }
  };
}
```

- [ ] **Step 4: Extend SSE parser handlers**

Inside `requestEventStream()` event loop, add:

```js
if (event.name === 'story_delta') {
  const delta = String(event.data?.text ?? '');
  rawNarration += delta;
  handlers.onStoryDelta?.(delta, rawNarration);
}

if (event.name === 'choices_ready') {
  handlers.onChoicesReady?.(event.data?.choices ?? []);
}

if (event.name === 'state_patch') {
  handlers.onStatePatch?.(event.data ?? {});
}
```

Keep the existing `narration_delta` handling for old action flow.

- [ ] **Step 5: Run focused tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-api.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit task 4 only**

Run:

```bash
git add frontend/src/api/gameApi.js frontend/src/mock/engine.js src/engine.js tests/frontend-api.test.js
git commit -m "feat: add frontend story stream api"
```

---

### Task 5: Home UI State Machine

**Files:**
- Modify: `frontend/src/app.js`
- Modify: `frontend/src/styles.css`
- Modify: `tests/frontend-event-state.test.js`
- Modify: `tests/frontend-views.test.js`

**Interfaces:**
- Consumes: `api.continueStoryStream(game, input, handlers)`
- Produces: local state `storyControl = { status, choices, preview, summary }`

- [ ] **Step 1: Write failing source-level UI tests**

Append to `tests/frontend-views.test.js`:

```js
test('home renders continuous story controls instead of fixed daily action cards', () => {
  const source = fs.readFileSync('frontend/src/app.js', 'utf8');
  const renderHomeView = extractNamedCallable(source, 'renderHomeView');
  const storyPanel = extractCallablePartsOrNull(source, 'renderStoryControlPanel')?.source ?? '';

  assert.match(renderHomeView, /renderStoryControlPanel\(\)/);
  assert.doesNotMatch(renderHomeView, /renderActionPanel\(\)/);
  assert.match(storyPanel, /data-story-continue/);
  assert.match(storyPanel, /data-story-choice-id/);
  assert.match(storyPanel, /继续/);
  assert.doesNotMatch(storyPanel, /effectHints|target|direction|intensity|eventId|choiceId/);
});
```

- [ ] **Step 2: Run UI tests and verify failure**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-views.test.js
```

Expected: FAIL because `renderStoryControlPanel()` does not exist.

- [ ] **Step 3: Add story control state**

In `frontend/src/app.js`, replace `dailyActions` as the home control source with:

```js
let storyControl = {
  status: 'CONTINUE_READY',
  choices: [],
  preview: '',
  summary: ''
};
```

Keep `dailyActions` only for onboarding, legacy non-home fallbacks, or old sample behavior until those paths are removed.

- [ ] **Step 4: Wire home click handling**

Replace the active view click handler body with:

```js
nodes.activeViewContent.addEventListener('click', async (event) => {
  const continueButton = event.target.closest('button[data-story-continue]');
  if (continueButton) {
    await continueStory({ type: 'continue' });
    return;
  }

  const choiceButton = event.target.closest('button[data-story-choice-id]');
  if (choiceButton) {
    const choice = storyControl.choices.find((item) => item.id === choiceButton.dataset.storyChoiceId);
    if (!choice) return;
    await continueStory({ type: 'choice', choiceId: choice.id, choiceText: choice.text });
  }
});
```

Do not remove onboarding action handling if onboarding still uses a separate button.

- [ ] **Step 5: Implement `continueStory()`**

Add:

```js
async function continueStory(input) {
  if (storyControl.status === 'STORY_STREAMING') return;
  storyControl = { ...storyControl, status: 'STORY_STREAMING', preview: '', summary: '' };
  renderActiveView(activeViewId);

  try {
    const previousGame = game;
    const result = await api.continueStoryStream(game, input, {
      onStoryDelta(delta, fullText) {
        storyControl = { ...storyControl, preview: fullText };
        renderActiveView(activeViewId);
      },
      onChoicesReady(choices) {
        storyControl = { ...storyControl, choices };
      }
    });

    game = enrichGameHistory(hydrateHistorySummaries(result.game), previousGame);
    markHistoryRefreshed(game);
    storyControl = {
      status: result.turnResult?.choices?.length ? 'CHOICE_PENDING' : 'CONTINUE_READY',
      choices: result.turnResult?.choices ?? [],
      preview: '',
      summary: result.turnResult?.summary ?? ''
    };
    persistHistorySummaryCache(game);
    saveGame();
    render();
    nodes.logList?.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    storyControl = { ...storyControl, status: 'CONTINUE_READY', preview: '', choices: [] };
    renderActiveView(activeViewId);
    handleApiError(error);
  }
}
```

- [ ] **Step 6: Render the story control panel**

Replace `renderActionPanel()` usage in `renderHomeView()`:

```js
function renderHomeView() {
  nodes.activeViewContent.innerHTML = [
    renderStatusPanel(),
    renderHistoryPanel(3),
    renderStoryControlPanel(),
    renderFocusPanel()
  ].join('');
  syncActiveViewNodes();
  renderStatusOverview();
  renderAttributeSummary();
  renderHomeFocus();
}
```

Add:

```js
function renderStoryControlPanel() {
  const isStreaming = storyControl.status === 'STORY_STREAMING';
  const hasChoices = storyControl.status === 'CHOICE_PENDING' && storyControl.choices.length > 0;
  return renderPanel({
    className: `story-control-panel ${isStreaming ? 'is-streaming' : ''}`,
    title: hasChoices ? '命途分岔' : '继续推演',
    meta: isStreaming ? '天机流转' : hasChoices ? `${storyControl.choices.length} 项` : '连续剧情',
    body: [
      storyControl.preview ? `<article class="story-preview">${storyControl.preview}</article>` : '',
      storyControl.summary ? `<p class="story-summary">${storyControl.summary}</p>` : '',
      hasChoices ? renderStoryChoiceButtons(storyControl.choices) : renderContinueButton(isStreaming)
    ].join('')
  });
}

function renderStoryChoiceButtons(choices) {
  return `
    <div class="story-choice-list">
      ${choices.map((choice) => `
        <button type="button" class="story-choice-button" data-story-choice-id="${choice.id}">
          ${choice.text}
        </button>
      `).join('')}
    </div>
  `;
}

function renderContinueButton(isStreaming) {
  return `
    <button type="button" class="primary-story-button" data-story-continue${isStreaming ? ' disabled' : ''}>
      ${isStreaming ? '推演中' : '继续'}
    </button>
  `;
}
```

- [ ] **Step 7: Add styles**

Add to `frontend/src/styles.css`:

```css
.story-control-panel {
  display: grid;
  gap: 14px;
}

.story-preview {
  padding: 14px 16px;
  border: 1px solid rgba(129, 93, 37, 0.22);
  background: rgba(255, 252, 241, 0.72);
  line-height: 1.75;
}

.story-summary {
  margin: 0;
  color: var(--muted);
}

.primary-story-button,
.story-choice-button {
  width: 100%;
  min-height: 48px;
  border: 1px solid rgba(129, 93, 37, 0.34);
  background: rgba(255, 252, 241, 0.86);
  color: var(--ink);
  font: inherit;
  cursor: pointer;
}

.primary-story-button {
  background: var(--accent);
  color: #fffaf0;
}

.story-choice-list {
  display: grid;
  gap: 10px;
}

.story-control-panel.is-streaming {
  opacity: 0.92;
}
```

- [ ] **Step 8: Update source-level tests that still expect action cards on home**

In `tests/frontend-views.test.js`, update the test named `only 洞府 renders action choices and places history before compact actions` to assert:

```js
assert.match(renderHomeView, /renderHistoryPanel\(\s*3\s*\)[\s\S]*renderStoryControlPanel\(\)/);
assert.ok(
  renderHomeView.indexOf('renderHistoryPanel(3)') < renderHomeView.indexOf('renderStoryControlPanel()'),
  'history should render before story controls on the home screen'
);
```

Keep the assertions that other tabs do not render action controls.

- [ ] **Step 9: Run frontend tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-api.test.js tests/frontend-views.test.js tests/frontend-event-state.test.js
```

Expected: PASS.

- [ ] **Step 10: Commit task 5 only**

Run:

```bash
git add frontend/src/app.js frontend/src/styles.css tests/frontend-event-state.test.js tests/frontend-views.test.js
git commit -m "feat: add home story control state"
```

---

### Task 6: Integration Verification, Docs, And Dev Push

**Files:**
- Modify: `README.md`
- Modify: `tests/frontend-app-wiring.test.js`
- Modify: `tests/frontend-backend-integration.test.js`
- Modify: any test file touched by earlier task repairs

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: documented entrypoints and verification evidence.

- [ ] **Step 1: Update README entry section**

In `README.md`, update the run instructions to state:

```md
## 入口

- 后端：`backend/src/server.js`，默认端口 `8787`
- 前端：`frontend/index.html`，开发服务一般为 `http://127.0.0.1:5173/frontend/`
- 调试分支：`dev`
- 正式发布分支：`main`

主页现在使用连续剧情导演模式：正式角色完成后，洞府页通过 `继续` 推进剧情；关键节点才显示模型生成的选择。
```

- [ ] **Step 2: Add end-to-end test for no raw fields**

In `tests/frontend-backend-integration.test.js`, add a test that runs a mocked director choice and asserts the public choice shape:

```js
test('continuous story public choices expose only id and text', async () => {
  const app = createBackendApp({
    seed: 31,
    now: fixedNow,
    llm: {
      async generateStoryDirector() {
        return {
          scene: '命火微动，雾隐钟声逼近。',
          mode: 'choice',
          npcLines: [],
          effectHints: [],
          choices: [
            { id: 'follow', text: '循声入山', tone: 'explore', effectHints: [{ target: 'lifespan', direction: 'down', intensity: 'small' }] },
            { id: 'wait', text: '暂守洞府', tone: 'safe', effectHints: [{ target: 'mind', direction: 'up', intensity: 'tiny' }] }
          ],
          memoryHints: []
        };
      }
    }
  });
  app.getState().game.onboarding = completedOnboardingState();

  const response = await app.handle(makeRequest('POST', '/api/v1/turns/stream', {
    type: 'continue',
    clientTurn: 0
  }));
  const done = parseSseEvent(await response.text(), 'done');
  const choice = done.data.turnResult.choices[0];

  assert.deepEqual(Object.keys(choice).sort(), ['id', 'text']);
  assert.doesNotMatch(JSON.stringify(done.data.turnResult.choices), /effectHints|target|direction|intensity|tone/);
});
```

If helper functions are local to `tests/backend-api.test.js`, copy small `makeRequest`, `fixedNow`, and `parseSseEvent` helpers into this test file rather than exporting test-only utilities from production.

- [ ] **Step 3: Run all tests**

Run:

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```

Expected: PASS. Record the passing test count in the final handoff.

- [ ] **Step 4: Check git status**

Run:

```bash
git status --short --branch
```

Expected: branch is `dev`; only intentional files from this feature are modified or committed. Pre-existing unrelated files are explicitly left untouched unless they are part of a completed task commit.

- [ ] **Step 5: Commit documentation and integration tests**

Run:

```bash
git add README.md tests/frontend-app-wiring.test.js tests/frontend-backend-integration.test.js
git commit -m "docs: document continuous story entrypoints"
```

- [ ] **Step 6: Push dev only after tests pass**

Run:

```bash
git push -u origin dev
```

Expected: `dev -> dev` is pushed. Do not push `main` in this task.

---

## Self-Review

Spec coverage:

- LLM-generated choices: Tasks 2, 3, 4, and 5.
- Backend-only numeric resolution: Task 1 and Task 3.
- Continue/choice home flow: Task 3, Task 4, and Task 5.
- Streaming narration: Task 3 and Task 4.
- Story memory and 天机录 continuity: Task 3 and Task 6.
- No raw internal fields in UI: Task 5 and Task 6.
- Fallback behavior: Task 2 and Task 3.

Placeholder scan:

- The plan contains no unresolved marker strings or open-ended implementation slots.
- Steps that change behavior include concrete file paths, functions, and expected test commands.

Type consistency:

- The backend public choices use `{ id, text }`.
- Internal director choices may hold `tone` and `effectHints`, but those remain in `state.pendingDirectorChoices`.
- Frontend uses `choice.id` only as a button value and `choice.text` as visible copy.
- `continueStoryStream()` returns `{ game, turnResult }`, and `frontend/src/app.js` reads exactly that shape.
