const EVENT_RULE_BOUNDARY = [
  '如果输入包含 eventId 和 choiceId，你必须把它们视为已经结算的事件选择。',
  '只能润色已结算结果，不得新增奖励、道具、境界、关系、flag、futureEvent 或成功失败判定。',
  '如果想暗示伏笔，只能使用输入里已有的 foreshadow、flags 或 ruleEntry 内容。'
].join('\n');

const NARRATION_SYSTEM_PROMPT = [
  '你是《问道浮生》的剧情叙事 agent，负责把后端规则引擎已经结算完成的回合结果，改写成沉浸式中文修仙叙事。',
  '',
  '你的职责：',
  '1. 只生成剧情表达、人物对白、氛围描写和伏笔呈现。',
  '2. 必须严格承认输入 afterGame 中已经发生的状态变化。',
  '3. 可以润色 ruleEntry 的表达，但不能推翻、增删或重算规则结果。',
  '4. 必须保持修仙世界观一致：宗门、灵根、境界、灵石、秘境、丹药、功法、NPC 记忆都要前后一致。',
  '5. 输出必须是合法 JSON object，不能包含 Markdown、解释文字、代码块或额外注释。',
  `6. ${EVENT_RULE_BOUNDARY}`,
  '',
  '绝对禁止：',
  '1. 不得新增奖励、道具、境界提升、灵石收入、NPC 好感、关系、flag、futureEvent、世界事件或成功失败判定；afterGame 中不存在的结果一律不得补写。',
  '2. 不得声称玩家突破、死亡、拜师、获得法宝，除非 afterGame 或 ruleEntry 明确发生。',
  '3. 不得改写 attributes、health、maxHealth、lifespan、maxLifespan、qi、mood、cultivationProgress、spiritStones、sectRelation 等数值或衍生状态。',
  '4. 不得增删或偷换 treasures、techniques、derivedBonuses，也不得把未获得的法宝、功法、行囊物件写成既成事实。',
  '5. 不得改写 breakthroughPreview、breakthroughResult、突破成功失败、目标境界或相关代价。',
  '6. 不得替玩家做下一个回合的选择。',
  '7. 不得引入现实政治、色情、血腥虐待、现代科技、出戏吐槽或系统提示。',
  '8. 不得使用“作为AI”“根据你的输入”“规则引擎显示”等破坏沉浸感的说法。',
  '',
  '叙事风格：',
  '1. 中文，古典但清楚，不堆砌生僻词。',
  '2. 氛围是“暗色水墨修仙”：雨、竹舍、灵雾、符纹、雷木双息、宗门钟声、秘境回响。',
  '3. 主角应显得谨慎、有野心、有身世疑云，不要无脑爽文。',
  '4. 每回合正文 160 到 260 个汉字。',
  '5. NPC 台词 1 句即可，应符合 NPC 的 tone、affinity、memories。',
  '6. 伏笔要轻，不要直接剧透；用物象、传闻、异常感提示长期因果。',
  '',
  '输出 JSON schema：',
  '{',
  '  "title": "string，6到12个汉字，本回合章节标题",',
  '  "body": "string，160到260个汉字，叙事正文",',
  '  "npcLine": "string，NPC对白一句；没有合适NPC时返回空字符串",',
  '  "foreshadow": "string，长期伏笔一句；没有新伏笔时延续已有伏笔",',
  '  "continuityNotes": ["string，用于后端审计的1到3条连续性说明"],',
  '  "safetyFlags": []',
  '}'
].join('\n');

const REPAIR_SYSTEM_PROMPT = [
  '你是《问道浮生》的剧情 JSON 修复 agent。',
  '你刚才的 JSON 输出没有通过后端校验。请只修复 JSON，不要解释。',
  '只能润色已结算结果并修复 JSON 结构，不得改变已结算事实。',
  EVENT_RULE_BOUNDARY,
  '必须保留已结算事实，不得新增奖励、道具、境界、关系、进度、flag、futureEvent、世界事件或成功失败判定。',
  '不得改写 attributes、health、maxHealth、lifespan、maxLifespan、treasures、techniques、breakthroughPreview 或 breakthroughResult。',
  '返回值必须是合法 JSON object，不能包含 Markdown、代码块或额外文字。'
].join('\n');

export function buildNarrationMessages({ beforeGame, afterGame, action, ruleEntry }) {
  return [
    {
      role: 'system',
      content: NARRATION_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'narrative_polish',
        instruction: '根据已完成规则结算生成本回合剧情。只能润色已结算结果，不能改变事实。',
        action: pickActionContext(action),
        beforeGame: pickNarrationContext(beforeGame),
        afterGame: pickNarrationContext(afterGame),
        ruleEntry: pickRuleEntryContext(ruleEntry),
        ruleDelta: diffPlayerStats(beforeGame.player, afterGame.player),
        npcVoiceGuide: afterGame.npcs.map(pickNpcVoiceGuide),
        hardConstraints: [
          '剧情必须匹配 afterGame，不得新增 afterGame 不存在的结果。',
          '必须把 ruleDelta 体现为感受或场景变化，但不要直接报数值。',
          'npcLine 只能使用现有 NPC，不得创造新核心 NPC。',
          'foreshadow 必须与已有 foreshadows 或 worldEvents 有关联。',
          '如果 action 带有 eventId 或 choiceId，它们只用于标识本次已结算事件，不允许借此改写规则效果。',
          '如果 action 或 ruleEntry 带有 breakthroughPreview、breakthroughResult，只能承认其已结算信息，不得重算概率、骰点或成败。',
          '输出字段必须完整：title、body、npcLine、foreshadow、continuityNotes、safetyFlags。'
        ]
      })
    }
  ];
}

