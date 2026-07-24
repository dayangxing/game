<script>
  import { submitOnboardingAction } from '$lib/stores/gameStore.svelte.js';

  let { game } = $props();

  const currentStep = $derived(game.log?.at(-1));
  const stepTitle = $derived(currentStep?.title ?? '山门初醒');
  const stepBody = $derived(currentStep?.body ?? '青云宗外门晨钟响起。');
</script>

<section class="onboarding-panel">
  <div class="panel-kicker">新手任务</div>
  <h2>{stepTitle}</h2>
  <p>{stepBody}</p>
  <button type="button" onclick={() => submitOnboardingAction()}>继续</button>
</section>
