# 主线章节状态机与终局分支 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在后端建立七章节主线状态机和确定性终局解析，让正式角色可以从序章推进到终局，并把章节摘要、章节转场和结局安全地提供给现有连续剧情前端。

**Architecture:** 新增章节目录、声明式目标求值器、章节状态归一化器和终局解析器。每次规则结算完成后，后端先更新章节与结局，再保存规则快照和生成叙事；LLM 只能读取章节公开摘要并润色变化，不能修改章节、目标、真相旗标或结局。前端继续使用现有四个页签，只新增章节进度和结局展示。

**Tech Stack:** Node.js ESM、原生 `node:test`、现有 REST/SSE 路由、现有 game state、原生前端 JavaScript、现有 CSS。

## Global Constraints

- 所有开发、测试和提交都在 `dev` 分支完成；不得在 `main` 提交或推送。
- 不操作或提交现有未跟踪的 `.idea/`。
- 使用项目缓存 Node：`/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`。
- 新手引导和角色创建不推进正式章节；正式角色从 `prologue` 开始。
- 章节由后端规则层推进，LLM 不得写入章节、objective、truth flag、契约立场或 ending id。
- 普通支线允许错过；只有声明式 required objective 能阻止章节切换。
- 同一回合最多推进一个普通章节；切换、里程碑和结局解析必须幂等。
- `ending.status === 'ended'` 后，行动接口返回 `GAME_ENDED`，状态读取和传记导出继续可用。
- 保留现有连续剧情流、旧 `act_...` 行动流、onboarding gating 和现有测试行为。
- 前端不展示 raw id、flag、effect hint、prompt 或调试字段，只展示标题、进度、目标文本和结局摘要。

---

## Source And File Map

依据：[2026-07-15-chapter-state-and-endings-design.md](/Users/ruilifeng/Documents/game/docs/superpowers/specs/2026-07-15-chapter-state-and-endings-design.md)。

新增文件：

- `backend/src/domain/chapters/chapterCatalog.js`：七章目录和目标定义。
- `backend/src/domain/chapters/objectiveEvaluator.js`：声明式目标求值。
- `backend/src/domain/chapters/storyProgress.js`：正式章节状态初始化、旧状态迁移和公开快照。
- `backend/src/domain/chapters/chapterProgression.js`：章节完成、切换和历史写入。
- `backend/src/domain/endings/endingCatalog.js`：主动结局和失败结局定义。
- `backend/src/domain/endings/endingResolver.js`：结局条件排序和终态写入。
- `frontend/src/ui/chapterProgress.js`：章节展示 helper。
- `tests/chapter-state.test.js`、`tests/chapter-migration.test.js`、`tests/chapter-progress.test.js`、`tests/ending-resolver.test.js`、`tests/backend-chapter-integration.test.js`、`tests/frontend-chapter-state.test.js`。

修改文件：

- `backend/src/domain/progression.js`、`backend/src/domain/characterCreation.js`、`backend/src/domain/time/timePressure.js`、`backend/src/domain/turnResult.js`。
- `backend/src/llm/prompts/storyDirectorPrompt.js`、`backend/src/app.js`。
- `src/engine.js`、`frontend/src/app.js`、`frontend/src/styles.css`。
- 相关 backend/frontend/progression/time 测试文件。

## Shared Interfaces

后续任务固定使用这些函数名：

```js
listChapterDefinitions() -> ChapterDefinition[]
getChapterDefinition(chapterId) -> ChapterDefinition | null
evaluateObjective(objective, game) -> boolean
getChapterProgress(chapter, game) -> ChapterProgress
createFormalStoryProgress() -> StoryProgress
normalizeStoryProgress(game) -> StoryProgress | null
getPublicChapterSnapshot(game) -> PublicChapterSnapshot | null
resolveChapterProgress({ before, after, turn }) -> ChapterResolution
resolveEnding(game) -> EndingCandidate | null
applyEnding(game, candidate, turn) -> GameState
buildTurnResult({ before, after, actionId, narration, timeResult, chapterTransition, ending }) -> TurnResult
```

公开章节快照只能包含：

```js
{
  id: 'qi',
  index: 1,
  title: '炼气：命火有痕',
  progress: 40,
  objectives: [
    { text: '将炼气修至圆满', completed: false, required: true }
  ]
}
```

### Task 1: 建立七章目录和目标求值器

**Files:**

- Create: `backend/src/domain/chapters/chapterCatalog.js`
- Create: `backend/src/domain/chapters/objectiveEvaluator.js`
- Modify: `backend/src/domain/progression.js`
- Test: `tests/chapter-state.test.js`

**Interfaces:**

- Consumes: `game.player.realm`、`game.flags`、`game.npcs`、`game.storyProgress`。
- Produces: `CHAPTER_CATALOG`、`listChapterDefinitions()`、`getChapterDefinition()`、`evaluateObjective()`、`getChapterProgress()`。

- [ ] **Step 1: 写失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { getChapterDefinition, listChapterDefinitions } from '../backend/src/domain/chapters/chapterCatalog.js';
import { evaluateObjective, getChapterProgress } from '../backend/src/domain/chapters/objectiveEvaluator.js';

const game = {
  player: { realm: '筑基初期' },
  flags: { lifespan_mark: true, bronze_bell: true },
  npcs: [{ name: '林师姐', affinity: 12 }],
  storyProgress: { truthFlags: ['lifespan_mark', 'bronze_bell', 'mist_archive'], sectPath: 'truth', contractStance: 'reject' }
};

