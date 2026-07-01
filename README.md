# 问道浮生

AI 文字修仙 Web 原型。当前稳定版已经完成单机事件库 MVP：新手序章解释世界观，完成后创建正式角色，再进入状态驱动事件循环。角色可随机生成，也可手动分配五维属性。前端负责桌面端交互和展示，后端负责权威存档、每日行动、回合结算与剧情生成 fallback，双方通过 REST JSON API 对接。产品不做开放世界、大地图、多人联机或离线挂机收益。

## 当前入口

- 前端页面：`frontend/index.html`
- 前端开发 URL：`http://127.0.0.1:5173/frontend/`
- 后端入口：`backend/src/server.js`
- 后端 API：`http://127.0.0.1:8787`
- 根入口：`index.html` 会跳转到 `frontend/`

直接双击 `frontend/index.html` 时，页面会自动跳转到本地开发服务地址。前端默认优先使用后端 API；如果后端不可用，会给出错误提示，也可以切换到本地 Mock。

## 启动方式

需要 Node.js。当前项目脚本如下：

首次接入正式模型时，在项目根目录创建本地配置文件 `.env.local`：

```bash
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_API_KEY=你的 DashScope compatible-mode key
BAILIAN_CHAT_MODEL=qwen3.7-plus
BAILIAN_FAST_MODEL=qwen3.6-flash
BAILIAN_PREMIUM_MODEL=qwen3.7-max
```

`.env.local` 和 `.env` 已被 git 忽略，只用于本机启动。不要把 key 写进 README、测试、前端代码或提交记录。

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

数值变化、境界进度、资源消耗、气血寿元、法宝功法、NPC 好感和世界事件不能由前端或 LLM 直接决定。

## 稳定版联调说明

- 前端 API client 集中在 `frontend/src/api/gameApi.js`，页面层不直接拼后端 URL。
- API 模式默认连接 `http://127.0.0.1:8787`，也可通过 `window.WENDAO_API_BASE_URL` 覆盖。
- 后端每日行动使用 `act_...` ID。前端的即时行动只作为 UI 过渡，占位期间不会在 API 模式下直接提交，待 `/api/v1/daily-actions` 返回真实后端行动后才可执行。
- 切换页签或完成回合时会先渲染即时行动，随后异步刷新后端行动，避免 UI 空白。
- 每日行动刷新带有 request、view、turn/version 防护，旧请求不会覆盖当前页签或新回合状态。
- 模式切换和重置会先拿到下一份 game/actions，再替换当前状态，避免半切换。
- 首次打开会出现新手指引；如果启动时 API 失败，错误 toast 优先展示，指引不会遮住错误信息。
- 新手指引只介绍玩法与界面，不推进剧情。完成指引后进入 12 章序章：青云宗门规、寿元压力、雾隐秘境、天门残契和飞升骗局伏笔会在序章中逐步展开。
- 角色创建阶段只有点击 `开始修行` 才会调用 `POST /api/v1/game/new` 创建正式后端存档；`重掷` 仅更新本地预览 seed。正式角色既支持随机五维，也支持手动分配固定 25 点。
- 产品不做开放世界、大地图、多人联机或离线挂机收益。

## 正式角色与规则状态

- 正式角色的五维为根骨、悟性、气运、心志、命元。随机建角会直接生成一套五维；手动建角则可在总点数固定的前提下自行分配。
- 根骨影响基础体魄与部分突破成功率；悟性影响修炼理解与突破成功率；气运影响随机机缘与少量突破加成；心志影响冲关稳定性；命元决定寿元上限并降低日常寿元消耗。
- 角色拥有气血与气血上限、寿元与寿元上限。气血用于承受事件与突破反噬；寿元是每回合正式行动的消耗，也是长期压力来源。
- 突破前会先由后端算出一份破境预览，包含目标境界、成功率与失败代价；真正的破境成败仍由后端结算，前端与 LLM 只能承认并表现它。
- 随身宝物与已习功法都由后端规则授予并写入权威存档，它们提供的加成会影响突破、体魄或修炼收益。
- LLM 只负责把已结算状态润色成剧情，不负责生成属性、寿元、气血、法宝、功法、突破成败或任何规则结果。

## API 概览

```http
GET  /api/v1/game/state
GET  /api/v1/model-health
POST /api/v1/game/new
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
- 本地模型配置加载、git 忽略和模型健康检查脱敏。

更多架构约束见 `docs/architecture/frontend-backend-requirements.md`。
