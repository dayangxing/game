<script>
  import { formatAttributeCards } from '$lib/characterCreation.js';
  import { formatTimePressureSummary } from '$lib/utils/helpers.js';
  import { getPendingAttributes } from '$lib/stores/gameStore.svelte.js';

  let { game } = $props();

  const pendingAttributes = $derived(getPendingAttributes());
  const attributes = $derived(game.character?.attributes ?? pendingAttributes);

  const statusCards = $derived([
    { label: '气血', value: `${game.player.health ?? 0}/${game.player.maxHealth ?? game.player.health ?? 0}`, percent: Math.round(((game.player.health ?? 0) / Math.max(1, game.player.maxHealth ?? 100)) * 100), tone: 'health', note: (game.player.health ?? 0) <= Math.floor((game.player.maxHealth ?? 0) * 0.4) ? '内息紊乱，宜先调养。' : '经脉尚稳，可继续推进。' },
    { label: '寿元', value: `${game.player.lifespan ?? 0}/${game.player.maxLifespan ?? game.player.lifespan ?? 0}`, percent: Math.round(((game.player.lifespan ?? 0) / Math.max(1, game.player.maxLifespan ?? 100)) * 100), tone: 'lifespan', note: formatTimePressureSummary(game) },
    { label: '境界', value: game.player.realm, percent: Math.min(100, game.player.cultivationProgress ?? 0), tone: 'realm', note: `当前破境进度 ${game.player.cultivationProgress ?? 0}%` },
    { label: '宗门声望', value: `${game.player.sectRelation ?? 0}/100`, percent: Math.min(100, game.player.sectRelation ?? 0), tone: 'sect', note: `所在 ${game.player.location ?? '未知'}` }
  ]);
</script>

<section class="paper-card stage-status">
  <div class="section-title"><h3>命途状态</h3><span>当前气象</span></div>
  <div class="status-overview">
    {#each statusCards as card}
      <article class="status-card">
        <div class="status-card-head"><span>{card.label}</span><strong>{card.value}</strong></div>
        <div class="bar {card.tone}"><i style="width:{card.percent}%"></i></div>
        {#if card.note}<p>{card.note}</p>{/if}
      </article>
    {/each}
  </div>
  <div class="attribute-summary">
    {#each formatAttributeCards(attributes) as card}
      <article class="summary-card"><span>{card.label}</span><strong>{card.value}</strong><p>{card.note}</p></article>
    {/each}
  </div>
</section>
