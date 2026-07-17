# 事件库扩容与 LLM 叙事层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有事件系统扩展为按七个章节组织、总计 50 个正式事件的长期可玩事件库，同时保持服务器规则权威和 LLM 叙事表达能力。

**Architecture:** 在现有 `eventCatalog.js`、`triggerMatcher.js`、`eventSelector.js` 和效果解析器上增加章节元数据、触发条件、一次性/冷却/递减收益语义。事件规则、状态变化和结局前置仍由后端确定；LLM 只接收脱敏后的场景素材、NPC 角色、感官标签和已结算结果，用于生成连续的中文叙事。共享规则文件先串行稳定，事件内容按章节串行写入同一目录文件。

**Tech Stack:** Node.js ESM、Node built-in test runner、现有 `@langchain/langgraph` 叙事管线、原生前端 JavaScript/CSS。

## Global Constraints

- 所有开发提交只进入当前 `dev` 分支；除非用户明确要求，不提交或推送 `main`。
- 不新增第三方依赖；使用项目当前 Node 运行时 `/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`。
- 正式事件总数固定为 50，章节数量依次为 `prologue=6`、`qi=7`、`foundation=7`、`golden_core=7`、`mist=8`、`ascension_scam=8`、`finale=7`。
- 每个正式事件必须有 `chapterIds`、`category`、`cadence`、`narrativeContext` 和至少两个选择；每个选择必须产生可观察的后端状态差异。
- `mainline` 事件一次性完成；`side` 事件可重复，但必须受冷却、近期重复保护和 100%/50%/25% 递减收益约束。
- LLM 不得读取或修改内部事件 ID、选择 ID、效果定义、实际概率、未公开触发条件、结局 ID 或任何服务器状态判定。
- 本计划不重做数值平衡表、存档槽、成就系统或云端同步；只提供事件扩容所需的最小状态和接口。
- 事件目录、触发器和效果解析器是共享高冲突文件，Task 1–9 必须串行执行；每个任务独立测试并提交。

## 文件地图与职责

**创建：**

- `backend/src/domain/events/eventHistory.js`：规范化事件历史、一次性完成判定、重复次数、冷却记录和收益倍率。
- `backend/src/domain/events/eventCatalogValidator.js`：验证 50 个正式事件的章节配额、字段完整性、选项数量、引用和主线/支线语义。
- `tests/event-history.test.js`：事件历史和递减收益的单元测试。
- `tests/event-catalog.test.js`：目录完整性、章节配额和事件引用测试。

**修改：**

- `backend/src/domain/characterCreation.js`：正式新局初始化 `eventHistory` 和突破失败统计。
- `backend/src/app.js`：兼容旧存档的 `normalizeGame` 默认字段，以及事件公共 API 的状态边界。
- `backend/src/domain/events/eventCatalog.js`：迁移现有 29 个事件并补齐 21 个新事件，统一事件元数据和双选择结构。
- `backend/src/domain/events/triggerMatcher.js`：增加章节、境界、NPC、宗门路线、寿元比例、突破失败和事件历史触发器。
- `backend/src/domain/events/eventSelector.js`：应用一次性、冷却、近期重复、支线重复收益和章节排序规则。
- `backend/src/domain/events/effectResolver.js`：增加 `storyProgress` 效果、重复奖励缩放和事件历史写入。
- `backend/src/domain/events/eventResult.js`：公共行动保留风险/类别/主支线信息，继续移除内部 ID 和规则定义。
- `backend/src/domain/progression.js`：记录按境界层级统计的突破失败次数。
- `backend/src/llm/prompts/narrationPrompt.js`：把安全的事件叙事素材送入 LLM，同时强化内部字段隔离。
- `frontend/src/app.js`：显示事件主线/支线和风险标签；继续不解析效果或内部 ID。
- `tests/event-engine.test.js`：更新已有事件引擎夹具并补充章节/重复规则回归。
- `tests/breakthrough.test.js`：补充突破失败计数回归。
- `tests/backend-api.test.js`：验证公共事件字段和内部规则脱敏。
- `tests/narration-prompt.test.js`：验证 LLM 获得叙事素材但看不到规则内部字段。
- `tests/frontend-app-wiring.test.js`：验证前端只显示公共字段。

---

### Task 1: 建立事件历史与兼容状态

**Files:**
- Create: `backend/src/domain/events/eventHistory.js`
- Modify: `backend/src/domain/characterCreation.js`
- Modify: `backend/src/app.js:796-850`
- Create: `tests/event-history.test.js`

**Interfaces:**
- Consumes: 现有 `game.cooldowns`、`game.turn`、`applyCharacterToGame` 和 `normalizeGame`。
- Produces: `normalizeEventHistory(history)`, `hasResolvedEvent(game, eventId)`, `getEventRepeatCount(game, eventId)`, `getRepeatRewardMultiplier(repeatCount)`, `recordEventResolution(history, eventId, turn)`。

- [ ] **Step 1: 写事件历史的失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEventRepeatCount,
  getRepeatRewardMultiplier,
  hasResolvedEvent,
  normalizeEventHistory,
  recordEventResolution
} from '../backend/src/domain/events/eventHistory.js';

test('event history normalizes missing fields and preserves old cooldown-only saves', () => {
  const history = normalizeEventHistory({});
  assert.deepEqual(history, { resolved: [], repeatCounts: {}, lastResolvedTurn: {} });
  assert.equal(hasResolvedEvent({ cooldowns: { old_event: 2 } }, 'old_event'), false);
});

test('repeat reward multipliers are deterministic and bottom out at 25 percent', () => {
  assert.equal(getRepeatRewardMultiplier(0), 1);
  assert.equal(getRepeatRewardMultiplier(1), 0.5);
  assert.equal(getRepeatRewardMultiplier(2), 0.25);
  assert.equal(getRepeatRewardMultiplier(8), 0.25);
});

test('recording a resolution increments count and stores the latest turn', () => {
  const first = recordEventResolution(normalizeEventHistory(), 'side_event', 4);
  const second = recordEventResolution(first, 'side_event', 9);
  assert.equal(getEventRepeatCount({ eventHistory: second }, 'side_event'), 2);
  assert.equal(second.lastResolvedTurn.side_event, 9);
  assert.equal(hasResolvedEvent({ eventHistory: second }, 'side_event'), true);
});
```

- [ ] **Step 2: 运行失败测试，确认新接口尚未实现**

Run:

```bash
NODE_BIN=/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE_BIN --test tests/event-history.test.js
```

Expected: FAIL because `eventHistory.js` does not exist yet。

- [ ] **Step 3: 实现最小事件历史模块**

```js
export function normalizeEventHistory(history = {}) {
  return {
    resolved: Array.isArray(history.resolved) ? [...new Set(history.resolved)] : [],
    repeatCounts: { ...(history.repeatCounts ?? {}) },
    lastResolvedTurn: { ...(history.lastResolvedTurn ?? {}) }
  };
}

export function hasResolvedEvent(game = {}, eventId) {
  return normalizeEventHistory(game.eventHistory).resolved.includes(eventId);
}

export function getEventRepeatCount(game = {}, eventId) {
  return Math.max(0, Number(normalizeEventHistory(game.eventHistory).repeatCounts[eventId] ?? 0));
}

export function getRepeatRewardMultiplier(repeatCount) {
  if (repeatCount <= 0) return 1;
  if (repeatCount === 1) return 0.5;
  return 0.25;
}

