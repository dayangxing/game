export function renderChapterProgress(chapter) {
  if (!chapter) return '';

  const progress = Math.max(0, Math.min(100, Number(chapter.progress) || 0));
  const objectives = (chapter.objectives ?? []).map((objective) => `
    <li class="chapter-objective ${objective.completed ? 'is-complete' : ''}">
      <span aria-hidden="true">${objective.completed ? '✓' : '○'}</span>
      <span>${escapeHtml(objective.text)}</span>
    </li>
  `).join('');

  return `<section class="paper-card chapter-progress-panel"><div class="section-title"><h3>${escapeHtml(chapter.title)}</h3><span>主线进度 ${progress}%</span></div><div class="chapter-progress-bar"><i style="width:${progress}%"></i></div><ul class="chapter-objective-list">${objectives}</ul></section>`;
}

export function formatChapterTransition(transition) {
  if (!transition) return '';
  return `你已完成${transition.fromTitle ?? '上一章'}，新的篇章已经展开：${transition.toTitle ?? '新的篇章'}。`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
