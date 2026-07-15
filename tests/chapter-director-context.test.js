import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryDirectorMessages } from '../backend/src/llm/prompts/storyDirectorPrompt.js';

test('director receives chapter progress but cannot mutate chapter or ending', () => {
  const messages = buildStoryDirectorMessages({
    game: {
      turn: 20,
      chapter: {
        id: 'qi',
        index: 1,
        title: '炼气：命火有痕',
        progress: 50,
        objectives: [{ text: '将炼气修至圆满', completed: false, required: true }],
        completedObjectiveIds: ['internal-objective'],
        truthFlags: { lifespan_mark: true },
        endingId: 'internal-ending'
      },
      player: { realm: '炼气八层', lifespan: 80, maxLifespan: 120 },
      storyMemory: { recentTurns: [], openThreads: [] },
      npcs: []
    },
    input: { type: 'continue' }
  });
  const serialized = JSON.stringify(messages);
  assert.match(serialized, /炼气：命火有痕/);
  assert.match(serialized, /将炼气修至圆满/);
  assert.match(serialized, /章节/);
  assert.match(serialized, /结局/);
  assert.doesNotMatch(serialized, /completedObjectiveIds|truthFlags|endingId|internal-objective|internal-ending/);
});
