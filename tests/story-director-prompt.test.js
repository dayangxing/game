import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeDirectorOutput } from '../backend/src/agents/storyDirector.js';
import { buildStoryDirectorMessages } from '../backend/src/llm/prompts/storyDirectorPrompt.js';
import { createGame } from '../src/engine.js';

test('story director prompt sends compact context and forbids numeric authority', () => {
  const game = {
    ...createGame(31),
    onboarding: { completed: true },
    storyMemory: {
      longSummary: '顾清河在青云宗追查雾隐秘境与飞升骗局。',
      recentTurns: [{ turn: 1, title: '命火微澜', action: '继续', outcome: '命火异常。' }],
      openThreads: [{ title: '飞升骗局伏笔', detail: '飞升传闻前后矛盾。', status: '未解' }],
      characterNotes: [{ name: '林师姐', role: '内门弟子', affinity: 34, tone: '谨慎', memories: ['提醒过命火异常。'] }],
      resolvedThreads: [],
      lastUpdatedTurn: 1
    }
  };
  const messages = buildStoryDirectorMessages({ game, input: { type: 'continue' } });
  const system = messages.find((message) => message.role === 'system').content;
  const user = JSON.parse(messages.find((message) => message.role === 'user').content);

  assert.match(system, /连续剧情导演/);
  assert.match(system, /不得输出具体数值/);
  assert.match(system, /effectHints/);
  assert.match(system, /target/);
  assert.match(system, /direction/);
  assert.match(system, /intensity/);
  assert.equal(user.task, 'continuous_story_director');
  assert.equal(user.input.type, 'continue');
  assert.equal(user.context.storyMemory.longSummary.includes('飞升骗局'), true);
  assert.equal(user.context.recentTurns.length, 1);
  assert.doesNotMatch(JSON.stringify(user), /apiKey|baseUrl|prompt|debug/i);
});

test('normalizes story director output to public scene, choices, and safe effect hints', () => {
  const game = createGame(31);
  const normalized = normalizeDirectorOutput({
    scene: '你在洞府中听见雾隐钟声，命火随之忽明忽暗。',
    mode: 'choice',
    npcLines: [
      { npcId: 'lin_shijie', speaker: '林师姐', line: '你也听见钟声了？' },
      { npcId: 'unknown', speaker: '陌生仙人', line: '送你仙剑。' }
    ],
    effectHints: [
      { target: 'lifespan', direction: 'down', intensity: 'small', amount: 50 }
    ],
    choices: [
      {
        id: 'follow-bell',
        text: '循着钟声前往后山',
        tone: 'explore',
        effectHints: [{ target: 'foreshadow', direction: 'advance', intensity: 'small', topic: '雾隐秘境' }]
      },
      {
        id: 'ask-lin',
        text: '先问林师姐旧事',
        tone: 'social',
        effectHints: [{ target: 'npc_affinity', npcId: 'lin_shijie', direction: 'up', intensity: 'small' }]
      }
    ],
    memoryHints: ['雾隐钟声与命火异常有关。']
  }, game);

  assert.equal(normalized.mode, 'choice');
  assert.equal(normalized.choices.length, 2);
  assert.deepEqual(normalized.choices.map((choice) => choice.id), ['follow_bell', 'ask_lin']);
  assert.equal(normalized.npcLines.length, 1);
  assert.equal(normalized.npcLines[0].speaker, '林师姐');
  assert.deepEqual(normalized.effectHints, [
    { target: 'lifespan', direction: 'down', intensity: 'small' }
  ]);
  assert.doesNotMatch(JSON.stringify(normalized), /50|陌生仙人|送你仙剑/);
});

test('falls back to continue mode when model gives too few valid choices', () => {
  const normalized = normalizeDirectorOutput({
    scene: '你暂时压下命火波动。',
    mode: 'choice',
    choices: [{ id: 'only-one', text: '继续观察', effectHints: [] }]
  }, createGame(31));

  assert.equal(normalized.mode, 'continue');
  assert.deepEqual(normalized.choices, []);
});
