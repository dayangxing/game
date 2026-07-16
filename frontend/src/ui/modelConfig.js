export const MODEL_CONFIG_STORAGE_KEY = 'wendao-model-config-v1';
export const MODEL_CONFIG_SKIP_KEY = 'wendao-model-config-skipped-v1';

export function shouldPromptModelConfig(config, sessionStorage = getStorage('sessionStorage')) {
  if (config?.configured) return false;
  try {
    return sessionStorage?.getItem(MODEL_CONFIG_SKIP_KEY) !== '1';
  } catch {
    return true;
  }
}

export function readStoredModelConfig(storage = getStorage('localStorage')) {
  try {
    const raw = storage?.getItem(MODEL_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      baseUrl: String(parsed.baseUrl ?? '').trim(),
      chatModel: String(parsed.chatModel ?? '').trim(),
      apiKey: String(parsed.apiKey ?? '').trim()
    };
  } catch {
    return null;
  }
}

export function writeStoredModelConfig(config, storage = getStorage('localStorage')) {
  try {
    storage?.setItem(MODEL_CONFIG_STORAGE_KEY, JSON.stringify({
      baseUrl: String(config?.baseUrl ?? '').trim(),
      chatModel: String(config?.chatModel ?? '').trim(),
      apiKey: String(config?.apiKey ?? '').trim()
    }));
  } catch {
    // Browser storage can be disabled; the backend remains the source of truth.
  }
}

export function clearStoredModelConfig(storage = getStorage('localStorage')) {
  try {
    storage?.removeItem(MODEL_CONFIG_STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function skipModelConfig(sessionStorage = getStorage('sessionStorage')) {
  try {
    sessionStorage?.setItem(MODEL_CONFIG_SKIP_KEY, '1');
  } catch {
    // Ignore unavailable session storage.
  }
}

export function clearModelConfigSkip(sessionStorage = getStorage('sessionStorage')) {
  try {
    sessionStorage?.removeItem(MODEL_CONFIG_SKIP_KEY);
  } catch {
    // Ignore unavailable session storage.
  }
}

function getStorage(name) {
  try {
    return globalThis[name] ?? null;
  } catch {
    return null;
  }
}
