# 前后端解耦顶层设计与需求

## 目标

把当前原型拆成清晰的前端应用和后端服务。前端只负责展示、交互、状态请求和用户体验；后端负责游戏规则、存档、LLM 调用、安全审核和长期数据。双方通过稳定 API 合同通信，前端不能直接依赖后端内部规则实现。

## 总体架构

```text
frontend/
  浏览器 UI
  API client
  页面状态
  水墨风格交互
        |
        | HTTPS JSON API
        v
backend/
  认证与用户
  游戏规则引擎
  每日行动生成
  回合结算
  LLM 编排
  存档与日志
  安全审核
        |
        v
database / cache / vector memory / LLM provider
```

## 前端职责

前端必须做：

- 展示桌面网页端 UI：洞府、修炼、功法、秘境、行囊五个顶层界面。
- 展示角色状态：境界、灵气、心境、破境进度、灵石、寿元、宗门关系、NPC 好感。
- 展示每日行动选项：只渲染后端返回的 action，不自行生成最终选项。
- 提交玩家选择：点击 action 后调用后端回合接口。
- 展示回合结果：剧情、NPC 台词、世界事件、长期伏笔、状态变化。
- 管理轻量 UI 状态：当前页签、加载态、错误提示、乐观禁用按钮。
- 提供前端 API client：集中在 `frontend/src/api/`，页面层禁止直接访问后端 URL。
- 保留桌面网页端布局接口：当前只启用 `desktop`，以后再接 `tablet/mobile`。

前端不能做：

- 不能结算境界、资源、战斗、炼丹、奖励、消耗。
- 不能直接调用 LLM provider。
- 不能保存权威存档。
- 不能决定 NPC 好感或世界事件是否真实发生。
- 不能绕过后端内容安全和规则校验。

## 后端职责

后端必须做：

- 提供 REST JSON API。
- 管理用户、会话、存档和当前 game state。
- 生成或读取每日行动选项。
- 执行规则结算：行动合法性、资源消耗、奖励、境界进度、NPC 好感、世界事件。
- 编排 LLM：每日行动生成、剧情润色、NPC 语气、记忆摘要、伏笔建议。
- 做内容安全：输入 action 校验、LLM 输出审核、敏感内容拦截。
- 写审计日志：用户选择、规则结果、LLM 请求摘要、错误信息。
- 持久化数据：玩家、存档、回合日志、NPC 记忆、世界事件。

后端不能做：

- 不直接返回页面 HTML 作为主要交互方式。
- 不依赖前端传来的数值作为权威状态。
- 不允许 LLM 直接改写规则结算结果。

## LLM 职责边界

不用 LLM：

- 角色数值、库存、境界、资源变化。
- 规则结算和随机事件落地。
- 存档、支付、账号、权限、安全审计。

使用 LLM：

- 每日行动候选项文案。
- 规则结算后的剧情润色。
- NPC 台词和语气。
- 事件描写。
- 记忆摘要。
- 长期伏笔建议。

详见 [llm-boundaries.md](./llm-boundaries.md)。

## 前后端 API 合同

所有接口返回 JSON。建议统一响应：

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "requestId": "req_xxx"
}
```

错误响应：

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "ACTION_EXPIRED",
    "message": "该行动已过期，请刷新每日行动。"
  },
  "requestId": "req_xxx"
}
```

### GET /api/v1/game/state

用途：获取当前玩家权威 game state。

前端使用场景：页面初始化、刷新、切换设备后恢复。

返回：

```json
{
  "game": "GameState"
}
```

### POST /api/v1/daily-actions

用途：获取当前界面的每日行动选项。

请求：

```json
{
  "viewId": "cultivation",
  "gameVersion": 12
}
```

返回：

```json
{
  "actions": [
    {
      "id": "act_001",
      "title": "三月闭关",
      "icon": "闭",
      "command": "闭关修炼三月，尝试突破",
      "meta": "破境进度",
      "source": "llm",
      "risk": "medium",
      "expiresAt": "2026-06-29T16:00:00.000Z"
    }
  ]
}
```

要求：