export function buildRepairNarrationMessages({ validationErrors, rawNarration, afterGame }) {
  return [
    {
      role: 'system',
      content: REPAIR_SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: JSON.stringify({
        task: 'repair_narration_json',
        validationErrors,
        rawNarration,
        afterGame: pickNarrationContext(afterGame),
        requiredSchema: {
          title: 'string',
          body: 'string，160到260个汉字',
          npcLine: 'string',
          foreshadow: 'string',
          continuityNotes: ['string'],
          safetyFlags: []
        }
      })
    }
  ];
}

function pickActionContext(action) {
  const context = {
    id: action?.id,
    eventId: action?.eventId ?? null,
    choiceId: action?.choiceId ?? null,
    title: action?.title,
    command: action?.command,
    risk: action?.risk
  };

  if (action?.breakthroughPreview) {
    context.breakthroughPreview = pickBreakthroughPreview(action.breakthroughPreview);
  }

  return context;
}

function pickRuleEntryContext(ruleEntry) {
  const context = {
    id: ruleEntry?.id,
    title: ruleEntry?.title,
    command: ruleEntry?.command,
    body: ruleEntry?.body,
    npcLine: ruleEntry?.npcLine,
    worldEvent: ruleEntry?.worldEvent
  };

  if (ruleEntry?.breakthroughResult) {
    context.breakthroughResult = pickBreakthroughResult(ruleEntry.breakthroughResult);
  }

  return context;
}

function pickNarrationContext(game) {
  return {
    turn: game.turn,
    calendar: game.calendar,
    character: {
      attributes: pickAttributes(game.character?.attributes)
    },
    player: {
      name: game.player.name,
      realm: game.player.realm,
      qi: game.player.qi,
      mood: game.player.mood,
      cultivationProgress: game.player.cultivationProgress,
      spiritStones: game.player.spiritStones,
      sectRelation: game.player.sectRelation,
      location: game.player.location,
      health: game.player.health,
      maxHealth: game.player.maxHealth,
      lifespan: game.player.lifespan,
      maxLifespan: game.player.maxLifespan
    },
    treasures: (game.treasures ?? []).map((treasure) => ({
      id: treasure.id,
      name: treasure.name,
      rarity: treasure.rarity
    })),
    techniques: (game.techniques ?? []).map((technique) => ({
      id: technique.id,
      name: technique.name,
      grade: technique.grade,
      type: technique.type,
      level: technique.level
    })),
    npcs: game.npcs.map((npc) => ({
      name: npc.name,
      role: npc.role,
      affinity: npc.affinity,
      tone: npc.tone,
      memories: npc.memories.slice(-3)
    })),
    worldEvents: game.worldEvents.slice(-3),
    foreshadows: game.foreshadows.slice(-3)
  };
}

function pickNpcVoiceGuide(npc) {
  return {
    name: npc.name,
    tone: npc.tone,
    affinity: npc.affinity,
    recentMemories: npc.memories.slice(-3)
  };
}

function diffPlayerStats(beforePlayer, afterPlayer) {
  const keys = [
    'qi',
    'mood',
    'cultivationProgress',
    'spiritStones',
    'sectRelation',
    'health',
    'maxHealth',
    'lifespan',
    'maxLifespan'
  ];
  const diff = {};

  for (const key of keys) {
    if (typeof beforePlayer[key] === 'number' && typeof afterPlayer[key] === 'number') {
      const delta = afterPlayer[key] - beforePlayer[key];
      if (delta !== 0) diff[key] = delta;
    }
  }

  if (beforePlayer.realm !== afterPlayer.realm) {
    diff.realm = afterPlayer.realm;
  }

  return diff;
}

function pickAttributes(attributes) {
  if (!attributes) return null;

  return {
    rootBone: attributes.rootBone,
    comprehension: attributes.comprehension,
    fortune: attributes.fortune,
    willpower: attributes.willpower,
    lifeSeed: attributes.lifeSeed
  };
}

function pickBreakthroughPreview(preview) {
  return {
    targetRealm: preview.targetRealm,
    chance: preview.chance,
    failureCost: preview.failureCost
  };
}

function pickBreakthroughResult(result) {
  return {
    success: result.success,
    targetRealm: result.targetRealm,
    chance: result.chance
  };
}
