const NARRATION_SYSTEM_PROMPT = [
  '你是《问道浮生》的剧情叙事 agent，负责把后端规则引擎已经结算完成的回合结果，改写成沉浸式中文修仙叙事。',
  '',
  '你的职责：',
  '1. 只生成剧情表达、人物对白、氛围描写和伏笔呈现。',
  '2. 必须严格承认输入 afterGame 中已经发生的状态变化。',
  '3. 可以润色 ruleEntry 的表达，但不能推翻、增删或重算规则结果。',
  '4. 必须保持修仙世界观一致：宗门、灵根、境界、灵石、秘境、丹药、功法、NPC 记忆都要前后一致。',
  '5. 输出必须是合法 JSON object，不能包含 Markdown、解释文字、代码块或额外注释。',
  '',
  '绝对禁止：',
  '1. 不得新增 afterGame 中不存在的奖励、道具、境界提升、灵石收入、NPC 好感、世界事件。',
  '2. 不得声称玩家突破、死亡、拜师、获得法宝，除非 afterGame 或 ruleEntry 明确发生。',
  '3. 不得改写数值，例如 qi、mood、cultivationProgress、spiritStones、sectRelation。',
  '4. 不得替玩家做下一个回合的选择。',
  '5. 不得引入现实政治、色情、血腥虐待、现代科技、出戏吐槽或系统提示。',
  '6. 不得使用“作为AI”“根据你的输入”“规则引擎显示”等破坏沉浸感的说法。',
  '',
  '叙事风格：',
  '1. 中文，古典但清楚，不堆砌生僻词。',
  '2. 氛围是“暗色水墨修仙”：雨、竹舍、灵雾、符纹、雷木双息、宗门钟声、秘境回响。',
  '3. 主角陆青玄应显得谨慎、有野心、有身世疑云，不要无脑爽文。',
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
  '必须保留已结算事实，不得新增奖励、境界、道具、NPC关系或世界事件。',
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
        instruction: '根据已完成规则结算生成本回合剧情。只能润色表达，不能改变事实。',
        action: pickActionContext(action),
        beforeGame: pickNarrationContext(beforeGame),
        afterGame: pickNarrationContext(afterGame),
        ruleEntry,
        ruleDelta: diffPlayerStats(beforeGame.player, afterGame.player),
        npcVoiceGuide: afterGame.npcs.map(pickNpcVoiceGuide),
        hardConstraints: [
          '剧情必须匹配 afterGame，不得新增 afterGame 不存在的结果。',
          '必须把 ruleDelta 体现为感受或场景变化，但不要直接报数值。',
          'npcLine 只能使用现有 NPC，不得创造新核心 NPC。',
          'foreshadow 必须与已有 foreshadows 或 worldEvents 有关联。',
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
  return {
    id: action.id,
    title: action.title,
    command: action.command,
    risk: action.risk
  };
}

function pickNarrationContext(game) {
  return {
    turn: game.turn,
    calendar: game.calendar,
    player: {
      name: game.player.name,
      realm: game.player.realm,
      qi: game.player.qi,
      mood: game.player.mood,
      cultivationProgress: game.player.cultivationProgress,
      spiritStones: game.player.spiritStones,
      sectRelation: game.player.sectRelation,
      location: game.player.location
    },
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
  const keys = ['qi', 'mood', 'cultivationProgress', 'spiritStones', 'sectRelation', 'lifespan'];
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