test('catalog has seven ordered chapters', () => {
  assert.deepEqual(listChapterDefinitions().map((item) => item.id), [
    'prologue', 'qi', 'foundation', 'golden_core', 'mist', 'ascension_scam', 'finale'
  ]);
  assert.deepEqual(listChapterDefinitions().map((item) => item.index), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(getChapterDefinition('missing'), null);
});

test('objective evaluator handles realm, flag, NPC, truth and contract predicates', () => {
  assert.equal(evaluateObjective({ predicate: { type: 'realmAtLeast', realm: '筑基初期' } }, game), true);
  assert.equal(evaluateObjective({ predicate: { type: 'anyFlag', flags: ['lifespan_mark'] } }, game), true);
  assert.equal(evaluateObjective({ predicate: { type: 'npcAffinityAtLeast', npcName: '林师姐', value: 10 } }, game), true);
  assert.equal(evaluateObjective({ predicate: { type: 'truthFlagCountAtLeast', value: 3 } }, game), true);
  assert.equal(evaluateObjective({ predicate: { type: 'contractStanceSelected' } }, game), true);
});

test('chapter progress reports required completion and percentage', () => {
  const chapter = getChapterDefinition('qi');
  const result = getChapterProgress(chapter, {
    ...game,
    player: { realm: '炼气九层' },
    flags: { lifespan_mark: true }
  });
  assert.equal(result.requiredCompleted, true);
  assert.equal(result.progress, 100);
});
```

- [ ] **Step 2: 运行失败测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/chapter-state.test.js
```

Expected: FAIL with module-not-found for `backend/src/domain/chapters/chapterCatalog.js`。

- [ ] **Step 3: 统一境界排序**

在 `backend/src/domain/progression.js` 导出并复用：

```js
export const REALM_ORDER = [
  '炼气一层', '炼气二层', '炼气三层', '炼气四层', '炼气五层',
  '炼气六层', '炼气七层', '炼气八层', '炼气九层',
  '筑基初期', '筑基中期', '筑基后期',
  '金丹初期', '金丹中期', '金丹后期',
  '元婴初期', '元婴中期', '元婴后期', '化神初期', '化神中期', '化神后期'
];

export function compareRealms(left = '', right = '') {
  return REALM_ORDER.indexOf(left) - REALM_ORDER.indexOf(right);
}
```

将现有突破用的 `REALM_ADVANCEMENT` 改为由该顺序生成，保持现有突破结果不变。

- [ ] **Step 4: 实现章节目录**

在 `chapterCatalog.js` 定义七章和以下 required objective：

```js
export const CHAPTER_CATALOG = [
  {
    id: 'prologue', index: 0, title: '序章：命簿初开', nextChapterId: 'qi',
    objectives: [
      { id: 'prologue_npc_contact', required: true, predicate: { type: 'anyNpcAffinityAtLeast', value: 5 }, publicText: '认识一位愿意指点你的青云宗人物' },
      { id: 'prologue_first_clue', required: true, predicate: { type: 'anyFlag', flags: ['lifespan_mark', 'bronze_bell'] }, publicText: '触及寿元或雾隐秘境的第一道线索' }
    ]
  },
  {
    id: 'qi', index: 1, title: '炼气：命火有痕', nextChapterId: 'foundation',
    objectives: [
      { id: 'qi_reach_ninth_layer', required: true, predicate: { type: 'realmAtLeast', realm: '炼气九层' }, publicText: '将炼气修至圆满' },
      { id: 'qi_reveal_lifespan_mark', required: true, predicate: { type: 'anyFlag', flags: ['lifespan_mark', 'ascension_contract'] }, publicText: '查明寿元异常的第一道痕迹' }
    ]
  },
  {
    id: 'foundation', index: 2, title: '筑基：道基与宗门', nextChapterId: 'golden_core',
    objectives: [
      { id: 'foundation_success', required: true, predicate: { type: 'realmAtLeast', realm: '筑基初期' }, publicText: '成功筑基' },
      { id: 'foundation_sect_path', required: true, predicate: { type: 'sectPathSelected' }, publicText: '确定宗门暗线中的立场' },
      { id: 'foundation_npc_bond', required: true, predicate: { type: 'anyNpcAffinityAtLeast', value: 12 }, publicText: '完成一条关键人物关系线' }
    ]
  },
  {
    id: 'golden_core', index: 3, title: '金丹：丹成见世', nextChapterId: 'mist',
    objectives: [
      { id: 'golden_core_success', required: true, predicate: { type: 'realmAtLeast', realm: '金丹初期' }, publicText: '成功结丹' },
      { id: 'golden_core_sect_conflict', required: true, predicate: { type: 'flag', flag: 'sect_elder_split' }, publicText: '触发青云宗长老分歧' },
      { id: 'golden_core_mist_access', required: true, predicate: { type: 'anyFlag', flags: ['mist_entry_unlocked', 'mist_archive'] }, publicText: '取得雾隐秘境进入资格' }
    ]
  },
  {
    id: 'mist', index: 4, title: '雾隐秘境：铜铃残档', nextChapterId: 'ascension_scam',
    objectives: [
      { id: 'mist_truth_count', required: true, predicate: { type: 'truthFlagCountAtLeast', value: 3 }, publicText: '找到至少三条雾隐真相线索' },
      { id: 'mist_key_clue', required: true, predicate: { type: 'anyFlag', flags: ['heaven_gate_key', 'bronze_bell'] }, publicText: '取得青铜铃或天门秘钥线索' }
    ]
  },
  {
    id: 'ascension_scam', index: 5, title: '飞升骗局：天门账帖', nextChapterId: 'finale',
    objectives: [
      { id: 'scam_contract', required: true, predicate: { type: 'flag', flag: 'ascension_contract' }, publicText: '确认天门契的真实存在' },
      { id: 'scam_truth_count', required: true, predicate: { type: 'truthFlagCountAtLeast', value: 4 }, publicText: '核对足够多的飞升者真相' },
      { id: 'scam_stance', required: true, predicate: { type: 'contractStanceSelected' }, publicText: '决定如何面对飞升契约' }
    ]
  },
  {
    id: 'finale', index: 6, title: '终局分支', nextChapterId: null,
    objectives: [
      { id: 'finale_stance', required: true, predicate: { type: 'finalChoiceMade' }, publicText: '完成天门契最终抉择' }
    ]
  }
];

export function listChapterDefinitions() {
  return CHAPTER_CATALOG.map((item) => structuredClone(item));
}

export function getChapterDefinition(chapterId) {
  return CHAPTER_CATALOG.find((item) => item.id === chapterId) ?? null;
}
```

- [ ] **Step 5: 实现目标求值和进度计算**

在 `objectiveEvaluator.js` 支持 `flag`、`anyFlag`、`allFlags`、`realmAtLeast`、`npcAffinityAtLeast`、`anyNpcAffinityAtLeast`、`truthFlagCountAtLeast`、`sectPathSelected`、`contractStanceSelected` 和内部终局门槛 `finalChoiceMade`。未知 predicate 返回 `false`。

```js
import { compareRealms } from '../progression.js';

export function evaluateObjective(objective, game = {}) {
  const predicate = objective?.predicate ?? {};
  const flags = game.flags ?? {};
  const progress = game.storyProgress ?? {};
  const npcs = game.npcs ?? [];

  if (predicate.type === 'flag') return flags[predicate.flag] === true;
  if (predicate.type === 'anyFlag') return (predicate.flags ?? []).some((flag) => flags[flag] === true);
  if (predicate.type === 'allFlags') return (predicate.flags ?? []).every((flag) => flags[flag] === true);
  if (predicate.type === 'realmAtLeast') return compareRealms(game.player?.realm, predicate.realm) >= 0;
  if (predicate.type === 'npcAffinityAtLeast') return npcs.some((npc) => npc.name === predicate.npcName && (npc.affinity ?? 0) >= predicate.value);
  if (predicate.type === 'anyNpcAffinityAtLeast') return npcs.some((npc) => (npc.affinity ?? 0) >= predicate.value);
  if (predicate.type === 'truthFlagCountAtLeast') return (progress.truthFlags ?? []).length >= predicate.value;
  if (predicate.type === 'sectPathSelected') return Boolean(progress.sectPath);
  if (predicate.type === 'contractStanceSelected') return Boolean(progress.contractStance);
  if (predicate.type === 'finalChoiceMade') return progress.finalChoiceMade === true;
  return false;
}

export function getChapterProgress(chapter, game = {}) {
  const completedObjectiveIds = chapter.objectives.filter((objective) => evaluateObjective(objective, game)).map((objective) => objective.id);
  const requiredObjectives = chapter.objectives.filter((objective) => objective.required);
  const requiredCompleted = requiredObjectives.every((objective) => completedObjectiveIds.includes(objective.id));
  return {
    completedObjectiveIds,
    requiredCompleted,
    progress: chapter.objectives.length === 0 ? 100 : Math.floor((completedObjectiveIds.length / chapter.objectives.length) * 100)
  };
}
```

- [ ] **Step 6: 运行 Task 1 测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/chapter-state.test.js tests/progression.test.js
```

Expected: 新增章节测试和原有 progression 测试全部 PASS。

- [ ] **Step 7: 在 dev 提交 Task 1**

```bash
git add backend/src/domain/chapters/chapterCatalog.js backend/src/domain/chapters/objectiveEvaluator.js backend/src/domain/progression.js tests/chapter-state.test.js
git commit -m "feat: add chapter catalog and objective evaluation"
```

### Task 2: 初始化正式章节状态并迁移旧状态

**Files:**

- Create: `backend/src/domain/chapters/storyProgress.js`
- Create: `tests/chapter-migration.test.js`
- Modify: `backend/src/domain/characterCreation.js`
- Modify: `backend/src/app.js`
- Modify: `src/engine.js`

**Interfaces:**

- Consumes: Task 1 的章节目录和目标求值。
- Produces: `createFormalStoryProgress()`、`normalizeStoryProgress()`、`getPublicChapterSnapshot()`。

- [ ] **Step 1: 写失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine.js';
import { createFormalStoryProgress, normalizeStoryProgress, getPublicChapterSnapshot } from '../backend/src/domain/chapters/storyProgress.js';

test('formal progress starts at prologue', () => {
  assert.deepEqual(createFormalStoryProgress(), {
    chapterId: 'prologue', chapterIndex: 0, status: 'active', completedObjectiveIds: [],
    truthFlags: [], sectPath: null, contractStance: null, finalChoiceMade: false, endingId: null
  });
});

test('tutorial state has no formal chapter', () => {
  assert.equal(normalizeStoryProgress({ ...createGame(31), onboarding: { completed: false } }), null);
});

test('legacy formal state derives known truth flags once', () => {
  const progress = normalizeStoryProgress({ ...createGame(31), onboarding: { completed: true }, flags: { lifespan_mark: true, bronze_bell: true } });
  assert.equal(progress.chapterId, 'prologue');
  assert.deepEqual(progress.truthFlags, ['lifespan_mark', 'bronze_bell']);
  assert.deepEqual(progress.completedObjectiveIds, []);
});

test('public snapshot hides objective ids and flag names', () => {
  const game = { ...createGame(31), onboarding: { completed: true }, storyProgress: createFormalStoryProgress() };
  const serialized = JSON.stringify(getPublicChapterSnapshot(game));
  assert.match(serialized, /序章：命簿初开/);
  assert.doesNotMatch(serialized, /prologue_first_clue|lifespan_mark/);
});
```

- [ ] **Step 2: 运行失败测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/chapter-migration.test.js
```

Expected: FAIL with module-not-found for `storyProgress.js`。

- [ ] **Step 3: 实现状态归一化**

`createFormalStoryProgress()` 返回固定字段；`normalizeStoryProgress(game)` 在 onboarding 未完成时返回 `null`，正式状态缺少字段时补齐默认值，非法 chapter id 回退 `prologue`，已存在 ending 时将 status 设为 `ended`。为避免刚进入 `finale` 就自动结局，新增内部字段 `finalChoiceMade`，只有最终选择写入既有事实 flag `final_choice_made` 后才置为 `true`；它不直接暴露给玩家界面。

truth flag 只从固定列表聚合：

```js
const TRUTH_FLAG_KEYS = [
  'lifespan_mark', 'mist_archive', 'bronze_bell',
  'sect_elder_split', 'ascension_contract', 'heaven_gate_key'
];

const truthFlags = [...new Set([
  ...(existing.truthFlags ?? []),
  ...TRUTH_FLAG_KEYS.filter((flag) => game.flags?.[flag] === true)
])];

const finalChoiceMade = existing.finalChoiceMade === true || game.flags?.final_choice_made === true;
```

`getPublicChapterSnapshot(game)` 调用 `getChapterProgress()`，只返回 `id`、`index`、`title`、`progress` 和 `{ text, completed, required }`。

- [ ] **Step 4: 接入正式角色和 normalizeGame**

在 `applyCharacterToGame()` 增加：

```js
storyProgress: createFormalStoryProgress(),
chapterHistory: []
```

在 `backend/src/app.js` 的 `normalizeGame()` 中补齐：

```js
const storyProgress = normalizeStoryProgress(normalized);
const withStoryProgress = {
  ...normalized,
  storyProgress,
  chapterHistory: storyProgress ? (game.chapterHistory ?? []) : []
};

return {
  ...withStoryProgress,
  chapter: getPublicChapterSnapshot(withStoryProgress),
  storyMemory: normalizeStoryMemory(game.storyMemory, withStoryProgress)
};
```

教程 mock 保持 `storyProgress: null`，正式角色创建后必须返回 `chapter.id === 'prologue'`。

- [ ] **Step 5: 运行迁移和角色创建回归测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/chapter-migration.test.js tests/onboarding-character.test.js tests/backend-api.test.js
```

Expected: 教程、正式角色和旧状态迁移测试全部 PASS。

- [ ] **Step 6: 在 dev 提交 Task 2**

```bash
git add backend/src/domain/chapters/storyProgress.js backend/src/domain/characterCreation.js backend/src/app.js src/engine.js tests/chapter-migration.test.js
git commit -m "feat: initialize formal chapter progress"
```

### Task 3: 实现章节推进、章节历史和回合结果字段

**Files:**

- Create: `backend/src/domain/chapters/chapterProgression.js`
- Create: `tests/chapter-progress.test.js`
- Create: `tests/backend-chapter-integration.test.js`
- Modify: `backend/src/app.js`
- Modify: `backend/src/domain/turnResult.js`

**Interfaces:**

- Consumes: Task 1 的目标求值和 Task 2 的 `storyProgress`、`chapterHistory`。
- Produces: `resolveChapterProgress({ before, after, turn })`、`turnResult.chapter`、`turnResult.chapterTransition`。

- [ ] **Step 1: 写章节切换和幂等失败测试**

测试 fixture 设置 `storyProgress.chapterId = 'qi'`、`player.realm = '炼气九层'`、`flags.lifespan_mark = true`、林师姐 affinity 为 `14`，然后断言：

```js
const result = resolveChapterProgress({ before: game, after: game, turn: 19 });

assert.equal(result.game.storyProgress.chapterId, 'foundation');
assert.equal(result.transition.fromChapterId, 'qi');
assert.equal(result.transition.toChapterId, 'foundation');
assert.equal(result.game.chapterHistory.length, 1);

const repeated = resolveChapterProgress({ before: result.game, after: result.game, turn: 19 });
assert.equal(repeated.transition, null);
assert.equal(repeated.game.chapterHistory.length, 1);
```

另测缺少 `lifespan_mark` 时保持在 `qi`，以及同一回合只能从 `qi` 进入 `foundation`，不能直接跳到 `golden_core`。

- [ ] **Step 2: 运行失败测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/chapter-progress.test.js
```

Expected: FAIL with module-not-found for `chapterProgression.js`。

- [ ] **Step 3: 实现 resolveChapterProgress**

实现以下确定性流程：

```js
export function resolveChapterProgress({ before, after, turn }) {
  if (!after.storyProgress || after.storyProgress.status === 'ended' || after.ending) {
    return { game: after, completedObjectiveIds: [], transition: null, milestone: null, ending: after.ending ?? null };
  }

  const current = getChapterDefinition(after.storyProgress.chapterId);
  if (!current) throw new Error(`CHAPTER_CONFIG_INVALID:${after.storyProgress.chapterId}`);

  const progress = getChapterProgress(current, after);
  const completedObjectiveIds = [...new Set([
    ...(after.storyProgress.completedObjectiveIds ?? []),
    ...progress.completedObjectiveIds
  ])];
  const withProgress = {
    ...after,
    storyProgress: { ...after.storyProgress, completedObjectiveIds }
  };

  if (!progress.requiredCompleted || !current.nextChapterId) {
    return {
      game: { ...withProgress, chapter: getPublicChapterSnapshot(withProgress) },
      completedObjectiveIds: progress.completedObjectiveIds,
      transition: null,
      milestone: null,
      ending: withProgress.ending ?? null
    };
  }

  const next = getChapterDefinition(current.nextChapterId);
  if (!next) throw new Error(`CHAPTER_CONFIG_INVALID_NEXT:${current.id}`);

  const nextGame = {
    ...withProgress,
    storyProgress: {
      ...withProgress.storyProgress,
      chapterId: next.id,
      chapterIndex: next.index,
      chapterStartedTurn: turn,
      chapterStartedElapsedMonths: withProgress.time?.elapsedMonths ?? 0,
      completedObjectiveIds: []
    },
    chapterHistory: [
      ...(withProgress.chapterHistory ?? []),
      {
        chapterId: current.id,
        index: current.index,
        startedTurn: withProgress.storyProgress.chapterStartedTurn ?? 0,
        completedTurn: turn,
        startedElapsedMonths: withProgress.storyProgress.chapterStartedElapsedMonths ?? 0,
        completedElapsedMonths: withProgress.time?.elapsedMonths ?? 0,
        completedObjectiveIds: progress.completedObjectiveIds
      }
    ]
  };

  return {
    game: { ...nextGame, chapter: getPublicChapterSnapshot(nextGame) },
    completedObjectiveIds: progress.completedObjectiveIds,
    transition: {
      fromChapterId: current.id,
      toChapterId: next.id,
      fromTitle: current.title,
      toTitle: next.title,
      completedObjectiveIds: progress.completedObjectiveIds
    },
    milestone: { id: `${current.id}_complete`, chapterId: current.id },
    ending: null
  };
}
```

在 `truthFlags` 更新处只能调用 Task 2 提供的固定 truth flag 合并函数，不能把所有 boolean `game.flags` 都当作真相。

- [ ] **Step 4: 扩展 buildTurnResult，保持旧字段**

将 `backend/src/domain/turnResult.js` 的签名扩展为：

```js
export function buildTurnResult({ before, after, actionId, narration, timeResult, chapterTransition = null, ending = after.ending ?? null }) {
  const entry = after.log.at(-1);
  return {
    turn: after.turn,
    actionId,
    chapter: after.chapter ?? null,
    chapterTransition,
    ending,
    ruleResult: {
      success: true,
      statChanges: diffStats(before.player, after.player),
      ...(timeResult ? { timeResult: publicTimeResult(timeResult) } : {})
    },
    narration: narration ?? {
      title: entry.title,
      body: entry.body,
      npcLine: entry.npcLine,
      foreshadow: after.foreshadows.at(-1) ?? ''
    }
  };
}
```

- [ ] **Step 5: 统一旧事件、突破和 director 三条回合路径**

在 `backend/src/app.js` 增加：

```js
function applyChapterResolution({ before, after, turn }) {
  const resolution = resolveChapterProgress({ before, after: normalizeGame(after), turn });
  return { ...resolution, game: normalizeGame(resolution.game) };
}
```

在 `resolveTurnRules()` 的突破、事件和旧 `advanceTurn()` 分支中，规则结算后都执行该 helper，并把 `chapterTransition`、`chapterMilestone` 传给 `finalizeTurn()`。在 `resolveDirectorTurn()` 形成 `nextGame` 后、写入 story memory 前执行同一个 helper。教程分支不推进章节。

- [ ] **Step 6: 写后端集成测试并运行**

测试旧事件流和 `/api/v1/turns/stream` 的 `continue` 流都返回：

```js
assert.equal(payload.data.game.chapter.id, 'foundation');
assert.equal(payload.data.turnResult.chapterTransition.toChapterId, 'foundation');
assert.equal(payload.data.game.storyProgress.chapterId, 'foundation');
```

运行：

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/chapter-progress.test.js tests/backend-chapter-integration.test.js tests/backend-api.test.js tests/backend-server-stream.test.js tests/time-pressure.test.js
```

Expected: 新增测试和原有后端回合、SSE、时间压力测试全部 PASS。

- [ ] **Step 7: 在 dev 提交 Task 3**

```bash
git add backend/src/domain/chapters/chapterProgression.js backend/src/domain/turnResult.js backend/src/app.js tests/chapter-progress.test.js tests/backend-chapter-integration.test.js
git commit -m "feat: advance chapters from authoritative turns"
```

### Task 4: 实现四类主动结局和寿元失败结局

**Files:**

- Create: `backend/src/domain/endings/endingCatalog.js`
- Create: `backend/src/domain/endings/endingResolver.js`
- Create: `tests/ending-resolver.test.js`
- Modify: `backend/src/domain/time/timePressure.js`
- Modify: `backend/src/app.js`
- Modify: `backend/src/domain/chapters/chapterProgression.js`

**Interfaces:**

- Consumes: `storyProgress.truthFlags`、`sectPath`、`contractStance`、`chapterId`、`flags` 和 `player`。
- Produces: `ENDING_CATALOG`、`resolveEnding()`、`applyEnding()`、统一的 `lifespan_exhausted` 结局对象。

- [ ] **Step 1: 写结局失败测试**

测试 fixture 使用以下确定性的终局基础状态；每个断言只覆盖一个契约立场或资格差异：

```js
import { createGame } from '../src/engine.js';
import { resolveEnding, applyEnding, createLifespanEnding } from '../backend/src/domain/endings/endingResolver.js';

const finaleGame = (overrides = {}) => {
  const baseGame = createGame(31);
  const base = {
    ...baseGame,
    onboarding: { completed: true },
    storyProgress: {
      chapterId: 'finale', chapterIndex: 6, status: 'active',
      completedObjectiveIds: ['finale_stance'],
      truthFlags: ['lifespan_mark', 'mist_archive', 'bronze_bell', 'heaven_gate_key'],
      sectPath: 'truth', contractStance: 'reject', finalChoiceMade: true, endingId: null
    },
    flags: { heaven_gate_key: true },
    player: { ...baseGame.player, realm: '金丹后期' }
  };
  return {
    ...base,
    ...overrides,
    storyProgress: { ...base.storyProgress, ...(overrides.storyProgress ?? {}) },
    flags: { ...base.flags, ...(overrides.flags ?? {}) },
    player: { ...base.player, ...(overrides.player ?? {}) }
  };
};

assert.equal(resolveEnding(finaleGame()).id, 'break_contract');
assert.equal(resolveEnding(finaleGame({ storyProgress: { contractStance: 'sacrifice', truthFlags: ['lifespan_mark', 'mist_archive', 'bronze_bell'] }, flags: { heaven_gate_key: false } })).id, 'sacrifice_to_break');
assert.equal(resolveEnding(finaleGame({ storyProgress: { contractStance: 'accept', truthFlags: [] }, flags: { heaven_gate_key: false } })).id, 'false_ascension');
assert.equal(resolveEnding(finaleGame({ storyProgress: { contractStance: 'guard', truthFlags: [] }, flags: { heaven_gate_key: false } })).id, 'mist_guardian');
assert.equal(resolveEnding(finaleGame({ storyProgress: { contractStance: null, truthFlags: [] }, flags: { heaven_gate_key: false } })).id, 'unfinished_truth');
assert.equal(resolveEnding(finaleGame({ storyProgress: { finalChoiceMade: false } })), null);

const ending = createLifespanEnding(finaleGame({ turn: 72 }));
assert.equal(ending.type, 'lifespan_exhausted');
assert.equal(ending.status, 'ended');

const candidate = resolveEnding(finaleGame());
const terminal = applyEnding(finaleGame(), candidate, 72);
assert.deepEqual(applyEnding(terminal, candidate, 72), terminal);
```

另测 `applyEnding()` 调用两次返回完全相同的 state。

- [ ] **Step 2: 运行失败测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/ending-resolver.test.js
```

Expected: FAIL with module-not-found for `endingResolver.js`。

- [ ] **Step 3: 写入结局目录和优先级**

`ENDING_CATALOG` 必须按以下优先级定义：

```js
export const ENDING_CATALOG = [
  { id: 'break_contract', priority: 40, title: '破契留世', requires: { minTruthFlags: 4, requiredFlags: ['heaven_gate_key'], contractStance: 'reject' } },
  { id: 'sacrifice_to_break', priority: 35, title: '以身拆契', requires: { minTruthFlags: 3, contractStance: 'sacrifice' } },
  { id: 'false_ascension', priority: 30, title: '伪飞升', requires: { contractStance: 'accept' } },
  { id: 'mist_guardian', priority: 20, title: '雾隐守门', requires: { contractStance: 'guard' } },
  { id: 'unfinished_truth', priority: 0, title: '真相未竟', requires: { fallback: true } }
];
```

- [ ] **Step 4: 实现 resolveEnding、applyEnding 和寿元结局**

`resolveEnding()` 只有在 `chapterId === 'finale'` 且 `storyProgress.finalChoiceMade === true` 时返回主动结局；按 priority 降序选择第一个满足条件的结局；最终选择尚未写入时返回 `null`，避免进入终局章节即自动结束；已完成最终选择但没有主动条件时返回 `unfinished_truth`。`applyEnding()` 写入 `ending.status = 'ended'`、`resolvedTurn`、`resolvedChapterId`、`summary`，并把 `storyProgress.status` 改为 `ended`。如果 state 已 ended，直接返回原对象。

最终选择入口沿用现有 effect resolver 写入事实 flag `final_choice_made`；`normalizeStoryProgress()` 将它归一化为 `finalChoiceMade`，本任务不新增另一套选择状态来源。

`createLifespanEnding(game)` 返回：

```js
{
  type: 'lifespan_exhausted',
  title: '命簿终章',
  status: 'ended',
  resolvedTurn: game.turn,
  resolvedChapterId: game.storyProgress?.chapterId ?? null,
  body: '命火在最后一夜熄灭，未解伏笔仍悬于天门之后。',
  unlocks: [],
  summary: {
    finalRealm: game.player?.realm ?? '',
    truthFlags: game.storyProgress?.truthFlags?.length ?? 0,
    unresolvedThreads: (game.storyMemory?.openThreads ?? []).filter((thread) => thread.status !== 'resolved').slice(-6).map((thread) => thread.title)
  }
}
```

- [ ] **Step 5: 接入终态和 GAME_ENDED**

在 `backend/src/app.js` 以统一 helper 串接章节推进和终局解析：

```js
function applyTerminalResolution({ before, after, turn }) {
  const chapterResolution = resolveChapterProgress({ before, after, turn });
  const candidate = resolveEnding(chapterResolution.game);
  const game = candidate ? applyEnding(chapterResolution.game, candidate, turn) : chapterResolution.game;
  return { ...chapterResolution, game: normalizeGame(game), ending: game.ending ?? null };
}
```

修改 `timePressure.js` 使用 `createLifespanEnding()`；修改 `rejectIfGameEnded()` 兼容已有无 status 的旧终章对象。寿元结局优先于主动结局。

- [ ] **Step 6: 运行结局和后端回归测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/ending-resolver.test.js tests/time-pressure.test.js tests/backend-chapter-integration.test.js tests/backend-api.test.js
```

Expected: 主动结局、寿元归零、结束后拒绝行动测试全部 PASS。

- [ ] **Step 7: 在 dev 提交 Task 4**

```bash
git add backend/src/domain/endings/endingCatalog.js backend/src/domain/endings/endingResolver.js backend/src/domain/time/timePressure.js backend/src/domain/chapters/chapterProgression.js backend/src/app.js tests/ending-resolver.test.js tests/backend-chapter-integration.test.js
git commit -m "feat: resolve deterministic cultivation endings"
```

### Task 5: 将章节摘要接入连续剧情导演

**Files:**

- Create: `tests/chapter-director-context.test.js`
- Modify: `backend/src/llm/prompts/storyDirectorPrompt.js`
- Modify: `tests/story-director-prompt.test.js`

**Interfaces:**

- Consumes: Task 2 的 `game.chapter` 公共快照。
- Produces: 带章节目标和终态边界的 director context；不改变 `normalizeDirectorOutput()` 的公开返回结构。

- [ ] **Step 1: 写章节上下文失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryDirectorMessages } from '../backend/src/llm/prompts/storyDirectorPrompt.js';

