<script>
  import { getCurrentGuideStep, getGuideStepIndex } from '$lib/stores/gameStore.svelte.js';
  import { guideSteps } from '$lib/onboardingGuide.js';

  let { onGuideNext, onGuideSkip } = $props();

  const currentStep = $derived(getCurrentGuideStep());
  const stepIndex = $derived(getGuideStepIndex());
  const isLastStep = $derived(stepIndex >= guideSteps.length - 1);
</script>

<div class="guide-overlay" role="dialog" aria-modal="true">
  <section class="guide-dialog">
    <div class="guide-kicker">新手指引</div>
    <h2>{currentStep.title}</h2>
    <p>{currentStep.body}</p>
    <div class="guide-progress">
      {#each guideSteps as step, index}
        <span class:active={index === stepIndex} class:completed={index < stepIndex}></span>
      {/each}
    </div>
    <div class="guide-actions">
      <button type="button" onclick={onGuideSkip}>跳过</button>
      <button type="button" onclick={onGuideNext}>{isLastStep ? '完成' : '下一步'}</button>
    </div>
  </section>
</div>