export function recordEventResolution(history = {}, eventId, turn) {
  const normalized = normalizeEventHistory(history);
  return {
    ...normalized,
    resolved: [...new Set([...normalized.resolved, eventId])],
    repeatCounts: { ...normalized.repeatCounts, [eventId]: (normalized.repeatCounts[eventId] ?? 0) + 1 },
    lastResolvedTurn: { ...normalized.lastResolvedTurn, [eventId]: turn }
  };
}
```

在 `applyCharacterToGame` 增加：

```js
eventHistory: { resolved: [], repeatCounts: {}, lastResolvedTurn: {} },
progressionStats: { breakthroughFailures: 0, breakthroughFailuresByTier: {} },
```

在 `normalizeGame` 中用 `normalizeEventHistory(game.eventHistory)` 补齐旧存档字段，并对 `progressionStats` 使用相同的数值默认值。旧存档只有 `cooldowns` 时不推断为已经完成过主线事件。

- [ ] **Step 4: 运行通过测试并检查现有回归**

Run: `$NODE_BIN --test tests/event-history.test.js tests/chapter-migration.test.js tests/breakthrough.test.js`
Expected: 新增测试和既有章节迁移/突破测试全部 PASS。

- [ ] **Step 5: 提交状态层**

```bash
git add backend/src/domain/events/eventHistory.js backend/src/domain/characterCreation.js backend/src/app.js tests/event-history.test.js
git commit -m "feat: track event history and progression counters"
```

### Task 2: 扩展章节与状态触发器

**Files:**
- Modify: `backend/src/domain/events/triggerMatcher.js`
- Modify: `backend/src/domain/events/eventCatalog.js:1-20`
- Modify: `tests/event-engine.test.js`
- Create: `tests/event-trigger.test.js`

**Interfaces:**
- Consumes: `game.storyProgress.chapterId`, `game.player.realm`, `game.npcs`, `game.player.lifespan`, `game.player.maxLifespan`, `game.progressionStats` 和 Task 1 的历史接口。
- Produces: 保持 `isEventEligible(event, game, viewId)` 签名不变，新增以下触发器字段：`chapterIds`、`realmAtLeast`、`npcAffinityMin`、`requiresSectPath`、`lifespanRatioMax`、`requiresBreakthroughFailure`、`requiresEventResolved`、`forbidEventResolved`。

- [ ] **Step 1: 写触发器失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { isEventEligible } from '../backend/src/domain/events/triggerMatcher.js';

const game = {
  onboarding: { completed: true },
  storyProgress: { chapterId: 'mist', sectPath: 'truth' },
  player: { realm: '金丹初期', lifespan: 20, maxLifespan: 100, sectRelation: 36 },
  npcs: [{ name: '林师姐', affinity: 18 }],
  eventHistory: {
    resolved: ['mist_archive_fragment'],
    repeatCounts: { mist_archive_fragment: 1 },
    lastResolvedTurn: { mist_archive_fragment: 4 }
  },
  progressionStats: { breakthroughFailures: 1, breakthroughFailuresByTier: { 筑基: 1 } },
  flags: {}
};

test('trigger matcher checks all new state predicates with AND semantics', () => {
  const event = {
    trigger: {
      viewIds: ['realm'], chapterIds: ['mist'], realmAtLeast: '筑基初期',
      npcAffinityMin: { npcId: 'lin_shijie', value: 12 }, requiresSectPath: 'truth',
      lifespanRatioMax: 0.25, requiresBreakthroughFailure: { tier: '筑基', atLeast: 1 },
      requiresEventResolved: 'mist_archive_fragment', forbidEventResolved: 'other_event'
    }
  };
  assert.equal(isEventEligible(event, game, 'realm'), true);
  assert.equal(isEventEligible(event, game, 'home'), false);
  assert.equal(isEventEligible({ ...event, trigger: { ...event.trigger, chapterIds: ['qi'] } }, game, 'realm'), false);
  assert.equal(isEventEligible({ ...event, trigger: { ...event.trigger, lifespanRatioMax: 0.1 } }, game, 'realm'), false);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `$NODE_BIN --test tests/event-trigger.test.js`
Expected: FAIL because the new predicates are ignored。

- [ ] **Step 3: 实现触发器组合逻辑**

在 `triggerMatcher.js` 中保持现有条件兼容，并按以下顺序追加判断：

```js
import { compareRealms } from '../progression.js';
import { hasResolvedEvent } from './eventHistory.js';

function getLifespanRatio(game) {
  const max = game.player?.maxLifespan ?? game.player?.lifespan ?? 0;
  return max > 0 ? (game.player?.lifespan ?? 0) / max : 0;
}

function npcMatches(npc, npcId) {
  return { lin_shijie: '林师姐', xuanheng: '玄衡长老' }[npcId] === npc?.name;
}

if (trigger.chapterIds && !trigger.chapterIds.includes(game.storyProgress?.chapterId)) return false;
if (trigger.realmAtLeast && compareRealms(game.player?.realm, trigger.realmAtLeast) < 0) return false;
if (trigger.npcAffinityMin) {
  const { npcId, value } = trigger.npcAffinityMin;
  if (!(game.npcs ?? []).some((npc) => npcMatches(npc, npcId) && (npc.affinity ?? 0) >= value)) return false;
}
if (trigger.requiresSectPath && game.storyProgress?.sectPath !== trigger.requiresSectPath) return false;
if (trigger.lifespanRatioMax !== undefined && getLifespanRatio(game) > trigger.lifespanRatioMax) return false;
if (trigger.requiresBreakthroughFailure) {
  const { tier, atLeast } = trigger.requiresBreakthroughFailure;
  const failures = tier ? (game.progressionStats?.breakthroughFailuresByTier?.[tier] ?? 0) : (game.progressionStats?.breakthroughFailures ?? 0);
  if (failures < atLeast) return false;
}
if (trigger.requiresEventResolved && !hasResolvedEvent(game, trigger.requiresEventResolved)) return false;
if (trigger.forbidEventResolved && hasResolvedEvent(game, trigger.forbidEventResolved)) return false;
```

`chapterIds` 缺失时保留旧事件兼容行为；新增正式事件全部填写章节。`npcAffinityMin` 统一使用 `npcId`，不把中文显示名写入触发器。

- [ ] **Step 4: 运行新旧触发测试**

Run: `$NODE_BIN --test tests/event-trigger.test.js tests/event-engine.test.js`
Expected: 触发器测试和已有视图/旗标测试全部 PASS。

- [ ] **Step 5: 提交触发器**

```bash
git add backend/src/domain/events/triggerMatcher.js backend/src/domain/events/eventCatalog.js tests/event-trigger.test.js tests/event-engine.test.js
git commit -m "feat: add chapter-aware event triggers"
```

### Task 3: 扩展事件效果、章节立场和突破失败统计

**Files:**
- Modify: `backend/src/domain/events/effectResolver.js`
- Modify: `backend/src/domain/events/eventResult.js`
- Modify: `backend/src/domain/progression.js`
- Modify: `tests/event-engine.test.js`
- Modify: `tests/breakthrough.test.js`

**Interfaces:**
- Consumes: Task 1 的 `eventHistory`，事件的 `cadence`、`oneShot`、`cooldownTurns` 和 `repeatCounts`。
- Produces: `applyEffects` 支持 `{ type: 'storyProgress', path, value }`；事件结算写入 `eventHistory`；突破失败写入 `progressionStats.breakthroughFailuresByTier`。

- [ ] **Step 1: 写状态效果和递减收益的失败测试**

```js
test('story progress effects can only set whitelisted branch fields', () => {
  const game = formalGame();
  const next = applyEffects(game, [
    { type: 'storyProgress', path: 'contractStance', value: 'reject' },
    { type: 'storyProgress', path: 'finalChoiceMade', value: true }
  ]);
  assert.equal(next.storyProgress.contractStance, 'reject');
  assert.equal(next.storyProgress.finalChoiceMade, true);
  assert.throws(() => applyEffects(game, [{ type: 'storyProgress', path: 'endingId', value: 'break_contract' }]), /RULE_EFFECT_INVALID:storyProgress/);
});

