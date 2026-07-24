<script>
  import { formatActionMeta, kindForCommand } from '$lib/utils/helpers.js';

  let { game, dailyActions, actionLoading, dailyActionPending, storyStepPending, pendingApiImmediateActions, onActionClick } = $props();

  function handleClick(action) {
    onActionClick({ detail: { action } });
  }

  const cards = $derived(dailyActions.map((action) => ({
    ...action,
    meta: formatActionMeta(action)
  })));
</script>

<section class="paper-card action-section">
  <div class="section-title">
    <h3>今日行动</h3>
    <span>{actionLoading ? '刷新中…' : `${dailyActions.length} 项可选`}</span>
  </div>
  <div class="action-grid">
    {#each cards as action}
      <button
        class="action-card {kindForCommand(action.command)}"
        type="button"
        disabled={actionLoading || dailyActionPending || storyStepPending || (pendingApiImmediateActions && action.source === 'immediate')}
        onclick={() => handleClick(action)}
      >
        <b>{action.icon}</b>
        <span>{action.title}</span>
        <strong>{action.command}</strong>
        {#if action.meta}<em>{action.meta}</em>{/if}
      </button>
    {/each}
  </div>
</section>
