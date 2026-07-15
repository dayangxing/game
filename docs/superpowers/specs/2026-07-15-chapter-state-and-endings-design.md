# 主线章节状态机与终局分支设计

## 目标

把《问道浮生》当前的连续回合剧情升级为可持续推进的章节化主线：玩家能够明确知道自己处于哪一章、正在完成什么目标、哪些伏笔已经揭开，以及本局最终走向哪一种结局。

本设计只覆盖以下范围：

- 序章、炼气、筑基、金丹、雾隐秘境、飞升骗局、终局分支七个章节。
- 章节状态、章节目标、章节切换和章节历史。
- 四类终局分支及确定性结局判定。
- 后端回合结算、连续剧情导演和前端公开状态所需的接口变化。
- 旧状态的安全归一化和迁移。

本设计不覆盖事件库批量扩容、数值平衡模拟、存档槽和全局成就；这三项在章节状态字段稳定后分别设计和实现。

## 当前上下文

当前后端已经具备：

- [backend/src/app.js](/Users/ruilifeng/Documents/game/backend/src/app.js) 中的权威 game state、回合校验、事件结算、突破结算和连续剧情流。
- [backend/src/domain/events/eventCatalog.js](/Users/ruilifeng/Documents/game/backend/src/domain/events/eventCatalog.js) 中的青云宗、寿元、雾隐秘境和飞升骗局核心事件。
- [backend/src/domain/events/triggerMatcher.js](/Users/ruilifeng/Documents/game/backend/src/domain/events/triggerMatcher.js) 中的事件触发条件。
- [backend/src/domain/time/timePressure.js](/Users/ruilifeng/Documents/game/backend/src/domain/time/timePressure.js) 中的寿元归零终章状态。
- [backend/src/agents/storyDirector.js](/Users/ruilifeng/Documents/game/backend/src/agents/storyDirector.js) 中的连续剧情和选择生成，但模型只能提供叙事和模糊影响方向。

当前状态中的 `flags`、`karma.futureEventFlags`、`foreshadows` 和 `storyMemory` 已能记录局部线索，但没有一个明确的章节进度源，也没有确定性的终局解析器。因此本设计将章节推进放在规则结算之后、叙事生成之前。

## 设计原则

1. **章节由规则层推进，模型只负责表达。** LLM 不得创建章节、宣布结局或绕过章节目标。
2. **主线与支线分离。** 支线可以错过，主线不能因为一次普通选择而永久卡死。
3. **章节切换可重复执行。** 重试叙事、重复加载状态或重复调用归一化不能重复发放章节奖励或重复写入章节历史。
4. **结局一旦落定不可回写。** 结局状态是当前 run 的终态，只允许查看传记、查看总结或重开。
5. **继续保护现有前端边界。** 章节公开信息可显示，内部 objective id、truth flag 和 ending id 不直接展示给玩家。
6. **不把章节判断塞进事件文案。** 章节目标使用声明式条件，事件只负责提供事实和效果。

## 方案选择

### 方案 A：章节状态机加声明式目标（推荐）

章节目录定义章节、目标和过渡条件；规则层每回合根据前后状态计算完成目标和章节切换。事件通过已有 `flags`、关系、境界和资源写入事实，章节系统读取事实。

优点：规则可测试、叙事模型不会越权、事件库后续可以按章节复用；缺点是需要新增状态归一化和目标条件求值器。

### 方案 B：由 LLM 维护章节摘要

每次让模型返回当前章节和主线进度，再由后端做有限校验。

不采用。模型可能跳章、重复结局或在失败状态后继续写剧情，无法满足数值和存档一致性要求。

### 方案 C：每章独立脚本

每章拥有一份硬编码流程，完成一章后切换到下一份脚本。

不采用。主线分支、NPC 支线和事件条件会迅速造成脚本分叉，后续扩容成本高，也不适合当前事件目录模式。

## 状态模型

在现有 game state 中增加以下字段：

```js
storyProgress: {
  chapterId: 'prologue',
  chapterIndex: 0,
  status: 'active',
  completedObjectiveIds: [],
  truthFlags: [],
  sectPath: null,
  contractStance: null,
  endingId: null
},
chapterHistory: [],
ending: null
```

`flags` 继续保存具体事实，例如 `bronze_bell`、`mist_archive` 和 `heaven_gate_key`；`storyProgress.truthFlags` 是由章节系统确认过的主线真相集合，不替代具体事实旗标。

章节公开快照的状态合法值：

