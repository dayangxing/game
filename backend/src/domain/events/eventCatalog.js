export const TRUTH_FLAGS = [
  'lifespan_mark',
  'mist_archive',
  'bronze_bell',
  'sect_elder_split',
  'ascension_contract',
  'heaven_gate_key'
];

export const EVENT_CATALOG = [
  event('cultivation_breathing', '晨起吐纳', 'cultivation', ['cultivation', 'home'], [
    choice('steady', '稳住周天', '闭关修炼一日，稳固丹田灵气', 'low', [
      stat('player.qi', 8),
      stat('player.cultivationProgress', 8)
    ], '你收束杂念，让灵气缓缓行过周天。')
  ]),
  event('cultivation_lifespan_mark', '命火微暗', 'cultivation', ['cultivation'], [
    choice('inspect', '内观命火', '检查寿元异常流失的源头', 'medium', [
      flag('lifespan_mark', true),
      stat('player.mood', -3),
      futureEvent('heaven_contract_echo')
    ], '你在丹田深处看见一缕像契印般的灰痕。')
  ]),
  event('breakthrough_bottleneck', '瓶颈松动', 'cultivation', ['cultivation'], [
    choice('attempt', '尝试破境', '借丹药与心境尝试突破瓶颈', 'high', [
      stat('player.cultivationProgress', 22),
      stat('player.qi', -12),
      flag('breakthrough_attempted', true)
    ], '经脉一阵灼痛，瓶颈裂开细纹。')
  ]),
  event('alchemy_gather_dew', '晨露采药', 'economy', ['bag', 'realm'], [
    choice('gather', '采集凝露草', '去药圃采集凝露草', 'low', [
      item('materials.凝露草', 2)
    ], '你在药圃边缘采得几株凝露草。')
  ]),
  event('alchemy_make_qi_pill', '丹房试火', 'economy', ['bag'], [
    choice('brew', '炼制聚气丹', '消耗凝露草炼制聚气丹', 'medium', [
      item('materials.凝露草', -1),
      item('pills.聚气丹', 1)
    ], '丹炉轻响，一枚温润聚气丹滚入玉盘。')
  ]),
  event('sect_trial_notice', '宗门小比告示', 'sect', ['home', 'cultivation'], [
    choice('join', '报名小比', '报名参加青云宗外门小比', 'medium', [
      stat('player.sectRelation', 5),
      sect('contribution', 10),
      flag('sect_trial_joined', true)
    ], '执事在名册上写下你的名字。')
  ]),
  event('sect_elder_split', '长老争执', 'sect', ['home'], [
    choice('listen', '旁听争执', '旁听长老关于雾隐秘境的争执', 'low', [
      flag('sect_elder_split', true),
      futureEvent('elder_private_warning')
    ], '你听见封门与开门两种截然不同的意见。')
  ]),
  event('mist_bronze_bell', '雾中青铜铃', 'realm', ['realm'], [
    choice('approach', '靠近铜铃', '靠近雾隐秘境中的青铜铃', 'medium', [
      flag('bronze_bell', true),
      stat('player.qi', -5),
      futureEvent('mist_archive_fragment')
    ], '铜铃无风自鸣，像是在回应你的灵根。')
  ]),
  event('mist_archive_fragment', '石刻残档', 'realm', ['realm'], [
    choice('copy', '拓下石刻', '拓下飞升者名录残片', 'medium', [
      flag('mist_archive', true),
      futureEvent('ascension_contract_echo')
    ], '石刻上的飞升者名录与灾年重合。')
  ]),
  event('heaven_contract_echo', '天门契影', 'heaven', ['home', 'cultivation'], [
    choice('read', '研读契影', '研读古修残卷中的天门契影', 'high', [
      flag('ascension_contract', true),
      stat('player.mood', -8)
    ], '残卷写明飞升前必须以命格签契。')
  ]),
  event('heaven_gate_key_fragment', '秘钥碎片', 'realm', ['realm'], [
    choice('take', '收起碎片', '收起天门核心秘钥碎片', 'high', [
      flag('heaven_gate_key', true),
      item('materials.天门碎片', 1)
    ], '碎片冰冷，边缘刻着雾隐道庭的旧印。')
  ]),
  event('market_injured_cultivator', '坊市受伤散修', 'karma', ['home', 'bag'], [
    choice('save', '赠丹救人', '赠丹救下受伤散修', 'low', [
      karma(12),
      relation('lin_shijie', 4),
      flag('saved_injured_cultivator', true),
      futureEvent('old_friend_returns')
    ], '你赠丹救人，在对方眼中留下一点善缘。'),
    choice('rob', '夺走玉简', '趁乱夺走散修怀中玉简', 'high', [
      evil(15),
      item('materials.残缺玉简', 1),
      futureEvent('vengeful_spirit')
    ], '你夺走玉简，背后却传来一声怨毒低笑。')
  ]),
  event('old_friend_returns', '故人报恩', 'social', ['home'], [
    choice('accept', '接受回报', '接受昔日散修送来的秘境线索', 'low', [
      karma(5),
      futureEvent('mist_archive_fragment')
    ], '昔日散修送来一枚雾隐秘境边图。')
  ], { requiresFutureEvent: 'old_friend_returns' }),
  event('vengeful_spirit', '冤魂索命', 'karma', ['cultivation'], [
    choice('resist', '镇压怨魂', '镇压被夺宝引来的怨魂', 'high', [
      evil(-3),
      stat('player.qi', -10),
      stat('player.mood', -8)
    ], '怨魂散去，因果却没有真正结束。')
  ], { requiresFutureEvent: 'vengeful_spirit' }),
  event('lin_invitation', '师姐邀约', 'social', ['home', 'realm'], [
    choice('go', '共探后山', '与林师姐共探后山雾线', 'medium', [
      relation('lin_shijie', 8),
      futureEvent('mist_bronze_bell')
    ], '林师姐在雾线前停步，示意你听铃声。')
  ]),
  event('black_market_offer', '黑市邀约', 'economy', ['bag'], [
    choice('trade', '交换雷纹草', '用灵石换取雷纹草', 'medium', [
      stat('player.spiritStones', -25),
      item('materials.雷纹草', 2),
      evil(2)
    ], '黑市商人递来两株雷纹草。')
  ]),
  event('demon_beast_patrol', '巡山斩妖', 'realm', ['realm'], [
    choice('fight', '接取巡山委托', '接取巡山斩妖委托', 'high', [
      stat('player.qi', -12),
      stat('player.sectRelation', 6),
      sect('contribution', 15)
    ], '你在山道斩退低阶妖兽。')
  ]),
  event('master_guidance', '长老指点', 'sect', ['cultivation', 'skills'], [
    choice('ask', '请教瓶颈', '向玄衡长老请教突破瓶颈', 'low', [
      stat('player.cultivationProgress', 10),
      relation('xuanheng', 5)
    ], '玄衡长老指出你周天里最危险的一处逆行。')
  ])
];

function event(id, title, category, viewIds, choices, trigger = {}) {
  return { id, title, category, priority: 10, weight: 1, trigger: { viewIds, ...trigger }, entryText: title, choices };
}

function choice(id, label, command, risk, effects, text) {
  return { id, label, command, risk, success: { text, effects } };
}

function stat(path, delta) {
  return { type: 'stat', path, delta };
}

function item(path, delta) {
  return { type: 'item', path, delta };
}

function flag(id, value) {
  return { type: 'flag', id, value };
}

function futureEvent(id) {
  return { type: 'futureEvent', id };
}

function relation(npcId, delta) {
  return { type: 'relation', npcId, delta };
}

function sect(path, delta) {
  return { type: 'sect', path, delta };
}

function karma(delta) {
  return { type: 'karma', delta };
}

function evil(delta) {
  return { type: 'evil', delta };
}
