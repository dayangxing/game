# 模型配置界面设计

## 目标

为问道浮生增加一个玩家可操作的模型配置界面，允许输入 OpenAI-compatible API 地址、API Key 和主模型名称；桌面版保存配置并在运行中立即应用，首次启动且没有已配置模型时自动打开配置界面。

## 用户体验

- 入口位于现有“菜单”折叠菜单，名称为“模型配置”。
- 首次启动时，如果后端返回未配置 API Key，自动打开配置弹窗；已有配置时不打扰用户。
- 配置弹窗提供 API 地址、API Key、主模型三个字段，以及“保存并应用”“清除配置”“暂不配置”操作。
- API Key 使用密码输入框；已配置时不回填原文，只显示“留空保持当前 Key”。
- 保存后立即刷新模型状态，不需要重启桌面 App；用户仍需点击顶部“云端”模式才会使用远程模型。
- “暂不配置”只跳过当前会话；如果仍未配置，下次启动继续自动提示，保证首次配置入口不会永久丢失。
- API 配置错误只显示面向玩家的失败提示，不显示 Key、Authorization header 或完整请求体。

## 配置字段与默认值

| 字段 | 默认值 | 规则 |
| --- | --- | --- |
| API 地址 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 去掉末尾 `/`；保存时必须是 `http` 或 `https` URL |
| API Key | 空 | 发送给本机后端；响应永远不返回原文 |
| 主模型 | `qwen3.7-plus` | 非空，最多 160 个字符；兼容任意 OpenAI-compatible 模型名 |

当前后端仍保留 fast/premium 模型的环境变量默认值；界面只编辑实际用于剧情生成的主模型，避免把首次配置做成复杂的模型矩阵。

## 架构与数据流

1. 前端通过现有后端 API 获取脱敏配置状态。
2. 前端提交配置到 `POST /api/v1/model-config`。
3. 后端校验配置，重建 Bailian-compatible client、story graph 和 story director；当前游戏状态、章节、事件和存档不变。
4. Electron 桌面运行时把配置保存到 Electron `userData/model-config.json`，与游戏存档文件分离。
5. 浏览器开发模式将配置副本保存到 `localStorage`，页面启动时重新提交给当前本地后端；这是开发便利功能，不作为生产密钥管理方案。

后端只返回 `baseUrl`、模型名、`configured` 和脱敏 Key 状态。API Key 不进入 `gameSaveStore`、传记导出、游戏状态响应或模型健康响应。

## API 契约

- `GET /api/v1/model-config`：返回脱敏配置。
- `POST /api/v1/model-config`：接收 `{ baseUrl, chatModel, apiKey?, clearApiKey? }`；空 `apiKey` 保持现有 Key，`clearApiKey: true` 清除 Key。
- 现有 `GET /api/v1/model-selection` 和 `GET /api/v1/model-health` 保持响应结构兼容，但数据来源切换为当前运行时配置。

## 安全与失败处理

- API Key 只保存在本机配置文件/开发环境 localStorage 和后端内存，不写入游戏存档。
- 配置文件使用原子写入并尽量使用用户私有文件权限；损坏配置备份为 `.corrupt` 后回退到默认值。
- URL、模型名和 API Key 在后端统一校验；无效配置返回 `400 MODEL_CONFIG_INVALID`，不替换当前可用配置。
- 配置保存失败时保留旧配置，前端显示错误并保持弹窗打开。
- 没有 API Key 时继续使用现有 fallback/mock 行为，不阻塞本地模式。

## 验收标准

- 新安装桌面 App 首次打开自动显示模型配置弹窗。
- 保存后刷新页面/重启桌面 App，API 地址和模型名仍然存在；API Key 只以配置状态存在，不出现在任何游戏 API 响应。
- 清除配置后回到未配置状态，下次启动再次弹窗。
- 配置切换不会重置当前游戏状态。
- 现有全量测试、前端移动端布局和 Electron 桌面运行时测试全部通过。
