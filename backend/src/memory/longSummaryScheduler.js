import {
  normalizeStoryMemory,
  selectRollingSummaryTurns,
  selectUnsummarizedTurns,
  SUMMARY_WINDOW_TURNS
} from '../../../src/storyMemory.js';

const DEFAULT_THRESHOLD_TURNS = 4;
const DEFAULT_TIMEOUT_MS = 8000;
const MAJOR_REASONS = new Set([
  'major',
  'major-foreshadow',
  'chapter-transition',
  'chapter-milestone',
  'ending'
]);

export function createLongSummaryScheduler({
  getGame,
  commitGame,
  summarize,
  persistGame = null,
  now = () => Date.now(),
  thresholdTurns = DEFAULT_THRESHOLD_TURNS,
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  if (typeof getGame !== 'function') throw new TypeError('getGame is required');
  if (typeof commitGame !== 'function') throw new TypeError('commitGame is required');
  if (typeof summarize !== 'function') throw new TypeError('summarize is required');

  const turnThreshold = Math.max(1, Math.floor(Number(thresholdTurns) || DEFAULT_THRESHOLD_TURNS));
  const deadline = Math.max(1, Math.floor(Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
  let pendingJob = null;
  let runner = null;
  let disposed = false;

  function consider({ reason = 'threshold' } = {}) {
    if (disposed) return;

    const game = safeGetGame();
    const job = createJob(game, reason);
    if (!job || !shouldSchedule(job)) return;

    if (runner) {
      pendingJob = latestJob(pendingJob, job);
      return;
    }

    runner = runQueue(job);
  }

  async function flush() {
    while (runner) {
      const active = runner;
      await active;
      if (runner === active) runner = null;
    }
  }

  function dispose() {
    disposed = true;
    pendingJob = null;
  }

  async function runQueue(firstJob) {
    let job = firstJob;

    while (job && !disposed) {
      await runJob(job);
      job = pendingJob;
      pendingJob = null;
    }

    runner = null;
  }

  async function runJob(job) {
    let result;
    try {
      result = await withDeadline(
        () => summarize({
          game: job.game,
          previousSummary: job.previousSummary,
          sourceTurns: job.sourceTurns,
          summaryWindowStartTurn: job.targetWindowStartTurn,
          summaryWindowEndTurn: job.targetWindowEndTurn,
          rebase: job.rebase,
          openingAnchor: job.openingAnchor
        }),
        deadline
      );
    } catch {
      return;
    }

    if (disposed) return;

    const current = safeGetGame();
    if (!matchesSnapshot(current, job)) {
      const latest = createJob(current, 'stale');
      if (latest && shouldSchedule(latest)) {
        pendingJob = latestJob(pendingJob, latest);
      }
      return;
    }

    const normalizedMemory = normalizeStoryMemory(current.storyMemory, current);
    const accepted = normalizeSummaryResult(result, job);
    if (!accepted) return;

    const nextGame = {
      ...current,
      storyMemory: {
        ...normalizedMemory,
        longSummary: accepted.summary,
        summaryThroughTurn: accepted.coveredThroughTurn,
        summaryRevision: normalizedMemory.summaryRevision + 1,
        summaryWindowStartTurn: job.rebase
          ? job.targetWindowStartTurn
          : normalizedMemory.summaryWindowStartTurn,
        lastUpdatedTurn: normalizedMemory.lastUpdatedTurn
      }
    };

    try {
      await commitGame(nextGame);
      if (persistGame) await persistGame(nextGame);
    } catch {
      // A persistence failure must not turn a completed player action into a
      // failed request. The authoritative in-memory commit remains valid.
    }
  }

  function createJob(game, reason) {
    if (!game || game.mode === 'mock' || typeof game !== 'object') return null;

    const memory = normalizeStoryMemory(game.storyMemory, game);
    const sourceGameVersion = Number.isFinite(game.version) ? game.version : game.turn;
    const rollingWindow = selectRollingSummaryTurns(
      { ...game, storyMemory: memory },
      { maxTurns: SUMMARY_WINDOW_TURNS }
    );
    const targetWindowStartTurn = rollingWindow.startTurn;
    const rebase = targetWindowStartTurn > memory.summaryWindowStartTurn;
    const incrementalTurns = rebase
      ? null
      : selectUnsummarizedTurns(
        { ...game, storyMemory: memory },
        { preserveNewest: false }
      );
    const sourceTurns = rebase
      ? rollingWindow.turns.filter((turn) => turn.turn > 0)
      : incrementalTurns.turns;
    const openingAnchor = rollingWindow.turns.find((turn) => turn.turn === 0) ?? null;

    return {
      reason,
      gameId: game.id,
      sourceGameVersion: Number.isFinite(sourceGameVersion) ? sourceGameVersion : 0,
      sourceSummaryRevision: memory.summaryRevision,
      sourceSummaryThroughTurn: memory.summaryThroughTurn,
      sourceSummaryWindowStartTurn: memory.summaryWindowStartTurn,
      game: cloneGame(game),
      previousSummary: rebase ? '' : memory.longSummary,
      rebase,
      targetWindowStartTurn,
      targetWindowEndTurn: rollingWindow.endTurn,
      openingAnchor,
      rollingWindowTurns: rollingWindow.turns,
      sourceTurns,
      sourceTurnsTruncated: rebase ? rollingWindow.truncated : incrementalTurns.truncated
    };
  }

  function shouldSchedule(job) {
    if (MAJOR_REASONS.has(job.reason)) return true;
    if (job.rebase) {
      // The first rollover must repair the legacy/unbounded summary immediately.
      // Later rollovers wait for the normal threshold so we do not call the LLM
      // once per turn after the window has started moving.
      return job.sourceSummaryWindowStartTurn === 0
        || job.targetWindowStartTurn - job.sourceSummaryWindowStartTurn >= turnThreshold;
    }
    return job.sourceTurns.length >= turnThreshold;
  }

  function latestJob(previous, next) {
    if (!previous) return next;
    return next.sourceGameVersion >= previous.sourceGameVersion ? next : previous;
  }

  function safeGetGame() {
    try {
      return getGame();
    } catch {
      return null;
    }
  }

  return {
    consider,
    flush,
    dispose
  };
}

function matchesSnapshot(current, job) {
  if (!current || current.id !== job.gameId) return false;

  const version = Number.isFinite(current.version) ? current.version : current.turn;
  const memory = normalizeStoryMemory(current.storyMemory, current);
  return version === job.sourceGameVersion
    && memory.summaryRevision === job.sourceSummaryRevision;
}

function normalizeSummaryResult(result, job) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null;

  const summary = typeof result.summary === 'string' ? result.summary.trim() : '';
  if (!summary) return null;

  const coveredThroughTurn = result.coveredThroughTurn;
  if (!Number.isInteger(coveredThroughTurn)) return null;
  if (coveredThroughTurn < job.sourceSummaryThroughTurn) return null;
  if (coveredThroughTurn > job.sourceGameVersion) return null;

  const highestSourceTurn = job.sourceTurns.at(-1)?.turn ?? job.sourceSummaryThroughTurn;
  if (coveredThroughTurn > highestSourceTurn) return null;
  if (job.rebase && coveredThroughTurn !== job.targetWindowEndTurn) return null;

  return { summary, coveredThroughTurn };
}

async function withDeadline(task, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('LONG_SUMMARY_TIMEOUT')), timeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function cloneGame(game) {
  if (typeof structuredClone === 'function') return structuredClone(game);
  return JSON.parse(JSON.stringify(game));
}
