<script>
  import { onMount } from 'svelte';
  import { showToast, saveGame } from '$lib/stores/gameStore.svelte.js';

  let { visibleViews, activeViewId, game, isDesktop, onViewChange, onModeChange, onShowGuide, onShowModelConfig, onExport, onReset, onRandom } = $props();

  let menuOpen = $state(false);
  let compactMenu = $state(false);
  let menuNode;

  function toggleMenu() { menuOpen = !menuOpen; }
  function closeMenu() { menuOpen = false; }

  const isApiMode = $derived(game?.mode === 'api');

  function handleModeClick(mode) {
    onModeChange(mode);
  }

  function handleSave() {
    saveGame();
    showToast('存档已保存');
    closeMenu();
  }

  onMount(() => {
    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 900px)')
      : null;
    const syncMenuMode = () => {
      compactMenu = Boolean(media?.matches);
      if (!compactMenu) closeMenu();
    };
    const handleOutsideClick = (event) => {
      if (menuOpen && menuNode && !menuNode.contains(event.target)) closeMenu();
    };
    const handleKeydown = (event) => {
      if (event.key === 'Escape') closeMenu();
    };

    syncMenuMode();
    media?.addEventListener?.('change', syncMenuMode);
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeydown);
    return () => {
      media?.removeEventListener?.('change', syncMenuMode);
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<header class="topbar">
  <div class="brand">
    <div class="seal">道</div>
    <div><span>AI 文字修仙</span><h1>问道浮生</h1></div>
  </div>

  <nav class="top-tabs" aria-label="主导航">
    {#each visibleViews as view}
      <button class:active={activeViewId === view.id} type="button" data-view={view.id}
        onclick={() => onViewChange(view.id)}>
        {view.label}
      </button>
    {/each}
  </nav>

  <div class="top-actions">
    <div class="mode-toggle">
      <button class="mode-option" class:active={!isApiMode} type="button" onclick={() => handleModeClick('mock')}>本地</button>
      <button class="mode-option" class:active={isApiMode} type="button" onclick={() => handleModeClick('api')}>云端</button>
    </div>
    <div class="utility-menu" class:is-open={menuOpen} bind:this={menuNode}>
      <button class="utility-menu-toggle" type="button" aria-controls="utilityMenuPanel" aria-expanded={compactMenu ? menuOpen : true} onclick={toggleMenu}>菜单</button>
      <div id="utilityMenuPanel" class="utility-menu-panel" aria-hidden={compactMenu && !menuOpen}>
        <button type="button" onclick={() => { onShowGuide(); closeMenu(); }}>指引</button>
        <button type="button" onclick={handleSave}>存档</button>
        <button type="button" onclick={() => { onExport(); closeMenu(); }}>传记</button>
        <button type="button" onclick={() => { onShowModelConfig(); closeMenu(); }}>模型配置</button>
        <div class="utility-menu-divider" role="separator"></div>
        <button class="is-danger" type="button" onclick={() => { onReset(); closeMenu(); }}>重开</button>
        <button type="button" onclick={() => { onRandom(); closeMenu(); }}>随机</button>
      </div>
    </div>
  </div>
</header>