test('director receives chapter progress but cannot mutate chapter or ending', () => {
  const messages = buildStoryDirectorMessages({
    game: {
      turn: 20,
      chapter: {
        id: 'qi', index: 1, title: '炼气：命火有痕', progress: 50,
        objectives: [{ text: '将炼气修至圆满', completed: false, required: true }]
      },
      player: { realm: '炼气八层', lifespan: 80, maxLifespan: 120 },
      storyMemory: { recentTurns: [], openThreads: [] },
      npcs: []
    },
    input: { type: 'continue' }
  });
  const serialized = JSON.stringify(messages);
  assert.match(serialized, /炼气：命火有痕/);
  assert.match(serialized, /将炼气修至圆满/);
  assert.match(serialized, /章节/);
  assert.match(serialized, /结局/);
});
```

- [ ] **Step 2: 运行失败测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/chapter-director-context.test.js tests/story-director-prompt.test.js
```

Expected: 新增测试 FAIL，原有 prompt 测试继续 PASS。

- [ ] **Step 3: 在 prompt context 中加入公开章节摘要**

在 `storyDirectorPrompt.js` 添加：

```js
function pickChapter(game) {
  const chapter = game.chapter;
  if (!chapter) return null;
  return {
    title: text(chapter.title),
    progress: Number.isFinite(chapter.progress) ? chapter.progress : 0,
    objectives: (chapter.objectives ?? []).map((objective) => ({
      text: text(objective.text),
      completed: objective.completed === true,
      required: objective.required === true
    }))
  };
}
```

