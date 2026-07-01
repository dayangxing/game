import test from 'node:test';
import assert from 'node:assert/strict';

import { createBailianClient } from '../backend/src/llm/bailianClient.js';

test('bailian client sends compatible chat completions request and parses json content', async () => {
  let captured;
  const client = createBailianClient({
    env: {
      BAILIAN_API_KEY: 'unit-test-token',
      BAILIAN_BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      BAILIAN_CHAT_MODEL: 'qwen3.7-plus'
    },
    async fetchImpl(url, init) {
      captured = {
        url,
        init,
        body: JSON.parse(init.body)
      };

      return {
        ok: true,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    title: '模型叙事',
                    body: '规则结果已经落定，模型只负责把这一回合写成可读剧情。',
                    npcLine: '林师姐道：“结果已定。”'
                  })
                }
              }
            ]
          };
        }
      };
    }
  });

  const result = await client.chatJson({
    messages: [{ role: 'user', content: '{"task":"narrative_polish"}' }],
    temperature: 0.3
  });

  assert.equal(captured.url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers.authorization, 'Bearer unit-test-token');
  assert.equal(captured.init.headers['content-type'], 'application/json');
  assert.equal(captured.body.model, 'qwen3.7-plus');
  assert.equal(captured.body.temperature, 0.3);
  assert.equal(captured.body.stream, true);
  assert.deepEqual(captured.body.stream_options, { include_usage: true });
  assert.equal(captured.body.enable_thinking, false);
  assert.deepEqual(captured.body.response_format, { type: 'json_object' });
  assert.deepEqual(captured.body.messages, [{ role: 'user', content: '{"task":"narrative_polish"}' }]);
  assert.equal(result.title, '模型叙事');
  assert.match(result.body, /模型只负责/);
});

test('bailian client assembles streamed json deltas before parsing', async () => {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"{\\"title\\":\\"流式\\""}}]}\n\n',
    'data: {"choices":[{"delta":{"content":",\\"body\\":\\"逐段返回\\""}}]}\n\n',
    'data: {"choices":[{"delta":{"content":",\\"npcLine\\":\\"\\"}"}}]}\n\n',
    'data: {"usage":{"total_tokens":42},"choices":[]}\n\n',
    'data: [DONE]\n\n'
  ];
  const client = createBailianClient({
    env: {
      BAILIAN_API_KEY: 'unit-test-token'
    },
    async fetchImpl() {
      return {
        ok: true,
        body: streamFromStrings(chunks),
        async json() {
          assert.fail('streaming response should not fall back to response.json()');
        }
      };
    }
  });

  const result = await client.chatJson({
    messages: [{ role: 'user', content: '{"task":"narrative_polish"}' }]
  });

  assert.deepEqual(result, {
    title: '流式',
    body: '逐段返回',
    npcLine: ''
  });
});

test('bailian client fails closed when no api key is configured', async () => {
  const client = createBailianClient({
    env: {},
    async fetchImpl() {
      assert.fail('fetch should not be called without an api key');
    }
  });

  await assert.rejects(
    () => client.chatJson({ messages: [] }),
    /BAILIAN_API_KEY is not configured/
  );
});

function streamFromStrings(chunks) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  });
}
