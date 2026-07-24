<script>
  import { formatAttributeCards } from '$lib/characterCreation.js';
  import { getPendingAttributes } from '$lib/stores/gameStore.svelte.js';

  let { game } = $props();

  const pendingAttributes = $derived(getPendingAttributes());
  const attributes = $derived(game.character?.attributes ?? pendingAttributes);
  const player = $derived(game.player);
  const traits = $derived((game.character?.traits ?? []).join('、') || '命格未定');
  const sect = $derived(game.sect ?? { name: '青云宗', contribution: player.sectRelation ?? 0, rank: '外门弟子' });
  const healthNow = $derived(player.health ?? player.maxHealth ?? 0);
  const healthMax = $derived(player.maxHealth ?? healthNow);
  const lifespanNow = $derived(player.lifespan ?? player.maxLifespan ?? 0);
  const lifespanMax = $derived(player.maxLifespan ?? lifespanNow);
  const npcs = $derived(game.npcs ?? []);
  const techniques = $derived(game.techniques ?? []);
</script>

<section class="paper-card personal-panel">
  <div class="personal-sheet">
    <header class="personal-sheet-header">
      <div><span>修士档案</span><h3>个人面板</h3></div>
      <strong>{player.realm}</strong>
    </header>
    <div class="personal-left">
      <section class="personal-section personal-profile-section">
        <div class="personal-portrait">{player.name.slice(0, 1)}</div>
        <div class="personal-nameplate"><span>人物</span><strong>{player.name}</strong><em>{player.origin}</em></div>
        <div class="personal-line-list">
          <div class="state-row"><span>灵根</span><strong>{player.spiritualRoot}</strong></div>
          <div class="state-row"><span>所在</span><strong>{player.location}</strong></div>
          <div class="state-row"><span>命格</span><strong>{traits}</strong></div>
        </div>
      </section>
      <section class="personal-section personal-sect-section">
        <div class="personal-section-title"><h4>宗门</h4><span>{sect.name}</span></div>
        <div class="personal-line-list">
          <div class="state-row"><span>身份</span><strong>{sect.rank}</strong></div>
          <div class="state-row"><span>声望</span><strong>{player.sectRelation ?? 0}/100</strong></div>
          <div class="state-row"><span>贡献</span><strong>{sect.contribution ?? player.sectRelation ?? 0}</strong></div>
        </div>
      </section>
    </div>
    <div class="personal-sections">
      <section class="personal-section personal-attribute-section">
        <div class="personal-section-title"><h4>五维</h4><span>天赋根基</span></div>
        <div class="personal-attribute-grid">
          {#each formatAttributeCards(attributes) as card}
            <article><span>{card.label}</span><strong>{card.value}</strong><em>{card.note}</em></article>
          {/each}
        </div>
      </section>
      <section class="personal-section personal-status-section">
        <div class="personal-section-title"><h4>状态</h4><span>实时属性</span></div>
        <div class="personal-line-list">
          <div class="state-row"><span>气血</span><strong>{healthNow}/{healthMax}</strong></div>
          <div class="state-row"><span>寿元</span><strong>{lifespanNow}/{lifespanMax}</strong></div>
          <div class="state-row"><span>灵气</span><strong>{player.qi ?? 0}</strong></div>
          <div class="state-row"><span>心境</span><strong>{player.mood ?? 0}</strong></div>
          <div class="state-row"><span>修为</span><strong>{player.cultivationProgress ?? 0}%</strong></div>
          <div class="state-row"><span>灵石</span><strong>{player.spiritStones ?? 0}</strong></div>
        </div>
      </section>
      <section class="personal-section personal-relation-section">
        <div class="personal-section-title"><h4>道友牵绊</h4><span>{npcs.length} 位</span></div>
        {#if npcs.length}
          <div class="personal-relation-list">
            {#each npcs as npc}
              <article><div><strong>{npc.name}</strong><span>{npc.role}</span></div><b>{npc.affinity}</b></article>
            {/each}
          </div>
        {:else}
          <div class="empty-collection">暂未结下新的道友牵绊。</div>
        {/if}
      </section>
      {#if techniques.length}
        <section class="personal-section personal-technique-section">
          <div class="personal-section-title"><h4>功法</h4><span>{techniques.length} 门</span></div>
          <div class="personal-technique-list">
            {#each techniques as technique}
              <article>
                <strong>{technique.name ?? technique}</strong>
                <span>{technique.badge ?? technique.grade ?? technique.type ?? '功法'}</span>
                {#if technique.description}<p>{technique.description}</p>{/if}
                {#if technique.detail}<em>{technique.detail}</em>{/if}
              </article>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  </div>
</section>
