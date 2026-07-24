<script>
  let { game } = $props();

  const inventory = $derived(game.inventory ?? {});
  const pills = $derived(Object.entries(inventory.pills ?? {}));
  const materials = $derived(Object.entries(inventory.materials ?? {}));
  const items = $derived([
    ...pills.map(([name, count]) => ({ name, badge: `丹药 x${count}`, description: `贴身所藏 ${name}，可在关键时刻调养经脉或稳住气机。` })),
    ...materials.map(([name, count]) => ({ name, badge: `材料 x${count}`, description: `${name} 已整理入囊，可用于炼丹、交易或入秘境前备物。` }))
  ]);
</script>

<section class="paper-card collection-section">
  <div class="section-title">
    <h3>丹药与材料</h3>
    <span>{items.length} 类存货</span>
  </div>
  {#if items.length}
    <div class="collection-grid">
      {#each items as item}
        <article class="collection-card">
          <div class="collection-card-head">
            <strong>{item.name}</strong>
            <span>{item.badge}</span>
          </div>
          <p>{item.description}</p>
        </article>
      {/each}
    </div>
  {:else}
    <p class="empty-collection">行囊里仍空空如也。</p>
  {/if}
</section>
