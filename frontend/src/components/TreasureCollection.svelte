<script>
  import { escapeHtml } from '$lib/utils/helpers.js';

  let { game } = $props();

  const treasures = $derived(game.treasures ?? []);
</script>

<section class="paper-card collection-section">
  <div class="section-title">
    <h3>法宝收藏</h3>
    <span>{treasures.length} 件</span>
  </div>
  {#if treasures.length}
    <div class="collection-grid">
      {#each treasures as treasure}
        <article class="collection-card">
          <div class="collection-card-head">
            <strong>{treasure.name ?? treasure}</strong>
            <span>{treasure.grade ?? '所得'}</span>
          </div>
          {#if treasure.description}<p>{treasure.description}</p>{/if}
          {#if treasure.detail}<em>{treasure.detail}</em>{/if}
        </article>
      {/each}
    </div>
  {:else}
    <p class="empty-collection">尚未收集到法宝。</p>
  {/if}
</section>
