<script>
  import {
    formatAttributeCards,
    randomizeAllocation,
    updateAllocation,
    remainingAllocationPoints
  } from '$lib/characterCreation.js';
  import {
    getPendingAttributes, setPendingAttributes,
    getPendingCharacterSeed, setPendingCharacterSeed,
    getPendingCharacterPreview, refreshCharacterPreview,
    getCharacterCreationPending, createFormalGame
  } from '$lib/stores/gameStore.svelte.js';

  let { game } = $props();

  let characterName = $state('');

  const pendingAttributes = $derived(getPendingAttributes());
  const preview = $derived(getPendingCharacterPreview());
  const remaining = $derived(remainingAllocationPoints(pendingAttributes));
  const attributeCards = $derived(formatAttributeCards(pendingAttributes));
  const previewHealth = $derived(80 + pendingAttributes.rootBone * 8 + pendingAttributes.lifeSeed * 2);
  const previewLifespan = $derived(80 + pendingAttributes.lifeSeed * 8);
  const canStart = $derived(characterName.trim().length > 0 && remaining === 0);
  const characterCreationPending = $derived(getCharacterCreationPending());

  function handleAttrChange(key, delta) {
    setPendingAttributes(updateAllocation(pendingAttributes, key, delta));
  }

  function handleReroll() {
    const seed = Date.now();
    setPendingCharacterSeed(seed);
    setPendingAttributes(randomizeAllocation(seed));
    void refreshCharacterPreview();
  }

  function handleStart() {
    if (!canStart || characterCreationPending) return;
    createFormalGame({ name: characterName.trim(), attributes: pendingAttributes });
  }
</script>

<section class="character-panel">
  <div>
    <div class="panel-kicker">创建角色</div>
    <h2>命格初定</h2>
    <p>分配五维天赋，定下入门后的气血、寿元与修行走向。</p>
  </div>
  <input type="text" maxlength="12" placeholder="输入角色名" bind:value={characterName} />
  <section class="character-background-preview">
    <div class="panel-kicker">命簿预览</div>
    <div class="background-grid">
      <div><span>出身</span><strong>{preview?.origin ?? '入山门后揭晓'}</strong></div>
      <div><span>灵根</span><strong>{preview?.spiritualRoot ?? '入山门后揭晓'}</strong></div>
      <div><span>命格天赋</span><strong>{preview?.traits?.join('、') ?? '命格尚未落定'}</strong></div>
    </div>
  </section>
  <div class="allocation-summary">
    <strong>{remaining}</strong><span>剩余天赋点</span>
  </div>
  <div class="attribute-allocation">
    {#each attributeCards as card}
      {@const canLower = card.value > 1}
      {@const canRaise = remaining > 0 && card.value < 10}
      <article class="allocation-card">
        <div><strong>{card.label}</strong><p>{card.note}</p></div>
        <div class="allocation-controls">
          <button type="button" disabled={!canLower} onclick={() => handleAttrChange(card.key, -1)}>-</button>
          <span>{card.value}</span>
          <button type="button" disabled={!canRaise} onclick={() => handleAttrChange(card.key, 1)}>+</button>
        </div>
      </article>
    {/each}
  </div>
  <div class="character-roll">
    <div class="attribute-row"><span>角色名</span><strong>{characterName.trim() || '未定名'}</strong></div>
    <div class="attribute-row"><span>预计气血</span><strong>{previewHealth}</strong></div>
    <div class="attribute-row"><span>预计寿元</span><strong>{previewLifespan} 年</strong></div>
    {#each attributeCards as card}
      <div class="attribute-row"><span>{card.label}</span><strong>{card.value}</strong></div>
    {/each}
    <p>入山门后会随机写定出身、灵根、命格与随身资源，天赋分配会直接影响气血、寿元与修行底色。</p>
  </div>
  <div class="character-actions">
    <button type="button" onclick={handleReroll}>随机分配</button>
    <button type="button" disabled={!canStart || characterCreationPending} onclick={handleStart}>
      {characterCreationPending ? '进入主界面…' : '开始修行'}
    </button>
  </div>
</section>
