# LLM 长期摘要设计规范

**状态：已确认设计**  
**确认日期：2026-07-22**

## 目标

将当前“长期摘要 + 被淘汰回合片段 + 字符截断”的机械拼接，升级为由 LLM 重新整理的结构化长期摘要，同时保证：

1. 摘要生成不阻塞行动结算、流式剧情和前端响应。
2. 旧摘要任务不能覆盖更新后的游戏状态。
3. 下一次剧情生成不能只读取过期摘要；即使摘要任务未完成，也必须收到尚未摘要的最新剧情增量。
4. 摘要模型失败时游戏仍可继续，旧摘要和原始日志都保留。
5. 普通摘要使用快速模型，控制延迟和成本。

## 非目标

- 不让摘要模型修改角色数值、背包、章节、伏笔状态或 NPC 好感。
- 不用摘要替代 `game.log` 原始历史。
- 不引入向量数据库、Embedding 或 RAG。
- 不让前端直接调用摘要模型。
- 不在本次设计中重构完整的伏笔解决/归档系统。

## 当前基线

当前 `storyMemory` 由 `src/storyMemory.js` 和前端镜像实现维护，主要包含：

- `longSummary`：初始 360 字符、后续最多 420 字符的机械摘要。
- `recentTurns`：最近 8 回合。
- `openThreads`：合并后最多 8 个未解伏笔，每个伏笔最多 4 条线索。
- `resolvedThreads`：已解决伏笔的保留字段。
- `characterNotes`：由 NPC 当前状态重建的角色记忆投影。

完整 `game.log` 仍是原始历史，不因 `recentTurns` 淘汰而删除。

## 设计决策

### 1. 采用异步批处理和最新版本获胜

摘要任务在后端创建，不进入行动接口的等待链路。每个游戏最多允许一个运行中的摘要任务和一个待处理的最新版本。

普通情况下每累计 4 个未摘要回合触发一次；出现重大伏笔、章节转场、关键人物关系变化、关键资源变化或结局相关事件时提前触发。

如果任务运行期间游戏继续推进，只保留最新待处理版本。旧任务返回后必须经过版本比较，过期结果直接丢弃并基于最新状态重新调度。

### 2. 使用快速模型生成摘要

摘要模型使用项目的 `fastModel`，默认值为 `qwen3.6-flash`，不使用 `chatModel` 的 `qwen3.7-plus` 或 `premiumModel` 的 `qwen3.7-max`。

摘要是事实压缩任务，不承担创作剧情、规则推理或数值计算，因此快速模型更符合延迟和成本目标。摘要调用使用非流式 JSON 请求，低温度设置，复用现有 LLM 客户端的重试策略。摘要任务有独立的后台截止时间；超过截止时间的返回值视为失败，晚到结果即使返回也不能写入状态。

### 3. 事实仍由规则状态负责

摘要模型输入必须同时包含：

- 当前 `game.character` 的身世、灵根、命格天赋。
- 当前 `game.player` 的真实状态。
- 当前章节和关键规则结果。
- 旧长期摘要。
- 摘要覆盖点之后的原始回合增量。
- 当前有效伏笔和重要 NPC 记忆。

模型只能重组输入事实，不能新增或改写事实。摘要输出只负责替换 `longSummary`，不能直接修改 `openThreads`、`game.player` 或其他规则字段。

## 数据契约

`storyMemory` 增加两个持久化字段：

```js
{
  longSummary: '……',
  summaryThroughTurn: 12,
  summaryRevision: 4,
  recentTurns: [],
  openThreads: [],
  resolvedThreads: [],
  characterNotes: [],
  lastUpdatedTurn: 12
}
```

- `summaryThroughTurn`：`longSummary` 已经覆盖的最大回合号。
- `summaryRevision`：每次摘要成功提交后递增，用于防止同版本任务互相覆盖。

任务上下文还要保存非持久化元数据：

```js
{
  gameId,
  sourceGameVersion,
  sourceSummaryRevision,
  sourceSummaryThroughTurn
}
```

旧存档没有摘要元数据时，迁移逻辑采取保守策略：将现有最近回合的最早回合之前视为已覆盖点，并把现有最近回合作为未摘要增量提供给下一次模型。这样会产生少量重复，但不会丢失旧剧情。

## 摘要生成流程

```text
规则引擎完成行动
        ↓
生成并返回本回合剧情
        ↓
更新后端权威 game
        ↓
判断是否满足摘要触发条件
        ↓
创建当前版本快照
        ↓
后台调用 qwen3.6-flash
        ↓
校验 JSON、覆盖回合和版本
        ↓
提交新 longSummary 或丢弃过期结果
```

摘要模型输出：

```json
{
  "summary": "新的长期剧情摘要",
  "coveredThroughTurn": 12
}
```

后端必须验证：

