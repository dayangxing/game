const ACTION_TTL_MS = 30 * 60 * 1000;

const VIEW_ACTIONS = {
  home: [
    { title: '静坐调息', icon: '息', command: '闭关修炼一日，稳固丹田灵气', meta: '恢复灵气', risk: 'low' },
    { title: '拜会同门', icon: '友', command: '找林师姐打听雾隐秘境的消息', meta: '提升牵绊', risk: 'low' },
    { title: '接取委托', icon: '令', command: '去执事堂接巡山任务', meta: '宗门声望', risk: 'medium' }
  ],
  cultivation: [
    { title: '三月闭关', icon: '闭', command: '闭关修炼三月，尝试突破', meta: '破境进度', risk: 'medium' },
    { title: '稳固雷息', icon: '雷', command: '继续闭关稳固境界，压住雷木双息反噬', meta: '降低风险', risk: 'low' },
    { title: '请教瓶颈', icon: '问', command: '找玄衡长老请教突破瓶颈', meta: '师门指点', risk: 'low' }
  ],
  skills: [
    { title: '青木诀', icon: '木', command: '研读青木诀，尝试让木息滋养经脉', meta: '心法', risk: 'low' },
    { title: '掌心雷', icon: '雷', command: '演练掌心雷，测试雷灵根的斗法威力', meta: '术法', risk: 'medium' },
    { title: '御风步', icon: '风', command: '修习御风步，在演武场磨炼身法', meta: '身法', risk: 'low' }
  ],
  realm: [
    { title: '后山探雾', icon: '山', command: '前往后山探索灵脉', meta: '探索', risk: 'medium' },
    { title: '石门符纹', icon: '符', command: '推开藤蔓后的石门，查验雾隐秘境符纹', meta: '奇遇', risk: 'high' },
    { title: '巡山斩妖', icon: '妖', command: '接取巡山斩妖委托，调查妖兽越界', meta: '战斗', risk: 'high' }
  ],
  bag: [
    { title: '炼制聚气丹', icon: '丹', command: '炼制一炉聚气丹', meta: '丹药', risk: 'low' },
    { title: '坊市购药', icon: '市', command: '去坊市购买雷纹草', meta: '材料', risk: 'low' },
    { title: '整理法器', icon: '器', command: '整理行囊中的旧符与法器，准备进入秘境', meta: '备战', risk: 'low' }
  ]
};

const VIEW_LABELS = {
  home: '洞府',
  cultivation: '修炼',
  skills: '功法',
  realm: '秘境',
  bag: '行囊'
};

export function hasView(viewId) {
  return Object.hasOwn(VIEW_ACTIONS, viewId);
}

export function createDailyActions({ game, viewId, now, sequenceStart = 0 }) {
  const viewActions = VIEW_ACTIONS[viewId] ?? VIEW_ACTIONS.home;
  const expiresAt = new Date(now.getTime() + ACTION_TTL_MS).toISOString();
  const suggestion = game.suggestions?.[0]
    ? [{ title: '天机建议', icon: '机', command: game.suggestions[0], meta: '规则建议', risk: 'medium' }]
    : [];

  return [...viewActions, ...suggestion].map((action, index) => ({
    id: `act_${game.turn}_${viewId}_${sequenceStart + index}`,
    title: action.title,
    icon: action.icon,
    command: action.command,
    meta: action.meta,
    source: 'fallback',
    risk: action.risk,
    storyHook: buildStoryHook(viewId, action),
    expiresAt
  }));
}

function buildStoryHook(viewId, action) {
  const label = VIEW_LABELS[viewId] ?? VIEW_LABELS.home;
  return [
    `当前界面：${label}`,
    `行动名称：${action.title}`,
    `行动指令：${action.command}`,
    '生成要求：规则先结算，叙事只能润色已发生的结果。'
  ].join('\n');
}
