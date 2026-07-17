import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderResourceCard,
  renderResourceDraft,
  renderResourceRunSummary,
  renderResonancePanel
} from '../frontend/src/ui/resourceDraft.js';

test('resource draft renders source context and three player-facing cards', () => {
  const html = renderResourceDraft({
    reason: '你在雾灯下找到三件可以带走的遗物。',
    options: [
      { actionId: 'opaque-a', name: '雾隐步', grade: '良品', type: '身法', tags: ['雾隐'], bonusText: '突破 +2' },
      { actionId: 'opaque-b', name: '静心莲香', grade: '良品', type: '香', tags: ['养元'], bonusText: '突破 +3' },
      { actionId: 'opaque-c', name: '青铜铃片', grade: '上品', type: '法器', tags: ['雾隐'], bonusText: '失败损失减免' }
    ]
  });
  assert.match(html, /雾灯下找到/);
  assert.equal((html.match(/resource-draft-card/g) ?? []).length, 3);
  assert.doesNotMatch(html, /opaque-a/);
});

test('resonance panel explains active threshold and next threshold', () => {
  const html = renderResonancePanel([{ name: '养元共鸣', count: 2, next: 3, effectText: '寿元上限 +4' }]);
  assert.match(html, /养元共鸣/);
  assert.match(html, /还需 1 件/);
});

test('terminal resource summary uses the finalized current-run snapshot', () => {
  const html = renderResourceRunSummary({
    summary: {
      runCount: 1,
      techniques: [{ name: '太虚心镜' }],
      treasures: [{ name: '雾隐披风' }]
    },
    metaProgress: {
      discoveredTechniques: ['taixu_heart_mirror'],
      discoveredTreasures: ['mist_veil']
    }
  });

  assert.match(html, /第 1 局/);
  assert.match(html, /太虚心镜/);
  assert.match(html, /雾隐披风/);
  assert.match(html, /永久发现：功法 1 门 · 宝物 1 件/);
});
