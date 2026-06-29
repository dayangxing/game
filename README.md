# 问道浮生

AI 文字修仙 Web 原型。当前稳定版已经完成前后端原型联调：前端负责桌面端交互和展示，后端负责权威存档、每日行动、回合结算与剧情生成 fallback，双方通过 REST JSON API 对接。

## 当前入口

- 前端页面：`frontend/index.html`
- 前端开发 URL：`http://127.0.0.1:5173/frontend/`
- 后端入口：`backend/src/server.js`
- 后端 API：`http://127.0.0.1:8787`
- 根入口：`index.html` 会跳转到 `frontend/`

直接双击 `frontend/index.html` 时，页面会自动跳转到本地开发服务地址。前端默认优先使用后端 API；如果后端不可用，会给出错误提示，也可以切换到本地 Mock。

## 启动方式

需要 Node.js。当前项目脚本如下：

```bash
npm run start:backend
```

另开一个终端启动前端静态服务：

```bash
npm run start:frontend
```

然后打开：

```text
http://127.0.0.1:5173/frontend/
```

如果 `5173` 被占用，可以临时换端口运行静态服务，但 `file:` 自动跳转默认仍指向 `5173`。

## 前后端职责

前端只负责：

- 展示洞府、修炼、功法、秘境、行囊五个顶层界面。
- 读取后端 game state 并渲染角色、资源、NPC、事件、伏笔和日志。
- 请求每日行动并渲染 action 卡牌。
- 提交玩家选择，展示后端返回的回合结果。
- 维护轻量 UI 状态，例如当前页签、加载态、错误提示、新手指引。

后端负责：

- 保存权威 game state。
- 生成或返回每日行动。
- 校验行动是否过期、回合是否匹配。
- 执行规则结算，推进 turn/version。
- 调用或降级 LLM 剧情生成。
- 导出玩家传记。

数值变化、境界进度、资源消耗、NPC 好感和世界事件不能由前端或 LLM 直接决定。

## 稳定版联调说明

- 前端 API client 集中在 `frontend/src/api/gameApi.js`，页面层不直接拼后端 URL。
- API 模式默认连接 `http://127.0.0.1:8787`，也可通过 `window.WENDAO_API_BASE_URL` 覆盖。
- 后端每日行动使用 `act_...` ID。前端的即时行动是临时 UI 兜底，提交前会重新请求 `/api/v1/daily-actions`，用 `command` 匹配并兑换为后端 action ID，再提交 `/api/v1/turns`。
- 切换页签时会先渲染即时行动，随后异步刷新后端行动，避免 UI 空白。
- 每日行动刷新带有 request、view、turn/version 防护，旧请求不会覆盖当前页签或新回合状态。
- 模式切换和重置会先拿到下一份 game/actions，再替换当前状态，避免半切换。
- 首次打开会出现新手指引；如果启动时 API 失败，错误 toast 优先展示，指引不会遮住错误信息。

## API 概览

```http
GET  /api/v1/game/state
POST /api/v1/daily-actions
POST /api/v1/turns
POST /api/v1/turns/:turn/narration
POST /api/v1/export-story
```

统一返回格式：

```json
{
  "ok": true,
  "data": {},
  "error": null,
  "requestId": "req_xxx"
}
```

错误返回：

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "TURN_MISMATCH",
    "message": "客户端回合已过期，请刷新后重试。"
  },
  "requestId": "req_xxx"
}
```

## 验证

运行全部测试：

```bash
npm test
```

当前测试覆盖：

- 后端 API 状态、每日行动、回合推进、过期行动、回合不匹配、传记导出。
- 前端 API client 与后端合同联调。
- 即时行动兑换为后端 action ID 后再提交。
- 前端页签切换、刷新防护、模式切换、重置流程。
- `file:` 打开时跳转到本地开发服务。
- 新手指引触发、完成和页面挂载。

更多架构约束见 `docs/architecture/frontend-backend-requirements.md`。
