import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

const StoryState = Annotation.Root({
  beforeGame: Annotation(),
  afterGame: Annotation(),
  action: Annotation(),
  ruleEntry: Annotation(),
  rawNarration: Annotation(),
  validationErrors: Annotation(),
  narration: Annotation(),
  error: Annotation()
});

export function createStoryGraph({ llm }) {
  const compiled = new StateGraph(StoryState)
    .addNode('generate_narration', async (state) => {
      try {
        return {
          rawNarration: await llm.generateNarration({
            beforeGame: state.beforeGame,
            afterGame: state.afterGame,
            action: state.action,
            ruleEntry: state.ruleEntry
          }),
          error: null
        };
      } catch (error) {
        return {
          error: {
            message: error.message
          }
        };
      }
    })
    .addNode('validate_narration', (state) => ({
      validationErrors: validateNarration(state.rawNarration)
    }))
    .addNode('accept_narration', (state) => ({
      narration: normalizeGeneratedNarration(state.rawNarration, state.afterGame)
    }))
    .addNode('repair_narration', async (state) => {
      try {
        const repaired = await llm.repairNarration?.({
          validationErrors: state.validationErrors,
          rawNarration: state.rawNarration,
          afterGame: state.afterGame
        });

        if (!repaired) {
          return {
            narration: normalizeGeneratedNarration(state.rawNarration, state.afterGame)
          };
        }

        return {
          narration: normalizeGeneratedNarration(repaired, state.afterGame)
        };
      } catch (error) {
        return {
          narration: normalizeGeneratedNarration(state.rawNarration, state.afterGame),
          error: {
            message: error.message
          }
        };
      }
    })
    .addNode('llm_unavailable', (state) => ({
      narration: buildUnavailableNarration({
        afterGame: state.afterGame,
        error: state.error
      })
    }))
    .addEdge(START, 'generate_narration')
    .addConditionalEdges('generate_narration', routeAfterGenerate, {
      validate_narration: 'validate_narration',
      llm_unavailable: 'llm_unavailable'
    })
    .addConditionalEdges('validate_narration', routeAfterValidate, {
      accept_narration: 'accept_narration',
      repair_narration: 'repair_narration'
    })
    .addEdge('accept_narration', END)
    .addEdge('repair_narration', END)
    .addEdge('llm_unavailable', END)
    .compile();

  return {
    engine: 'langgraph',
    graph: compiled,
    invoke(input) {
      return compiled.invoke(input);
    }
  };
}

function routeAfterGenerate(state) {
  return state.error ? 'llm_unavailable' : 'validate_narration';
}

function routeAfterValidate(state) {
  return state.validationErrors?.length > 0 ? 'repair_narration' : 'accept_narration';
}

function validateNarration(narration) {
  const errors = [];

  if (!isMeaningfulText(narration?.title)) {
    errors.push('title is required');
  }
  if (!isMeaningfulText(narration?.body)) {
    errors.push('body is required');
  } else if (countCharacters(narration.body) < 80) {
    errors.push('body is too short for immersive narration');
  } else if (countCharacters(narration.body) > 320) {
    errors.push('body is too long for a single turn narration');
  }
  if (narration?.npcLine === undefined) {
    errors.push('npcLine is required');
  }
  if (!Array.isArray(narration?.continuityNotes)) {
    errors.push('continuityNotes must be an array');
  }
  if (!Array.isArray(narration?.safetyFlags)) {
    errors.push('safetyFlags must be an array');
  }

  return errors;
}

export function normalizeGeneratedNarration(narration, afterGame) {
  return {
    status: 'generated',
    title: requiredText(narration?.title, `第${afterGame.turn}回合`),
    body: requiredText(narration?.body, '模型已生成本回合剧情。'),
    npcLine: requiredText(narration?.npcLine, ''),
    foreshadow: requiredText(narration?.foreshadow, ''),
    continuityNotes: Array.isArray(narration?.continuityNotes) ? narration.continuityNotes : [],
    safetyFlags: Array.isArray(narration?.safetyFlags) ? narration.safetyFlags : []
  };
}

export function buildUnavailableNarration({ afterGame, error }) {
  return {
    status: 'llm_unavailable',
    title: '模型暂不可用',
    body: '本回合规则结算已保存，但剧情模型暂不可用。稍后可以基于已保存进度重新续写本回合剧情。',
    npcLine: '',
    foreshadow: afterGame.foreshadows?.at(-1) ?? '',
    retryable: true,
    savedTurn: afterGame.turn,
    error: {
      code: 'LLM_UNAVAILABLE',
      message: '剧情模型暂不可用，请稍后重试。'
    },
    detail: error?.message ?? 'unknown llm error'
  };
}

function requiredText(value, fallback) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  return text || fallback;
}

function isMeaningfulText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function countCharacters(value) {
  return String(value).replace(/\s/g, '').length;
}
