# macOS 与 Windows 单机 App 设计

## 目标

将问道浮生封装为可安装的 macOS 与 Windows 桌面应用。用户双击 App 后只看到一个游戏窗口，不需要手动启动 Python 静态服务器、Node 后端或浏览器；关闭 App 时本地服务同步退出，重新打开后可以恢复本地存档。

## 选型

第一版使用 Electron + Electron Forge。

- Electron 主进程运行在 Node.js 环境，可以直接复用当前 Node 后端和 ESM 模块。
- Renderer 继续使用现有 HTML、CSS 和 ES modules，避免重写已经完成的游戏 UI。
- Electron Forge 负责开发启动、打包和平台 maker 配置。
- Tauri 暂不采用，因为当前项目的核心后端已经是 Node.js；迁移到 Tauri 会额外引入 Rust sidecar 或重写后端运行层。

## 运行架构

```text
Electron main process
├── createBackendApp()
├── startBackendServer({ host: '127.0.0.1', port: 0 })
├── 等待 server listening 并读取实际端口
├── 创建 BrowserWindow
├── preload 注入 WENDAO_API_BASE_URL 和桌面运行标记
└── before-quit 时关闭后端 server

Renderer process
└── 加载 frontend/index.html
    ├── 桌面模式不执行 file: → 5173 的开发环境跳转
    └── 通过运行时 API 地址请求内置后端
```

后端优先在 Electron 主进程内启动，而不是继续依赖 Python 静态服务器或额外 Node 可执行文件。使用端口 `0` 让操作系统分配空闲本地端口，避免用户机器上已有服务造成冲突；后端只绑定 `127.0.0.1`，不对局域网开放。

## 代码边界

### Electron 层

- `electron/main.mjs`：应用生命周期、后端启动/停止、窗口创建、加载前端。
- `electron/preload.mjs`：使用 `contextBridge` 暴露最小桌面配置，不开启 renderer 的 Node 直接访问。
- `forge.config.cjs`：应用元数据、资源目录、asar 和 macOS/Windows maker 配置。
- `package.json`：加入 Electron 开发命令、打包命令和 Electron Forge 依赖。

### 后端层

- `backend/src/server.js`：保留现有 `startBackendServer`，补充可等待 listening、读取随机端口和安全关闭所需的接口。
- `backend/src/app.js`：允许注入初始游戏状态和持久化回调，不改变现有 API 响应结构。
- 新增后端存档模块：以用户目录中的 JSON 文件为第一版持久化介质，负责读取、校验、原子写入和重置。

### 前端层

- `frontend/index.html`：只在普通浏览器的 `file:` 访问下跳转开发服务器；检测到桌面运行标记时直接加载。
- `frontend/src/app.js`、`frontend/src/api/gameApi.js`：优先使用 preload 注入的运行时 API 地址，继续保留浏览器开发环境 fallback。
- 不改动现有游戏视图、章节、事件、菜单和移动端响应式行为。

## 存档策略

当前后端状态是进程内存，App 退出后会丢失权威游戏状态。单机版启动时从用户目录读取存档，创建后端状态；每次成功改变游戏状态后写入临时文件，再通过 rename 原子替换正式存档文件。

- macOS 和 Windows 都使用 Electron 的 `userData` 目录，不把存档写入安装目录。
- 存档文件只保存游戏状态，不保存 API Key。
- 存档损坏时自动备份为 `.corrupt`，重新创建可玩初始状态，并向 UI 返回可读错误提示。
- 同一 App 只支持单用户单实例；不引入登录、远程同步和多人隔离。
- 前端 `localStorage` 继续保存 UI 偏好和浏览器侧摘要，后端 JSON 保存权威游戏状态。

## LLM 配置

- 本地模式无需网络和 API Key，可以离线体验确定性玩法。
- 云端 LLM 模式需要用户提供网络和 API 配置。
- API Key 不写入前端源码、Forge 配置、安装包资源或 Git；第一版通过启动环境变量/本地配置接入，后续再接入 macOS Keychain 和 Windows Credential Manager。
- LLM 不参与确定性规则、寿元扣除、突破结果和章节状态写入，沿用现有后端边界。

## 开发与打包命令

- `npm run desktop:dev`：启动 Electron，内置后端和前端窗口，不需要 `npm run start:all`。
- `npm run desktop:package`：生成当前平台可运行的未签名包，用于本机验收。
- `npm run desktop:make`：调用 Electron Forge 生成 macOS/Windows 分发产物。
- `npm run start:all`：继续保留，作为浏览器开发模式和自动化测试入口。

macOS 和 Windows 的最终安装包分别在对应平台或 CI runner 上构建。正式分发前需要配置 macOS notarization/code signing 与 Windows code signing；未签名包只作为开发验收产物。

## 错误处理

- 后端启动失败：Electron 显示明确错误对话框并退出，不打开空白窗口。
- 存档读取失败：保留损坏文件备份，使用安全初始状态并显示恢复提示。
- 前端加载失败：窗口显示错误页，主进程记录后端和窗口错误日志到用户目录。
- App 退出：先关闭 BrowserWindow，再关闭后端 server；重复关闭必须幂等。

## 验收标准

- macOS 和 Windows 开发环境都能通过 `npm run desktop:dev` 打开窗口。
- 不启动 Python，不占用固定 `5173`，后端只监听随机本地端口。
- 页面能完成启动、教程、角色创建、事件行动、章节推进、传记导出和重开。
- App 退出后重新打开，权威游戏状态和传记内容仍然存在。
- 浏览器开发模式现有 `node --test` 全量测试保持通过。
- Electron 主进程测试覆盖后端生命周期、随机端口、关闭幂等和启动失败处理。
- 存档测试覆盖首次启动、成功写入、重启恢复、损坏恢复和重开清理。
- 不修改 `main`，不推送远程分支。

## 非目标

- 本次不做移动端 App、远程账号、多用户联机、云端存档和自动更新服务。
- 本次不把 LLM 模型本体打包进安装包；云端 LLM 仍通过外部 API 工作。
- 本次不重写现有游戏引擎、章节事件库或响应式 UI。
