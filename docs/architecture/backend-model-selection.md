# 后端模型选型

## 结论

后端默认使用百炼 OpenAI-compatible Chat Completions 接口，不在代码中保存 API key。

- 主模型：`qwen3.7-plus`
- 快速降级模型：`qwen3.6-flash`
- 高质量可选模型：`qwen3.7-max`
- 默认 Base URL：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- 密钥来源：`BAILIAN_API_KEY`，兼容读取 `DASHSCOPE_API_KEY`
- 本地配置文件：项目根目录 `.env.local`，由 `backend/src/config/env.js` 在服务启动前加载

## 选择理由

`qwen3.7-plus`适合作为剧情润色、NPC 语气和每日行动生成的默认模型：质量高于低成本模型，又比最高规格模型更适合常规回合频率。`qwen3.6-flash`用于未来的低成本快速任务，例如候选行动补全或安全重写。`qwen3.7-max`保留给章节总结、长线伏笔整理等更需要质量的后台任务。

后端使用 LangGraph 编排剧情生成。回合推进时先执行规则结算并保存新进度，再请求 LLM 生成剧情。若模型不可用，后端不会回滚规则结算，而是在 `turnResult.narration` 中返回 `status: "llm_unavailable"`、`retryable: true` 和已保存的 `savedTurn`。之后可调用 `POST /api/v1/turns/:turn/narration`，基于同一已保存结算重新续写剧情，不会重复推进规则。

百炼请求默认使用流式响应，并在请求体中关闭 Qwen 思考模式。后端会从 SSE delta 中组装完整 JSON，再按原有 REST 合同返回给前端；这样不改变当前前后端接口，同时减少模型思考阶段造成的等待。

测试环境通过 fake LLM 注入验证生成和不可用路径，不调用真实百炼 API。

## 提示词与修复流程

剧情提示词位于 `backend/src/llm/prompts/narrationPrompt.js`。首轮生成使用两段 message：

- `system`：定义剧情叙事 agent 的职责、绝对禁止事项、暗色水墨修仙文风和 JSON schema。
- `user`：传入本回合 `action`、`beforeGame`、`afterGame`、`ruleEntry`、`ruleDelta`、`npcVoiceGuide` 和硬性约束。

提示词上下文只暴露紧凑但足够叙事的确定性状态：

- `character.attributes`：根骨、悟性、福缘、心志、命种五维。
- `player.health/maxHealth` 与 `player.lifespan/maxLifespan`：体现气血损耗、寿元压力与上限。
- `treasures`、`techniques`：仅传递紧凑的玩家可感知字段，如名称、品阶、描述与加成，方便模型承认既有收藏而不暴露内部标识。
- `action.breakthrough`：若本次行动带有突破预览，传入目标境界、成功率与失败代价的语义字段。
- `ruleEntry.breakthrough`：若规则结算已经给出突破成败，传入已结算结果，禁止模型重算概率或改写成败。

LangGraph 在 `generate_narration` 后执行 `validate_narration`。如果输出缺少字段、正文过短/过长，或缺少审计字段，会进入 `repair_narration` 节点。修复提示词只允许模型修补 JSON，不允许解释或改写已结算事实。

这里的边界必须保持 deterministic-first：属性、气血、寿元、法宝、功法、突破概率与突破结果都先由后端规则结算，LLM 只能承认并润色这些事实，不能补发奖励、不能追加状态变化，也不能把失败写成成功。

## 环境变量

推荐开发环境使用 `.env.local`：

```bash
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_API_KEY="..."
BAILIAN_CHAT_MODEL="qwen3.7-plus"
BAILIAN_FAST_MODEL="qwen3.6-flash"
BAILIAN_PREMIUM_MODEL="qwen3.7-max"
```

也可以直接通过 shell 环境变量注入：

```bash
export BAILIAN_API_KEY="..."
export BAILIAN_CHAT_MODEL="qwen3.7-plus"
export BAILIAN_FAST_MODEL="qwen3.6-flash"
export BAILIAN_PREMIUM_MODEL="qwen3.7-max"
```

不要把 API key 写入仓库、测试快照、浏览器代码或审计日志。

后端提供 `GET /api/v1/model-health` 用于检查当前模型配置。该接口只返回 provider、baseUrl、模型名、`hasApiKey` 和 `status`，不会返回 key 原文。
