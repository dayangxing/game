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
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`Bailian chat request failed with HTTP ${response.status}`);
      }

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Bailian chat response did not include message content');
      }

      return JSON.parse(content);
    }
  };
}
