import { getModelSelection, resolveBailianApiKey } from './modelSelection.js';
import {
  buildNarrationMessages,
  buildRepairNarrationMessages
} from './prompts/narrationPrompt.js';

export function createBailianClient({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const selection = getModelSelection(env);
  const apiKey = resolveBailianApiKey(env);

  async function requestChatCompletion({ messages, model = selection.chatModel, temperature = 0.7 }) {
    if (!apiKey) {
      throw new Error('BAILIAN_API_KEY is not configured');
    }
    if (!fetchImpl) {
      throw new Error('fetch is not available in this runtime');
    }

    const response = await fetchImpl(`${selection.baseUrl}/chat/completions`, {
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

    if (!response.ok) {
      throw new Error(`Bailian chat request failed with HTTP ${response.status}`);
    }

    return response;
  }

  async function* streamChatContent({ messages, model = selection.chatModel, temperature = 0.7 }) {
    const response = await requestChatCompletion({ messages, model, temperature });

    if (!response.body?.getReader) {
      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (content) yield content;
      return;
    }

    yield* readStreamContentChunks(response.body);
  }

  async function chatJson({ messages, model = selection.chatModel, temperature = 0.7 }) {
    let content = '';
    for await (const delta of streamChatContent({ messages, model, temperature })) {
      content += delta;
    }

    if (!content) {
      throw new Error('Bailian chat response did not include message content');
    }

    return JSON.parse(content);
  }

  return {
    selection,

    async generateNarration({ beforeGame, afterGame, action, ruleEntry }) {
      return chatJson({
        model: selection.chatModel,
        messages: buildNarrationMessages({ beforeGame, afterGame, action, ruleEntry })
      });
    },

    streamNarration({ beforeGame, afterGame, action, ruleEntry }) {
      return streamChatContent({
        model: selection.chatModel,
        messages: buildNarrationMessages({ beforeGame, afterGame, action, ruleEntry })
      });
    },

    async repairNarration({ validationErrors, rawNarration, afterGame }) {
      return chatJson({
        model: selection.chatModel,
        temperature: 0.2,
        messages: buildRepairNarrationMessages({ validationErrors, rawNarration, afterGame })
      });
    },

    chatJson,
    streamChatContent
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