在 `pickContext(game)` 中加入 `chapter: pickChapter(game)`；不得把 `completedObjectiveIds`、truth flag 原名、`endingId` 放进 prompt。

- [ ] **Step 4: 增加模型边界文案**

在 system prompt 和 `hardConstraints` 中加入：

```text
章节由后端规则层决定。你只能描写当前章节和后端已经提供的章节转场。
不得创建章节、完成章节目标、修改真相旗标、修改契约立场或宣布结局 id。
如果当前状态已经结束，不得生成新的行动或继续推进剧情。
```

- [ ] **Step 5: 运行导演边界测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/chapter-director-context.test.js tests/story-director-prompt.test.js tests/director-effect-hints.test.js tests/backend-server-stream.test.js
```

Expected: 新增章节上下文测试、既有 prompt、effect hint 和 SSE 测试全部 PASS。

- [ ] **Step 6: 在 dev 提交 Task 5**

```bash
git add backend/src/llm/prompts/storyDirectorPrompt.js tests/chapter-director-context.test.js tests/story-director-prompt.test.js
git commit -m "feat: constrain story director with chapter context"
```

### Task 6: 接入前端章节进度、转场提示和结局展示

**Files:**

- Create: `frontend/src/ui/chapterProgress.js`
- Create: `tests/frontend-chapter-state.test.js`
- Modify: `frontend/src/app.js`
- Modify: `frontend/src/styles.css`
- Modify: `tests/frontend-api.test.js`
- Modify: `tests/frontend-views.test.js`

**Interfaces:**

- Consumes: `game.chapter`、`turnResult.chapterTransition`、`game.ending`。
- Produces: `renderChapterProgress(chapter)`、`formatChapterTransition(transition)` 和洞府章节展示。

- [ ] **Step 1: 写 UI helper 失败测试**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatChapterTransition, renderChapterProgress } from '../frontend/src/ui/chapterProgress.js';

test('chapter progress renders title, percentage and readable objectives', () => {
  const html = renderChapterProgress({
    id: 'qi', index: 1, title: '炼气：命火有痕', progress: 50,
    objectives: [
      { text: '将炼气修至圆满', completed: false, required: true },
      { text: '查明寿元异常的第一道痕迹', completed: true, required: true }
    ]
  });
  assert.match(html, /炼气：命火有痕/);
  assert.match(html, /50%/);
  assert.match(html, /将炼气修至圆满/);
  assert.doesNotMatch(html, /qi|lifespan_mark/);
});

test('chapter transition uses titles and hides internal ids', () => {
  const text = formatChapterTransition({ fromTitle: '炼气：命火有痕', toTitle: '筑基：道基与宗门' });
  assert.equal(text, '你已完成炼气：命火有痕，新的篇章已经展开：筑基：道基与宗门。');
  assert.doesNotMatch(text, /qi|foundation/);
});
```

