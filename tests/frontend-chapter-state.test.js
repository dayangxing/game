import test from 'node:test';
import assert from 'node:assert/strict';

import { formatChapterTransition, renderChapterProgress } from '../frontend/src/ui/chapterProgress.js';

test('chapter progress renders title, percentage and readable objectives', () => {
  const html = renderChapterProgress({
    id: 'qi', index: 1, title: '炼气：命火有痕', progress: 50,
    objectives: [
      { text: '将炼气修至圆满', completed: false, required: true },
      { text: '查明寿元异常的第一道痕迹', completed: true, required: true }
    ]
  });
  assert.match(html, /炼气：命火有痕/);
  assert.match(html, /50%/);
  assert.match(html, /将炼气修至圆满/);
  assert.doesNotMatch(html, /qi|lifespan_mark/);
});

test('chapter progress escapes player-facing text', () => {
  const html = renderChapterProgress({
    title: '<危险标题>',
    progress: 120,
    objectives: [{ text: '看见 <雾> & 铃', completed: false, required: true }]
  });

  assert.match(html, /危险标题/);
  assert.match(html, /看见 &lt;雾&gt; &amp; 铃/);
  assert.match(html, /100%/);
  assert.doesNotMatch(html, /<危险标题>|看见 <雾> & 铃/);
});

test('chapter transition uses titles and hides internal ids', () => {
  const text = formatChapterTransition({ fromTitle: '炼气：命火有痕', toTitle: '筑基：道基与宗门' });
  assert.equal(text, '你已完成炼气：命火有痕，新的篇章已经展开：筑基：道基与宗门。');
  assert.doesNotMatch(text, /qi|foundation/);
});
