export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeAttribute(value) {
  return escapeHtml(value);
}

export function formatDate(calendar) {
  return `玄历${calendar.year}年 ${calendar.season} 第${calendar.month}月`;
}

export function formatTopTimeLabel(game) {
  const calendar = game?.calendar ?? { year: 3, season: '春', month: 1 };
  const calendarLabel = game?.timePressure?.calendarLabel || formatDate(calendar);
  const lifespanNow = game?.player?.lifespan ?? game?.player?.maxLifespan ?? 0;
  const lifespanMax = game?.player?.maxLifespan ?? lifespanNow;
  return `${calendarLabel} | 余寿 ${lifespanNow}年 / 大限 ${lifespanMax}年`;
}

export function kindForCommand(command) {
  if (command.includes('炼丹') || command.includes('丹') || command.includes('药')) return 'alchemy';
  if (command.includes('挑战') || command.includes('斗法') || command.includes('斩妖')) return 'combat';
  if (command.includes('林师姐') || command.includes('长老') || command.includes('打听') || command.includes('请教')) return 'social';
  if (command.includes('修炼') || command.includes('闭关') || command.includes('突破') || command.includes('稳固')) return 'cultivate';
  return 'explore';
}

export function formatActionMeta(action = {}) {
  const titleMeta = String(action.meta ?? '')
    .split('/')
    .map((part) => part.trim())
    .find((part) => part && !['low', 'medium', 'high'].includes(part.toLowerCase())) ?? '';
  const cadenceMeta = action.cadence === 'mainline' ? '主线' : action.cadence === 'side' ? '支线' : '';
  const riskMeta = {
    low: '平稳',
    medium: '谨慎',
    high: '凶险'
  }[String(action.risk ?? '').toLowerCase()] ?? '';
  return [titleMeta, cadenceMeta, riskMeta].filter(Boolean).join(' · ') || '今日抉择';
}

export function formatTimePressureSummary(game) {
  const tp = game?.timePressure ?? {};
  if (game?.ending) return game.ending.body;
  const parts = [];
  const level = tp.warningLevel ?? 'steady';
  if (tp.lastDeltaTime) parts.push(`本回合历时${tp.lastDeltaTime}。`);
  const textByLevel = {
    steady: '命火尚盛，仍有余地布局。',
    strained: '命火渐弱，行事务必克制。',
    danger: '大限逼近，需尽快破局。',
    critical: '命火将熄，每一步都在折损余寿。',
    ended: '命火已尽。'
  };
  parts.push(textByLevel[level] ?? textByLevel.steady);
  return parts.join('');
}

export function summarizeCultivationFocus(game) {
  const progress = game?.player?.cultivationProgress ?? 0;
  if (progress >= 80) return '瓶颈已现松动，持续闭关或可一击破开。';
  if (progress >= 50) return '修行稳步推进，可考虑闭关或服药加速。';
  if (progress >= 20) return '修为尚浅，需积累底蕴。';
  return '刚刚踏上修行路，先稳固根基。';
}

export function buildSuggestionText(game) {
  const suggestions = game?.suggestions ?? [];
  return suggestions.length ? suggestions.slice(0, 2).join('；') : '随心而动，天机自有安排。';
}

export function inferChapterTransition(previousChapter, nextChapter) {
  if (!previousChapter || !nextChapter) return null;
  if (previousChapter.id === nextChapter.id) return null;
  return `从「${previousChapter.title ?? '序章'}」步入「${nextChapter.title ?? '新篇章'}」`;
}

export function shouldUseContinuousStory(game) {
  return game?.storyProgress?.status === 'active';
}

export function normalizeStoryChoices(choices = []) {
  if (!Array.isArray(choices)) return [];
  return choices
    .map((choice) => ({
      id: String(choice?.id ?? ''),
      text: String(choice?.text ?? '').trim()
    }))
    .filter((choice) => choice.id && choice.text);
}

export function buildStoryChoiceActions(choices = []) {
  const normalized = normalizeStoryChoices(choices);
  if (!normalized.length) {
    return [{
      id: 'story-continue',
      title: '下一步',
      icon: '续',
      command: '继续推演命途',
      meta: '连续剧情',
      source: 'story-continue',
      storyHook: '连续剧情尚未出现新的分岔，继续推演命途。'
    }];
  }

  return normalized.map((choice, index) => ({
    id: choice.id,
    title: `抉择 ${index + 1}`,
    icon: '择',
    command: choice.text,
    meta: '剧情分支',
    source: 'story-choice',
    storyHook: `剧情分支：${choice.text}`
  }));
}
