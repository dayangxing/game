export const DEFAULT_MODEL_CONFIG = Object.freeze({
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  chatModel: 'qwen3.7-plus',
  apiKey: ''
});

export function getModelConfigFromEnv(env = process.env) {
  return normalizeModelConfig({
    baseUrl: env.BAILIAN_BASE_URL,
    chatModel: env.BAILIAN_CHAT_MODEL,
    apiKey: env.BAILIAN_API_KEY || env.DASHSCOPE_API_KEY || ''
  });
}

export function normalizeModelConfig(input = {}, current = {}) {
  const baseUrl = cleanString(input.baseUrl ?? current.baseUrl ?? DEFAULT_MODEL_CONFIG.baseUrl);
  const chatModel = cleanString(input.chatModel ?? current.chatModel ?? DEFAULT_MODEL_CONFIG.chatModel);
  const apiKey = cleanString(input.apiKey ?? current.apiKey ?? DEFAULT_MODEL_CONFIG.apiKey);

  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error('MODEL_CONFIG_INVALID: API 地址必须是有效 URL。');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('MODEL_CONFIG_INVALID: API 地址只支持 HTTP 或 HTTPS。');
  }

  if (!chatModel || chatModel.length > 160) {
    throw new Error('MODEL_CONFIG_INVALID: 主模型名称必须为 1-160 个字符。');
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    chatModel,
    apiKey
  };
}

export function toPublicModelConfig(config = DEFAULT_MODEL_CONFIG) {
  const normalized = normalizeModelConfig(config);
  return {
    baseUrl: normalized.baseUrl,
    chatModel: normalized.chatModel,
    configured: Boolean(normalized.apiKey),
    apiKeyMasked: normalized.apiKey ? '••••••••' : ''
  };
}

function cleanString(value) {
  return String(value ?? '').trim();
}
