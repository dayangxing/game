<script>
  import { resetGame, exportStory } from '$lib/stores/gameStore.svelte.js';

  let { game } = $props();

  const summary = $derived(game.ending?.summary ?? {});
  const chapterIndex = $derived(Number(game.chapter?.index));
  const historyCount = $derived(Array.isArray(game.chapterHistory) ? game.chapterHistory.length : 0);
  const chapterCount = $derived(Math.max(
    Number.isInteger(chapterIndex) ? chapterIndex + 1 : 0,
    historyCount + (game.chapter ? 1 : 0)
  ));
  const finalRealm = $derived(summary.finalRealm ?? game.player?.realm ?? '未知境界');
  const truthClueCount = $derived(Number.isFinite(summary.truthFlags) ? summary.truthFlags : 0);
  const lastRunSummary = $derived(game.resourceRun?.lastRunSummary ?? {});
  const metaProgress = $derived(game.metaProgress ?? {});
  const runTechniques = $derived((lastRunSummary.techniques ?? []).map((entry) => typeof entry === 'string' ? entry : entry?.name).filter(Boolean));
  const runTreasures = $derived((lastRunSummary.treasures ?? []).map((entry) => typeof entry === 'string' ? entry : entry?.name).filter(Boolean));
  const discoveredTechniques = $derived(new Set(metaProgress.discoveredTechniques ?? []).size);
  const discoveredTreasures = $derived(new Set(metaProgress.discoveredTreasures ?? []).size);
</script>

<section class="paper-card ending-section">
  <div class="section-title">
    <h3>{game.ending?.title ?? '命簿终章'}</h3>
    <span>本局已结</span>
  </div>
  <p>{game.ending?.body ?? '命火已尽。'}</p>
  <dl class="ending-summary">
    <div><dt>最终境界</dt><dd>{finalRealm}</dd></div>
    <div><dt>章节数</dt><dd>{chapterCount || '暂无记录'}</dd></div>
    <div><dt>真相线索</dt><dd>{truthClueCount}</dd></div>
  </dl>
  <section class="resource-run-summary">
    <div class="personal-section-title"><h4>资源轨迹</h4><span>第 {lastRunSummary.runCount ?? metaProgress.runCount ?? 1} 局</span></div>
    <p>{runTechniques.length || runTreasures.length ? `本局带走：${[...runTechniques, ...runTreasures].join('、')}` : '本局未保留仍在身上的功法或宝物。'}</p>
    <p>永久发现：功法 {discoveredTechniques} 门 · 宝物 {discoveredTreasures} 件</p>
  </section>
  <div class="ending-actions">
    <button type="button" onclick={exportStory}>查看传记</button>
    <button type="button" onclick={resetGame}>重开</button>
  </div>
</section>
