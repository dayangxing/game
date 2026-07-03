const BASE_BY_INTENSITY = {
  tiny: 1,
  small: 3,
  medium: 6,
  high: 11,
  critical: 16
};

const BREAKTHROUGH_REWARDS = [
  { from: '炼气九层', to: '筑基初期', gain: 25, max: 40 },
  { from: '筑基后期', to: '金丹初期', gain: 65, max: 100 },
  { from: '金丹后期', to: '元婴初期', gain: 150, max: 210 },
  { from: '元婴后期', to: '化神初期', gain: 300, max: 430 }
];

export function calculateLongevityChange({
  game = {},
  category = 'story',
  effectHints = [],
  source = '',
  breakthrough
} = {}) {
  if (breakthrough) {
    return {
      ...calculateBreakthroughLongevityReward(breakthrough),
      recoveryFatigue: 0,
      recoverySource: 'breakthrough',
      note: breakthrough.success ? '突破洗练，寿元重燃。' : ''
    };
  }

  const positiveHints = effectHints.filter((hint) => (
    hint.target === 'lifespan' && ['up', 'gain'].includes(hint.direction)
  ));
  if (!positiveHints.length) {
    return {
      longevityGain: 0,
      maxLifespanDelta: 0,
      recoveryFatigue: 0,
      recoverySource: '',
      note: ''
    };
  }

  const recoverySource = source === 'medicine' || positiveHints.some((hint) => hint.id?.includes('pill'))
    ? 'medicine'
    : 'rest';
  const fatigue = recoverySource === 'rest' ? Math.max(0, game.longevity?.recoveryFatigue ?? 0) : 0;
  const resistance = recoverySource === 'medicine'
    ? Math.max(0, Object.values(game.longevity?.medicineResistance ?? {}).reduce((sum, value) => sum + value, 0))
    : 0;
  const rawGain = positiveHints.reduce((sum, hint) => (
    sum + (BASE_BY_INTENSITY[hint.intensity] ?? BASE_BY_INTENSITY.small)
  ), 0);
  const lifeSeedBonus = Math.floor((game.character?.attributes?.lifeSeed ?? 1) / 4);
  const penalty = fatigue * 2 + resistance * 2;
  const longevityGain = Math.max(0, rawGain + lifeSeedBonus - penalty);

  return {
    longevityGain,
    maxLifespanDelta: 0,
    recoveryFatigue: recoverySource === 'rest' ? fatigue + 1 : fatigue,
    recoverySource,
    note: fatigue > 0 ? '久守洞府，调养收益降低。' : category === 'cultivation' ? '命火回稳。' : '药力入脉，命火稍定。'
  };
}

export function applyLongevityState(game = {}, result = {}) {
  const previous = game.longevity ?? {};
  const medicineResistance = { ...(previous.medicineResistance ?? {}) };

  if (result.recoverySource === 'medicine') {
    medicineResistance.longevity_pill = (medicineResistance.longevity_pill ?? 0) + 1;
  }

  return {
    ...game,
    longevity: {
      ...previous,
      recoveryFatigue: result.recoverySource === 'rest' ? result.recoveryFatigue : 0,
      medicineResistance
    }
  };
}

export function calculateBreakthroughLongevityReward({ fromRealm = '', targetRealm = '', success = false } = {}) {
  if (!success) return { longevityGain: 0, maxLifespanDelta: 0 };

  const major = BREAKTHROUGH_REWARDS.find((reward) => (
    reward.from === fromRealm && reward.to === targetRealm
  ));
  if (major) return { longevityGain: major.gain, maxLifespanDelta: major.max };
  return { longevityGain: 2, maxLifespanDelta: 1 };
}