test('side event repeat rewards decay while costs and persistent flags remain intact', () => {
  const game = { ...formalGame(), eventHistory: { resolved: ['side'], repeatCounts: { side: 1 }, lastResolvedTurn: { side: 2 } } };
  const event = {
    id: 'side', category: 'social', cadence: 'side', oneShot: false, cooldownTurns: 1,
    choices: [{ id: 'help', label: '援手', command: '援手', risk: 'low', success: { text: '帮助', effects: [
      { type: 'stat', path: 'player.qi', delta: 10 }, { type: 'stat', path: 'player.lifespan', delta: -2 }, { type: 'flag', id: 'helped', value: true }
    ] } }]
  };
  const result = resolveChoice({ game, event, choice: event.choices[0], now: new Date('2026-07-02T00:00:00.000Z') });
  assert.equal(result.game.player.qi, game.player.qi + 5);
  assert.equal(result.game.player.lifespan, game.player.lifespan - 2);
  assert.equal(result.game.flags.helped, true);
  assert.equal(result.game.eventHistory.repeatCounts.side, 2);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `$NODE_BIN --test tests/event-engine.test.js tests/breakthrough.test.js`
Expected: FAIL because `storyProgress` effects, repeat scaling and failure counters are not implemented。

- [ ] **Step 3: 增加白名单状态效果和重复奖励缩放**

在 `effectResolver.js` 增加：

```js
const STORY_PROGRESS_EFFECT_PATHS = new Set(['sectPath', 'contractStance', 'finalChoiceMade']);

function applyStoryProgressEffect(game, effect) {
  if (!STORY_PROGRESS_EFFECT_PATHS.has(effect.path)) throw new Error(`RULE_EFFECT_INVALID:storyProgress:${effect.path}`);
  return { ...game, storyProgress: { ...game.storyProgress, [effect.path]: effect.value } };
}

function scaleRepeatableReward(effect, multiplier) {
  const scalable = new Set(['stat', 'item', 'relation', 'sect', 'karma', 'attribute']);
  if (!scalable.has(effect.type) || effect.delta <= 0) return effect;
  return { ...effect, delta: Math.max(1, Math.floor(effect.delta * multiplier)) };
}
```

`applyEffects` 继续先执行全量 `preflightEffects`，避免递减后的奖励绕过资源校验。`resolveChoice` 先读取结算前的 `repeatCount`，只对正向可重复奖励使用 `getRepeatRewardMultiplier`；负向资源消耗、寿元代价、`flag`、`futureEvent`、`storyProgress`、`treasure` 和 `technique` 不缩放。重复获得已有宝物/功法继续依赖 `grantTreasure`/`grantTechnique` 的去重行为。

事件结算对象改为：

```js
const repeatCount = getEventRepeatCount(game, event.id);
const multiplier = event.cadence === 'side' ? getRepeatRewardMultiplier(repeatCount) : 1;
const effects = outcome.effects.map((effect) => scaleRepeatableReward(effect, multiplier));
const withEffects = applyEffects(game, effects);
const nextHistory = recordEventResolution(withEffects.eventHistory, event.id, turn);
```

返回的新 game 使用 `eventHistory: nextHistory`，`cooldowns` 仍保留兼容字段。主线事件仍记录一次 `repeatCounts`，但由选择器的 `oneShot` 判定阻止再次出现。

- [ ] **Step 4: 记录突破失败次数**

在 `resolveBreakthrough` 生成最终 game 时，失败分支按当前境界层级写入：

```js
const failureTier = getRealmTier(game.player?.realm);
const previousStats = {
  breakthroughFailures: game.progressionStats?.breakthroughFailures ?? 0,
  breakthroughFailuresByTier: { ...(game.progressionStats?.breakthroughFailuresByTier ?? {}) }
};
const progressionStats = success ? previousStats : {
  breakthroughFailures: previousStats.breakthroughFailures + 1,
  breakthroughFailuresByTier: {
    ...previousStats.breakthroughFailuresByTier,
    [failureTier]: (previousStats.breakthroughFailuresByTier[failureTier] ?? 0) + 1
  }
};
```

成功分支保留原统计对象；旧存档缺失统计时按零处理。新增测试断言一次失败后 `炼气` 计数为 1，成功不会增加计数。

- [ ] **Step 5: 运行通过测试**

Run: `$NODE_BIN --test tests/event-engine.test.js tests/breakthrough.test.js tests/event-history.test.js`
Expected: 全部 PASS，原有物品/资源 preflight 测试仍 PASS。

- [ ] **Step 6: 提交效果层**

```bash
git add backend/src/domain/events/effectResolver.js backend/src/domain/events/eventResult.js backend/src/domain/progression.js tests/event-engine.test.js tests/breakthrough.test.js
git commit -m "feat: resolve event branches and repeat rewards"
```

### Task 4: 让选择器执行一次性、冷却和章节排序

**Files:**
- Modify: `backend/src/domain/events/eventSelector.js`
- Modify: `backend/src/domain/events/eventResult.js`
- Modify: `tests/event-engine.test.js`

**Interfaces:**
- Consumes: Task 1 的历史查询、Task 2 的章节触发器和 Task 3 的事件元数据。
- Produces: `selectEventActions` 继续返回内部动作；`stripInternalActionFields` 额外公开 `risk`、`category`、`cadence`，不公开 `eventId`、`choiceId`、`event`、`choice`、`trigger`、`effects`。

- [ ] **Step 1: 写一次性与支线冷却失败测试**

```js
test('resolved mainline events are never selected again in the same chapter', () => {
  const base = formalGame();
  const game = { ...base, storyProgress: { ...base.storyProgress, chapterId: 'prologue' }, eventHistory: { resolved: ['lin_invitation'], repeatCounts: { lin_invitation: 1 }, lastResolvedTurn: { lin_invitation: 2 } } };
  const actions = selectEventActions({ game, viewId: 'home', now: new Date('2026-07-03T00:00:00.000Z') });
  assert.equal(actions.some((action) => action.eventId === 'lin_invitation'), false);
});

test('side events respect catalog cooldown and recent-resolution protection', () => {
  const base = formalGame();
  const game = { ...base, storyProgress: { ...base.storyProgress, chapterId: 'prologue' }, turn: 5, cooldowns: { master_guidance: 7 }, eventHistory: { resolved: ['master_guidance'], repeatCounts: { master_guidance: 1 }, lastResolvedTurn: { master_guidance: 4 } } };
  const actions = selectEventActions({ game, viewId: 'skills', now: new Date('2026-07-03T00:00:00.000Z') });
  assert.equal(actions.some((action) => action.eventId === 'master_guidance'), false);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `$NODE_BIN --test tests/event-engine.test.js`
Expected: FAIL because selector currently only reads `cooldowns` and does not distinguish one-shot events。

- [ ] **Step 3: 实现选择器过滤顺序**

在 `selectEventActions` 的候选链中使用以下顺序：

```js
const eligible = EVENT_CATALOG
  .map((event, index) => ({ event, index }))
  .filter(({ event }) => isEventEligible(event, game, viewId))
  .filter(({ event }) => !isEventCompleted(event, game))
  .filter(({ event }) => !isEventOnCooldown(event, game))
  .filter(({ event }) => !isEventRecentlyResolved(event, game))
  .sort((left, right) => compareEvents(left, right, viewId, game))
  .map(({ event }) => event);

function isEventCompleted(event, game) {
  return event.oneShot === true && hasResolvedEvent(game, event.id);
}

function isEventOnCooldown(event, game) {
  const cooldownTurn = game.cooldowns?.[event.id];
  return typeof cooldownTurn === 'number' && cooldownTurn >= game.turn;
}

function isEventRecentlyResolved(event, game) {
  const lastTurn = game.eventHistory?.lastResolvedTurn?.[event.id];
  if (typeof lastTurn === 'number') return game.turn - lastTurn <= RECENT_EVENT_TURN_WINDOW;
  const legacyCooldownTurn = game.cooldowns?.[event.id];
  return typeof legacyCooldownTurn === 'number' && game.turn - legacyCooldownTurn <= RECENT_EVENT_TURN_WINDOW;
}
```

`resolveChoice` 写入 `cooldowns[event.id] = turn + event.cooldownTurns`；主线 `cooldownTurns` 为 0，但 `oneShot` 永久阻止重复。候选排序保留现有类别多样性和雾隐秘境特色事件优先级。

- [ ] **Step 4: 补充公共字段和回归测试**

`stripInternalActionFields` 返回：

```js
{
  id: action.id, title: action.title, icon: action.icon, command: action.command,
  meta: action.meta, category: action.category, risk: action.risk, cadence: action.cadence,
  storyHook: action.storyHook, expiresAt: action.expiresAt
}
```

测试必须断言返回对象不存在 `eventId`、`choiceId`、`event`、`choice`、`trigger` 和 `effects`。

- [ ] **Step 5: 运行测试并提交选择器**

Run: `$NODE_BIN --test tests/event-engine.test.js tests/backend-api.test.js`
Expected: 事件轮换、资源过滤、公共 API 脱敏测试全部 PASS。

```bash
git add backend/src/domain/events/eventSelector.js backend/src/domain/events/eventResult.js tests/event-engine.test.js tests/backend-api.test.js
git commit -m "feat: enforce event cadence and public action boundaries"
```

### Task 5: 接入安全 LLM 叙事上下文和前端主支线显示

**Files:**
- Modify: `backend/src/domain/events/eventSelector.js`
- Modify: `backend/src/llm/prompts/narrationPrompt.js`
- Modify: `frontend/src/app.js:1810-1835`
- Modify: `tests/narration-prompt.test.js`
- Modify: `tests/frontend-app-wiring.test.js`

**Interfaces:**
- Consumes: 事件的 `narrativeContext`、选择的 `narrativeIntent`、公共 `risk/cadence` 字段。
- Produces: LLM 请求中增加安全的 `eventNarrativeContext`；前端在行动卡片中显示“主线/支线”和“平稳/谨慎/凶险”。

- [ ] **Step 1: 写 LLM 边界失败测试**

```js
test('narration prompt includes event atmosphere but excludes internal event rules', () => {
  const messages = buildNarrationMessages({ ...makePromptInput(), action: {
    title: '雾中青铜铃', command: '靠近铜铃', source: 'event', eventId: 'mist_bronze_bell', choiceId: 'approach',
    narrativeContext: { scene: '雾隐秘境边缘', mood: '诡谲、克制', npcRoles: ['lin_shijie'], sensoryTags: ['铜铃', '白雾', '残碑'] },
    narrativeIntent: '主动追查铜铃来源'
  } });
  const payload = JSON.stringify(JSON.parse(messages[1].content));
  assert.match(payload, /雾隐秘境边缘/);
  assert.match(payload, /主动追查铜铃来源/);
  assert.doesNotMatch(payload, /mist_bronze_bell|approach|requiresFlags|effects|eventId|choiceId/);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `$NODE_BIN --test tests/narration-prompt.test.js tests/frontend-app-wiring.test.js`
Expected: LLM payload尚未包含事件素材，前端尚未显示主支线标签。

- [ ] **Step 3: 在内部动作中携带叙事素材，在提示词中只复制白名单**

事件动作增加：

```js
narrativeContext: event.narrativeContext ?? null,
narrativeIntent: choice.narrativeIntent ?? ''
```

在 `pickActionContext` 中只复制：

```js
if (action?.narrativeContext) {
  context.eventNarrativeContext = {
    scene: String(action.narrativeContext.scene ?? ''),
    mood: String(action.narrativeContext.mood ?? ''),
    npcRoles: Array.isArray(action.narrativeContext.npcRoles) ? action.narrativeContext.npcRoles.map(String) : [],
    sensoryTags: Array.isArray(action.narrativeContext.sensoryTags) ? action.narrativeContext.sensoryTags.map(String) : []
  };
}
if (action?.narrativeIntent) context.narrativeIntent = String(action.narrativeIntent);
```

不复制 `eventId`、`choiceId`、`event`、`choice`、`trigger`、`effects`。系统提示增加“事件素材只能改变叙事表达，不能创造规则结果”的约束，并要求正文承接 `eventNarrativeContext`。

- [ ] **Step 4: 更新前端显示**

将 `formatActionMeta` 改为：

```js
function formatActionMeta(action) {
  const titleMeta = firstReadableMetaPart(action.meta);
  const cadenceMeta = action.cadence === 'mainline' ? '主线' : action.cadence === 'side' ? '支线' : '';
  const riskMeta = riskLabel(action.risk);
  return [titleMeta, cadenceMeta, riskMeta].filter(Boolean).join(' · ') || '今日抉择';
}
```

保持 `normalizeAction`、前端 API 和 mock 行动对缺失 `cadence/risk` 的兼容，避免旧数据出现空白卡片。

- [ ] **Step 5: 运行测试并提交叙事/前端边界**

Run: `$NODE_BIN --test tests/narration-prompt.test.js tests/frontend-app-wiring.test.js tests/backend-api.test.js`
Expected: LLM 脱敏、前端字段边界和公共 API 测试全部 PASS。

```bash
git add backend/src/domain/events/eventSelector.js backend/src/llm/prompts/narrationPrompt.js frontend/src/app.js tests/narration-prompt.test.js tests/frontend-app-wiring.test.js
git commit -m "feat: expose safe event context to narration layer"
```

### Task 6: 建立事件目录完整性校验并迁移现有 29 个事件

**Files:**
- Create: `backend/src/domain/events/eventCatalogValidator.js`
- Modify: `backend/src/domain/events/eventCatalog.js`
- Create: `tests/event-catalog.test.js`

**Interfaces:**
- Consumes: `EVENT_CATALOG`、现有 `CHAPTER_CATALOG`、事件元数据和选择效果。
- Produces: `validateEventCatalog(catalog)` 返回 `{ valid: true, errors: [] }` 或 `{ valid: false, errors: [...] }`；测试直接断言 `valid` 和 `errors`，拒绝无效目录。

- [ ] **Step 1: 写目录校验失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_CATALOG } from '../backend/src/domain/events/eventCatalog.js';
import { validateEventCatalog } from '../backend/src/domain/events/eventCatalogValidator.js';

test('formal catalog has the required chapter distribution and metadata', () => {
  const result = validateEventCatalog(EVENT_CATALOG);
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('validator reports duplicate ids, wrong choice count and dangling references', () => {
  const result = validateEventCatalog([
    { id: 'duplicate', chapterIds: ['unknown'], cadence: 'mainline', oneShot: true, choices: [] },
    { id: 'duplicate', chapterIds: ['prologue'], cadence: 'bad', oneShot: false, choices: [] }
  ]);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /duplicate|unknown|cadence|choices/);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `$NODE_BIN --test tests/event-catalog.test.js`
Expected: FAIL because validator and formal metadata are not complete。

- [ ] **Step 3: 实现校验器**

校验器必须检查：

```js
const EXPECTED_CHAPTER_COUNTS = {
  prologue: 6,
  qi: 7,
  foundation: 7,
  golden_core: 7,
  mist: 8,
  ascension_scam: 8,
  finale: 7
};

export function validateEventCatalog(catalog = []) {
  const errors = [];
  const ids = new Set();
  const counts = Object.fromEntries(Object.keys(EXPECTED_CHAPTER_COUNTS).map((id) => [id, 0]));
  for (const event of catalog) {
    if (!event?.id || ids.has(event.id)) errors.push(`duplicate or missing id: ${event?.id ?? '<empty>'}`);
    ids.add(event?.id);
    const chapterId = event.chapterIds?.[0];
    if (!(chapterId in EXPECTED_CHAPTER_COUNTS)) errors.push(`unknown chapter: ${event.id}`);
    else counts[chapterId] += 1;
    if (!['mainline', 'side'].includes(event.cadence)) errors.push(`invalid cadence: ${event.id}`);
    if (event.oneShot !== (event.cadence === 'mainline')) errors.push(`cadence/oneShot mismatch: ${event.id}`);
    if (!event.narrativeContext?.scene || !Array.isArray(event.narrativeContext?.sensoryTags)) errors.push(`missing narrative context: ${event.id}`);
    if (!Array.isArray(event.choices) || event.choices.length < 2) errors.push(`need two choices: ${event.id}`);
    for (const choice of event.choices ?? []) {
      if (!choice.id || !choice.label || !choice.command || !choice.risk || !choice.narrativeIntent) errors.push(`incomplete choice: ${event.id}`);
    }
  }
  for (const [chapterId, expected] of Object.entries(EXPECTED_CHAPTER_COUNTS)) {
    if (counts[chapterId] !== expected) errors.push(`${chapterId}: expected ${expected}, got ${counts[chapterId]}`);
  }
  if (catalog.length !== 50) errors.push(`expected 50 formal events, got ${catalog.length}`);
  const knownIds = new Set(catalog.map((event) => event?.id));
  for (const event of catalog) {
    const references = [event.trigger?.requiresEventResolved, event.trigger?.forbidEventResolved];
    for (const choice of event.choices ?? []) {
      for (const effect of choice.success?.effects ?? []) {
        if (effect.type === 'futureEvent') references.push(effect.id);
      }
    }
    for (const reference of references.filter(Boolean)) {
      if (!knownIds.has(reference)) errors.push(`dangling event reference: ${event.id} -> ${reference}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
```

校验器只统计 `chapterIds[0]` 作为该事件的内容归属，正式事件统一使用单章节 `chapterIds`，避免多章节事件破坏配额计算。

- [ ] **Step 4: 为现有 29 个事件补齐元数据和第二选择**

现有事件迁移归属如下，原有选择效果必须保留：

| 章节 | 迁移事件 |
| --- | --- |
| `prologue` | `qingyun_life_register`、`master_guidance`、`lin_invitation`、`cultivation_lifespan_mark`、`sect_trial_notice`、`alchemy_gather_dew` |
| `qi` | `cultivation_breathing`、`breakthrough_bottleneck`、`alchemy_make_qi_pill`、`market_injured_cultivator`、`old_friend_returns` |
| `foundation` | `sect_elder_split`、`demon_beast_patrol`、`lin_shijie_warning`、`elder_private_warning` |
| `golden_core` | `sect_archive_key`、`black_market_offer`、`xuanheng_private_confession` |
| `mist` | `mist_bronze_bell`、`mist_archive_fragment`、`mist_lantern_path`、`mist_archive_full`、`heaven_gate_key_fragment` |
| `ascension_scam` | `heaven_contract_echo`、`lifespan_debt_collector`、`false_ascender_name`、`heaven_gate_tally`、`contract_scar_recurrence` |
| `finale` | `vengeful_spirit` |

所有 29 个记录补齐：`chapterIds: ['...']`、`cadence`、`oneShot`、`cooldownTurns`、`narrativeContext`。现有两项选择的事件保持两项以上；只有一项选择的事件增加一个低风险或高风险的真实替代选择。替代选择具体为：

| 事件 | 新选择 | 状态差异 |
| --- | --- | --- |
| `cultivation_breathing` | `force` | `player.cultivationProgress +16`、`player.qi -10` |
| `cultivation_lifespan_mark` | `suppress` | `player.mood +2`、`player.lifespan -2` |
| `breakthrough_bottleneck` | `stabilize` | `player.cultivationProgress +10`、`player.qi -4` |
| `alchemy_gather_dew` | `test_soil` | `materials.凝露草 +1`、`player.mood -2` |
| `alchemy_make_qi_pill` | `refine` | `materials.凝露草 -2`、`pills.聚气丹 +2` |
| `sect_trial_notice` | `observe` | `player.sectRelation +2`、`sect_trial_observed=true` |
| `sect_elder_split` | `interrupt` | `player.sectRelation -5`、`sect_elder_split=true` |
| `mist_bronze_bell` | `listen` | `player.qi -2`、`mist_bell_listened=true` |
| `mist_archive_fragment` | `memorize` | `player.mood -2`、`mist_archive=true` |
| `heaven_contract_echo` | `burn` | `player.mood +3`、`ascension_contract=true`、`player.qi -5` |
| `heaven_gate_key_fragment` | `trace` | `player.qi -4`、`heaven_key_traced=true` |
| `old_friend_returns` | `ask_truth` | `relation(lin_shijie,+2)`、`futureEvent(mist_archive_fragment)` |
| `vengeful_spirit` | `negotiate` | `karma +4`、`player.mood -4` |
| `lin_invitation` | `decline` | `relation(lin_shijie,+2)`、`player.mood +1` |
| `black_market_offer` | `bargain` | `player.spiritStones -10`、`materials.雷纹草 +1`、`evil +1` |
| `demon_beast_patrol` | `scout` | `player.sectRelation +2`、`sect.contribution +5` |
| `qingyun_life_register` | `close` | `relation(xuanheng,+1)`、`player.mood +2` |
| `sect_archive_key` | `return` | `relation(lin_shijie,+2)`、`player.sectRelation +2` |
| `lin_shijie_warning` | `press` | `relation(lin_shijie,+3)`、`player.mood -2` |
| `elder_private_warning` | `report` | `player.sectRelation -4`、`futureEvent(heaven_contract_echo)` |
| `mist_lantern_path` | `mark` | `player.qi -2`、`mist_lantern_marked=true` |
| `mist_archive_full` | `seal` | `player.mood +2`、`mist_archive_sealed=true` |
| `lifespan_debt_collector` | `hide` | `player.lifespan -1`、`player.mood -2` |
| `false_ascender_name` | `erase` | `player.mood +1`、`ascension_name_erased=true` |
| `xuanheng_private_confession` | `swear` | `relation(xuanheng,+4)`、`player.lifespan -2` |
| `heaven_gate_tally` | `copy` | `player.mood -2`、`heaven_tally_copied=true` |
| `contract_scar_recurrence` | `observe` | `player.mood -3`、`player.lifespan -2` |

`master_guidance`、`market_injured_cultivator` 已有多于两个选择，补齐元数据即可，不强制删减选择。

- [ ] **Step 5: 运行目录校验和既有事件测试**

Run: `$NODE_BIN --test tests/event-catalog.test.js tests/event-engine.test.js`
Expected: 迁移后的 29 个事件通过字段校验；此时目录仍报告缺少 21 个新事件，直到后续章节任务完成。

### Task 7: 串行录入序章、炼气和筑基新增事件

**Files:**
- Modify: `backend/src/domain/events/eventCatalog.js`
- Modify: `tests/event-catalog.test.js`
- Modify: `tests/event-engine.test.js`

**Interfaces:**
- Consumes: Task 2–6 的事件格式、触发器、效果和校验器。
- Produces: 完成 `prologue=6`、`qi=7`、`foundation=7`，新增 5 个事件并让序章到筑基形成可测试主线。

- [ ] **Step 1: 写章节配额和关键路线的失败测试**

```js
test('early chapters contain recovery and sect stance routes', () => {
  const byId = Object.fromEntries(EVENT_CATALOG.map((event) => [event.id, event]));
  assert.equal(byId.qi_failed_breakthrough_recovery.trigger.requiresBreakthroughFailure.tier, '炼气');
  assert.equal(byId.foundation_trial_verdict.choices.some((choice) => choice.success.effects.some((effect) => effect.type === 'storyProgress' && effect.path === 'sectPath')), true);
  assert.equal(byId.foundation_heart_demon.trigger.chapterIds[0], 'foundation');
});
```

- [ ] **Step 2: 运行失败测试**

Run: `$NODE_BIN --test tests/event-catalog.test.js tests/event-engine.test.js`
Expected: FAIL because the five new IDs do not exist。

- [ ] **Step 3: 添加炼气事件**

加入以下两个正式事件，每个两个选择、单章节归属和 `narrativeContext`：

| ID | 触发条件 | 稳健选择 | 高风险选择 |
| --- | --- | --- | --- |
| `qi_failed_breakthrough_recovery` | `chapterIds:['qi']`、`requiresBreakthroughFailure:{tier:'炼气',atLeast:1}` | `repair`: `player.qi +8`、`cultivationProgress +20`、`futureEvent('master_guidance')` | `press_on`: `cultivationProgress +35`、`player.health -8`、`flag('qi_failure_faced',true)` |
| `qi_lifespan_alarm` | `chapterIds:['qi']`、`lifespanRatioMax:0.45` | `seek_register`: `relation('xuanheng',+5)`、`flag('lifespan_mark',true)` | `burn_lifespan`: `cultivationProgress +25`、`player.lifespan -5`、`flag('lifespan_debt',true)` |

两个事件的场景分别为“受挫后的药庐”和“夜半命灯”，感官标签必须分别包含“药香/裂脉/冷汗”和“灰印/命灯/纸页”。

- [ ] **Step 4: 添加筑基事件**

加入以下三个正式事件：

| ID | 触发条件 | 稳健选择 | 高风险选择 |
| --- | --- | --- | --- |
| `foundation_trial_verdict` | `chapterIds:['foundation']`、`requiresFlags:['sect_trial_joined']` | `speak_truth`: `storyProgress.sectPath='truth'`、`sectRelation +5`、`flag('foundation_verdict',true)` | `join_silent`: `storyProgress.sectPath='silence'`、`sectRelation +10`、`evil +2` |
| `foundation_heart_demon` | `chapterIds:['foundation']`、`requiresBreakthroughFailure:{tier:'筑基',atLeast:1}` | `suppress`: `player.mood -3`、`cultivationProgress +12` | `face_it`: `relation('xuanheng',+5)`、`player.lifespan -3`、`flag('heart_demon_faced',true)` |
| `foundation_sect_oath` | `chapterIds:['foundation']`、`requiresFlags:['sect_elder_split']` | `archive_oath`: `storyProgress.sectPath='truth'`、`flag('foundation_oath',true)` | `close_oath`: `storyProgress.sectPath='silence'`、`player.sectRelation +6`、`flag('foundation_oath',true)` |

两个 `storyProgress.sectPath` 选择必须使用白名单效果；不得通过 LLM 或前端直接写入路线。

- [ ] **Step 5: 运行早期章节测试并提交**

Run: `$NODE_BIN --test tests/event-catalog.test.js tests/event-engine.test.js tests/chapter-progress.test.js`
Expected: 早期章节配额、突破失败恢复、宗门路线和章节目标测试 PASS。

```bash
git add backend/src/domain/events/eventCatalog.js tests/event-catalog.test.js tests/event-engine.test.js
git commit -m "feat: add prologue qi and foundation events"
```

### Task 8: 串行录入金丹和雾隐秘境事件

**Files:**
- Modify: `backend/src/domain/events/eventCatalog.js`
- Modify: `tests/event-catalog.test.js`
- Modify: `tests/event-engine.test.js`

**Interfaces:**
- Consumes: 早期章节的 `sectPath`、NPC 关系、境界触发器和真相旗标。
- Produces: 完成 `golden_core=7`、`mist=8`，新增 7 个事件并提供秘境多入口汇流。

- [ ] **Step 1: 写金丹/秘境失败测试**

```js
test('golden core and mist events provide access, cost and truth convergence', () => {
  const byId = Object.fromEntries(EVENT_CATALOG.map((event) => [event.id, event]));
  assert.equal(byId.mist_entry_authorization.trigger.requiresFlags.includes('sect_elder_split'), true);
  assert.equal(byId.mist_white_mist_price.trigger.lifespanRatioMax, 0.6);
  assert.equal(byId.mist_bell_keeper.choices.length, 2);
  assert.equal(byId.mist_archive_countermark.choices.some((choice) => choice.success.effects.some((effect) => effect.type === 'flag')), true);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `$NODE_BIN --test tests/event-catalog.test.js tests/event-engine.test.js`
Expected: FAIL because seven新增事件尚未加入。

- [ ] **Step 3: 添加金丹事件**

加入四个事件：

| ID | 触发条件 | 稳健选择 | 高风险选择 |
| --- | --- | --- | --- |
| `mist_entry_authorization` | `chapterIds:['golden_core']`、`realmAtLeast:'筑基初期'`、`requiresFlags:['sect_elder_split']` | `request`: `flag('mist_entry_unlocked',true)`、`relation('xuanheng',+3)` | `steal`: `flag('mist_entry_unlocked',true)`、`evil +8`、`player.lifespan -2` |
| `golden_core_formation` | `chapterIds:['golden_core']`、`realmAtLeast:'筑基后期'` | `steady`: `cultivationProgress +18`、`player.qi +5` | `condense`: `cultivationProgress +35`、`player.health -12`、`flag('golden_core_ready',true)` |
| `golden_core_storm` | `chapterIds:['golden_core']`、`realmAtLeast:'金丹初期'` | `weather`: `player.qi +6`、`mood -2` | `take_lightning`: `attribute fortune +1`、`player.health -15`、`flag('golden_storm_survived',true)` |
| `golden_core_npc_bargain` | `chapterIds:['golden_core']`、`npcAffinityMin:{npcId:'lin_shijie',value:12}` | `share`: `relation('lin_shijie',+6)`、`futureEvent('mist_bronze_bell')` | `trade_secret`: `relation('lin_shijie',-2)`、`flag('mist_entry_unlocked',true)`、`evil +3` |

- [ ] **Step 4: 添加雾隐事件**

加入三个事件：

| ID | 触发条件 | 稳健选择 | 高风险选择 |
| --- | --- | --- | --- |
| `mist_white_mist_price` | `chapterIds:['mist']`、`requiresFlags:['mist_entry_unlocked']`、`lifespanRatioMax:0.6` | `retreat`: `player.lifespan -1`、`flag('mist_cost_seen',true)` | `advance`: `player.lifespan -5`、`player.qi -8`、`flag('bronze_bell',true)` |
| `mist_bell_keeper` | `chapterIds:['mist']`、`requiresFlags:['bronze_bell']` | `answer`: `relation('lin_shijie',+5)`、`flag('mist_bell_keeper',true)`、`futureEvent('mist_archive_fragment')` | `silence`: `player.qi -6`、`flag('mist_bell_keeper',true)`、`flag('heaven_gate_key',true)` |
| `mist_archive_countermark` | `chapterIds:['mist']`、`requiresFlags:['mist_archive']` | `copy`: `flag('mist_countermark',true)`、`futureEvent('heaven_contract_echo')` | `burn`: `flag('mist_countermark',true)`、`evil +10`、`player.mood -8` |

雾隐事件的 `narrativeContext` 必须至少使用“铜铃/白雾/残碑/回声”中的两个感官标签；不同选择都可汇入 `mist_archive`、`bronze_bell` 或 `heaven_gate_key` 真相旗标，不得设置不可恢复的唯一入口。

- [ ] **Step 5: 运行章节测试并提交**

Run: `$NODE_BIN --test tests/event-catalog.test.js tests/event-engine.test.js tests/chapter-progress.test.js tests/narration-prompt.test.js`
Expected: 金丹资格、秘境寿元代价、真相汇流和 LLM 素材边界全部 PASS。

```bash
git add backend/src/domain/events/eventCatalog.js tests/event-catalog.test.js tests/event-engine.test.js
git commit -m "feat: add golden core and mist events"
```

### Task 9: 串行录入飞升骗局和终局分支事件

**Files:**
- Modify: `backend/src/domain/events/eventCatalog.js`
- Modify: `tests/event-catalog.test.js`
- Modify: `tests/event-engine.test.js`
- Modify: `tests/ending-resolver.test.js`

**Interfaces:**
- Consumes: 现有 `ENDING_CATALOG` 的 `reject/accept/guard/sacrifice` 契约立场和 `finalChoiceMade` 结局判定。
- Produces: 完成 `ascension_scam=8`、`finale=7`；四类正式结局都能通过事件选择进入；隐藏结局前置只存在于后端状态，不进入 LLM payload。

- [ ] **Step 1: 写飞升/终局失败测试**

```js
test('ascension events set all four contract stances through authoritative effects', () => {
  const stancePaths = EVENT_CATALOG
    .filter((event) => event.chapterIds?.[0] === 'ascension_scam')
    .flatMap((event) => event.choices)
    .flatMap((choice) => choice.success.effects)
    .filter((effect) => effect.type === 'storyProgress' && effect.path === 'contractStance')
    .map((effect) => effect.value);
  for (const stance of ['reject', 'accept', 'guard', 'sacrifice']) assert.ok(stancePaths.includes(stance), stance);
});

test('finale choice effects mark finalChoiceMade and resolve the existing ending catalog', () => {
  const finalChoices = EVENT_CATALOG
    .filter((event) => event.chapterIds?.[0] === 'finale')
    .flatMap((event) => event.choices)
    .flatMap((choice) => choice.success.effects);
  assert.ok(finalChoices.some((effect) => effect.type === 'storyProgress' && effect.path === 'finalChoiceMade' && effect.value === true));
});
```

- [ ] **Step 2: 运行失败测试**

Run: `$NODE_BIN --test tests/event-catalog.test.js tests/ending-resolver.test.js`
Expected: FAIL because飞升立场和终局标记尚未被正式事件覆盖。

- [ ] **Step 3: 添加飞升骗局事件**

加入三个事件：

| ID | 触发条件 | 稳健选择 | 高风险选择 |
| --- | --- | --- | --- |
| `ascension_contract_accounting` | `chapterIds:['ascension_scam']`、`requiresFlags:['ascension_contract']` | `reject`: `storyProgress.contractStance='reject'`、`flag('contract_accounted',true)` | `accept`: `storyProgress.contractStance='accept'`、`player.mood -8`、`flag('contract_accounted',true)` |
| `ascension_returned_message` | `chapterIds:['ascension_scam']`、`requiresEventResolved:'false_ascender_name'` | `listen`: `relation('xuanheng',+5)`、`flag('returned_message',true)` | `destroy`: `evil +8`、`player.qi -5`、`flag('returned_message',true)` |
| `ascension_scam_witness` | `chapterIds:['ascension_scam']`、`requiresFlags:['mist_archive']`、`requiresEventResolved:'mist_archive_full'` | `sacrifice`: `storyProgress.contractStance='sacrifice'`、`player.lifespan -8` | `guard`: `storyProgress.contractStance='guard'`、`flag('archive_guardian',true)` |

这样四种立场分别由 `ascension_contract_accounting`、`ascension_scam_witness` 的选择形成，结局解析仍使用现有 `ENDING_CATALOG`，不在事件效果中写入结局 ID。

- [ ] **Step 4: 添加终局事件**

加入以下六个新增终局归属事件：

| ID | 触发条件 | 稳健选择 | 高风险选择 |
| --- | --- | --- | --- |
| `finale_break_contract` | `chapterIds:['finale']`、`requiresFlags:['heaven_gate_key']` | `tear`: `contractStance='reject'`、`finalChoiceMade=true`、`flag('final_break_attempted',true)` | `seal`: `contractStance='guard'`、`finalChoiceMade=true`、`player.lifespan -4` |
| `finale_accept_contract` | `chapterIds:['finale']`、`requiresFlags:['ascension_contract']` | `sign`: `contractStance='accept'`、`finalChoiceMade=true`、`player.mood -6` | `rewrite`: `contractStance='reject'`、`finalChoiceMade=true`、`player.lifespan -6` |
| `finale_guard_mist` | `chapterIds:['finale']`、`requiresFlags:['bronze_bell','mist_archive']` | `keep_bell`: `contractStance='guard'`、`finalChoiceMade=true`、`flag('mist_guardian_mark',true)` | `open_archive`: `contractStance='reject'`、`finalChoiceMade=true`、`player.qi -12` |
| `finale_sacrifice_lifelong` | `chapterIds:['finale']`、`lifespanRatioMax:0.25` | `pin_lifeline`: `contractStance='sacrifice'`、`finalChoiceMade=true`、`player.lifespan -10` | `burn_name`: `contractStance='sacrifice'`、`finalChoiceMade=true`、`evil +5`、`player.lifespan -6` |
| `finale_npc_parting` | `chapterIds:['finale']`、`npcAffinityMin:{npcId:'lin_shijie',value:12}`、`requiresEventResolved:'ascension_returned_message'` | `part`: `relation('lin_shijie',+5)`、`flag('npc_parting_seen',true)` | `ask_help`: `relation('lin_shijie',-3)`、`player.mood +4`、`flag('npc_parting_seen',true)` |
| `finale_last_lifespan` | `chapterIds:['finale']`、`lifespanRatioMax:0.15` | `leave_words`: `relation('xuanheng',+4)`、`player.lifespan -1` | `force_finale`: `player.lifespan -5`、`player.qi -10`、`flag('last_lifespan_warning',true)` |

与迁移的 `vengeful_spirit` 合计，终局正好 7 个事件。四个带 `finalChoiceMade=true` 的事件都必须是 `mainline`/`oneShot`，其余两个为 `side`，避免终局候选池重复刷出结局动作。

- [ ] **Step 5: 运行全目录和结局测试**

Run: `$NODE_BIN --test tests/event-catalog.test.js tests/event-engine.test.js tests/ending-resolver.test.js tests/chapter-progress.test.js`
Expected: 50 个事件、七章配额、四种立场和现有结局解析全部 PASS。

```bash
git add backend/src/domain/events/eventCatalog.js tests/event-catalog.test.js tests/event-engine.test.js tests/ending-resolver.test.js
git commit -m "feat: add ascension scam and finale events"
```

### Task 10: 完成目录引用审计和端到端 API 回归

**Files:**
- Modify: `tests/backend-api.test.js`
- Modify: `tests/frontend-backend-integration.test.js`
- Modify: `tests/time-pressure.test.js`
- Modify: `tests/event-engine.test.js`

**Interfaces:**
- Consumes: Task 1–9 的完整事件目录和服务端流程。
- Produces: 从 `/api/v1/actions` 到 `/api/v1/turns` 再到章节推进、寿元终章和 LLM 叙事回退的完整验收证据。

- [ ] **Step 1: 添加 API 公共字段与脱敏测试**

```js
test('public event actions expose cadence and risk but no internal rule fields', async () => {
  const app = createBackendApp({ seed: 31, now: fixedNow });
  app.getState().game.onboarding = completedOnboardingState();
  const response = await jsonResponse(app.handle(makeRequest('POST', '/api/v1/daily-actions', {
    viewId: 'realm',
    gameVersion: app.getState().game.version
  })));
  const event = response.data.actions.find((action) => action.cadence === 'mainline' || action.cadence === 'side');
  assert.ok(event);
  assert.ok(['low', 'medium', 'high'].includes(event.risk));
  for (const key of ['eventId', 'choiceId', 'event', 'choice', 'trigger', 'effects']) assert.equal(key in event, false);
});
```

- [ ] **Step 2: 添加事件结算到章节推进测试**

构造一个 `qi` 存档，选择 `qi_lifespan_alarm` 的稳健分支，断言：

```js
assert.equal(turnPayload.data.game.eventHistory.resolved.includes('qi_lifespan_alarm'), true);
assert.equal(turnPayload.data.turnResult.chapter.id, 'qi');
assert.equal('eventId' in turnPayload.data.game.log.at(-1), false);
```

随后构造满足炼气章节两个必需目标的状态，结算一回合，断言 `chapterTransition.toChapterId === 'foundation'`，确认事件状态和章节权威推进在同一回合一致。

- [ ] **Step 3: 添加寿元终章与 LLM 回退测试**

使用 `player.lifespan=1`、`maxLifespan=100` 的存档结算一个会消耗时间的支线事件，断言 `ending.type === 'lifespan_exhausted'`、`storyProgress.status === 'ended'`，并在无 LLM 时断言确定性 `fallbackNarration` 仍返回事件文本。

- [ ] **Step 4: 运行端到端测试**

Run:

```bash
$NODE_BIN --test tests/backend-api.test.js tests/frontend-backend-integration.test.js tests/time-pressure.test.js tests/event-engine.test.js
```

Expected: 公共 API、事件结算、章节推进、冷却、寿元终章和回退叙事全部 PASS。

- [ ] **Step 5: 提交端到端回归**

```bash
git add tests/backend-api.test.js tests/frontend-backend-integration.test.js tests/time-pressure.test.js tests/event-engine.test.js
git commit -m "test: cover event library API and chapter flow"
```

### Task 11: 全量验证、内容路线验收和计划收尾

**Files:**
- Modify: `tests/event-catalog.test.js`（只在补充路线夹具时修改）
- Modify: `docs/superpowers/specs/2026-07-16-event-library-expansion-design.md`（只在实现发现规格错误时修改，并单独提交）

**Interfaces:**
- Consumes: 所有实现任务和测试。
- Produces: 可复现的全量测试结果、三条人工路线的验收记录和 `dev` 分支上的完整提交链。

- [ ] **Step 1: 运行全量自动测试**

```bash
NODE_BIN=/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE_BIN --test
```

Expected: 退出码 0，`0 fail`、`0 cancelled`；测试数量以运行时输出为准，不用旧基线替代本次结果。

- [ ] **Step 2: 运行目录和格式审计**

```bash
$NODE_BIN --input-type=module -e "import { EVENT_CATALOG } from './backend/src/domain/events/eventCatalog.js'; import { validateEventCatalog } from './backend/src/domain/events/eventCatalogValidator.js'; console.log(EVENT_CATALOG.length, validateEventCatalog(EVENT_CATALOG));"
git diff --check HEAD^ HEAD
git status --short
```

Expected：目录输出 `50` 且 `valid: true`；当前实现提交无 whitespace 错误；工作树只保留既有 `.idea/` 等明确无关文件。

- [ ] **Step 3: 人工验证三条路线**

使用现有前端/后端运行命令，在浏览器中完成：

1. 稳健路线：序章和炼气主要选低风险，确认章节从 `prologue` 进入 `qi`，支线重复奖励第二次变为 50%。
2. 冒险路线：至少一次炼气/筑基突破失败后进入恢复事件，确认失败统计开放恢复路径且仍能完成章节。
3. 真相路线：收集至少四条真相并选择 `reject`/`guard`/`sacrifice` 中一条，确认终局只展示公开叙事，不展示内部结局 ID，最终由现有 `endingResolver` 选择结局。

- [ ] **Step 4: 请求代码评审前的证据整理**

记录以下结果：分支为 `dev`、最近提交列表、全量测试输出、目录统计输出、API 脱敏测试输出和三条路线的结果。不要推送远程，不要合并 `main`。

- [ ] **Step 5: 提交最终验证**

```bash
git add tests/event-catalog.test.js
git commit -m "test: verify complete event catalog"
```

## 规格覆盖自审清单

- 规则与叙事分层：Task 5 的白名单上下文、Task 10 的 API 脱敏和回退叙事。
- 章节驱动事件模型：Task 2 的 `chapterIds`、Task 6 的目录校验、Task 7–9 的章节内容。
- 50 个事件与七章配额：Task 6 迁移 29 个，Task 7 新增 5 个，Task 8 新增 7 个，Task 9 新增 9 个，合计 50。
- 主线一次性、支线冷却和递减收益：Task 1 的历史状态、Task 3 的收益缩放、Task 4 的候选过滤。
- 分支汇流、NPC/宗门/寿元/突破失败：Task 2 的触发器、Task 3 的状态效果和失败统计、Task 7–9 的内容表。
- 隐藏结局前置与现有结局解析：Task 9 只写 `contractStance` 和 `finalChoiceMade`，由现有 `endingResolver` 继续决定结局。
- 前端显示和 LLM 特色：Task 5 公开主支线/风险标签，LLM 使用场景、情绪、NPC 角色、感官标签和叙事意图。
- 回归与人工验收：Task 10 覆盖 API/章节/寿元终章，Task 11 覆盖全量测试和三条路线。
- 非目标边界：Global Constraints 明确不改数值平衡、存档槽、成就和云端同步。

## 执行顺序与并行结论

任务必须按 `1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11` 顺序执行。原因是 `eventCatalog.js`、`triggerMatcher.js`、`eventSelector.js` 和 `effectResolver.js` 互相依赖，且章节事件内容都写入同一个目录文件；并行改写会产生字段漂移、目录配额冲突和难以审计的合并冲突。

可以并行的范围只有：

- Task 1 的测试阅读与 Task 6 的事件内容表审阅，但不能同时写共享业务文件；
- Task 10 的 API 测试审阅与 Task 11 的人工路线准备，但必须在 Task 9 完成后执行；
- 实现完成后的代码评审和文档格式检查。

最安全的执行方式是当前会话内按任务串行执行；如果使用子代理，也必须每个任务单独分派、回收、运行测试并提交后再开始下一个任务，禁止多个子代理同时编辑 `eventCatalog.js`。
