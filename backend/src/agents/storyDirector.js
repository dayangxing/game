import { normalizeEffectHints } from '../domain/director/effectHints.js';
import { buildStoryDirectorMessages } from '../llm/prompts/storyDirectorPrompt.js';

export function createStoryDirector({ llm }) {
  return {
    async invoke({ game, input }) {
      if (!llm.generateStoryDirector) return buildFallbackDirectorOutput({ game, input });
      const raw = await llm.generateStoryDirector({ game, input });
      return normalizeDirectorOutput(raw, game);
    },

    async *stream({ game, input }) {
      if (!llm.streamStoryDirector) {
        yield { type: 'director_result', data: await this.invoke({ game, input }) };
        return;
      }

      let rawText = '';
      for await (const chunk of llm.streamStoryDirector({ game, input })) {
        const text = String(chunk ?? '');
        if (!text) continue;
        rawText += text;
        yield { type: 'story_delta', data: { text } };
      }

      yield { type: 'director_result', data: normalizeDirectorOutput(JSON.parse(rawText), game) };
    }
  };
}

export function normalizeDirectorOutput(rawOutput, game) {
  const raw = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : (rawOutput ?? {});
  const rootHints = normalizeEffectHints(raw.effectHints, game);
  const requestedMode = raw.mode === 'choice' ? 'choice' : 'continue';
  const choices = requestedMode === 'choice' ? normalizeChoices(raw.choices, game).slice(0, 4) : [];
  const mode = choices.length >= 2 ? 'choice' : 'continue';

  return {
    status: 'generated',
    scene: text(raw.scene, '你静坐片刻，命火在丹田深处微微摇曳。'),
    mode,
    npcLines: normalizeNpcLines(raw.npcLines, game),
    effectHints: rootHints.accepted,
    rejectedEffectHints: rootHints.rejected,
    choices: mode === 'choice' ? choices : [],
    memoryHints: Array.isArray(raw.memoryHints)
      ? raw.memoryHints.slice(0, 4).map((item) => text(item, '')).filter(Boolean)
      : []
  };
}

export function buildFallbackDirectorOutput() {
  return {
    status: 'fallback',
    scene: '你收束心神，沿经脉缓缓运转一周天。今日并无惊变，唯有命火在灵台深处轻轻摇晃，提醒你求道之路仍受寿元所限。',
    mode: 'continue',
    npcLines: [],
    effectHints: [{ target: 'lifespan', direction: 'down', intensity: 'tiny' }],
    rejectedEffectHints: [],
    choices: [],
    memoryHints: ['命火与寿元压力仍在持续。']
  };
}

export function buildStoryDirectorRequest({ game, input }) {
  return buildStoryDirectorMessages({ game, input });
}

function normalizeChoices(choices = [], game) {
  if (!Array.isArray(choices)) return [];

  return choices.map((choice, index) => {
    const normalized = normalizeEffectHints(choice?.effectHints, game);
    return {
      id: safeChoiceId(choice?.id, index),
      text: text(choice?.text, `顺势观察第${index + 1}处异动`),
      tone: text(choice?.tone, 'mystery'),
      effectHints: normalized.accepted,
      rejectedEffectHints: normalized.rejected
    };
  }).filter((choice) => choice.text.length > 0);
}

function normalizeNpcLines(lines = [], game) {
  if (!Array.isArray(lines)) return [];
  const knownNames = new Set((game.npcs ?? []).map((npc) => npc.name));

  return lines.slice(0, 2)
    .map((line) => ({
      npcId: text(line?.npcId, ''),
      speaker: text(line?.speaker, ''),
      line: text(line?.line, '')
    }))
    .filter((line) => line.line && knownNames.has(line.speaker));
}

function safeChoiceId(value, index) {
  const id = text(value, `choice_${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return id || `choice_${index + 1}`;
}

function text(value, fallback = '') {
  const normalized = value === undefined || value === null ? '' : String(value).trim();
  return normalized || fallback;
}
