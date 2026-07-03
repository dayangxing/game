const START_YEAR = 1;
const MONTHS_PER_YEAR = 12;

const SEASONS = [
  { name: '春', start: 1, end: 3 },
  { name: '夏', start: 4, end: 6 },
  { name: '秋', start: 7, end: 9 },
  { name: '冬', start: 10, end: 12 }
];

export function normalizeElapsedMonths(game = {}) {
  if (Number.isFinite(game.time?.elapsedMonths)) {
    return Math.max(0, Math.floor(game.time.elapsedMonths));
  }

  const calendar = game.calendar ?? {};
  const year = Number.isFinite(calendar.year) ? calendar.year : START_YEAR;
  const month = Number.isFinite(calendar.month) ? calendar.month : 1;

  return Math.max(0, (year - START_YEAR) * MONTHS_PER_YEAR + (month - 1));
}

export function calendarFromElapsedMonths(elapsedMonths = 0) {
  const safeMonths = Math.max(0, Math.floor(elapsedMonths));
  const year = START_YEAR + Math.floor(safeMonths / MONTHS_PER_YEAR);
  const month = (safeMonths % MONTHS_PER_YEAR) + 1;

  return {
    year,
    season: SEASONS.find((season) => month >= season.start && month <= season.end)?.name ?? '春',
    month
  };
}

export function advanceCalendarByMonths(game = {}, deltaMonths = 0) {
  const elapsedMonths = normalizeElapsedMonths(game) + Math.max(0, Math.floor(deltaMonths));

  return {
    elapsedMonths,
    calendar: calendarFromElapsedMonths(elapsedMonths)
  };
}

export function formatCalendarLabel(calendar = {}) {
  return `玄历${calendar.year ?? START_YEAR}年 ${calendar.season ?? '春'} 第${calendar.month ?? 1}月`;
}

export function formatDurationLabel(deltaMonths = 0) {
  const months = Math.max(0, Math.floor(deltaMonths));
  if (months <= 0) return '片刻';
  if (months === 1) return '一月';
  if (months === 3) return '三月';
  if (months === 6) return '半年';

  const years = Math.floor(months / MONTHS_PER_YEAR);
  const rest = months % MONTHS_PER_YEAR;
  if (years === 0) return `${toChineseNumber(months)}月`;
  if (rest === 0) return `${toChineseNumber(years)}年`;
  if (rest === 6) return `${toChineseNumber(years)}年半`;
  return `${toChineseNumber(years)}年${toChineseNumber(rest)}月`;
}

function toChineseNumber(value) {
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  if (value <= 10) return digits[value] ?? String(value);
  if (value < 20) return `十${digits[value - 10]}`;
  return String(value);
}
