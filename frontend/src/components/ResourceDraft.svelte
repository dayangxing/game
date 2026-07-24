<script>
  import { submitDailyAction } from '$lib/stores/gameStore.svelte.js';

  let { game } = $props();

  const draft = $derived(game.resourceRun?.pendingDraft);
  const options = $derived(Array.isArray(draft?.options) ? draft.options.slice(0, 3) : []);
  const sourceTitle = $derived(draft?.sourceEventTitle ?? draft?.source ?? '');
  const reason = $derived(draft?.reason ?? '');

  function handleDraftClick(resource) {
    const command = resource.name ? `选择${resource.name}` : '选择这件机缘';
    submitDailyAction({
      id: resource.actionId,
      command,
      title: resource.name,
      source: 'resourceDraft',
      category: 'resource'
    });
  }
</script>

{#if options.length > 0}
  <section class="paper-card resource-draft-panel">
    <div class="section-title"><h3>机缘候选</h3><span>{sourceTitle || '奇遇所得'}</span></div>
    {#if sourceTitle}<p class="resource-draft-source">来源：{sourceTitle}</p>{/if}
    {#if reason}<p class="resource-draft-reason">{reason}</p>{/if}
    <div class="resource-draft-grid">
      {#each options as resource}
        <button class="resource-draft-card" type="button" onclick={() => handleDraftClick(resource)}>
          <span class="draft-grade">{resource.grade || '所得'}</span>
          <strong>{resource.name || '未命名机缘'}</strong>
          <span class="draft-type">{resource.type || '资源'}</span>
          <span class="draft-tags">{(resource.tags ?? []).filter(Boolean).join(' · ') || '未明标签'}</span>
          <span class="draft-bonus">{resource.bonusText || '暂无额外数值加成'}</span>
          {#if resource.description}<p>{resource.description}</p>{/if}
          {#if resource.detail}<em>{resource.detail}</em>{/if}
        </button>
      {/each}
    </div>
  </section>
{:else if draft}
  <section class="paper-card resource-draft-panel resource-draft-empty">
    <div class="section-title"><h3>机缘候选</h3><span>暂无待领取资源</span></div>
    <p>当前没有待领取的功法或宝物。</p>
  </section>
{/if}
