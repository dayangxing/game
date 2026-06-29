# 后端模型选型

## 结论

后端默认使用百炼 OpenAI-compatible Chat Completions 接口，不在代码中保存 API key。

- 主模型：`qwen3.7-plus`
- 快速降级模型：`qwen3.6-flash`
- 高质量可选模型：`qwen3.7-max`
- 默认 Base URL：`https://dashscope.aliyuncs.com/compatible-mode/v1`
- 密钥来源：`BAILIAN_API_KEY`，兼容读取 `DASHSCOPE_API_KEY`

## 选择理由

`qwen3.7-plus`适合作为剧情润色、NPC 语气和每日行动生成的默认模型：质量高于低成本模型，又比最高规格模型更适合常规回合频率。`qwen3.6-flash`用于未来的低成本快速任务，例如候选行动补全或安全重写。`qwen3.7-max`保留给章节总结、长线伏笔整理等更需要质量的后台任务。

后端使用 LangGraph 编排剧情生成。回合推进时先执行规则结算并保存新进度，再请求 LLM 生成剧情。若模型不可用，后端不会回滚规则结算，而是在 `turnResult.narration` 中返回 `status: "llm_unavailable"`、`retryable: true` 和已保存的 `savedTurn`。之后可调用 `POST /api/v1/turns/:turn/narration`，基于同一已保存结算重新续写剧情，不会重复推进规则。

测试环境通过 fake LLM 注入验证生成和不可用路径，不调用真实百炼 API。

## 提示词与修复流程

剧情提示词位于 `backend/src/llm/prompts/narrationPrompt.js`。首轮生成使用两段 message：

- `system`：定义剧情叙事 agent 的职责、绝对禁止事项、暗色水墨修仙文风和 JSON schema。
- `user`：传入本回合 `action`、`beforeGame`、`afterGame`、`ruleEntry`、`ruleDelta`、`npcVoiceGuide` 和硬性约束。

LangGraph 在 `generate_narration` 后执行 `validate_narration`。如果输出缺少字段、正文过短/过长，或缺少审计字段，会进入 `repair_narration` 节点。修复提示词只允许模型修补 JSON，不允许解释或改写已结算事实。

## 环境变量

```bash
export BAILIAN_API_KEY="..."
export BAILIAN_CHAT_MODEL="qwen3.7-plus"
export BAILIAN_FAST_MODEL="qwen3.6-flash"
export BAILIAN_PREMIUM_MODEL="qwen3.7-max"
```

不要把 API key 写入仓库、测试快照、浏览器代码或审计日志。
