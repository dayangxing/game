import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEventRepeatCount,
  getRepeatRewardMultiplier,
  hasResolvedEvent,
  normalizeEventHistory,
  recordEventResolution
} from '../backend/src/domain/events/eventHistory.js';

test('event history normalizes missing fields and preserves old cooldown-only saves', () => {
  const history = normalizeEventHistory({});
  assert.deepEqual(history, { resolved: [], repeatCounts: {}, lastResolvedTurn: {} });
  assert.equal(hasResolvedEvent({ cooldowns: { old_event: 2 } }, 'old_event'), false);
});

test('repeat reward multipliers are deterministic and bottom out at 25 percent', () => {
  assert.equal(getRepeatRewardMultiplier(0), 1);
  assert.equal(getRepeatRewardMultiplier(1), 0.5);
  assert.equal(getRepeatRewardMultiplier(2), 0.25);
  assert.equal(getRepeatRewardMultiplier(8), 0.25);
});

test('recording a resolution increments count and stores the latest turn', () => {
  const first = recordEventResolution(normalizeEventHistory(), 'side_event', 4);
  const second = recordEventResolution(first, 'side_event', 9);
  assert.equal(getEventRepeatCount({ eventHistory: second }, 'side_event'), 2);
  assert.equal(second.lastResolvedTurn.side_event, 9);
  assert.equal(hasResolvedEvent({ eventHistory: second }, 'side_event'), true);
});
