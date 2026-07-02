const ACTIONS = {
  cultivate: ['修炼', '闭关', '突破', '吐纳', '稳固'],
  explore: ['探索', '前往', '秘境', '后山', '灵脉', '游历'],
  social: ['打听', '拜师', '请教', '交谈', '林师姐', '长老', '道友'],
  alchemy: ['炼丹', '丹药', '药草', '丹炉'],
  combat: ['挑战', '比试', '斗法', '妖兽', '斩妖']
};

const EVENT_POOL = [
  { title: '青云宗试炼开启', detail: '外门钟声三响，新一轮入门试炼将在七日后举行。' },
  { title: '雾隐秘境现世', detail: '后山雾气倒卷，疑似古修洞府重见天日。' },
  { title: '灵气潮汐上升', detail: '东岭灵脉复苏，闭关修炼的收益短暂提高。' },
  { title: '坊市拍卖预告', detail: '一枚雷纹筑基丹将在月末拍卖，已有多位弟子暗中筹资。' },
  { title: '妖兽越界', detail: '十万大山边缘出现低阶妖兽，宗门发布巡山委托。' }
];

const INITIAL_TIMELINE = [
  { type: 'season', title: '玄历三年 春', detail: '青云山雨后初晴，外门弟子各自寻路。' }
];

export function createGame(seed = Date.now()) {
  return {
    seed,
    turn: 0,
    mode: 'mock',
    calendar: { year: 3, season: '春', month: 1 },
    player: {
      name: '陆青玄',
      origin: '山野孤子',
      realm: '炼气七层',
      spiritualRoot: '雷木双灵根',
      lifespan: 93,
      spiritStones: 126,
      qi: 74,
      mood: 68,
      cultivationProgress: 42,
      sectRelation: 32,
      location: '青云宗外门'
    },
    npcs: [
      {
        name: '林师姐',
        role: '内门弟子',
        affinity: 34,
        tone: '温和而谨慎',
        memories: ['记得陆青玄曾在雨夜替她守过药田。']
      },
      {
        name: '玄衡长老',
        role: '传功长老',
        affinity: 18,
        tone: '庄重严厉',
        memories: ['认为陆青玄灵根驳杂，但心性尚可。']
      }
    ],
    worldEvents: [
      { title: '青云宗春试将近', detail: '外门弟子都在准备争夺内门名额。', turn: 0 }
    ],
    foreshadows: [
      '雷木双灵根可能引来异常天劫。',
      '雾隐秘境与陆青玄身世存在隐约关联。'
    ],
    timeline: [...INITIAL_TIMELINE],
    log: [
      {
        id: 'opening',
        title: '山门初醒',
        command: '开局',
        body: '春雨洗过青云山，石阶间浮着淡淡灵雾。陆青玄从外门竹舍醒来，丹田中一缕雷光与木息相互纠缠，像是在催促他踏出今日的第一步。',
        npcLine: '林师姐递来一枚温热的辟谷丹：“春试近了，你若还想入内门，今日便别再偷懒。”',
        worldEvent: '青云宗春试将近'
      }
    ],
    suggestions: ['闭关修炼三月，尝试突破', '找林师姐打听雾隐秘境', '前往后山探索灵脉']
  };
}

export function advanceTurn(state, command) {
  const cleanCommand = (command || '').trim();
  if (!cleanCommand) {
    return withLog(state, {
      title: '心念未定',
      command: '空指令',
      body: '你站在青石道旁，心念散乱，未能聚起可执行的念头。风从竹林穿过，像是在提醒你先定下方向。',
      npcLine: '玄衡长老的声音从远处传来：“修行最忌心浮。”',
      worldEvent: ''
    }, ['闭关修炼一日', '去外门执事堂接任务', '找林师姐请教修行']);
  }

  const action = classifyAction(cleanCommand);
  const next = cloneState(state);
  next.turn += 1;
  next.calendar = advanceCalendar(next.calendar);
  next.player = evolvePlayer(next.player, action);

  const targetNpcName = cleanCommand.includes('长老') ? '玄衡长老' : '林师姐';
  next.npcs = next.npcs.map((npc) => evolveNpc(npc, action, cleanCommand, targetNpcName));

  const event = pickWorldEvent(next.seed, next.turn, action);
  next.worldEvents = [...next.worldEvents, { ...event, turn: next.turn }];
  next.timeline = [
    ...next.timeline,
    {
      type: action,
      title: event.title,
      detail: `${formatDate(next.calendar)}：${event.detail}`
    }
  ];

  const entry = narrateTurn(next, cleanCommand, action, event, targetNpcName);
  next.log = [...next.log, entry];
  next.suggestions = nextSuggestions(action);
  next.foreshadows = updateForeshadows(next.foreshadows, action, event);
  next.seed = next.seed + 17 + next.turn;
  return next;
}

