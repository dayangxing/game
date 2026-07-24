import { getModelSelection, resolveBailianApiKey } from './modelSelection.js';
import {
  buildNarrationMessages,
  buildRepairNarrationMessages
} from './prompts/narrationPrompt.js';
import { buildStoryDirectorMessages } from './prompts/storyDirectorPrompt.js';
import { buildLongSummaryMessages } from './prompts/longSummaryPrompt.js';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

export function createBailianClient({
  env = process.env,
  fetchImpl = globalThis.fetch,
  config = null,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  sleepImpl = sleep
} = {}) {
  const selection = getModelSelection(env, config);
  const apiKey = resolveBailianApiKey(env, config);
  const retryLimit = normalizeRetryCount(maxRetries);
  const baseRetryDelay = normalizeRetryDelay(retryDelayMs);

  async function requestChatCompletion({ messages, model = selection.chatModel, temperature = 0.7 }) {
    if (!apiKey) {
      throw createNonRetryableError('BAILIAN_API_KEY is not configured');
    }
    if (!fetchImpl) {
      throw createNonRetryableError('fetch is not available in this runtime');
    }

    let response;
    try {
      response = await fetchImpl(`${selection.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          stream: true,
          stream_options: { include_usage: true },
          enable_thinking: false,
          response_format: { type: 'json_object' }
        })
      });
    } catch (error) {
      throw markRetryable(error);
    }

    if (!response.ok) {
      const error = new Error(`Bailian chat request failed with HTTP ${response.status}`);
      error.status = response.status;
      error.retryable = isRetryableStatus(response.status);
      throw error;
    }

    return response;
  }

  async function waitForRetry(attempt, error, onRetry) {
    await sleepImpl(baseRetryDelay * (2 ** (attempt - 1)));
    onRetry?.({ attempt, maxRetries: retryLimit, error });
  }

  async function readChatContentOnce({ messages, model, temperature }) {
    const response = await requestChatCompletion({ messages, model, temperature });
    if (!response.body?.getReader) {
      const payload = await response.json();
      return payload?.choices?.[0]?.message?.content ?? '';
    }
    return readStreamContent(response.body);
  }

  async function* streamChatContent({ messages, model = selection.chatModel, temperature = 0.7, onRetry }) {
    let attempt = 0;

    while (true) {
      try {
        const response = await requestChatCompletion({ messages, model, temperature });

        if (!response.body?.getReader) {
          const payload = await response.json();
          const content = payload?.choices?.[0]?.message?.content;
          if (content) yield content;
          return;
        }

        yield* readStreamContentChunks(response.body);
        return;
      } catch (error) {
        if (!canRetry(error, attempt, retryLimit)) throw error;
        attempt += 1;
        await waitForRetry(attempt, error, onRetry);
      }
    }
  }

  async function chatJson({
    messages,
    model = selection.chatModel,
    temperature = 0.7,
    validateResult = null
  }) {
    let attempt = 0;

    while (true) {
      try {
        const content = await readChatContentOnce({ messages, model, temperature });
        if (!content) {
          throw new Error('Bailian chat response did not include message content');
        }
        const result = JSON.parse(content);
        return typeof validateResult === 'function' ? validateResult(result) : result;
      } catch (error) {
        if (!canRetry(error, attempt, retryLimit)) throw error;
        attempt += 1;
        await waitForRetry(attempt, error);
      }
    }
  }

  return {
    selection,

    async generateNarration({ beforeGame, afterGame, action, ruleEntry }) {
      return chatJson({
        model: selection.chatModel,
        messages: buildNarrationMessages({ beforeGame, afterGame, action, ruleEntry })
      });
    },

    streamNarration({ beforeGame, afterGame, action, ruleEntry, onRetry }) {
      return streamChatContent({
        model: selection.chatModel,
        messages: buildNarrationMessages({ beforeGame, afterGame, action, ruleEntry }),
        onRetry
      });
    },

    async repairNarration({ validationErrors, rawNarration, afterGame }) {
      return chatJson({
        model: selection.chatModel,
        temperature: 0.2,
        messages: buildRepairNarrationMessages({ validationErrors, rawNarration, afterGame })
      });
    },

    async generateStoryDirector({ game, input }) {
      return chatJson({
        model: selection.chatModel,
        messages: buildStoryDirectorMessages({ game, input })
      });
    },

    async generateLongSummary({
      game,
      previousSummary,
      sourceTurns,
      summaryWindowStartTurn,
      summaryWindowEndTurn,
      rebase,
      openingAnchor
    }) {
      const result = await chatJson({
        model: selection.fastModel,
        temperature: 0.1,
        validateResult: validateLongSummaryResult,
        messages: buildLongSummaryMessages({
          game,
          previousSummary,
          sourceTurns,
          summaryWindowStartTurn,
          summaryWindowEndTurn,
          rebase,
          openingAnchor
        })
      });

      return validateLongSummaryResult(result);
    },

    streamStoryDirector({ game, input, onRetry }) {
      return streamChatContent({
        model: selection.chatModel,
        messages: buildStoryDirectorMessages({ game, input }),
        onRetry
      });
    },

    chatJson,
    streamChatContent
  };
}

function canRetry(error, attempt, maxRetries) {
  return attempt < maxRetries && error?.retryable !== false;
}

function markRetryable(error) {
  const next = error instanceof Error ? error : new Error(String(error));
  if (next.retryable === undefined) next.retryable = true;
  return next;
}

function createNonRetryableError(message) {
  const error = new Error(message);
  error.retryable = false;
  return error;
}

function isRetryableStatus(status) {
  return status === 408
    || status === 409
    || status === 425
    || status === 429
    || (status >= 500 && status <= 599);
}

function normalizeRetryCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : DEFAULT_MAX_RETRIES;
}

function normalizeRetryDelay(value) {
  const delay = Number(value);
  return Number.isFinite(delay) ? Math.max(0, delay) : DEFAULT_RETRY_DELAY_MS;
}

function sleep(delay) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function validateLongSummaryResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('Bailian long summary response must be a JSON object');
  }

  const summary = typeof result.summary === 'string' ? result.summary.trim() : '';
  if (!summary) {
    throw new Error('Bailian long summary response must include a non-empty summary');
  }
  if (Array.from(summary).length > 420) {
    throw new Error('Bailian long summary response must not exceed 420 characters');
  }
  if (!Number.isInteger(result.coveredThroughTurn) || result.coveredThroughTurn < 0) {
    throw new Error('Bailian long summary response must include an integer coveredThroughTurn');
  }

  return {
    summary,
    coveredThroughTurn: result.coveredThroughTurn
  };
}

async function readChatContent(response) {
  if (!response.body?.getReader) {
    const payload = await response.json();
    return payload?.choices?.[0]?.message?.content;
  }

  return readStreamContent(response.body);
}

async function readStreamContent(body) {
  let content = '';

  for await (const delta of readStreamContentChunks(body)) {
    content += delta;
  }

  return content;
}

async function* readStreamContentChunks(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      const content = parseStreamEvent(part);
      if (content) yield content;
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const content = parseStreamEvent(buffer);
    if (content) yield content;
  }
}

function parseStreamEvent(eventBlock) {
  let content = '';

  for (const line of eventBlock.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;

    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;

    const payload = JSON.parse(data);
    for (const choice of payload.choices ?? []) {
      content += choice.delta?.content ?? choice.message?.content ?? '';
    }
  }

  return content;
}
