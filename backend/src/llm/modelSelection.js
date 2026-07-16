import { DEFAULT_MODEL_CONFIG } from './modelConfig.js';

export function getModelSelection(env = process.env, config = null) {
  const hasApiKey = Boolean(resolveBailianApiKey(env, config));

  return {
    provider: 'bailian',
    baseUrl: config?.baseUrl || env.BAILIAN_BASE_URL || DEFAULT_MODEL_CONFIG.baseUrl,
    chatModel: config?.chatModel || env.BAILIAN_CHAT_MODEL || DEFAULT_MODEL_CONFIG.chatModel,
    fastModel: env.BAILIAN_FAST_MODEL || 'qwen3.6-flash',
    premiumModel: env.BAILIAN_PREMIUM_MODEL || 'qwen3.7-max',
    apiKeyEnv: 'BAILIAN_API_KEY or DASHSCOPE_API_KEY',
    hasApiKey,
    apiKey: hasApiKey ? '[configured]' : null
  };
}

export function resolveBailianApiKey(env = process.env, config = null) {
  if (config && Object.prototype.hasOwnProperty.call(config, 'apiKey')) {
    return config.apiKey || '';
  }
  return env.BAILIAN_API_KEY || env.DASHSCOPE_API_KEY || '';
}