export function exportNovel(state) {
  const header = [
    '《问道浮生》',
    `主角：${state.player.name}`,
    `境界：${state.player.realm}`,
    `时间：${formatDate(state.calendar)}`,
    ''
  ].join('\n');

  const chapters = state.log.map((entry, index) => {
    return [
      `第${index + 1}节 ${entry.title}`,
      `行动：${entry.command}`,
      entry.body,
      entry.npcLine,
      entry.worldEvent ? `天机：${entry.worldEvent}` : ''
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  const memories = state.npcs
    .map((npc) => `${npc.name}：${npc.memories.join('；')}`)
    .join('\n');

  return `${header}${chapters}\n\n人物记忆\n${memories}\n`;
}

export function classifyAction(command) {
  for (const [action, words] of Object.entries(ACTIONS)) {
    if (words.some((word) => command.includes(word))) return action;
  }
  return 'freeform';
}

function evolvePlayer(player, action) {
  const changes = {
    cultivate: { qi: 11, mood: 3, cultivationProgress: 16, spiritStones: -4, sectRelation: 1 },
    explore: { qi: -8, mood: 7, cultivationProgress: 6, spiritStones: 9, sectRelation: 2 },
    social: { qi: -2, mood: 5, cultivationProgress: 4, spiritStones: 0, sectRelation: 5 },
    alchemy: { qi: -5, mood: 2, cultivationProgress: 7, spiritStones: 14, sectRelation: 2 },
    combat: { qi: -13, mood: 6, cultivationProgress: 10, spiritStones: 18, sectRelation: 4 },
    freeform: { qi: -1, mood: 2, cultivationProgress: 5, spiritStones: 1, sectRelation: 1 }
  }[action];

  const progress = clamp(player.cultivationProgress + changes.cultivationProgress, 0, 100);
  const realm = progress >= 100 ? '炼气八层' : player.realm;

  return {
    ...player,
    realm,
    qi: clamp(player.qi + changes.qi, 0, 100),
    mood: clamp(player.mood + changes.mood, 0, 100),
    cultivationProgress: realm === player.realm ? progress : progress - 100,
    spiritStones: Math.max(0, player.spiritStones + changes.spiritStones),
    sectRelation: clamp(player.sectRelation + changes.sectRelation, 0, 100),
    location: action === 'explore' ? '青云后山' : player.location
  };
}

function evolveNpc(npc, action, command, targetNpcName) {
  if (npc.name !== targetNpcName && action !== 'social') return npc;

  const memory = memoryFromCommand(action, command);
  const affinityDelta = action === 'social' ? 6 : 2;
  return {
    ...npc,
    affinity: clamp(npc.affinity + affinityDelta, 0, 100),
    memories: [...npc.memories.slice(-3), memory]
  };
}

function memoryFromCommand(action, command) {
  if (command.includes('雾隐秘境')) return '记下陆青玄正在追查雾隐秘境的线索。';
  if (action === 'cultivate') return '见证陆青玄闭关后气息更趋凝实。';
  if (action === 'combat') return '听闻陆青玄主动挑战强敌，胆气不弱。';
  if (action === 'alchemy') return '知道陆青玄尝试以丹道补足修为。';
  return `记得陆青玄曾说：“${command.slice(0, 18)}”。`;
}

function narrateTurn(state, command, action, event, targetNpcName) {
  const titleByAction = {
    cultivate: '闭关试炼',
    explore: '雾中探路',
    social: '问道同门',
    alchemy: '炉火微明',
    combat: '斗法惊雷',
    freeform: '命途微澜'
  };
  const sceneByAction = {
    cultivate: `你在竹舍内布下简易聚灵阵，雷木双息沿经脉缓慢周天。第九次吐纳时，丹田忽然传出细微雷鸣，${state.player.realm}的瓶颈像被春水浸软。`,
    explore: '你踏入后山雾线，草叶上的露珠倒映出破碎符纹。越往深处走，灵气越像有自己的潮汐，牵引你靠近一处被藤蔓遮住的石门。',
    social: '你收起杂念，向同门请教近日宗门异动。话音刚落，檐下风铃无风自响，仿佛有人在暗处也听见了这场谈话。',
    alchemy: '丹炉下青火初稳，药草香气与雷息相冲。你小心压住火候，让药性在炉腹里一点点凝成温润的光。',
    combat: '演武场上砂石震动，你以木息护住心脉，再引雷劲入掌。对手后退半步，围观弟子间响起压低的惊呼。',
    freeform: '你的念头落入这方天地，天机随之轻轻偏转。未必每一步都有前人经验，却都可能成为日后因果的开端。'
  };

  return {
    id: `turn-${state.turn}`,
    title: titleByAction[action],
    command,
    body: `${sceneByAction[action]} ${event.detail}`,
    npcLine: npcLineFor(action, targetNpcName),
    worldEvent: event.title
  };
}

function npcLineFor(action, targetNpcName) {
  if (targetNpcName === '玄衡长老') {
    return `玄衡长老拂袖道：“根骨只是舟，心性才是渡河之人。你今日所行，宗门会记下。”`;
  }
  const lines = {
    cultivate: '林师姐低声提醒：“突破前先稳住雷息，别让木气被它焚尽。”',
    explore: '林师姐将一枚旧符塞给你：“雾隐秘境若真开了，见到青铜铃便退三步。”',
    social: '林师姐望向后山：“雾隐秘境不是传闻那么简单，你若要去，最好先找一份旧地图。”',
    alchemy: '林师姐笑了笑：“丹成不必求满炉，有一枚能救命，便不算失败。”',
    combat: '林师姐抱剑立在场边：“这一掌有雷意了，但收势还差半寸。”',
    freeform: '林师姐点头：“这条路少有人走，但少有人走并不代表不能走。”'
  };
  return lines[action];
}

function nextSuggestions(action) {
  const suggestions = {
    cultivate: ['继续闭关稳固境界', '找玄衡长老请教突破瓶颈', '服用一枚聚气丹冲击炼气八层'],
    explore: ['推开藤蔓后的石门', '记录符纹后返回宗门', '沿灵气潮汐寻找源头'],
    social: ['找林师姐打听雾隐秘境的消息', '拜见玄衡长老求取功法', '去执事堂接巡山任务'],
    alchemy: ['炼制聚气丹', '去坊市购买雷纹草', '请林师姐鉴定丹药'],
    combat: ['挑战外门第十席', '接取巡山斩妖委托', '复盘刚才的斗法破绽'],
    freeform: ['闭关修炼一日', '前往后山探索灵脉', '找林师姐打听消息']
  };
  return suggestions[action];
}

function pickWorldEvent(seed, turn, action) {
  const actionOffset = Object.keys(ACTIONS).indexOf(action);
  const index = Math.abs(seed + turn * 7 + actionOffset) % EVENT_POOL.length;
  return EVENT_POOL[index];
}

function updateForeshadows(foreshadows, action, event) {
  const extra = {
    cultivate: '若陆青玄强行突破，雷木双息可能产生反噬。',
    explore: '雾隐秘境石门后的铃声似乎只回应雷灵根。',
    social: '林师姐对雾隐秘境知道得太多，或许另有隐情。',
    alchemy: '雷纹筑基丹的主药可能出自雾隐秘境。',
    combat: '外门斗法排名变化会影响春试分组。',
    freeform: `${event.title}可能改变青云宗未来三月的局势。`
  }[action];
  return [...new Set([...foreshadows.slice(-3), extra])];
}

function withLog(state, entry, suggestions) {
  const next = cloneState(state);
  next.log = [...next.log, { ...entry, id: `turn-${next.turn}-empty` }];
  next.suggestions = suggestions;
  return next;
}

function advanceCalendar(calendar) {
  const month = calendar.month + 1;
  const seasons = ['春', '夏', '秋', '冬'];
  const seasonIndex = Math.floor((month - 1) / 3) % seasons.length;
  const year = calendar.year + Math.floor((month - 1) / 12);
  return {
    year,
    season: seasons[seasonIndex],
    month: ((month - 1) % 12) + 1
  };
}

function formatDate(calendar) {
  return `玄历${calendar.year}年 ${calendar.season} 第${calendar.month}月`;
}

function cloneState(state) {
  return structuredClone(state);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
