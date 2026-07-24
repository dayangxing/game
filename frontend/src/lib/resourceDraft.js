export function renderResourceDraft(draft = {}) {
  const options = Array.isArray(draft.options) ? draft.options.slice(0, 3) : [];
  const sourceTitle = draft.sourceEventTitle ?? draft.source ?? '';
  const reason = draft.reason ?? '';

  if (!options.length) {
    return `
      <section class="paper-card resource-draft-panel resource-draft-empty">
        <div class="section-title">
          <h3>机缘候选</h3>
          <span>暂无待领取资源</span>
        </div>
        <p>当前没有待领取的功法或宝物。</p>
      </section>
    `;
  }

  return `
    <section class="paper-card resource-draft-panel">
      <div class="section-title">
        <h3>机缘候选</h3>
        <span>${escapeHtml(sourceTitle || '奇遇所得')}</span>
      </div>
      ${sourceTitle ? `<p class="resource-draft-source">来源：${escapeHtml(sourceTitle)}</p>` : ''}
      ${reason ? `<p class="resource-draft-reason">${escapeHtml(reason)}</p>` : ''}
      <div class="resource-draft-grid">
        ${options.map((resource, index) => renderResourceCard(resource, { index })).join('')}
      </div>
    </section>
  `;
}

export function renderResourceCard(resource = {}, source = {}) {
  const index = Number.isInteger(source?.index) ? source.index : resource.index;
  const actionIndex = Number.isInteger(index)
    ? ` data-resource-draft-index="${index}"`
    : '';
  const command = resource.name ? `选择${resource.name}` : '选择这件机缘';
  const tags = Array.isArray(resource.tags) ? resource.tags.filter(Boolean) : [];
  const tagText = tags.length ? tags.join(' · ') : '未明标签';
  const bonusText = resource.bonusText || '暂无额外数值加成';

  return `
    <button class="resource-draft-card" type="button" data-command="${escapeAttribute(command)}"${actionIndex}>
      <span class="draft-grade">${escapeHtml(resource.grade || '所得')}</span>
      <strong>${escapeHtml(resource.name || '未命名机缘')}</strong>
      <span class="draft-type">${escapeHtml(resource.type || '资源')}</span>
      <span class="draft-tags">${escapeHtml(tagText)}</span>
      <span class="draft-bonus">${escapeHtml(bonusText)}</span>
      ${resource.description ? `<p>${escapeHtml(resource.description)}</p>` : ''}
      ${resource.detail ? `<em>${escapeHtml(resource.detail)}</em>` : ''}
    </button>
  `;
}

export function renderResonancePanel(resonances = []) {
  const entries = Array.isArray(resonances) ? resonances.filter(Boolean) : [];

  return `
    <section class="paper-card resonance-panel">
      <div class="section-title">
        <h3>资源共鸣</h3>
        <span>${entries.length ? `${entries.length} 项激活` : '尚未激活'}</span>
      </div>
      ${entries.length ? `
        <div class="resonance-list">
          ${entries.map(renderResonanceEntry).join('')}
        </div>
      ` : '<p class="empty-collection">收集带有相同标签的功法或宝物，可激活共鸣。</p>'}
    </section>
  `;
}

export function renderResourceRunSummary({ summary = {}, metaProgress = {} } = {}) {
  const techniques = (summary.techniques ?? [])
    .map((entry) => typeof entry === 'string' ? entry : entry?.name)
    .filter(Boolean);
  const treasures = (summary.treasures ?? [])
    .map((entry) => typeof entry === 'string' ? entry : entry?.name)
    .filter(Boolean);
  const discoveredTechniques = new Set(Array.isArray(metaProgress.discoveredTechniques)
    ? metaProgress.discoveredTechniques.filter(Boolean)
    : []).size;
  const discoveredTreasures = new Set(Array.isArray(metaProgress.discoveredTreasures)
    ? metaProgress.discoveredTreasures.filter(Boolean)
    : []).size;
  const activeResources = [...techniques, ...treasures];
  const runCount = Number.isFinite(summary.runCount)
    ? summary.runCount
    : Number.isFinite(metaProgress.runCount)
      ? metaProgress.runCount
      : 0;

  return `
    <section class="resource-run-summary">
      <div class="personal-section-title">
        <h4>资源轨迹</h4>
        <span>第 ${runCount || 1} 局</span>
      </div>
      <p>${activeResources.length
        ? `本局带走：${activeResources.map((name) => escapeHtml(name)).join('、')}`
        : '本局未保留仍在身上的功法或宝物。'}</p>
      <p>永久发现：功法 ${discoveredTechniques} 门 · 宝物 ${discoveredTreasures} 件</p>
    </section>
  `;
}

function renderResonanceEntry(resonance = {}) {
  const count = Number.isFinite(resonance.count) ? resonance.count : 0;
  const next = Number.isFinite(resonance.next)
    ? resonance.next
    : Number.isFinite(resonance.nextThreshold)
      ? resonance.nextThreshold
      : Number.isFinite(resonance.nextCount)
        ? resonance.nextCount
        : null;
  const progress = next !== null && next > count
    ? `还需 ${next - count} 件`
    : next !== null
      ? '当前阈值已达成'
      : '继续收集同类资源可提升共鸣';

  return `
    <article class="resonance-entry">
      <div class="resonance-entry-head">
        <strong>${escapeHtml(resonance.name || '未明共鸣')}</strong>
        <span>${count} 件</span>
      </div>
      <p>${escapeHtml(resonance.effectText || resonance.label || '共鸣效果已生效。')}</p>
      <em>${escapeHtml(progress)}</em>
    </article>
  `;
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
