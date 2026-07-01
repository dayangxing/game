import { getModelSelection, resolveBailianApiKey } from './modelSelection.js';
import {
  buildNarrationMessages,
  buildRepairNarrationMessages
} from './prompts/narrationPrompt.js';

export function createBailianClient({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const selection = getModelSelection(env);
  const apiKey = resolveBailianApiKey(env);

  return {
    selection,

    async generateNarration({ beforeGame, afterGame, action, ruleEntry }) {
      return this.chatJson({
        model: selection.chatModel,
        messages: buildNarrationMessages({ beforeGame, afterGame, action, ruleEntry })
      });
    },

    async repairNarration({ validationErrors, rawNarration, afterGame }) {
      return this.chatJson({
        model: selection.chatModel,
        temperature: 0.2,
        messages: buildRepairNarrationMessages({ validationErrors, rawNarration, afterGame })
      });
    },

    async chatJson({ messages, model = selection.chatModel, temperature = 0.7 }) {
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

      const content = await readChatContent(response);
      if (!content) {
        throw new Error('Bailian chat response did not include message content');
      }

      return JSON.parse(content);
    }
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
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const parts = buffer.split(/\r?\n\r?\n/);
    buffer = parts.pop() ?? '';

    for (const part of parts) {
      content += parseStreamEvent(part);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    content += parseStreamEvent(buffer);
  }

  return content;
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
