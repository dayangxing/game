import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advanceCalendarByMonths,
  calendarFromElapsedMonths,
  formatCalendarLabel,
  formatDurationLabel,
  normalizeElapsedMonths
} from '../backend/src/domain/time/calendar.js';
import { createGame } from '../src/engine.js';

test('calendar derives seasons and crosses years from elapsed months', () => {
  assert.deepEqual(calendarFromElapsedMonths(24), { year: 3, season: '春', month: 1 });
  assert.deepEqual(calendarFromElapsedMonths(26), { year: 3, season: '春', month: 3 });
  assert.deepEqual(calendarFromElapsedMonths(27), { year: 3, season: '夏', month: 4 });
  assert.deepEqual(calendarFromElapsedMonths(35), { year: 3, season: '冬', month: 12 });
  assert.deepEqual(calendarFromElapsedMonths(36), { year: 4, season: '春', month: 1 });
});

test('advanceCalendarByMonths prefers stored elapsed months and returns readable labels', () => {
  const game = { ...createGame(31), time: { elapsedMonths: 24 } };
  const advanced = advanceCalendarByMonths(game, 14);

  assert.equal(normalizeElapsedMonths(game), 24);
  assert.deepEqual(advanced, {
    elapsedMonths: 38,
    calendar: { year: 4, season: '春', month: 3 }
  });
  assert.equal(formatCalendarLabel(advanced.calendar), '玄历4年 春 第3月');
  assert.equal(formatDurationLabel(1), '一月');
  assert.equal(formatDurationLabel(6), '半年');
  assert.equal(formatDurationLabel(12), '一年');
  assert.equal(formatDurationLabel(18), '一年半');
  assert.equal(formatDurationLabel(30), '二年半');
});
