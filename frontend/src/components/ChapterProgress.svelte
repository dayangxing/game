<script>
  let { chapter } = $props();

  const hasChapter = $derived(!!chapter?.title);
  const progress = $derived(chapter?.progress ?? 0);
  const objectives = $derived(chapter?.objectives ?? []);
</script>

{#if hasChapter}
  <section class="paper-card chapter-progress-panel">
    <div class="section-title">
      <h3>{chapter.title}</h3>
      <span>主线进度 {progress}%</span>
    </div>
    <div class="chapter-progress-bar">
      <i style="width:{progress}%"></i>
    </div>
    {#if objectives.length}
      <ul class="chapter-objective-list">
        {#each objectives as objective}
          <li class="chapter-objective" class:is-complete={objective.completed}>
            {objective.completed ? '✓' : '○'} {objective.text}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}
