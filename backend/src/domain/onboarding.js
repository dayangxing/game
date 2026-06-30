export const ONBOARDING_STEPS = [
  {
    id: 'awakening',
    protagonist: '陆青玄',
    title: '山门初醒',
    body: '青云宗外门晨钟响起，你从竹舍醒来。今日只需学会查看状态、选择行动，并读懂天机札记。',
    actionTitle: '查看山门',
    command: '完成新手任务：山门初醒'
  },
  {
    id: 'breathing',
    protagonist: '陆青玄',
    title: '调息入门',
    body: '灵气、心境、寿元共同决定修行节奏。寿元不是装饰，它会参与突破和结局。',
    actionTitle: '静坐调息',
    command: '完成新手任务：调息入门'
  },
  {
    id: 'sect_contact',
    protagonist: '陆青玄',
    title: '同门问讯',
    body: '林师姐和玄衡长老代表宗门关系。好感、贡献和师门立场会影响事件池。',
    actionTitle: '拜会同门',
    command: '完成新手任务：同门问讯'
  },
  {
    id: 'alchemy_trial',
    protagonist: '陆青玄',
    title: '丹房试火',
    body: '材料与丹药用于修炼、疗伤和突破。炼丹是选择事件，不是离线收菜。',
    actionTitle: '试炼丹火',
    command: '完成新手任务：丹房试火'
  },
  {
    id: 'mist_bell',
    protagonist: '陆青玄',
    title: '雾隐铃声',
    body: '雾隐秘境中的青铜铃回应雷木双息，也回应天门契的裂痕。',
    actionTitle: '听辨铃声',
    command: '完成新手任务：雾隐铃声'
  },
  {
    id: 'karma_choice',
    protagonist: '陆青玄',
    title: '因果一念',
    body: '救人、夺宝、交给宗门会改变善缘、业力和未来事件权重。',
    actionTitle: '辨明因果',
    command: '完成新手任务：因果一念'
  },
  {
    id: 'heaven_contract',
    protagonist: '陆青玄',
    title: '天门残契',
    body: '飞升并非纯粹机缘。天门契暗示上界会抽取下界气运维持天门。',
    actionTitle: '收起残契',
    command: '完成新手任务：天门残契'
  },
  {
    id: 'formal_life',
    protagonist: '陆青玄',
    title: '入世立命',
    body: '序章结束。接下来由玩家创建自己的修仙者，属性、出身和命格随机生成。',
    actionTitle: '开启命簿',
    command: '完成新手任务：入世立命'
  }
];

export function createOnboardingState() {
  return {
    completed: false,
    stepId: ONBOARDING_STEPS[0].id,
    completedStepIds: [],
    unlockedCharacterCreation: false
  };
}

export function getCurrentOnboardingStep(onboarding = createOnboardingState()) {
  return ONBOARDING_STEPS.find((step) => step.id === onboarding.stepId) ?? ONBOARDING_STEPS.at(-1);
}

export function canCreateFormalCharacter(onboarding) {
  return Boolean(onboarding?.completed && onboarding?.unlockedCharacterCreation);
}

export function completeOnboardingStep(onboarding, stepId) {
  const current = getCurrentOnboardingStep(onboarding);
  if (current.id !== stepId) return onboarding;

  const completedStepIds = [...new Set([...(onboarding.completedStepIds ?? []), stepId])];
  const nextStep = ONBOARDING_STEPS[completedStepIds.length];
  const completed = completedStepIds.length === ONBOARDING_STEPS.length;

  return {
    completed,
    stepId: nextStep?.id ?? stepId,
    completedStepIds,
    unlockedCharacterCreation: completed
  };
}