- [ ] **Step 2: 运行失败测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-chapter-state.test.js
```

Expected: FAIL with module-not-found for `frontend/src/ui/chapterProgress.js`。

- [ ] **Step 3: 实现安全展示 helper**

`renderChapterProgress()` 输出标题、百分比、目标文本和完成标记并进行 HTML escaping；`formatChapterTransition()` 只使用标题，不读取或显示 id。

```js
export function renderChapterProgress(chapter) {
  if (!chapter) return '';
  const progress = Math.max(0, Math.min(100, Number(chapter.progress) || 0));
  const objectives = (chapter.objectives ?? []).map((objective) => `
    <li class="chapter-objective ${objective.completed ? 'is-complete' : ''}">
      <span aria-hidden="true">${objective.completed ? '✓' : '○'}</span>
      <span>${escapeHtml(objective.text)}</span>
    </li>
  `).join('');
  return `<section class="paper-card chapter-progress-panel"><div class="section-title"><h3>${escapeHtml(chapter.title)}</h3><span>主线进度 ${progress}%</span></div><div class="chapter-progress-bar"><i style="width:${progress}%"></i></div><ul class="chapter-objective-list">${objectives}</ul></section>`;
}

export function formatChapterTransition(transition) {
  if (!transition) return '';
  return `你已完成${transition.fromTitle ?? '上一章'}，新的篇章已经展开：${transition.toTitle ?? '新的篇章'}。`;
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
```

- [ ] **Step 4: 接入洞府首页和回合转场**

在 `frontend/src/app.js` 引入两个 helper，增加 `let chapterTransitionNotice = '';`。在 `renderHomeView()` 中让 `renderChapterProgress(game.chapter)` 位于历史和行动区之前；如果 `chapterTransitionNotice` 非空，使用现有 `renderPanel()` 显示 `篇章转折`。在 `submitStoryStep()` 和 `submitDailyAction()` 成功收到 `turnResult` 后设置：

```js
chapterTransitionNotice = formatChapterTransition(turnResult?.chapterTransition);
```

重开、切换模式和创建新角色时清空该变量。保留 `renderEndingPanel()` 的传记和重开按钮，并加入最终境界、章节数和真相数量的可读摘要，不显示 `ending.type`。

- [ ] **Step 5: 增加样式并保持页签边界**

在 `frontend/src/styles.css` 增加章节面板、进度条、目标列表和转场提示样式；保持当前布局变量、四个可见页签和“只有洞府拥有行动控件”的约束。

- [ ] **Step 6: 更新并运行前端测试**

在 `tests/frontend-api.test.js` 断言 `result.game.chapter` 和 `result.turnResult.chapterTransition`；在 `tests/frontend-views.test.js` 断言源码使用 `renderChapterProgress(game.chapter)` 且不输出 `ending.type`。

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/frontend-chapter-state.test.js tests/frontend-api.test.js tests/frontend-views.test.js tests/frontend-event-state.test.js tests/frontend-backend-integration.test.js
```

Expected: 新增章节 UI、API 字段、流式剧情、四页签和结局按钮测试全部 PASS。

- [ ] **Step 7: 在 dev 提交 Task 6**

```bash
git add frontend/src/ui/chapterProgress.js frontend/src/app.js frontend/src/styles.css tests/frontend-chapter-state.test.js tests/frontend-api.test.js tests/frontend-views.test.js
git commit -m "feat: show chapter progress and endings"
```

### Task 7: 全量回归和 dev 分支交付检查

**Files:**

- Modify only if a regression assertion is missing: `tests/backend-api.test.js`、`tests/backend-server-stream.test.js`、`tests/time-pressure.test.js`、`tests/progression.test.js`、`tests/frontend-api.test.js`、`tests/frontend-views.test.js`。

- [ ] **Step 1: 检查工作区和分支**

```bash
git status --short --branch
```

Expected: 当前分支为 `dev`；`.idea/` 可以继续显示为未跟踪；不得出现本任务之外的新修改。

- [ ] **Step 2: 运行全量测试**

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```

Expected: 测试总数大于或等于现有 `217`，`fail 0`、`cancelled 0`。

- [ ] **Step 3: 审计前端 raw 字段泄漏**

```bash
rg -n "chapterId|completedObjectiveIds|truthFlags|endingId|effectHints|choiceId|eventId" frontend/src tests/frontend-*.test.js
```

Expected: 命中只能出现在 API 适配、状态判断或测试断言中；不得出现在玩家可见 HTML 文本中。

- [ ] **Step 4: 检查差异**

```bash
git diff --check
git diff --stat
```

Expected: 无空白错误，差异只涉及章节、终局、导演上下文、前端展示和对应测试。

- [ ] **Step 5: 保存最后的 dev 提交但不推送**

如果 Task 1—6 已分别提交，只检查没有遗漏；如果仍有本任务文件未提交，执行：

```bash
git add backend frontend src tests
git commit -m "feat: complete chapterized mainline and endings"
```

不得执行 `git push`；远程推送等待用户明确要求。

## Plan Self-Review

- 七章由 Task 1 定义，Task 2 初始化，Task 3 推进，Task 6 展示。
- 声明式目标覆盖 flag、realm、NPC、truth、宗门路径和契约立场。
- 幂等、旧状态迁移和教程隔离由 Task 2、Task 3 覆盖。
- 四类主动结局、普通失败结局和寿元失败结局由 Task 4 覆盖。
- LLM 越权边界由 Task 5 覆盖。
- 前端公开状态和 raw 字段审计由 Task 6、Task 7 覆盖。
- `GAME_ENDED`、SSE、旧行动流和现有测试由 Task 3、Task 4、Task 7 覆盖。
- 统一函数名和字段名与设计稿一致；每个实现步骤都有明确文件、接口、测试和提交命令。
