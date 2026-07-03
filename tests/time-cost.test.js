import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateActionTimeCost,
  getRealmTimeTier,
  inferActionTimeCategory
} from '../backend/src/domain/time/timeCost.js';
import { createGame } from '../src/engine.js';

function gameAtRealm(realm) {
  const base = createGame(31);
  return {
    ...base,
    onboarding: { completed: true },
    player: { ...base.player, realm }
  };
}

test('realm time tiers cover first version and reserved high realms', () => {
  assert.equal(getRealmTimeTier('炼气九层'), '炼气');
  assert.equal(getRealmTimeTier('筑基后期'), '筑基');
  assert.equal(getRealmTimeTier('金丹中期'), '金丹');
  assert.equal(getRealmTimeTier('元婴初期'), '元婴');
  assert.equal(getRealmTimeTier('化神初期'), '化神');
});

test('action category inference uses command text and source', () => {
  assert.equal(inferActionTimeCategory({ command: '闭关修炼三月' }), 'cultivation');
  assert.equal(inferActionTimeCategory({ command: '前往后山探索灵脉' }), 'explore');
  assert.equal(inferActionTimeCategory({ command: '找林师姐请教旧事' }), 'social');
  assert.equal(inferActionTimeCategory({ command: '炼制聚气丹' }), 'craft');
  assert.equal(inferActionTimeCategory({ source: 'breakthrough', command: '尝试突破' }), 'breakthrough');
  assert.equal(inferActionTimeCategory({ command: '继续' }), 'story');
});

test('time cost grows by realm and accepts vague time hints', () => {
  const qi = calculateActionTimeCost({ game: gameAtRealm('炼气七层'), command: '继续' });
  const foundation = calculateActionTimeCost({ game: gameAtRealm('筑基初期'), command: '继续' });
  const jindanCultivate = calculateActionTimeCost({
    game: gameAtRealm('金丹初期'),
    command: '闭关修炼',
    effectHints: [{ target: 'time', direction: 'up', intensity: 'small' }]
  });
  const fastExplore = calculateActionTimeCost({
    game: gameAtRealm('筑基初期'),
    command: '前往后山探索',
    effectHints: [{ target: 'time', direction: 'down', intensity: 'small' }]
  });

  assert.deepEqual(qi, { category: 'story', baseMonths: 1, modifierMonths: 0, deltaMonths: 1, label: '一月' });
  assert.equal(foundation.deltaMonths, 3);
  assert.equal(jindanCultivate.deltaMonths, 15);
  assert.equal(jindanCultivate.label, '一年三月');
  assert.equal(fastExplore.deltaMonths, 3);
});
