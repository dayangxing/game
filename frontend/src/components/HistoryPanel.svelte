<script>
  import { getRecentHistory, getHighlightedHistoryEntryId, getStreamingNarration } from '$lib/stores/gameStore.svelte.js';

  let { game } = $props();

  const entries = $derived(getRecentHistory(3));
  const highlightedId = $derived(getHighlightedHistoryEntryId());

  function cardClass(entry) {
    if (entry.streaming) return 'log-card streaming';
    return entry.id === highlightedId ? 'log-card is-new' : 'log-card';
  }

  function normalizeLines(effectsSummary) {
    if (Array.isArray(effectsSummary)) {
      return effectsSummary.map((l) => String(l ?? '').trim()).filter(Boolean);
    }
    const line = String(effectsSummary ?? '').trim();
    return line ? [line] : [];
  }
</script>

<section class="paper-card story-section">
  <div class="section-title"><h3>历史行为</h3><span>最近3回合</span></div>
  <div class="log-list">
    {#each entries as entry}
      <article class={cardClass(entry)}>
        <header><strong>{entry.title}</strong><span>{entry.command}</span></header>
        <p>{entry.body}</p>
        {#if entry.effectsSummary}
          <div class="effects-summary">
            {#each normalizeLines(entry.effectsSummary) as line}<span>{line}</span>{/each}
          </div>
        {/if}
        {#if entry.npcLine}<blockquote>{entry.npcLine}</blockquote>{/if}
        {#if entry.worldEvent}<em>{entry.worldEvent}</em>{/if}
      </article>
    {/each}
  </div>
</section>