- `locked`：尚未到达。
- `active`：当前章节。
- `completed`：已完成并进入历史。
- `ended`：终局已经落定。

持久化的 `storyProgress.status` 只使用 `active` 和 `ended`；`locked`、`completed` 由当前章节目录和 `chapterHistory` 推导，避免在多个字段中重复保存同一状态。

章节历史使用以下结构：

```js
{
  chapterId: 'qi',
  index: 1,
  startedTurn: 6,
  completedTurn: 19,
  startedElapsedMonths: 8,
  completedElapsedMonths: 42,
  completedObjectiveIds: ['qi_reach_ninth_layer', 'qi_reveal_lifespan_mark']
}
```

## 章节目录

章节目录放在 `backend/src/domain/chapters/chapterCatalog.js`。章节条件使用声明式 predicate，不在 JSON 中保存函数。

```js
{
  id: 'qi',
  index: 1,
  title: '炼气：命火有痕',
  entry: {
    requiresChapter: 'prologue'
  },
  objectives: [
    {
      id: 'qi_reach_ninth_layer',
      type: 'realmAtLeast',
      realm: '炼气九层',
      required: true,
      publicText: '将炼气修至圆满'
    },
    {
      id: 'qi_reveal_lifespan_mark',
      type: 'anyFlag',
      flags: ['lifespan_mark', 'ascension_contract'],
      required: true,
      publicText: '查明寿元异常的第一道痕迹'
    }
  ],
  exit: {
    type: 'allRequiredObjectives'
  },
  reward: {
    type: 'chapterMilestone',
    id: 'qi_complete'
  }
}
```

七章的主线目标如下：

| 章节 | 必要目标 | 进入下一章的条件 |
|---|---|---|
| `prologue` 序章 | 完成命簿登记、认识关键 NPC、触发寿元或雾隐伏笔 | 序章目标全部完成 |
| `qi` 炼气 | 达到炼气九层、揭开寿元异常第一层 | 必要目标全部完成 |
| `foundation` 筑基 | 成功筑基、确定宗门立场、完成一条 NPC 线 | 必要目标全部完成 |
| `golden_core` 金丹 | 成功结丹、获得雾隐进入资格、触发宗门冲突 | 必要目标全部完成 |
| `mist` 雾隐秘境 | 获得青铜铃、残档和至少一个秘钥线索 | 至少三个真相目标完成 |
| `ascension_scam` 飞升骗局 | 核对飞升名录、确认天门契、选择契约态度 | 飞升骗局前置全部完成 |
| `finale` 终局分支 | 完成最终抉择 | 结局解析器返回合法结局 |

筑基和金丹必须以真实突破成功作为目标，不能只靠 `player.realm` 被外部修改。对于错过的普通支线，章节系统使用 fail-forward：只要玩家仍能通过另一条合法路径获得必要事实，就不阻塞主线。

## 章节推进流程

每个正式回合按以下顺序处理：

```text
校验回合和行动
  ↓
执行现有规则结算
  ↓
更新时间、寿元、境界、NPC、flags
  ↓
resolveChapterProgress(before, after)
  ↓
必要时解析终局
  ↓
保存规则快照
  ↓
把章节变化传给 story director
  ↓
生成并保存叙事
```

新增模块接口：

```js
getChapterDefinition(chapterId)
getChapterSnapshot(game)
evaluateObjective(objective, game)
resolveChapterProgress({ before, after, turn })
resolveEnding(game)
```

`resolveChapterProgress` 返回：

```js
{
  game,
  completedObjectiveIds,
  transition: null | {
    fromChapterId,
    toChapterId,
    completedObjectiveIds
  },
  milestone: null
}
```

章节切换必须是幂等的：如果目标已进入 `completedObjectiveIds`，再次计算只能返回相同状态，不能重复添加奖励、历史或日志。

## 终局判定

终局解析只在 `storyProgress.chapterId === 'finale'` 时执行，或者在寿元归零时执行强制失败结局。四类主结局使用后端确定性条件：

```js
const ENDINGS = [
  {
    id: 'break_contract',
    priority: 40,
    requires: {
      minTruthFlags: 4,
      requiredFlags: ['heaven_gate_key'],
      contractStance: 'reject'
    }
  },
  {
    id: 'sacrifice_to_break',
    priority: 35,
    requires: {
      minTruthFlags: 3,
      contractStance: 'sacrifice'
    }
  },
  {
    id: 'false_ascension',
    priority: 30,
    requires: {
      contractStance: 'accept'
    }
  },
  {
    id: 'mist_guardian',
    priority: 20,
    requires: {
      contractStance: 'guard'
    }
  }
]
```

