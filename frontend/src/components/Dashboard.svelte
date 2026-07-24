<script>
  import { formatTopTimeLabel } from '$lib/utils/helpers.js';
  import { getView } from '$lib/views.js';
  import {
    getDailyActions, getChapterTransitionNotice, getActionLoading,
    getDailyActionPending, getStoryStepPending, getPendingApiImmediateActions,
    submitDailyAction, submitStoryStep
  } from '$lib/stores/gameStore.svelte.js';
  import StatusPanel from './StatusPanel.svelte';
  import HistoryPanel from './HistoryPanel.svelte';
  import ActionPanel from './ActionPanel.svelte';
  import ChapterProgress from './ChapterProgress.svelte';
  import EndingPanel from './EndingPanel.svelte';
  import ResourceDraft from './ResourceDraft.svelte';
  import PersonalPanel from './PersonalPanel.svelte';
  import ResonancePanel from './ResonancePanel.svelte';
  import StoryArchive from './StoryArchive.svelte';
  import TreasureCollection from './TreasureCollection.svelte';
  import InventoryCollection from './InventoryCollection.svelte';

  let { game, activeViewId } = $props();

  const view = $derived(getView(activeViewId));
  const dailyActions = $derived(getDailyActions());
  const chapterTransitionNotice = $derived(getChapterTransitionNotice());
  const actionLoading = $derived(getActionLoading());
  const dailyActionPending = $derived(getDailyActionPending());
  const storyStepPending = $derived(getStoryStepPending());
  const pendingApiImmediateActions = $derived(getPendingApiImmediateActions());

  function handleActionClick(event) {
    const action = event.detail.action;
    if (action.source === 'story-choice' || action.source === 'story-continue' || action.category === 'director') {
      submitStoryStep(action);
    } else {
      submitDailyAction(action);
    }
  }
</script>

<div class="dashboard-content" id="dashboardContent">
  <section class="hero-scroll">
    <div>
      <p>
        <span id="gameDate">{formatTopTimeLabel(game)}</span>
        <span id="turnPill">第 {game.turn} 回合</span>
      </p>
      <h2 id="viewTitle">{view.title}</h2>
      <span id="viewDescription">{view.description}</span>
    </div>
    <div class="status-pill" id="worldMode">{game.mode === 'api' ? '云端存档' : '本地存档'}</div>
  </section>

  {#if game.mode === 'api'}
    <div class="api-banner">云箓已启，今日行止皆已入册。</div>
  {/if}

  <div class="active-view-content" data-active-view={activeViewId}>
    {#if activeViewId === 'home'}
      <StatusPanel {game} />
      <ChapterProgress chapter={game.chapter} />
      {#if chapterTransitionNotice}
        <div class="paper-card chapter-transition-panel">
          <div class="section-title"><h3>篇章转折</h3><span>主线推进</span></div>
          <p>{chapterTransitionNotice}</p>
        </div>
      {/if}
      {#if game.ending}
        <EndingPanel {game} />
      {/if}
      <div class="home-story-actions">
        <HistoryPanel {game} />
        {#if !game.ending}
          <ResourceDraft {game} />
          <ActionPanel {game} {dailyActions} {actionLoading} {dailyActionPending} {storyStepPending} {pendingApiImmediateActions} onActionClick={handleActionClick} />
        {/if}
      </div>
    {:else if activeViewId === 'skills'}
      <PersonalPanel {game} />
      <ResonancePanel resonances={game.resourceRun?.activeResonances} />
    {:else if activeViewId === 'realm'}
      <StoryArchive {game} />
    {:else if activeViewId === 'bag'}
      <TreasureCollection {game} />
      <InventoryCollection {game} />
      <ResonancePanel resonances={game.resourceRun?.activeResonances} />
    {/if}
  </div>
</div>
