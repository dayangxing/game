<script>
  let { game } = $props();

  const memory = $derived(getStoryMemory(game));
  const recentTurns = $derived(memory.recentTurns.slice(-8).reverse());
  const openThreads = $derived(memory.openThreads.length ? memory.openThreads : buildThreadsFromForeshadows(game));
  const characterNotes = $derived(memory.characterNotes.length ? memory.characterNotes : buildNpcMemoryNotes(game));
  const worldRecords = $derived(buildWorldRecords(game));
  const modelContext = $derived([
    { label: '剧情摘要', value: memory.longSummary },
    { label: '最近行动', value: recentTurns[0]?.action ?? '尚未行动' },
    { label: '未解伏笔', value: openThreads.slice(0, 3).map((thread) => thread.title).join('、') || '暂无' },
    { label: '人物牵连', value: characterNotes.slice(0, 3).map((note) => `${note.name}(${note.affinity})`).join('、') || '暂无' }
  ]);

  function getStoryMemory(targetGame) {
    const storyMemory = targetGame.storyMemory ?? {};
    const recentTurns = Array.isArray(storyMemory.recentTurns) && storyMemory.recentTurns.length
      ? storyMemory.recentTurns.map((entry) => ({
        turn: Number.isFinite(entry.turn) ? entry.turn : 0,
        title: entry.title || '无题回合',
        action: entry.action || '静观其变',
        outcome: entry.outcome || '',
        npcLine: entry.npcLine || '',
        worldEvent: entry.worldEvent || '',
        timeLabel: entry.timeLabel || '',
        warningLevel: entry.warningLevel || ''
      }))
      : (targetGame.log ?? []).map((entry, index) => ({
        turn: entry.id === 'formal-opening' ? 0 : Number(entry.id?.match(/\d+/)?.[0] ?? index),
        title: entry.title || '无题回合',
        action: entry.command || '静观其变',
        outcome: entry.body || '',
        npcLine: entry.npcLine || '',
        worldEvent: entry.worldEvent || '',
        timeLabel: '',
        warningLevel: ''
      }));

    return {
      longSummary: storyMemory.longSummary || targetGame.log?.[0]?.body || '青云宗山门初醒，求道之路刚刚铺开。',
      recentTurns,
      openThreads: Array.isArray(storyMemory.openThreads) ? storyMemory.openThreads : [],
      characterNotes: Array.isArray(storyMemory.characterNotes) ? storyMemory.characterNotes : [],
      lastUpdatedTurn: Number.isFinite(storyMemory.lastUpdatedTurn) ? storyMemory.lastUpdatedTurn : targetGame.turn
    };
  }

  function buildThreadsFromForeshadows(targetGame) {
    return (targetGame.foreshadows ?? []).map((detail) => ({
      title: detail.includes('雾隐秘境') ? '雾隐秘境疑云' : detail.includes('雷木') ? '雷木双息异兆' : '未明天机',
      detail,
      status: '未解',
      clues: []
    }));
  }

  function buildNpcMemoryNotes(targetGame) {
    return (targetGame.npcs ?? []).map((npc) => ({
      name: npc.name,
      role: npc.role,
      affinity: npc.affinity,
      tone: npc.tone,
      memories: npc.memories ?? []
    }));
  }

  function buildWorldRecords(targetGame) {
    return [
      ...(targetGame.worldEvents ?? []).map((item) => ({
        title: item.title,
        detail: item.detail,
        tag: `第 ${item.turn ?? 0} 回合`
      })),
      ...(targetGame.timeline ?? []).slice(-6).map((item) => ({
        title: item.title,
        detail: item.detail,
        tag: item.type ?? '天机'
      }))
    ].slice(-8).reverse();
  }

  function formatOutcome(entry) {
    return [
      entry.timeLabel ? `历时${entry.timeLabel}` : '',
      entry.warningLevel ? `气象：${entry.warningLevel}` : '',
      entry.outcome,
      entry.npcLine ? `人物：${entry.npcLine}` : '',
      entry.worldEvent ? `天机：${entry.worldEvent}` : ''
    ].filter(Boolean).join(' ');
  }
</script>

<section class="paper-card story-archive-panel">
  <div class="archive-sheet">
    <header class="archive-header">
      <div><span>本局档案</span><h3>天机录</h3></div>
      <strong>第 {memory.lastUpdatedTurn} 回合</strong>
    </header>

    <div class="archive-grid">
      <section class="archive-section archive-overview-section">
        <div class="personal-section-title"><h4>本局总纲</h4><span>剧情摘要</span></div>
        <p>{memory.longSummary}</p>
      </section>

      <section class="archive-section archive-recent-section">
        <div class="personal-section-title"><h4>近期回合</h4><span>{recentTurns.length} 条</span></div>
        <div class="archive-recent-list">
          {#if recentTurns.length}
            {#each recentTurns as entry}
              <article>
                <span>第 {entry.turn} 回合</span>
                <strong>{entry.title}</strong>
                <p>{entry.action}</p>
                <em>{formatOutcome(entry)}</em>
              </article>
            {/each}
          {:else}
            <div class="empty-collection">尚无新的回合记录。</div>
          {/if}
        </div>
      </section>

      <section class="archive-section archive-thread-section">
        <div class="personal-section-title"><h4>未解伏笔</h4><span>{openThreads.length} 条</span></div>
        <div class="archive-thread-list">
          {#if openThreads.length}
            {#each openThreads as thread}
              <article>
                <b>{thread.status || '未解'}</b>
                <strong>{thread.title || '未明天机'}</strong>
                {#if Number.isFinite(thread.updatedTurn)}<span>第 {thread.updatedTurn} 回合更新</span>{/if}
                <p>{thread.detail}</p>
                {#if thread.clues?.length}
                  <div class="archive-thread-clues">
                    <em>最近线索</em>
                    {#each thread.clues.slice(-2) as clue}<small>{clue}</small>{/each}
                  </div>
                {/if}
              </article>
            {/each}
          {:else}
            <div class="empty-collection">天机尚未落笔。</div>
          {/if}
        </div>
      </section>

      <section class="archive-section archive-npc-section">
        <div class="personal-section-title"><h4>人物记忆</h4><span>{characterNotes.length} 人</span></div>
        <div class="archive-npc-list">
          {#if characterNotes.length}
            {#each characterNotes as note}
              <article>
                <div><strong>{note.name}</strong><span>{note.role} · 好感 {note.affinity}</span></div>
                <p>{note.memories?.slice(-2).join('；') || note.tone || '态度未明'}</p>
              </article>
            {/each}
          {:else}
            <div class="empty-collection">尚未结下新的道友牵绊。</div>
          {/if}
        </div>
      </section>

      <section class="archive-section archive-world-section">
        <div class="personal-section-title"><h4>世界记录</h4><span>{worldRecords.length} 条</span></div>
        <div class="archive-world-list">
          {#if worldRecords.length}
            {#each worldRecords as item}
              <article><span>{item.tag}</span><strong>{item.title}</strong><p>{item.detail}</p></article>
            {/each}
          {:else}
            <div class="empty-collection">天机尚未落笔。</div>
          {/if}
        </div>
      </section>

      <section class="archive-section archive-context-section">
        <div class="personal-section-title"><h4>模型上下文</h4><span>续写依据</span></div>
        <div class="archive-context-list">
          {#each modelContext as item}
            <article><strong>{item.label}</strong><p>{item.value}</p></article>
          {/each}
        </div>
      </section>
    </div>
  </div>
</section>
