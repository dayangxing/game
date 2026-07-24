export const ONBOARDING_STEPS = [
  {
    id: 'awakening',
    protagonist: '陆青玄',
    title: '山门初醒',
    body: '青云宗外门晨钟三响，陆青玄从竹舍醒来。山门外云阶如洗，执事弟子逐一核验命簿。林师姐提醒你：修行不是漫游天地，而是在每日行动里做取舍，选择会写入日志，也会改变日后的关系与事件。',
    actionTitle: '查看山门',
    command: '推进序章：山门初醒'
  },
  {
    id: 'qingyun_rules',
    protagonist: '陆青玄',
    title: '青云门规',
    body: '玄衡长老在传功石前讲青云宗旧规：外门弟子先修身、再立功、后问道。宗门贡献能换丹药与功法，人情声望也会决定谁愿意在关键时刻出手。山门像一张网，护人，也束人。',
    actionTitle: '听讲门规',
    command: '推进序章：青云门规'
  },
  {
    id: 'breathing',
    protagonist: '陆青玄',
    title: '调息入门',
    body: '第一夜入静，你按青云吐纳法引气入体。灵气推着境界往前，心境决定能否稳住周天，而寿元像灯油一样在命簿边缘缓慢燃烧。破境不是单纯攒满进度，心急也会留下暗伤。',
    actionTitle: '静坐调息',
    command: '推进序章：调息入门'
  },
  {
    id: 'lifespan_lamp',
    protagonist: '陆青玄',
    title: '命灯微晦',
    body: '丹堂后院供着一排命灯，陆青玄的灯芯忽然暗了一寸。玄衡长老没有立刻解释，只说寿元压力会贯穿修行：受伤、强行突破、签下奇怪契约，都可能让命灯提前枯尽。',
    actionTitle: '检视命灯',
    command: '推进序章：命灯微晦'
  },
  {
    id: 'sect_contact',
    protagonist: '陆青玄',
    title: '同门问讯',
    body: '林师姐带你认路，从药圃、演武场一路走到后山封线。她说青云宗表面清净，内里却有不同立场：有人主张封住雾隐秘境，有人认为秘境是外门弟子翻身的机会。你第一次意识到关系会改变命运。',
    actionTitle: '拜会同门',
    command: '推进序章：同门问讯'
  },
  {
    id: 'alchemy_trial',
    protagonist: '陆青玄',
    title: '丹房试火',
    body: '丹房烟气辛辣，药童把凝露草和雷纹草分开放在石案上。炼丹不是凭空收获，每一枚聚气丹都来自材料、火候和代价。你学会查看行囊，也学会在修炼、疗伤和换取人情之间分配资源。',
    actionTitle: '试炼丹火',
    command: '推进序章：丹房试火'
  },
  {
    id: 'sect_trial',
    protagonist: '陆青玄',
    title: '外门小比',
    body: '外门小比的告示贴在演武场边，胜者能得贡献，也会被长老记住。陆青玄只旁观半日，便看见有人为功法结盟，有人为名额翻脸。青云宗并不只是背景，它会不断向你索取选择。',
    actionTitle: '旁观小比',
    command: '推进序章：外门小比'
  },
  {
    id: 'mist_bell',
    protagonist: '陆青玄',
    title: '雾隐铃声',
    body: '后山雾线夜里忽然退开半步，雾隐秘境深处传来青铜铃声。铃声只响给少数人听，尤其会回应雷木双息。林师姐按住你的肩，低声说：听见铃声的人，往往会被旧档案记住。',
    actionTitle: '听辨铃声',
    command: '推进序章：雾隐铃声'
  },
  {
    id: 'karma_choice',
    protagonist: '陆青玄',
    title: '因果一念',
    body: '坊市归途有散修倒在雨里，怀中露出一角玉简。救他会消耗丹药，夺简会立刻得利，交给宗门则能换来清白却失去线索。林师姐没有替你决定，只说善缘、业力和未来事件都会记账。',
    actionTitle: '辨明因果',
    command: '推进序章：因果一念'
  },
  {
    id: 'mist_archive',
    protagonist: '陆青玄',
    title: '石刻残档',
    body: '雾隐秘境边缘露出半截石碑，上面刻着一批飞升者名录。奇怪的是，名录之后的年份都对应下界灾年，像是有人用众生气运填补天门。陆青玄拓下残档，却发现自己的命灯又暗了一线。',
    actionTitle: '拓下残档',
    command: '推进序章：石刻残档'
  },
  {
    id: 'heaven_contract',
    protagonist: '陆青玄',
    title: '天门残契',
    body: '玄衡长老终于取出一页天门残契：飞升不是单纯破境，而是以命格签契，替上界维系天门。所谓骗局并非没人能飞升，而是飞升的代价被故意藏起。青云宗的封门派，正是怕弟子被这份契约吞没。',
    actionTitle: '收起残契',
    command: '推进序章：天门残契'
  },
  {
    id: 'formal_life',
    protagonist: '陆青玄',
    title: '命簿归主',
    body: '序章到此收束。陆青玄只是被命簿借来演示这方天地的第一盏灯，真正的修行者还未落名。接下来你将创建自己的角色，姓名由你决定，出身、灵根、天赋、寿元和初始资源会随机写入命簿。',
    actionTitle: '开启命簿',
    command: '推进序章：命簿归主'
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

export function createTutorialAction({ game, now, sequenceStart = 0 }) {
  const step = getCurrentOnboardingStep(game.onboarding);
  return {
    id: `act_${game.turn}_tutorial_${sequenceStart}`,
    title: step.actionTitle,
    icon: '引',
    command: step.command,
    meta: step.title,
    source: 'tutorial',
    risk: 'low',
    onboardingStepId: step.id,
    storyHook: [
      `序章：${step.title}`,
      step.body,
      '生成要求：只解释本步骤对应系统，不提前揭露全部真相。'
    ].join('\n'),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString()
  };
}

export function resolveTutorialAction({ game, action }) {
  const step = ONBOARDING_STEPS.find((candidate) => candidate.id === action.onboardingStepId);
  const onboarding = completeOnboardingStep(game.onboarding, action.onboardingStepId);
  const turn = game.turn + 1;
  const player = onboarding.completed ? { ...game.player, name: '' } : game.player;
  return {
    ...game,
    player,
    turn,
    version: turn,
    onboarding,
    log: [
      ...game.log,
      {
        id: `turn-${turn}`,
        title: step.title,
        command: action.command,
        body: step.body,
        npcLine: step.id === 'formal_life'
          ? '玄衡长老合上命簿：“接下来，不再是陆青玄的路，而是你的路。”'
          : '林师姐低声提醒：“先记住这一条，后面的因果会慢慢追上来。”',
        worldEvent: step.title
      }
    ],
    timeline: [
      ...game.timeline,
      { type: 'tutorial', title: step.title, detail: step.body }
    ],
    flags: {
      ...game.flags,
      [`tutorial_${step.id}`]: true,
      ...(step.id === 'lifespan_lamp' ? { lifespan_mark: true } : {}),
      ...(step.id === 'sect_trial' ? { sect_elder_split: true } : {}),
      ...(step.id === 'mist_bell' ? { bronze_bell: true } : {}),
      ...(step.id === 'mist_archive' ? { mist_archive: true } : {}),
      ...(step.id === 'heaven_contract' ? { ascension_contract: true } : {})
    }
  };
}
