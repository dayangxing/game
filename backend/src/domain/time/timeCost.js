import { formatDurationLabel } from './calendar.js';
import { getRealmTier } from '../realmRules.js';

export const ACTION_TIME_CATEGORIES = ['story', 'cultivation', 'explore', 'social', 'craft', 'breakthrough'];

const REALM_TIME_TABLE = {
  炼气: { story: 1, cultivation: 3, explore: 2, social: 1, craft: 2, breakthrough: 6 },
  筑基: { story: 3, cultivation: 6, explore: 4, social: 2, craft: 4, breakthrough: 12 },
  金丹: { story: 6, cultivation: 12, explore: 8, social: 4, craft: 8, breakthrough: 24 },
  元婴: { story: 12, cultivation: 24, explore: 18, social: 8, craft: 18, breakthrough: 48 },
  化神: { story: 24, cultivation: 48, explore: 36, social: 12, craft: 36, breakthrough: 96 }
};

const TIME_HINT_MODIFIER = {
  tiny: 1,
  small: 3,
  medium: 6,
  high: 12,
  critical: 24
};

export function getRealmTimeTier(realm = '') {
  if (realm.includes('化神')) return '化神';
  return getRealmTier(realm);
}

export function inferActionTimeCategory({ action = {}, command = '', source = '', effectHints = [] } = {}) {
  if (source === 'breakthrough' || action.source === 'breakthrough') return 'breakthrough';

  const text = `${command || action.command || ''} ${action.title || ''}`;
  if (text.includes('突破')) return 'breakthrough';
  if (text.includes('闭关') || text.includes('修炼') || text.includes('吐纳') || text.includes('稳固')) return 'cultivation';
  if (text.includes('探索') || text.includes('前往') || text.includes('秘境') || text.includes('后山') || text.includes('远行')) return 'explore';
  if (text.includes('林师姐') || text.includes('长老') || text.includes('请教') || text.includes('拜会') || text.includes('打听')) return 'social';
  if (text.includes('炼丹') || text.includes('炼制') || text.includes('丹药') || text.includes('整理') || text.includes('法器') || text.includes('坊市')) return 'craft';
  if (effectHints.some((hint) => hint.target === 'lifespan' && hint.direction === 'up')) return 'cultivation';
  return 'story';
}

export function calculateActionTimeCost({ game = {}, action = {}, command = '', category, effectHints = [] } = {}) {
  const realmTier = getRealmTimeTier(game.player?.realm);
  const resolvedCategory = ACTION_TIME_CATEGORIES.includes(category)
    ? category
    : inferActionTimeCategory({ action, command, source: action.source, effectHints });
  const baseMonths = REALM_TIME_TABLE[realmTier]?.[resolvedCategory] ?? REALM_TIME_TABLE.炼气.story;
  const modifierMonths = calculateTimeHintModifier(effectHints);
  const deltaMonths = Math.max(1, baseMonths + modifierMonths);

  return {
    category: resolvedCategory,
    baseMonths,
    modifierMonths,
    deltaMonths,
    label: formatDurationLabel(deltaMonths)
  };
}

function calculateTimeHintModifier(effectHints = []) {
  return effectHints
    .filter((hint) => hint.target === 'time' && hint.direction !== 'stable')
    .reduce((total, hint) => {
      const value = TIME_HINT_MODIFIER[hint.intensity] ?? TIME_HINT_MODIFIER.small;
      const isReduction = ['down', 'consume', 'lose'].includes(hint.direction);
      const reduction = Math.max(1, Math.ceil(value / 3));
      return total + (isReduction ? -reduction : value);
    }, 0);
}
