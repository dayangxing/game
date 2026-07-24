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

test('bailian client exposes streamed chat content deltas as they arrive', async () => {
  const chunks = [
    'data: {"choices":[{"delta":{"content":"{\\"title\\":\\"流式\\""}}]}\n\n',
    'data: {"choices":[{"delta":{"content":",\\"body\\":\\"逐段"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"返回\\"}"}}]}\n\n',
    'data: [DONE]\n\n'
  ];
  const client = createBailianClient({
    env: {
      BAILIAN_API_KEY: 'unit-test-token'
    },
    async fetchImpl() {
      return {
        ok: true,
        body: streamFromStrings(chunks)
      };
    }
  });

  const deltas = [];
  for await (const delta of client.streamChatContent({
    messages: [{ role: 'user', content: '{"task":"narrative_polish"}' }]
  })) {
    deltas.push(delta);
  }

  assert.deepEqual(deltas, [
    '{"title":"流式"',
    ',"body":"逐段',
    '返回"}'
  ]);
});

test('bailian client exposes story director generation and streaming wrappers', async () => {
  const capturedTasks = [];
  const chunks = [
    'data: {"choices":[{"delta":{"content":"{\\"scene\\":\\"命火微动\\",\\"mode\\":\\"continue\\",\\"npcLines\\":[],"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"\\"effectHints\\":[],\\"choices\\":[],\\"memoryHints\\":[]}"}}]}\n\n',
    'data: [DONE]\n\n'
  ];
  const client = createBailianClient({
    env: {
      BAILIAN_API_KEY: 'unit-test-token'
    },
    async fetchImpl(url, init) {
      const body = JSON.parse(init.body);
      capturedTasks.push(JSON.parse(body.messages.find((message) => message.role === 'user').content).task);
      return {
        ok: true,
        body: streamFromStrings(chunks)
      };
    }
  });

  const generated = await client.generateStoryDirector({
    game: minimalGame(),
    input: { type: 'continue' }
  });
  const deltas = [];
  for await (const delta of client.streamStoryDirector({
    game: minimalGame(),
    input: { type: 'continue' }
  })) {
    deltas.push(delta);
  }

  assert.equal(generated.scene, '命火微动');
  assert.equal(generated.mode, 'continue');
  assert.deepEqual(capturedTasks, ['continuous_story_director', 'continuous_story_director']);
  assert.deepEqual(deltas, [
    '{"scene":"命火微动","mode":"continue","npcLines":[],',
    '"effectHints":[],"choices":[],"memoryHints":[]}'
  ]);
});

test('bailian client generates long summaries with the fast model and returns only summary fields', async () => {
  let captured;
  const client = createBailianClient({
    env: { BAILIAN_API_KEY: 'unit-test-token' },
    async fetchImpl(url, init) {
      captured = { url, body: JSON.parse(init.body) };
      return {
        ok: true,
        async json() {
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  summary: '顾清河追查雾隐秘境，尚未解开飞升传闻。',
                  coveredThroughTurn: 12,
                  ignoredField: '不得透传'
                })
              }
            }]
          };
        }
      };
    }
  });

  const result = await client.generateLongSummary({
    game: minimalGame(),
    previousSummary: '青云宗新生入门。',
    sourceTurns: [{ turn: 12, title: '雾隐回响', outcome: '发现残契' }]
  });

  assert.equal(captured.url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(captured.body.model, 'qwen3.6-flash');
  assert.equal(captured.body.response_format.type, 'json_object');
  assert.ok(captured.body.temperature <= 0.3);
  assert.deepEqual(result, {
    summary: '顾清河追查雾隐秘境，尚未解开飞升传闻。',
    coveredThroughTurn: 12
  });
});

test('bailian client accepts a long summary at the 420-character limit', async () => {
  const client = createBailianClient({
    env: { BAILIAN_API_KEY: 'unit-test-token' },
    async fetchImpl() {
      return {
        ok: true,
        async json() {
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  summary: '甲'.repeat(420),
                  coveredThroughTurn: 12
                })
              }
            }]
          };
        }
      };
    }
  });

  const result = await client.generateLongSummary({
    game: minimalGame(),
    sourceTurns: [{ turn: 12, title: '雾隐回响', outcome: '发现残契' }]
  });

  assert.equal(result.summary.length, 420);
});

