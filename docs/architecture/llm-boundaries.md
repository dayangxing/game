# LLM 边界与接口规划

## 核心原则

LLM 负责“表达、生成、润色”，规则系统负责“判定、结算、存档”。任何会影响公平性、数值、库存、境界、支付、安全和审计的内容，都不能由 LLM 直接决定。

## 不使用 LLM 的部分

- 角色数值：境界、灵气、心境、破境进度、寿元、灵石。
- 规则结算：行动是否成功、奖励多少、消耗多少、NPC 好感变化、世界事件落库。
- 随机种子：每日事件抽取、奇遇概率、战斗/炼丹成败。
- 存档读写：用户存档、导出文本、回合日志。
- 安全合规：输入/输出审核、敏感词、风控拦截、操作审计。
- 账号、支付、权限：登录、充值、未成年人保护、交易校验。

## 使用 LLM 的部分

- 每日行动生成：根据角色、界面、近期事件生成 3-6 个可选行动。
- 剧情润色：把规则结算后的结果写成修仙叙事。
- NPC 语气：根据 NPC 人设、好感、记忆生成对话。
- 事件描写：为秘境、宗门、坊市、战斗等事件生成文本。
- 记忆摘要：把多轮互动压缩成可检索的记忆摘要。
- 伏笔建议：提出长期因果线，但不能直接落数值结果。

## 前端预留接口

当前前端通过 `frontend/src/api/gameApi.js` 访问游戏能力。未来接后端时，替换这个文件里的 mock 调用即可。

### getDailyActions(game, view)

用途：获取每日行动选项。当前由本地 view 配置 + mock 建议生成，后续可由后端调用 LLM。

返回 action：

```js
{
  id: string,
  title: string,
  icon: string,
  command: string,
  meta: string,
  source: 'view' | 'suggestion' | 'llm',
  storyHook: string,
  llmRequest: DailyActionGenerationRequest
}
```

### submitDailyAction(game, action)

用途：提交玩家选择。后端必须先做规则结算，再决定是否调用 LLM 润色剧情。

### exportStory(game)

用途：导出玩家传记。首版可本地生成，后续可由后端合成章节文本。

## LLM 请求契约

契约代码位于 `frontend/src/ai/llmContracts.js`。

### DailyActionOptions

任务名：`daily_action_generation`

输入：角色状态、当前界面、近期日志、NPC 记忆、世界事件、长期伏笔。

约束：

- 只生成行动选项，不直接修改数值。
- 每个行动必须转化为 `command`，交给规则引擎结算。
- 行动必须符合当前境界和修仙世界观。
- 输出必须符合结构化 JSON。

### TurnNarration

任务名：`narrative_polish`

输入：行动前状态、行动后状态、玩家选择的 action、规则已生成的回合 entry。

约束：

- 不得改写规则结算结果。
- 不得新增 after 状态中不存在的奖励、境界、道具或关系变化。
- 只润色环境描写、NPC 语气、心理刻画和伏笔表达。

## 后端建议接口

```http
POST /api/v1/daily-actions
POST /api/v1/turns
POST /api/v1/narration
GET  /api/v1/saves/:id
PUT  /api/v1/saves/:id
```

推荐流程：

1. 前端请求 `/daily-actions`。
2. 后端组装 `DailyActionGenerationRequest`，可调用 LLM 生成行动。
3. 玩家选择 action，前端提交 `/turns`。
4. 后端规则引擎结算 after state。
5. 后端可调用 `/narration` 或内部 LLM 服务润色剧情。
6. 后端返回完整新 game state。
