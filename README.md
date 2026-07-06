# 问道浮生

AI 文字修仙 Web 原型。当前调试版已经进入连续剧情导演模式：新手序章解释世界观，完成后创建正式角色，主页通过“下一步/剧情选择”推进一局连续人生。角色可随机生成，也可手动分配五维属性。前端负责桌面端交互和展示，后端负责权威存档、连续剧情流、模糊效果提示校验、数值结算与剧情生成 fallback，双方通过 REST JSON API 与 SSE 对接。产品不做开放世界、大地图、多人联机或离线挂机收益。

## 当前入口

- 上线分支：`main`
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

## 本地调试命令

所有命令默认在项目根目录执行：

```bash
cd /Users/ruilifeng/Documents/game
```

### 后端调试

启动后端：

```bash
npm run start:backend
```

检查后端是否监听 `8787`：

```bash
lsof -nP -iTCP:8787 -sTCP:LISTEN
```

检查当前后端存档状态：

```bash
curl -s http://127.0.0.1:8787/api/v1/game/state
```

检查模型配置状态：

```bash
curl -s http://127.0.0.1:8787/api/v1/model-health
```

重启后端前，先备份当前内存状态：

```bash
curl -s http://127.0.0.1:8787/api/v1/game/state -o /private/tmp/wendao-backend-state-before-restart.json
```

再查 PID 并停止旧后端，把 `<PID>` 换成 `lsof` 查出来的数字：

```bash
lsof -nP -iTCP:8787 -sTCP:LISTEN
kill <PID>
npm run start:backend
```

如果 `8787` 被占用，可以临时换端口：

```bash
PORT=8788 npm run start:backend
```

注意：`/api/v1/game/reset` 会清当前后端记录并回到重新建角，只在确认要重开时调用：

```bash
curl -s -X POST http://127.0.0.1:8787/api/v1/game/reset \
  -H 'content-type: application/json' \
  --data '{"rerollSeed":1}'
```

### 前端调试

启动前端静态服务：

```bash
npm run start:frontend
```

浏览器访问：

```text
http://127.0.0.1:5173/frontend/
```

检查前端服务是否监听 `5173`：

```bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
```

如果 `5173` 被占用，可以临时换端口启动静态服务：

```bash
python3 -m http.server 5174
```

然后访问：

```text
http://127.0.0.1:5174/frontend/
```

前端默认连接 `http://127.0.0.1:8787`。如果换了后端端口，需要在页面加载前覆盖 `window.WENDAO_API_BASE_URL`，或直接把后端仍跑在 `8787`。修改前端代码后，Chrome 建议用 `Cmd + Shift + R` 强刷新。

## 当前上线版本

- 页面入口：`http://127.0.0.1:5173/frontend/`
- 默认页签：`洞府`
- 调试分支：`dev`
- 顶部页签：`洞府`、`命簿`、`天机录`、`行囊`
- `洞府`：展示命途状态、历史行为和命途推进，是唯一提供“下一步/剧情选择”的主页。
- `命簿`：详细属性面板，集中展示人物、五维、生命与修行、宗门、道友牵绊和已修功法，不重复行囊里的宝物/丹药材料列表。
- `天机录`：展示本局总纲、近期回合、未解伏笔、人物记忆、世界记录和模型上下文摘要；未解伏笔只收录雾隐秘境、飞升契约、寿元异常、重要 NPC 身份、宗门暗线等关键事件，普通行动只进入近期回合。
- `行囊`：专门展示奇珍法器、丹药与材料。

## 时间与寿元规则

- 正式角色进入洞府后，每次主页推进都会消耗一段游戏内时间；新手序章和角色创建不消耗寿元。
- 境界越高，闭关、探秘、推演剧情和突破耗时越长。第一版平衡重点覆盖到金丹后期，元婴与化神规则已作为后续储备配置。
- 后端按规则结算游戏内月份、寿元、寿元上限、突破成功率、调养递减、灵药抗性和命簿终章；大模型只负责剧情正文、NPC 台词、玩家选择和模糊影响方向。
- 调息、灵药、功法和关键奇遇可以恢复当前寿元；普通调息不会提高寿元上限。
- 突破成功会恢复寿元并提高寿元上限，突破失败会消耗时间、气血、寿元和修为进度。
- 寿元归零进入“命簿终章”，主页停止提供行动选项，玩家可以查看传记或重开。

## 前后端职责

前端只负责：

- 展示洞府、命簿、天机录、行囊四个顶层界面。
- 读取后端 game state 并渲染角色、资源、NPC、事件、伏笔和日志。
- 在洞府渲染“下一步”或后端返回的剧情选择。
- 提交继续/选择请求，流式展示剧情正文，最终展示后端返回的回合结果。
- 维护轻量 UI 状态，例如当前页签、加载态、错误提示、新手指引。

后端负责：

- 保存权威 game state。
- 在序章/旧事件流中生成或返回每日行动。
- 在正式角色阶段生成连续剧情、公开选择和模型模糊效果提示。
- 校验行动是否过期、回合是否匹配。
- 执行规则结算，把模糊提示转换为具体数值变化，推进 turn/version。
- 调用或降级 LLM 剧情生成。
- 导出玩家传记。

数值变化、境界进度、资源消耗、气血寿元、法宝功法、NPC 好感和世界事件不能由前端或 LLM 直接决定。

## 稳定版联调说明

- 前端 API client 集中在 `frontend/src/api/gameApi.js`，页面层不直接拼后端 URL。
- API 模式默认连接 `http://127.0.0.1:8787`，也可通过 `window.WENDAO_API_BASE_URL` 覆盖。
- 后端每日行动使用 `act_...` ID，主要保留给序章和旧事件流。正式角色的洞府主页不再展示固定每日行动。
- 正式角色使用 `POST /api/v1/turns/stream` 的 `{ "type": "continue" }` 或 `{ "type": "choice" }` 推进。后端用 `story_delta` 先流式返回剧情片段，再用 `done` 返回权威 game state。
- 模型可以生成选择和模糊效果提示，但前端只展示选择文字；`effectHints`、内部 choice id、规则结果和调试字段不会出现在 UI。
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
- LLM 负责连续剧情正文、可选 NPC 台词、玩家选择和模糊效果方向；寿元、气血、修为、资源、好感、功法法宝、突破成败与具体数值仍由后端规则结算。

## API 概览

```http
GET  /api/v1/game/state
GET  /api/v1/model-health
POST /api/v1/game/new
POST /api/v1/daily-actions
POST /api/v1/turns
POST /api/v1/turns/stream
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

也可以直接使用当前 Codex 缓存 Node 运行：

```bash
/Users/ruilifeng/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test
```

当前测试覆盖：

- 后端 API 状态、每日行动、回合推进、过期行动、回合不匹配、传记导出。
- 连续剧情导演 prompt、模糊 effect hint 校验、后端数值结算、SSE continue/choice 流。
- 前端 API client 与后端合同联调。
- 前端连续剧情流式预览、后端公开选择提交、主页“下一步/剧情选择”状态机。
- 即时行动兑换为后端 action ID 后再提交。
- 前端页签切换、刷新防护、模式切换、重置流程。
- `file:` 打开时跳转到本地开发服务。
- 新手指引触发、完成和页面挂载。
- 本地模型配置加载、git 忽略和模型健康检查脱敏。

更多架构约束见 `docs/architecture/frontend-backend-requirements.md`。
