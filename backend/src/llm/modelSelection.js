const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

export function getModelSelection(env = process.env) {
  const hasApiKey = Boolean(resolveBailianApiKey(env));

  return {
    provider: 'bailian',
    baseUrl: env.BAILIAN_BASE_URL || DEFAULT_BASE_URL,
    chatModel: env.BAILIAN_CHAT_MODEL || 'qwen3.7-plus',
    fastModel: env.BAILIAN_FAST_MODEL || 'qwen3.6-flash',
    premiumModel: env.BAILIAN_PREMIUM_MODEL || 'qwen3.7-max',
    apiKeyEnv: 'BAILIAN_API_KEY or DASHSCOPE_API_KEY',
    hasApiKey,
    apiKey: hasApiKey ? '[configured]' : null
  };
}

export function resolveBailianApiKey(env = process.env) {
  return env.BAILIAN_API_KEY || env.DASHSCOPE_API_KEY || '';
}
