import { applyEffects } from '../events/effectResolver.js';

export const ALLOWED_EFFECT_TARGETS = [
  'lifespan',
  'health',
  'spirit',
  'cultivation',
  'rootBone',
  'comprehension',
  'fortune',
  'willpower',
  'lifeSeed',
  'mind',
  'time',
  'fate',
  'npc_affinity',
  'item',
  'technique',
  'foreshadow',
  'sect_reputation',
  'injury',
  'karma'
];

export const ALLOWED_EFFECT_DIRECTIONS = [
  'up',
  'down',
  'advance',
  'reveal',
  'consume',
  'gain',
  'lose',
  'stable'
];

export const ALLOWED_EFFECT_INTENSITIES = [
  'tiny',
  'small',
  'medium',
  'high',
  'critical'
];

const ATTRIBUTE_TARGETS = new Set(['rootBone', 'comprehension', 'fortune', 'willpower', 'lifeSeed']);
const TARGETS = new Set(ALLOWED_EFFECT_TARGETS);
const DIRECTIONS = new Set(ALLOWED_EFFECT_DIRECTIONS);
const INTENSITIES = new Set(ALLOWED_EFFECT_INTENSITIES);

const BASE_BY_INTENSITY = {
  tiny: 1,
  small: 3,
  medium: 6,
  high: 11,
  critical: 16
};

const PLAYER_STAT_TARGETS = {
  spirit: 'player.qi',
  cultivation: 'player.cultivationProgress',
  mind: 'player.mood',
  sect_reputation: 'player.sectRelation'
};

const SUMMARY_LABELS = {
  lifespan: '寿元',
  health: '气血',
  spirit: '灵力',
  cultivation: '修行',
  rootBone: '根骨',
  comprehension: '悟性',
  fortune: '气运',
  willpower: '心性',
  lifeSeed: '命元',
  mind: '心境',
  time: '时间',
  fate: '命途',
  npc_affinity: '林师姐',
  foreshadow: '伏笔',
  sect_reputation: '宗门声望',
  injury: '伤势',
  karma: '因果',
  item: '物品',
  technique: '功法',
};

export function normalizeEffectHints(effectHints = [], game = {}) {
  const accepted = [];
  const rejected = [];

  if (!Array.isArray(effectHints)) {
    return { accepted, rejected: [{ reason: 'not_array' }] };
  }

  for (const rawHint of effectHints) {
    const target = String(rawHint?.target ?? '').trim();
    if (!TARGETS.has(target)) {
      rejected.push({ target, reason: 'unknown_target' });
      continue;
    }

    const direction = DIRECTIONS.has(rawHint?.direction) ? rawHint.direction : 'stable';
    let intensity = INTENSITIES.has(rawHint?.intensity) ? rawHint.intensity : 'small';

    if (ATTRIBUTE_TARGETS.has(target) && intensity !== 'tiny') {
      intensity = hasAttributeStoryAuthorization(rawHint, game) ? 'small' : 'small';
    }

    if (intensity === 'critical' && !hasCriticalStoryAuthorization(rawHint, game)) {
      intensity = 'high';
    }

    const normalized = { target, direction, intensity };
    if (target === 'npc_affinity' && typeof rawHint?.npcId === 'string') normalized.npcId = rawHint.npcId;
    if (target === 'foreshadow' && typeof rawHint?.topic === 'string') normalized.topic = rawHint.topic.slice(0, 24);
    if ((target === 'item' || target === 'technique') && typeof rawHint?.id === 'string') normalized.id = rawHint.id;

    accepted.push(normalized);
  }

  return { accepted, rejected };
}

export function resolveDirectorEffectHints({ game, effectHints = [], now = new Date() }) {
  const normalized = normalizeEffectHints(effectHints, game);
  const effects = normalized.accepted
    .map((hint) => hintToRuleEffect(game, hint))
    .filter(Boolean);
  const nextGame = applyEffects(game, effects);

  return {
    game: nextGame,
    summary: summarizeEffects(normalized.accepted),
    accepted: normalized.accepted,
    appliedEffects: effects,
    rejected: normalized.rejected,
    resolvedAt: now.toISOString()
  };
}

function hintToRuleEffect(game, hint) {
  if (hint.target === 'time' || hint.target === 'lifespan') return null;

  const magnitude = signedMagnitude(game, hint);

  if (magnitude === 0 && !['foreshadow'].includes(hint.target)) return null;
  if (hint.target === 'health') return { type: 'vitality', delta: magnitude };
  if (hint.target === 'karma') return { type: 'karma', delta: magnitude };
  if (hint.target === 'npc_affinity' && hint.npcId) return { type: 'relation', npcId: hint.npcId, delta: magnitude };
  if (PLAYER_STAT_TARGETS[hint.target]) return { type: 'stat', path: PLAYER_STAT_TARGETS[hint.target], delta: magnitude };
  if (ATTRIBUTE_TARGETS.has(hint.target)) return { type: 'attribute', key: hint.target, delta: Math.sign(magnitude) || 0 };
  if (hint.target === 'foreshadow' && (hint.direction === 'advance' || hint.direction === 'reveal')) {
    return { type: 'futureEvent', id: normalizeForeshadowFlag(hint.topic) };
  }

  return null;
}

function signedMagnitude(game, hint) {
  if (hint.direction === 'stable') return 0;

  const base = BASE_BY_INTENSITY[hint.intensity] ?? BASE_BY_INTENSITY.small;
  const directionSign = ['down', 'consume', 'lose'].includes(hint.direction) ? -1 : 1;
  const attributes = game.character?.attributes ?? {};
  const adjusted = applyAttributeAdjustment(base, hint.target, directionSign, attributes);
  return directionSign * Math.max(1, Math.round(adjusted));
}

function applyAttributeAdjustment(base, target, directionSign, attributes) {
  if (directionSign < 0 && target === 'lifespan') {
    return Math.max(1, base - Math.floor((attributes.lifeSeed ?? 1) / 3));
  }
  if (directionSign < 0 && target === 'health') {
    return Math.max(1, base - Math.floor((attributes.rootBone ?? 1) / 3));
  }
  if (directionSign > 0 && target === 'cultivation') {
    return base + Math.floor((attributes.comprehension ?? 1) / 4);
  }
  if (directionSign > 0 && target === 'spirit') {
    return base + Math.floor((attributes.comprehension ?? 1) / 5);
  }
  return base;
}

function normalizeForeshadowFlag(topic = 'story_thread') {
  const text = String(topic || 'story_thread');
  if (text.includes('飞升')) return 'director_ascension_thread';
  if (text.includes('雾隐')) return 'director_mist_thread';
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `director_${slug || 'story_thread'}`;
}

function summarizeEffects(hints) {
  const parts = hints
    .filter((hint) => hint.direction !== 'stable')
    .map((hint) => SUMMARY_LABELS[hint.target] ?? hint.target);
  return parts.length ? `${[...new Set(parts)].join('、')}发生变化。` : '气机平稳，没有明显变化。';
}

function hasCriticalStoryAuthorization(rawHint, game) {
  return Boolean(rawHint?.storyAuthorized === true || game?.flags?.critical_story_authorized);
}

function hasAttributeStoryAuthorization(rawHint, game) {
  return Boolean(rawHint?.storyAuthorized === true || game?.flags?.attribute_story_authorized);
}
