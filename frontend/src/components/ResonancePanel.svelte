<script>
  import { escapeHtml } from '$lib/utils/helpers.js';

  let { resonances = [] } = $props();

  const entries = $derived(Array.isArray(resonances) ? resonances.filter(Boolean) : []);
</script>

<section class="paper-card resonance-panel">
  <div class="section-title">
    <h3>资源共鸣</h3>
    <span>{entries.length ? `${entries.length} 项激活` : '尚未激活'}</span>
  </div>
  {#if entries.length}
    <div class="resonance-list">
      {#each entries as resonance}
        {@const count = Number.isFinite(resonance.count) ? resonance.count : 0}
        {@const next = Number.isFinite(resonance.next) ? resonance.next : null}
        <article class="resonance-entry">
          <div class="resonance-entry-head">
            <strong>{resonance.name || '未明共鸣'}</strong>
            <span>{count} 件</span>
          </div>
          <p>{resonance.effectText || resonance.label || '共鸣效果已生效。'}</p>
          <em>{next !== null && next > count ? `还需 ${next - count} 件` : next !== null ? '当前阈值已达成' : '继续收集同类资源可提升共鸣'}</em>
        </article>
      {/each}
    </div>
  {:else}
    <p class="empty-collection">收集带有相同标签的功法或宝物，可激活共鸣。</p>
  {/if}
</section>