- 后端可以用 LLM 生成 action，但必须校验 action 是否能被规则系统识别。
- `command` 是规则引擎输入，不是前端自由文本。
- action 必须有过期机制，避免旧选项重复提交。

### POST /api/v1/turns

用途：提交每日行动并推进一回合。

请求：

```json
{
  "actionId": "act_001",
  "clientTurn": 12
}
```

返回：

```json
{
  "game": "GameState",
  "turnResult": {
    "turn": 13,
    "actionId": "act_001",
    "ruleResult": {
      "success": true,
      "statChanges": {
        "qi": 8,
        "cultivationProgress": 16,
        "spiritStones": -4
      }
    },
    "narration": {
      "title": "闭关试炼",
      "body": "竹舍外雨声渐密...",
      "npcLine": "林师姐低声提醒...",
      "foreshadow": "雷木双息开始出现反噬征兆。"
    }
  }
}
```

要求：

- 后端必须以服务端存档为准，不信任前端传来的 game state。
- 规则先结算，LLM 后润色。
- 如果 LLM 失败，后端必须返回规则生成的 fallback narration。

### POST /api/v1/export-story

用途：导出玩家传记。

请求：

```json
{
  "format": "txt"
}
```

返回：

```json
{
  "filename": "问道浮生-陆青玄-第13回合.txt",
  "content": "..."
}
```

## 核心数据模型

### GameState

```ts
type GameState = {
  id: string;
  version: number;
  turn: number;
  calendar: Calendar;
  player: PlayerState;
  npcs: NpcState[];
  worldEvents: WorldEvent[];
  foreshadows: string[];
  timeline: TimelineItem[];
  log: TurnLogEntry[];
};
```

### DailyAction

```ts
type DailyAction = {
  id: string;
  title: string;
  icon: string;
  command: string;
  meta: string;
  source: 'system' | 'llm' | 'fallback';
  risk: 'low' | 'medium' | 'high';
  storyHook?: string;
  expiresAt?: string;
};
```

### TurnResult

```ts
type TurnResult = {
  turn: number;
  actionId: string;
  ruleResult: RuleResult;
  narration: TurnNarration;
};
```

## 目录规划

```text
frontend/
  index.html
  src/
    api/
      gameApi.js          # 唯一 API client 出口
    ai/
      llmContracts.js     # 临时共享 LLM 契约，后续可迁到 shared/
    ui/
      views.js
      layoutModes.js
    app.js
    styles.css

backend/
  src/
    api/
      routes/
        gameState.ts
        dailyActions.ts
        turns.ts
        exportStory.ts
    domain/
      rules/
      state/
      actions/
    llm/
      prompts/
      schemas/
      providers/
    safety/
    persistence/
    audit/

shared/
  contracts/
    gameState.ts
    dailyAction.ts
    turnResult.ts
    llm.ts
```

## 解耦验收标准

前端验收：

- 页面层只调用 `frontend/src/api/gameApi.js`。
- 页面层不 import 规则引擎。
- 页面层没有自由输入框，只渲染后端 action。
- 顶层五个界面都能请求每日行动。
- 后端 API 不可用时，有清晰错误态和重试入口。

后端验收：

- 所有规则结算都有单元测试。
- LLM 输出必须经过 schema 校验。
- LLM 失败时仍能完成回合推进。
- 任何数值变化都来自规则模块，不来自 LLM 文本。
- 每次 turn 都有审计日志。

联调验收：

- 前端刷新后能从 `/game/state` 恢复。
- 切换页签后能从 `/daily-actions` 获取不同 action。
- 点击 action 后 `/turns` 返回新状态和剧情。
- 重复提交过期 action 会被拒绝。
- LLM provider 关闭时，游戏仍可通过 fallback 文案运行。

## 推荐开发顺序

1. 后端先实现 `GET /game/state` 和内存存档。
2. 后端实现 `POST /daily-actions`，先返回规则 fallback action。
3. 前端 `gameApi.js` 从 mock 切到 HTTP client。
4. 后端实现 `POST /turns` 规则结算。
5. 后端接入 LLM narration，失败时 fallback。
6. 后端接入 LLM daily action generation。
7. 补数据库、用户、审计、内容安全。