如果契约立场为 `guard`，则进入 `mist_guardian`；如果没有满足任何主动结局条件，则进入 `unfinished_truth` 普通失败结局。寿元归零使用独立的 `lifespan_exhausted`，不伪装成玩家主动选择的结局。

结局对象：

```js
ending: {
  type: 'break_contract',
  title: '破契留世',
  status: 'ended',
  resolvedTurn: 72,
  resolvedChapterId: 'finale',
  body: '',
  unlocks: [],
  summary: {
    finalRealm: '金丹后期',
    truthFlags: 4,
    unresolvedThreads: []
  }
}
```

一旦 `ending.status === 'ended'`，`daily-actions`、`turns` 和 `turns/stream` 都返回现有风格的 `GAME_ENDED` 错误；传记导出和状态读取仍然可用。

## 连续剧情导演接口

后端传给 director 的上下文增加公开章节摘要：

```js
chapter: {
  id: 'mist',
  title: '雾隐秘境：铜铃残档',
  progress: 66,
  objectiveTexts: ['已找到青铜铃', '尚未解读完整残档'],
  pressure: 'high'
}
```

模型可以：

- 描述章节转场。
- 描写目标完成后的反馈。
- 生成终局选择的玩家可见文本。

模型不可以：

- 返回新的章节 id。
- 直接完成 objective。
- 直接设置 truth flag、契约立场或 ending id。
- 在 `GAME_ENDED` 后生成新的行动。

章节转场由后端写入 `turnResult`：

```js
turnResult.chapterTransition = {
  from: 'qi',
  to: 'foundation',
  title: '筑基：道基与宗门'
}
```

现有客户端如果不读取该字段仍能正常显示回合；新增前端只消费公开的 `chapter` 和 `chapterTransition`。

## 旧状态归一化

在 [backend/src/app.js](/Users/ruilifeng/Documents/game/backend/src/app.js) 的 `normalizeGame` 中增加安全迁移：

1. 已有 `ending` 的状态归一化为 `storyProgress.status = 'ended'`。
2. 没有 `storyProgress` 的正式角色从 `prologue` 开始。
3. 已有 `flags`、`karma.futureEventFlags`、境界和日志保持不变。
4. 如果旧状态已经有 `bronze_bell`、`mist_archive` 等事实，迁移器只补齐可推导的 `truthFlags`，不重复发放奖励。
5. 教程状态不进入正式章节，`onboarding.completed === false` 时不推进章节。
6. 非法章节 id 回退到 `prologue`，同时写入 audit log；不静默生成结局。

## 错误与边界处理

- 章节目标条件缺少字段时按未完成处理，不把未知字段当作已完成。
- 除 `finale` 外，章节定义缺少下一章时视为配置错误，测试阶段直接失败，运行时返回安全错误。
- 同一回合不能跨越两个普通章节；如果一个突破同时满足多个章节目标，只允许按目录顺序推进一次。
- 寿元归零和主动结局同时满足时，优先写入寿元归零结局，保留本回合完成的章节目标。
- LLM 失败不影响章节切换和结局落库；重试叙事只能补正文，不能重新结算规则。
- 已结束状态不能被 `reset` 之外的接口改变。

## 测试设计

新增测试文件：

- `tests/chapter-state.test.js`
- `tests/ending-resolver.test.js`
- `tests/chapter-migration.test.js`
- `tests/backend-chapter-integration.test.js`

必须覆盖：

1. 章节目录包含七章且 index 连续。
2. 序章完成后进入炼气，未完成必要目标不能跳章。
3. 章节目标可重复求值且不会重复发放里程碑。
4. 错过普通支线时，替代事实可以让主线继续。
5. 筑基和金丹只能由真实突破结果推进。
6. 四种主动结局按优先级和条件稳定解析。
7. 寿元归零进入 `lifespan_exhausted`，不会误判成主动结局。
8. 结局后所有推进接口返回 `GAME_ENDED`。
9. 旧状态归一化后不会重复奖励或丢失既有 flags。
10. 连续剧情收到章节摘要，但模型不能改变章节或结局。
11. 现有 217 个测试继续通过。

## 验收标准

本子项目完成后，可以用固定 seed 从正式建角开始，依次走过七个章节，并在最后稳定得到四种主动结局或寿元失败结局。每次回合都能从后端状态读取当前章节和目标；重试叙事不会重复推进；刷新和重新加载不会丢失章节状态；前端不需要暴露内部 id 即可展示章节标题、进度和结局摘要。