test('bailian client rejects an overlong summary after reusing the existing retries', async () => {
  let calls = 0;
  const client = createBailianClient({
    env: { BAILIAN_API_KEY: 'unit-test-token' },
    retryDelayMs: 0,
    sleepImpl: async () => {},
    async fetchImpl() {
      calls += 1;
      return {
        ok: true,
        async json() {
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  summary: '甲'.repeat(421),
                  coveredThroughTurn: 12
                })
              }
            }]
          };
        }
      };
    }
  });

  await assert.rejects(
    () => client.generateLongSummary({
      game: minimalGame(),
      sourceTurns: [{ turn: 12, title: '雾隐回响', outcome: '发现残契' }]
    }),
    /420/
  );
  assert.equal(calls, 4);
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

test('bailian client retries a transient json request before succeeding', async () => {
  let calls = 0;
  const waits = [];
  const client = createBailianClient({
    env: { BAILIAN_API_KEY: 'unit-test-token' },
    retryDelayMs: 10,
    sleepImpl: async (delay) => waits.push(delay),
    async fetchImpl() {
      calls += 1;
      if (calls === 1) throw new Error('temporary network failure');
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: '{"ok":true}' } }] };
        }
      };
    }
  });

  assert.deepEqual(await client.chatJson({ messages: [] }), { ok: true });
  assert.equal(calls, 2);
  assert.deepEqual(waits, [10]);
});

test('bailian client retries a malformed json response up to three times', async () => {
  let calls = 0;
  const client = createBailianClient({
    env: { BAILIAN_API_KEY: 'unit-test-token' },
    retryDelayMs: 0,
    sleepImpl: async () => {},
    async fetchImpl() {
      calls += 1;
      return {
        ok: true,
        async json() {
          return { choices: [{ message: { content: calls === 4 ? '{"ok":true}' : '{broken' } }] };
        }
      };
    }
  });

  assert.deepEqual(await client.chatJson({ messages: [] }), { ok: true });
  assert.equal(calls, 4);
});

test('bailian client does not retry authentication failures', async () => {
  let calls = 0;
  const client = createBailianClient({
    env: { BAILIAN_API_KEY: 'unit-test-token' },
    retryDelayMs: 0,
    sleepImpl: async () => {},
    async fetchImpl() {
      calls += 1;
      return { ok: false, status: 401, async json() { return {}; } };
    }
  });

  await assert.rejects(() => client.chatJson({ messages: [] }), /HTTP 401/);
  assert.equal(calls, 1);
});

test('bailian client retries a stream and reports reset attempts', async () => {
  let calls = 0;
  const retries = [];
  const chunks = [
    'data: {"choices":[{"delta":{"content":"{\\"ok\\":true}"}}]}\n\n',
    'data: [DONE]\n\n'
  ];
  const client = createBailianClient({
    env: { BAILIAN_API_KEY: 'unit-test-token' },
    retryDelayMs: 0,
    sleepImpl: async () => {},
    async fetchImpl() {
      calls += 1;
      if (calls === 1) throw new Error('stream connection reset');
      return { ok: true, body: streamFromStrings(chunks) };
    }
  });

  const deltas = [];
  for await (const delta of client.streamChatContent({
    messages: [],
    onRetry: (retry) => retries.push(retry)
  })) {
    deltas.push(delta);
  }

  assert.deepEqual(deltas, ['{"ok":true}']);
  assert.equal(calls, 2);
  assert.equal(retries.length, 1);
  assert.equal(retries[0].attempt, 1);
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

function minimalGame() {
  return {
    turn: 0,
    calendar: { year: 3, season: '春', month: 1 },
    player: {
      name: '顾清河',
      realm: '炼气一层',
      location: '青云宗外门',
      health: 100,
      maxHealth: 100,
      lifespan: 100,
      maxLifespan: 100,
      qi: 50,
      mood: 50,
      cultivationProgress: 10,
      sectRelation: 20
    },
    character: { attributes: {} },
    inventory: { pills: {}, materials: {} },
    npcs: [],
    storyMemory: {
      longSummary: '青云宗新生入门。',
      recentTurns: [],
      openThreads: [],
      characterNotes: []
    }
  };
}