1. `summary` 是非空字符串。
2. `summary` 不超过设定长度上限。
3. `coveredThroughTurn` 是整数。
4. `coveredThroughTurn` 不得超过任务快照的游戏回合。
5. 当前游戏版本仍等于任务的 `sourceGameVersion`。
6. 当前摘要版本仍等于任务的 `sourceSummaryRevision`。

只有全部通过后，才允许执行：

```text
storyMemory.longSummary = result.summary
storyMemory.summaryThroughTurn = result.coveredThroughTurn
storyMemory.summaryRevision += 1
```

## 上下文新鲜度保证

摘要未完成时，剧情上下文不能只发送 `longSummary`。上下文构造器必须根据：

```text
当前回合 - summaryThroughTurn
```

找到尚未被摘要覆盖的日志，并以 `unsummarizedTurns` 形式附加给叙事模型和连续剧情导演。

例如：

```text
longSummary 已覆盖第 8 回合
当前游戏为第 12 回合

模型收到：
  - longSummary（覆盖到第 8 回合）
  - 第 9～12 回合未摘要增量
  - 当前角色事实
  - 当前 player 状态
```

这样保证的是“模型收到的整体上下文是最新的”，而不是要求 `longSummary` 字符串在后台任务完成前立即变化。

未摘要增量需要有输入预算：优先保留最新回合、重大事件、当前伏笔相关回合和规则变化；原始完整内容仍保留在 `game.log`，供后续摘要任务重新读取。

## 过期任务处理

任务 J12 基于第 12 回合启动，期间游戏推进到第 13 回合：

```text
J12 返回
    ↓
发现 sourceGameVersion = 12
当前 game.version = 13
    ↓
丢弃 J12
    ↓
记录最新待处理版本 13
    ↓
调度 J13
```

不允许使用“返回得更晚但结果更完整”作为覆盖依据。版本是唯一提交依据。

如果摘要提交成功后桌面端开启了 `persistGame`，必须把更新后的完整游戏状态写回存档；Web 开发模式则更新后端内存状态，前端在下一次状态请求或行动响应中得到新摘要。

## 失败和降级

摘要模型失败、JSON 无效、超时或版本过期，都不能回滚游戏状态。

失败时：

1. 保留旧 `longSummary`。
2. 保留 `recentTurns` 和完整 `game.log`。
3. 不推进 `summaryThroughTurn`。
4. 下一次剧情继续携带未摘要增量。
5. 只保留最新待处理摘要任务，避免请求堆积。

本地 Mock 模式不调用 LLM，继续使用确定性的本地摘要逻辑；API 和 Electron 后端模式使用异步 LLM 摘要。

## 组件边界

### 纯记忆层

`src/storyMemory.js` 和 `frontend/src/lib/storyMemory.js` 继续负责：

- 数据归一化。
- 最近回合和伏笔的结构化管理。
- 旧摘要迁移。
- 机械回退摘要。

它们不直接发起网络请求。

### 摘要服务层

新增独立的后端摘要服务，负责：

- 触发条件判断。
- 快照创建。
- 单任务合并。
- 调用 `fastModel`。
- JSON 校验。
- 版本比较。
- 提交和持久化。

### LLM 提示层

新增长期摘要提示构造器，负责明确：

- 输入事实边界。
- 压缩目标。
- 禁止新增事实。
- 输出 JSON schema。
- `coveredThroughTurn` 的含义。

### 现有剧情提示层

普通叙事和连续剧情提示增加未摘要增量，但继续保留当前角色事实、规则状态和伏笔边界。

## 测试验收标准

必须增加以下测试：

1. 摘要提示使用 `fastModel`，而不是默认聊天模型。
2. 摘要输出可以被解析并校验 `summary` 和 `coveredThroughTurn`。
3. 摘要任务后台运行时，行动响应不等待摘要完成。
4. 旧任务返回后不能覆盖更高版本的游戏状态。
5. 多个连续回合只保留一个运行任务和一个最新待处理版本。
6. 摘要未完成时，下一次剧情提示包含 `summaryThroughTurn` 之后的增量。
7. 摘要失败时旧摘要保持不变。
8. 超时或晚到结果不能写入游戏状态。
9. 成功摘要会更新 `summaryThroughTurn` 和 `summaryRevision`。
10. Electron 持久化模式会保存摘要更新，Mock 模式不发起网络摘要请求。
11. 旧存档缺失摘要元数据时可以安全迁移，且不会丢失最近回合。

## 验收结果定义

功能完成必须满足：

```text
行动首屏响应时间不包含摘要模型耗时
下一次剧情模型拿到当前回合及所有关键未摘要增量
任何旧版本摘要都不能覆盖新版本状态
摘要模型失败不会阻塞或回滚行动
长期摘要不再依赖固定字符串拼接作为主要更新方式
```
