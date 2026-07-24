<script>
  import { onMount } from 'svelte';
  import {
    initializeApp, getGame, getActiveViewId, setActiveViewId,
    visibleViews, getStartupNotice, getShowGuide, setShowGuide,
    getShowModelConfig, setShowModelConfig, getToast, showToast,
    setMode, resetGame, exportStory, saveGame,
    handleGuideNext, handleGuideSkip,
    getModelConfig, saveModelConfigAction, clearModelConfigAction, skipModelConfigAction,
    submitRandomAction, shouldShowCharacterCreation,
    layout, isDesktop, getInitialized
  } from '$lib/stores/gameStore.svelte.js';
  import TopBar from './components/TopBar.svelte';
  import Dashboard from './components/Dashboard.svelte';
  import OnboardingPanel from './components/OnboardingPanel.svelte';
  import CharacterCreation from './components/CharacterCreation.svelte';
  import GuideOverlay from './components/GuideOverlay.svelte';
  import ModelConfigOverlay from './components/ModelConfigOverlay.svelte';
  import Toast from './components/Toast.svelte';

  onMount(async () => {
    await initializeApp();
  });

  const initialized = $derived(getInitialized());
  const game = $derived(getGame());
  const activeViewId = $derived(getActiveViewId());
  const showGuide = $derived(getShowGuide());
  const showModelConfig = $derived(getShowModelConfig());
  const toast = $derived(getToast());
  const startupNotice = $derived(getStartupNotice());

  const needsOnboarding = $derived(game?.onboarding && !game.onboarding.completed);
  const needsCharacter = $derived(!needsOnboarding && game && shouldShowCharacterCreation(game));
  const showDashboard = $derived(!needsOnboarding && !needsCharacter && !!game);

  $effect(() => {
    if (startupNotice) showToast(startupNotice);
  });

  function handleViewChange(viewId) {
    setActiveViewId(viewId);
  }

  function handleModeChange(mode) {
    setMode(mode);
  }
</script>

{#if !initialized}
  <div class="loading-screen">
    <div class="seal large">道</div>
    <p>问道浮生 · 载入中</p>
  </div>
{:else}
  <div class="app" data-layout={layout.id}>
    {#if game}
      <TopBar
        {visibleViews}
        {activeViewId}
        {game}
        {isDesktop}
        onViewChange={handleViewChange}
        onModeChange={handleModeChange}
        onShowGuide={() => setShowGuide(true)}
        onShowModelConfig={() => setShowModelConfig(true)}
        onExport={exportStory}
        onReset={resetGame}
        onRandom={submitRandomAction}
      />
    {/if}

    <main class="layout">
      <section class="main-stage">
        {#if needsOnboarding}
          <OnboardingPanel {game} />
        {:else if needsCharacter}
          <CharacterCreation {game} />
        {:else if showDashboard}
          <Dashboard {game} {activeViewId} {visibleViews} />
        {/if}
      </section>
    </main>
  </div>
{/if}

{#if showGuide}
  <GuideOverlay
    onGuideNext={handleGuideNext}
    onGuideSkip={handleGuideSkip}
  />
{/if}

{#if showModelConfig}
  <ModelConfigOverlay
    modelConfig={getModelConfig()}
    {isDesktop}
    onSave={saveModelConfigAction}
    onClear={clearModelConfigAction}
    onClose={skipModelConfigAction}
  />
{/if}

{#if toast.visible}
  <Toast message={toast.message} />
{/if}

<style>
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    color: var(--text);
    gap: 1rem;
  }
  .seal.large {
    width: 80px;
    height: 80px;
    font-size: 2rem;
  }
  .loading-screen p {
    color: var(--muted);
    font-size: 0.95rem;
  }
</style>
