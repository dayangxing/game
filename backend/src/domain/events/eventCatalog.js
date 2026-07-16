export const TRUTH_FLAGS = [
  'lifespan_mark',
  'mist_archive',
  'bronze_bell',
  'sect_elder_split',
  'ascension_contract',
  'heaven_gate_key'
];

const EVENT_METADATA = {
  qingyun_life_register: eventMetadata('prologue', 'mainline', '青云宗命簿房', '冷静中透着不安', ['灰印', '纸页', '烛火'], ['xuanheng']),
  master_guidance: eventMetadata('prologue', 'side', '玄衡长老的竹舍', '克制、耐心', ['竹香', '雷息', '石案'], ['xuanheng']),
  lin_invitation: eventMetadata('prologue', 'side', '青云宗后山雾线', '亲近而谨慎', ['后山', '薄雾', '铃声'], ['lin_shijie']),
  cultivation_lifespan_mark: eventMetadata('prologue', 'mainline', '外门静室', '疑惧、压抑', ['命火', '灰痕', '丹田'], []),
  sect_trial_notice: eventMetadata('prologue', 'mainline', '青云宗外门告示墙', '喧闹中藏着审视', ['钟声', '名册', '墨迹'], []),
  alchemy_gather_dew: eventMetadata('prologue', 'side', '青云宗药圃', '清淡、安稳', ['晨露', '药香', '竹叶'], []),
  cultivation_breathing: eventMetadata('qi', 'side', '外门静室', '沉静、专注', ['吐纳', '雷息', '木灵'], []),
  breakthrough_bottleneck: eventMetadata('qi', 'mainline', '闭关石室', '紧绷、灼热', ['裂隙', '经脉', '冷汗'], []),
  alchemy_make_qi_pill: eventMetadata('qi', 'side', '青云宗丹房', '专注、微喜', ['丹火', '药香', '玉盘'], []),
  market_injured_cultivator: eventMetadata('qi', 'side', '青云宗坊市', '混乱、试探', ['血迹', '玉简', '雨棚'], []),
  old_friend_returns: eventMetadata('qi', 'mainline', '坊市旧巷', '温和中带着隐瞒', ['旧伞', '雾图', '脚步'], []),
  sect_elder_split: eventMetadata('foundation', 'mainline', '青云宗议事殿外', '压抑、分裂', ['钟声', '门缝', '低语'], ['xuanheng']),
  demon_beast_patrol: eventMetadata('foundation', 'side', '青云宗巡山道', '肃杀、清醒', ['山风', '妖息', '剑鸣'], []),
  lin_shijie_warning: eventMetadata('foundation', 'side', '后山雨亭', '低沉、真挚', ['雨声', '旧铃', '湿木'], ['lin_shijie']),
  elder_private_warning: eventMetadata('foundation', 'mainline', '玄衡长老私室', '沉重、坦白', ['契痕', '灯影', '旧卷'], ['xuanheng']),
  sect_archive_key: eventMetadata('golden_core', 'mainline', '青云宗藏经阁', '谨慎、幽深', ['钥牌', '尘埃', '禁制'], ['lin_shijie']),
  black_market_offer: eventMetadata('golden_core', 'side', '坊市暗巷', '暧昧、诱惑', ['黑灯', '灵石', '草药'], []),
  xuanheng_private_confession: eventMetadata('golden_core', 'mainline', '玄衡长老旧院', '悲凉、克制', ['契痕', '旧伤', '风铃'], ['xuanheng']),
  mist_bronze_bell: eventMetadata('mist', 'mainline', '雾隐秘境边缘', '诡谲、克制', ['铜铃', '白雾', '残碑'], ['lin_shijie']),
  mist_archive_fragment: eventMetadata('mist', 'mainline', '雾隐秘境残碑林', '冷寂、怀疑', ['残碑', '石刻', '回声'], []),
  mist_lantern_path: eventMetadata('mist', 'mainline', '雾隐秘境雾灯石径', '诱导、危险', ['雾灯', '石径', '铃声'], []),
  mist_archive_full: eventMetadata('mist', 'mainline', '雾隐秘境深档库', '震骇、肃穆', ['石档', '白雾', '回声'], []),
  heaven_gate_key_fragment: eventMetadata('mist', 'mainline', '秘境天门残台', '冰冷、决绝', ['碎片', '雾门', '寒光'], []),
  heaven_contract_echo: eventMetadata('ascension_scam', 'mainline', '青云宗古卷室', '阴冷、压迫', ['契影', '古卷', '命灯'], []),
  lifespan_debt_collector: eventMetadata('ascension_scam', 'side', '梦中命灯殿', '荒诞、窒息', ['命灯', '灰烬', '账帖'], []),
  false_ascender_name: eventMetadata('ascension_scam', 'mainline', '青云宗密档室', '惊疑、冷峻', ['名录', '批注', '墨痕'], []),
  heaven_gate_tally: eventMetadata('ascension_scam', 'mainline', '天门账房幻境', '森严、失真', ['账帖', '纹片', '回声'], []),
  contract_scar_recurrence: eventMetadata('ascension_scam', 'side', '外门命灯台', '灼痛、决绝', ['契痕', '灰火', '命灯'], []),
  vengeful_spirit: eventMetadata('finale', 'side', '青云宗夜雨山道', '怨恨、肃杀', ['怨魂', '雨幕', '玉简'], []),
  qi_failed_breakthrough_recovery: eventMetadata('qi', 'side', '受挫后的药庐', '疼痛中寻找转机', ['药香', '裂脉', '冷汗'], []),
  qi_lifespan_alarm: eventMetadata('qi', 'mainline', '夜半命灯台', '惊惧、克制', ['灰印', '命灯', '纸页'], []),
  foundation_trial_verdict: eventMetadata('foundation', 'mainline', '筑基试场高台', '肃静、审判', ['法印', '名册', '钟声'], []),
  foundation_heart_demon: eventMetadata('foundation', 'side', '筑基心魔境', '压迫、孤独', ['心火', '旧影', '裂隙'], ['xuanheng']),
  foundation_sect_oath: eventMetadata('foundation', 'side', '青云宗祖师堂', '庄重、分岔', ['香火', '玉简', '誓纹'], []),
  mist_entry_authorization: eventMetadata('golden_core', 'mainline', '青云宗封门石台', '谨慎、试探', ['封印', '令牌', '雾气'], ['xuanheng']),
  golden_core_formation: eventMetadata('golden_core', 'mainline', '金丹闭关雷室', '凝重、灼烈', ['丹火', '雷光', '经脉'], []),
  golden_core_storm: eventMetadata('golden_core', 'side', '金丹天雷台', '宏大、凶险', ['天雷', '焦木', '雨幕'], []),
  golden_core_npc_bargain: eventMetadata('golden_core', 'side', '后山雾线石亭', '亲近、试探', ['雾线', '茶盏', '旧图'], ['lin_shijie']),
  mist_white_mist_price: eventMetadata('mist', 'side', '雾隐秘境白雾层', '窒息、诱惑', ['白雾', '铜铃', '冷骨'], []),
  mist_bell_keeper: eventMetadata('mist', 'mainline', '雾隐秘境守铃台', '诡秘、肃穆', ['铜铃', '回声', '残碑'], ['lin_shijie']),
  mist_archive_countermark: eventMetadata('mist', 'side', '雾隐秘境石档库', '危险、专注', ['残碑', '墨痕', '白雾'], []),
  ascension_contract_accounting: eventMetadata('ascension_scam', 'mainline', '天门契约账房', '冰冷、荒谬', ['账本', '命灯', '契影'], []),
  ascension_returned_message: eventMetadata('ascension_scam', 'mainline', '上界回信石室', '悲凉、清醒', ['回信', '尘封', '墨迹'], []),
  ascension_scam_witness: eventMetadata('ascension_scam', 'side', '宗门旧碑前', '犹疑、愤怒', ['旧碑', '香火', '风声'], ['xuanheng']),
  finale_break_contract: eventMetadata('finale', 'mainline', '天门裂隙前', '决绝、清醒', ['契痕', '裂隙', '雷声'], []),
  finale_accept_contract: eventMetadata('finale', 'mainline', '天门白阶', '诱惑、空寂', ['白阶', '天光', '账帖'], []),
  finale_guard_mist: eventMetadata('finale', 'mainline', '雾隐秘境核心', '守望、苍凉', ['白雾', '残碑', '守灯'], ['lin_shijie']),
  finale_sacrifice_lifelong: eventMetadata('finale', 'mainline', '命灯祭台', '悲壮、温柔', ['命灯', '灰烬', '旧铃'], []),
  finale_npc_parting: eventMetadata('finale', 'side', '秘境出口雨幕', '不舍、克制', ['雨幕', '旧伞', '雾灯'], ['lin_shijie']),
  finale_last_lifespan: eventMetadata('finale', 'side', '寿元终章命灯台', '寂静、回望', ['命灯', '白发', '纸页'], [])
};

export const BREAKTHROUGH_EVENT = event('breakthrough_attempt', '破境契机', 'cultivation', ['cultivation'], [
  choice('attempt', '尝试突破', '尝试突破', 'high', [], '你调息凝神，朝瓶颈发起冲击。')
]);

export const EVENT_CATALOG = [
  event('cultivation_breathing', '晨起吐纳', 'cultivation', ['cultivation', 'home'], [
    choice('steady', '稳住周天', '闭关修炼一日，稳固丹田灵气', 'low', [
      stat('player.qi', 8),
      stat('player.cultivationProgress', 8)
    ], '你收束杂念，让灵气缓缓行过周天。'),
    choice('force', '强行冲关', '强行压榨灵气冲击修为瓶颈', 'high', [
      stat('player.cultivationProgress', 16),
      stat('player.qi', -10)
    ], '你把灵气逼过经脉最窄处，丹田传来一声细微的裂响。')
  ]),
  event('cultivation_lifespan_mark', '命火微暗', 'cultivation', ['cultivation'], [
    choice('inspect', '内观命火', '检查寿元异常流失的源头', 'medium', [
      flag('lifespan_mark', true),
      stat('player.mood', -3),
      futureEvent('heaven_contract_echo')
    ], '你在丹田深处看见一缕像契印般的灰痕。'),
    choice('suppress', '暂压灰痕', '暂时压制命火旁的灰色契痕', 'high', [
      stat('player.mood', 2),
      stat('player.lifespan', -2)
    ], '你以灵息盖住灰痕，命灯却像被谁从远处拨动了一下。')
  ]),
  event('breakthrough_bottleneck', '瓶颈松动', 'cultivation', ['cultivation'], [
    choice('attempt', '尝试破境', '借丹药与心境尝试突破瓶颈', 'high', [
      stat('player.cultivationProgress', 22),
      stat('player.qi', -12),
      flag('breakthrough_attempted', true)
    ], '经脉一阵灼痛，瓶颈裂开细纹。'),
    choice('stabilize', '稳住瓶颈', '先稳住周天再寻找破境时机', 'low', [
      stat('player.cultivationProgress', 10),
      stat('player.qi', -4)
    ], '你收回冲势，裂纹没有扩大，却也没有真正消失。')
  ]),
  event('alchemy_gather_dew', '晨露采药', 'economy', ['bag', 'realm'], [
    choice('gather', '采集凝露草', '去药圃采集凝露草', 'low', [
      item('materials.凝露草', 2)
    ], '你在药圃边缘采得几株凝露草。'),
    choice('test_soil', '试探灵土', '检查药圃灵土寻找更好的凝露草', 'medium', [
      item('materials.凝露草', 1),
      stat('player.mood', -2)
    ], '你拨开湿土辨认灵脉，指缝沾上一层微苦的青泥。')
  ]),
  event('alchemy_make_qi_pill', '丹房试火', 'economy', ['bag'], [
    choice('brew', '炼制聚气丹', '消耗凝露草炼制聚气丹', 'medium', [
      item('materials.凝露草', -1),
      item('pills.聚气丹', 1)
    ], '丹炉轻响，一枚温润聚气丹滚入玉盘。'),
    choice('refine', '精炼一炉', '消耗更多凝露草精炼聚气丹', 'high', [
      item('materials.凝露草', -2),
      item('pills.聚气丹', 2)
    ], '丹火压成一线，第二枚聚气丹带着近乎透明的丹纹出炉。')
  ]),
  event('sect_trial_notice', '宗门小比告示', 'sect', ['home', 'cultivation'], [
    choice('join', '报名小比', '报名参加青云宗外门小比', 'medium', [
      stat('player.sectRelation', 5),
      sect('contribution', 10),
      flag('sect_trial_joined', true)
    ], '执事在名册上写下你的名字。'),
    choice('observe', '先观小比', '报名旁观青云宗外门小比', 'low', [
      stat('player.sectRelation', 2),
      flag('sect_trial_observed', true)
    ], '你没有立刻登台，只把每一场比试的出手顺序记在心里。')
  ]),
  event('sect_elder_split', '长老争执', 'sect', ['home'], [
    choice('listen', '旁听争执', '旁听长老关于雾隐秘境的争执', 'low', [
      flag('sect_elder_split', true),
      futureEvent('elder_private_warning')
    ], '你听见封门与开门两种截然不同的意见。'),
    choice('interrupt', '当堂插话', '在长老争执时公开质疑封门决定', 'high', [
      stat('player.sectRelation', -5),
      flag('sect_elder_split', true)
    ], '你的话落在殿前，争执短暂止住，几道目光同时压了过来。')
  ]),
  event('mist_bronze_bell', '雾中青铜铃', 'realm', ['realm'], [
    choice('approach', '靠近铜铃', '靠近雾隐秘境中的青铜铃', 'medium', [
      flag('bronze_bell', true),
      treasure('calm_lotus_incense'),
      stat('player.qi', -5),
      futureEvent('mist_archive_fragment')
    ], '铜铃无风自鸣，像是在回应你的灵根。'),
    choice('listen', '停步听铃', '在雾隐秘境边缘静听青铜铃回声', 'low', [
      stat('player.qi', -2),
      flag('mist_bell_listened', true)
    ], '你没有伸手，只让铃声穿过白雾，辨出其中夹着一声迟来的回响。')
  ]),
  event('mist_archive_fragment', '石刻残档', 'realm', ['realm'], [
    choice('copy', '拓下石刻', '拓下飞升者名录残片', 'medium', [
      flag('mist_archive', true),
      futureEvent('heaven_contract_echo')
    ], '石刻上的飞升者名录与灾年重合。'),
    choice('memorize', '默记石文', '默记飞升者名录残片后离开', 'low', [
      stat('player.mood', -2),
      flag('mist_archive', true)
    ], '你把石文一字不差地记进识海，离开时却发现最后一行正在缓缓变淡。')
  ]),
  event('heaven_contract_echo', '天门契影', 'heaven', ['home', 'cultivation'], [
    choice('read', '研读契影', '研读古修残卷中的天门契影', 'high', [
      flag('ascension_contract', true),
      stat('player.mood', -8)
    ], '残卷写明飞升前必须以命格签契。'),
    choice('burn', '焚毁契影', '焚毁古修残卷中的天门契影', 'high', [
      stat('player.mood', 3),
      stat('player.qi', -5),
      flag('ascension_contract', true)
    ], '火舌吞没契影，灰烬却在半空拼出一枚无人署名的印。')
  ]),
  event('heaven_gate_key_fragment', '秘钥碎片', 'realm', ['realm'], [
    choice('take', '收起碎片', '收起天门核心秘钥碎片', 'high', [
      flag('heaven_gate_key', true),
      item('materials.天门碎片', 1)
    ], '碎片冰冷，边缘刻着雾隐道庭的旧印。'),
    choice('trace', '追索纹路', '沿天门秘钥碎片的旧印追查来源', 'medium', [
      stat('player.qi', -4),
      flag('heaven_key_traced', true)
    ], '你以灵识追过碎片边缘，旧印尽头指向一片没有地图的白雾。')
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
    ], '昔日散修送来一枚雾隐秘境边图。'),
    choice('ask_truth', '追问真相', '追问散修当年为何从雾隐秘境逃回', 'medium', [
      relation('lin_shijie', 2),
      futureEvent('mist_archive_fragment')
    ], '散修没有回答，只把边图翻到背面，那里画着一口不肯停响的铜铃。')
  ], { requiresFutureEvent: 'old_friend_returns' }),
  event('vengeful_spirit', '冤魂索命', 'karma', ['cultivation'], [
    choice('resist', '镇压怨魂', '镇压被夺宝引来的怨魂', 'high', [
      evil(-3),
      stat('player.qi', -10),
      stat('player.mood', -8)
    ], '怨魂散去，因果却没有真正结束。'),
    choice('negotiate', '与魂相谈', '尝试与被夺宝引来的怨魂谈判', 'medium', [
      karma(4),
      stat('player.mood', -4)
    ], '你放下玉简听完怨魂最后一句话，雨声里多了一道迟迟不散的叹息。')
  ], { requiresFutureEvent: 'vengeful_spirit' }),
  event('lin_invitation', '师姐邀约', 'social', ['home', 'realm'], [
    choice('go', '共探后山', '与林师姐共探后山雾线', 'medium', [
      relation('lin_shijie', 8),
      futureEvent('mist_bronze_bell')
    ], '林师姐在雾线前停步，示意你听铃声。'),
    choice('decline', '婉拒邀约', '婉拒林师姐的后山邀约并交换雾线消息', 'low', [
      relation('lin_shijie', 2),
      stat('player.mood', 1)
    ], '林师姐没有勉强，只把一枚被雨水打湿的旧符递到你掌心。')
  ]),
  event('black_market_offer', '黑市邀约', 'economy', ['bag'], [
    choice('trade', '交换雷纹草', '用灵石换取雷纹草', 'medium', [
      stat('player.spiritStones', -25),
      item('materials.雷纹草', 2),
      evil(2)
    ], '黑市商人递来两株雷纹草。'),
    choice('bargain', '压价换草', '用较少灵石换取一株雷纹草', 'low', [
      stat('player.spiritStones', -10),
      item('materials.雷纹草', 1),
      evil(1)
    ], '你把灵石一枚枚推过去，黑市商人盯着你的手，最后吐出一株雷纹草。')
  ]),
  event('demon_beast_patrol', '巡山斩妖', 'realm', ['realm'], [
    choice('fight', '接取巡山委托', '接取巡山斩妖委托', 'high', [
      stat('player.qi', -12),
      stat('player.sectRelation', 6),
      sect('contribution', 15)
    ], '你在山道斩退低阶妖兽。'),
    choice('scout', '先行探路', '先探查巡山道再回报妖兽踪迹', 'low', [
      stat('player.sectRelation', 2),
      sect('contribution', 5)
    ], '你沿着折断的灌木辨出妖兽来路，把最危险的一段山道标在地图上。')
  ]),
  event('master_guidance', '长老指点', 'sect', ['cultivation', 'skills'], [
    choice('ask', '请教瓶颈', '向玄衡长老请教突破瓶颈', 'low', [
      stat('player.cultivationProgress', 10),
      relation('xuanheng', 5)
    ], '玄衡长老指出你周天里最危险的一处逆行。'),
    choice('stabilize', '求稳灵息', '请玄衡长老指点稳固灵息之法', 'low', [
      technique('qingmu_jue'),
      stat('player.qi', 6),
      stat('player.mood', 4),
      relation('xuanheng', 3)
    ], '玄衡长老让你先稳住吐纳节奏，再谈更高层的术诀。'),
    choice('analyze', '拆解术诀', '请玄衡长老拆解掌心雷的运劲诀窍', 'medium', [
      stat('player.cultivationProgress', 6),
      stat('player.qi', -3),
      relation('xuanheng', 4)
    ], '长老以指代笔，在石案上拆开掌心雷的每一道转劲。')
  ]),
  event('qingyun_life_register', '青云命簿复核', 'sect', ['home', 'skills'], [
    choice('inspect', '复核命簿', '陪玄衡长老复核青云宗命簿寿元', 'medium', [
      flag('lifespan_mark', true),
      relation('xuanheng', 3),
      futureEvent('lifespan_debt_collector')
    ], '命簿页脚有一枚淡灰小印，像是有人提前在你的寿元旁记了一笔债。'),
    choice('close', '合上命簿', '合上命簿并请玄衡长老暂缓追查', 'low', [
      relation('xuanheng', 1),
      stat('player.mood', 2)
    ], '你合上命簿，纸页缝里的灰印仍在，仿佛只是换了一个更隐蔽的地方。')
  ]),
  event('sect_archive_key', '藏经阁钥牌', 'sect', ['home', 'skills'], [
    choice('borrow', '借阅旧档', '请林师姐借来雾隐秘境旧档钥牌', 'medium', [
      relation('lin_shijie', 3),
      item('materials.残缺玉简', 1),
      futureEvent('mist_archive_full')
    ], '林师姐把钥牌压在案上，提醒你只看雾隐秘境旧档，不要碰飞升名录。'),
    choice('return', '先还钥牌', '先归还雾隐旧档钥牌并留下查阅请求', 'low', [
      relation('lin_shijie', 2),
      stat('player.sectRelation', 2)
    ], '你没有翻开旧档，只把钥牌推回去，林师姐的神色因此稍稍松动。')
  ]),
  event('lin_shijie_warning', '师姐夜谈', 'social', ['home', 'realm'], [
    choice('listen', '听师姐示警', '听林师姐讲青云宗封门旧事', 'low', [
      relation('lin_shijie', 6),
      futureEvent('elder_private_warning')
    ], '林师姐说青云宗曾有人带队入雾，回来后只剩命簿空页和一枚不肯停响的铜铃。'),
    choice('press', '追问细节', '追问林师姐关于命簿空页的细节', 'medium', [
      relation('lin_shijie', 3),
      stat('player.mood', -2)
    ], '林师姐抬眼看向雨幕，终于说出那支失踪队伍的领队也姓陆。')
  ]),
  event('elder_private_warning', '长老私诫', 'sect', ['home', 'skills'], [
    choice('accept', '收下私诫', '听玄衡长老私下警告天门契', 'medium', [
      relation('xuanheng', 6),
      flag('sect_elder_split', true),
      futureEvent('mist_lantern_path')
    ], '玄衡长老承认宗内长老分裂已久，所谓封门不是怯懦，而是怕弟子被天门契诱成燃料。'),
    choice('report', '上报宗门', '把玄衡长老关于天门契的私诫上报宗门', 'high', [
      stat('player.sectRelation', -4),
      futureEvent('heaven_contract_echo')
    ], '你把私诫交上去，议事殿的封门令当夜又多了一道。')
  ], { requiresFutureEvent: 'elder_private_warning' }),
  event('mist_lantern_path', '雾灯石径', 'realm', ['realm'], [
    choice('follow', '循雾灯前行', '沿雾隐秘境雾灯石径深入', 'high', [
      technique('mist_step'),
      stat('player.qi', -6),
      flag('bronze_bell', true),
      futureEvent('mist_archive_full')
    ], '雾灯一盏盏亮起，青铜铃声在石径尽头回旋，像在核对每个闯入者的命格。'),
    choice('mark', '留下记号', '沿雾灯石径留下可回返的灵息记号', 'medium', [
      stat('player.qi', -2),
      flag('mist_lantern_marked', true)
    ], '你在石径边缘留下三点灵光，回头时却只看见其中一点正向更深处移动。')
  ]),
  event('mist_archive_full', '雾隐全档', 'realm', ['realm', 'skills'], [
    choice('decode', '解读全档', '解读雾隐秘境飞升名录全档', 'high', [
      flag('mist_archive', true),
      stat('player.mood', -5),
      futureEvent('false_ascender_name')
    ], '全档显示数名飞升者在上界仍有回信，可他们的下界宗族却在同年气运枯竭。'),
    choice('seal', '封存全档', '封存雾隐秘境飞升名录全档', 'low', [
      stat('player.mood', 2),
      flag('mist_archive_sealed', true)
    ], '你把全档重新封入石匣，匣盖合拢前最后一行字像在向你眨眼。')
  ], { requiresFutureEvent: 'mist_archive_full' }),
  event('lifespan_debt_collector', '命债来客', 'cultivation', ['home', 'cultivation'], [
    choice('confront', '追问命债', '追问命灯灰印背后的寿元债', 'high', [
      stat('player.lifespan', -3),
      stat('player.mood', -6),
      futureEvent('false_ascender_name')
    ], '梦中来客自称天门司簿，口口声声说每个求飞升者都先欠下三年灯油。'),
    choice('hide', '藏起命灯', '藏起命灯避开梦中司簿的追索', 'high', [
      stat('player.lifespan', -1),
      stat('player.mood', -2)
    ], '你把命灯藏进袖中，司簿的声音却从自己胸腔里传来。')
  ], { requiresFlags: ['lifespan_mark'] }),
  event('false_ascender_name', '假飞升者名讳', 'heaven', ['home', 'skills'], [
    choice('compare', '核对名讳', '核对飞升名录中仍在人间的名字', 'high', [
      flag('ascension_contract', true),
      stat('player.mood', -4),
      futureEvent('heaven_gate_tally')
    ], '你发现一位传说已飞升的祖师，竟在青云宗密档里留下晚年批注：天门不是门，是账房。'),
    choice('erase', '抹去名讳', '抹去密档中假飞升者的名讳', 'medium', [
      stat('player.mood', 1),
      flag('ascension_name_erased', true)
    ], '墨迹从名讳上剥落，空白处却浮出一行更小的债主名录。')
  ], { requiresFutureEvent: 'false_ascender_name' }),
  event('xuanheng_private_confession', '玄衡旧伤', 'social', ['home', 'skills'], [
    choice('ask', '询问旧伤', '询问玄衡长老为何惧怕飞升契约', 'medium', [
      relation('xuanheng', 8),
      flag('sect_elder_split', true),
      futureEvent('heaven_gate_tally')
    ], '玄衡长老卷起袖口，腕上契痕仍在。他曾送师兄飞升，却只等回一封收取下界气运的账帖。'),
    choice('swear', '立下誓言', '向玄衡长老保证不以飞升换取下界气运', 'high', [
      relation('xuanheng', 4),
      stat('player.lifespan', -2)
    ], '你立下誓言，腕侧忽然一凉，像有一根看不见的线替你记下了名字。')
  ]),
  event('heaven_gate_tally', '天门账帖', 'heaven', ['cultivation', 'realm'], [
    choice('seal', '封存账帖', '封存天门账帖并取走秘钥纹片', 'high', [
      flag('heaven_gate_key', true),
      item('materials.天门碎片', 1),
      stat('player.qi', -8)
    ], '账帖化作冰冷纹片，刻着每一次飞升背后被抽走的下界气数。'),
    choice('copy', '抄下账目', '抄下天门账帖中的气运收支记录', 'medium', [
      stat('player.mood', -2),
      flag('heaven_tally_copied', true)
    ], '你抄下最后一笔账，墨迹忽然自行补上了你的名字。')
  ], { requiresFutureEvent: 'heaven_gate_tally' }),
  event('contract_scar_recurrence', '契痕复燃', 'cultivation', ['cultivation'], [
    choice('suppress', '压制契痕', '以周天灵息压制天门契痕回潮', 'high', [
      stat('player.lifespan', -5),
      stat('player.mood', -5),
      futureEvent('heaven_gate_key_fragment')
    ], '契痕像灰火一样爬过命灯，你压住它，却明白飞升骗局的结局必须有人亲手拆开。'),
    choice('observe', '凝视契痕', '凝视天门契痕记录它的回潮规律', 'high', [
      stat('player.mood', -3),
      stat('player.lifespan', -2)
    ], '你没有压制契痕，只看着灰火一寸寸爬过命灯，终于认出其中的账目格式。')
  ], { requiresFlags: ['ascension_contract'] }),
  event('qi_failed_breakthrough_recovery', '裂脉后的药庐', 'cultivation', ['cultivation', 'home'], [
    choice('repair', '修复经脉', '在药庐修复突破失败后的经脉', 'low', [
      stat('player.qi', 8),
      stat('player.cultivationProgress', 20),
      futureEvent('master_guidance')
    ], '药香压住裂脉的痛意，你终于找回一缕可以继续吐纳的灵息。'),
    choice('press_on', '带伤强修', '带着突破失败的伤势继续强修', 'high', [
      stat('player.cultivationProgress', 35),
      stat('player.health', -8),
      flag('qi_failure_faced', true)
    ], '你没有躺下，裂开的经脉在每一次吐纳中发出细响。')
  ], { chapterIds: ['qi'], requiresBreakthroughFailure: { tier: '炼气', atLeast: 1 } }),
  event('qi_lifespan_alarm', '夜半命灯', 'cultivation', ['cultivation', 'home'], [
    choice('seek_register', '回查命簿', '请玄衡长老回查命簿上的寿元灰印', 'low', [
      relation('xuanheng', 5),
      flag('lifespan_mark', true)
    ], '你把命灯端到玄衡长老面前，纸页上的灰印终于有了清晰轮廓。'),
    choice('burn_lifespan', '燃寿强行', '燃烧寿元换取一夜修炼灵压', 'high', [
      stat('player.cultivationProgress', 25),
      stat('player.lifespan', -5),
      flag('lifespan_debt', true)
    ], '你拨亮命灯，火焰立刻变得锋利，纸页边缘也跟着卷曲。')
  ], { chapterIds: ['qi'], lifespanRatioMax: 0.45 }),
  event('foundation_trial_verdict', '筑基试场判词', 'sect', ['home', 'cultivation'], [
    choice('speak_truth', '直陈所见', '在筑基试场如实陈述长老分裂与秘境疑点', 'medium', [
      storyProgress('sectPath', 'truth'),
      stat('player.sectRelation', 5),
      flag('foundation_verdict', true)
    ], '你把听见的每句争执说出口，试场上的法印因此亮起一线冷光。'),
    choice('join_silent', '顺势缄默', '在筑基试场接受宗门的沉默安排', 'high', [
      storyProgress('sectPath', 'silence'),
      stat('player.sectRelation', 10),
      evil(2)
    ], '你低头收下判词，宗门的掌声像一层无声的雪盖住了疑问。')
  ], { chapterIds: ['foundation'], requiresFlags: ['sect_trial_joined'] }),
  event('foundation_heart_demon', '筑基心魔', 'cultivation', ['cultivation'], [
    choice('suppress', '压住心火', '压制突破失败后滋生的筑基心魔', 'medium', [
      stat('player.mood', -3),
      stat('player.cultivationProgress', 12)
    ], '心魔在识海里敲门，你把门闩重新压紧，却听见门外有人叫你的旧名。'),
    choice('face_it', '迎面而视', '直面筑基心魔并请玄衡长老见证', 'high', [
      relation('xuanheng', 5),
      stat('player.lifespan', -3),
      flag('heart_demon_faced', true)
    ], '你让心魔站到灯下，玄衡长老没有出手，只替你记住了它的脸。')
  ], { chapterIds: ['foundation'], requiresBreakthroughFailure: { tier: '筑基', atLeast: 1 } }),
  event('foundation_sect_oath', '祖师堂誓', 'sect', ['home', 'skills'], [
    choice('archive_oath', '守住真相', '在祖师堂立誓守护雾隐秘境真相', 'medium', [
      storyProgress('sectPath', 'truth'),
      flag('foundation_oath', true)
    ], '香火在誓纹上停了一瞬，你没有说出天门的名字，却把它记进心底。'),
    choice('close_oath', '封存疑问', '在祖师堂立誓不再追问雾隐旧案', 'low', [
      storyProgress('sectPath', 'silence'),
      stat('player.sectRelation', 6),
      flag('foundation_oath', true)
    ], '你把疑问压进祖师堂的玉简，誓纹合拢时仍有一道雾气从缝中逸出。')
  ], { chapterIds: ['foundation'], requiresFlags: ['sect_elder_split'] }),
  event('mist_entry_authorization', '秘境入门令', 'realm', ['realm', 'home'], [
    choice('request', '请示入境', '向宗门请示领取雾隐秘境入境令', 'low', [
      flag('mist_entry_unlocked', true),
      relation('xuanheng', 3)
    ], '玄衡长老在封印旁按下指印，雾门第一次没有立刻合拢。'),
    choice('steal', '夺令入雾', '趁封门松动夺走雾隐秘境入境令', 'high', [
      flag('mist_entry_unlocked', true),
      evil(8),
      stat('player.lifespan', -2)
    ], '你撬开封印取走令牌，掌心的契痕却比雾门更早亮了起来。')
  ], { chapterIds: ['golden_core'], realmAtLeast: '筑基初期', requiresFlags: ['sect_elder_split'] }),
  event('golden_core_formation', '金丹凝形', 'cultivation', ['cultivation'], [
    choice('steady', '稳住丹形', '稳住金丹凝形过程中的灵息', 'low', [
      stat('player.cultivationProgress', 18),
      stat('player.qi', 5)
    ], '丹田里的灵息逐层收束，像雷声终于学会在木心中安静下来。'),
    choice('condense', '强凝金丹', '强行压缩灵息凝成金丹雏形', 'high', [
      stat('player.cultivationProgress', 35),
      stat('player.health', -12),
      flag('golden_core_ready', true)
    ], '金光在经脉深处一闪，代价是胸口像被无形巨石撞过。')
  ], { chapterIds: ['golden_core'], realmAtLeast: '筑基后期' }),
  event('golden_core_storm', '金丹天雷', 'realm', ['realm', 'cultivation'], [
    choice('weather', '借雷观势', '在金丹天雷中观察雷木双息的变化', 'medium', [
      stat('player.qi', 6),
      stat('player.mood', -2)
    ], '天雷落在远山，你借那一瞬的白光看清了雾中一座倒悬的门。'),
    choice('take_lightning', '引雷入体', '主动引一道金丹天雷入体', 'high', [
      attribute('fortune', 1),
      stat('player.health', -15),
      flag('golden_storm_survived', true)
    ], '雷光贯入四肢百骸，你在焦木气味里抓住了一丝不属于此界的回声。')
  ], { chapterIds: ['golden_core'], realmAtLeast: '金丹初期' }),
  event('golden_core_npc_bargain', '师姐的雾图', 'social', ['home', 'realm'], [
    choice('share', '交换线索', '与林师姐分享金丹后的雾隐线索', 'low', [
      relation('lin_shijie', 6),
      futureEvent('mist_bronze_bell')
    ], '林师姐把旧雾图铺在茶盏旁，图上的铜铃位置与她的指尖重合。'),
    choice('trade_secret', '以秘换路', '用一段宗门秘闻换取林师姐的入雾线索', 'high', [
      relation('lin_shijie', -2),
      flag('mist_entry_unlocked', true),
      evil(3)
    ], '你把秘闻推过石桌，林师姐收下雾图，却没有再看你的眼睛。')
  ], { chapterIds: ['golden_core'], npcAffinityMin: { npcId: 'lin_shijie', value: 12 } }),
  event('mist_white_mist_price', '白雾索价', 'realm', ['realm'], [
    choice('retreat', '暂退雾层', '退回雾隐秘境入口观察白雾变化', 'low', [
      stat('player.lifespan', -1),
      flag('mist_cost_seen', true)
    ], '你退回石阶，白雾仍从脚边掠过，像在计算你刚才少掉的那一年。'),
    choice('advance', '踏入深雾', '以寿元为价强行穿过雾隐秘境白雾层', 'high', [
      stat('player.lifespan', -5),
      stat('player.qi', -8),
      flag('bronze_bell', true)
    ], '白雾贴上命灯，五缕火星接连熄灭，深处的铜铃随即为你让开道路。')
  ], { chapterIds: ['mist'], requiresFlags: ['mist_entry_unlocked'], lifespanRatioMax: 0.6 }),
  event('mist_bell_keeper', '守铃人', 'social', ['realm'], [
    choice('answer', '回答铃问', '回答雾隐秘境守铃人的三声铃问', 'medium', [
      relation('lin_shijie', 5),
      flag('mist_bell_keeper', true),
      futureEvent('mist_archive_fragment')
    ], '铃声停下，一个站在残碑后的影子替你说出了没有说出口的名字。'),
    choice('silence', '以默相对', '沉默面对雾隐秘境守铃人的试问', 'high', [
      stat('player.qi', -6),
      flag('mist_bell_keeper', true),
      flag('heaven_gate_key', true)
    ], '你不回答，守铃人便把一枚冰冷钥纹塞进雾里，代价是经脉里少了一段回声。')
  ], { chapterIds: ['mist'], requiresFlags: ['bronze_bell'] }),
  event('mist_archive_countermark', '石档反印', 'realm', ['realm', 'skills'], [
    choice('copy', '拓下反印', '拓下雾隐石档上的飞升反印', 'medium', [
      flag('mist_countermark', true),
      futureEvent('heaven_contract_echo')
    ], '你拓下最后一道反印，石档深处传来一声像账房拨珠的轻响。'),
    choice('burn', '烧毁反印', '烧毁雾隐石档上的危险反印', 'high', [
      flag('mist_countermark', true),
      evil(10),
      stat('player.mood', -8)
    ], '火光吞掉反印，灰烬却在地面拼出一条通往天门的细线。')
  ], { chapterIds: ['mist'], requiresFlags: ['mist_archive'] }),
  event('ascension_contract_accounting', '契约清账', 'heaven', ['home', 'skills'], [
    choice('reject', '拒绝签契', '拒绝以命格偿还天门契约', 'high', [
      storyProgress('contractStance', 'reject'),
      flag('contract_accounted', true)
    ], '你把账帖推回去，天门之外的风第一次吹进了这间没有窗的账房。'),
    choice('accept', '接受契约', '接受天门契约换取飞升名额', 'high', [
      storyProgress('contractStance', 'accept'),
      stat('player.mood', -8),
      flag('contract_accounted', true)
    ], '你按下指印，账房里响起欢迎声，命灯却暗了一层。')
  ], { chapterIds: ['ascension_scam'], requiresFlags: ['ascension_contract'] }),
  event('ascension_returned_message', '上界回信', 'heaven', ['home', 'skills'], [
    choice('listen', '听完回信', '听完飞升者从上界寄回的最后一封回信', 'medium', [
      relation('xuanheng', 5),
      flag('returned_message', true)
    ], '回信没有写上界风光，只写着一句：不要让他们看见你还记得下界。'),
    choice('destroy', '毁掉回信', '毁掉飞升者寄回的上界回信', 'high', [
      evil(8),
      stat('player.qi', -5),
      flag('returned_message', true)
    ], '你撕碎回信，纸屑在半空拼成一扇只向外开的门。')
  ], { chapterIds: ['ascension_scam'], requiresEventResolved: 'false_ascender_name' }),
  event('ascension_scam_witness', '骗局见证者', 'social', ['home', 'skills'], [
    choice('sacrifice', '承受账债', '承受天门账帖转嫁下界的气运债', 'high', [
      storyProgress('contractStance', 'sacrifice'),
      stat('player.lifespan', -8)
    ], '你把账帖上的债名按进自己的命灯，远处无数未熄的灯同时颤了一下。'),
    choice('guard', '守住旧档', '守住雾隐全档不让天门抹去下界记录', 'medium', [
      storyProgress('contractStance', 'guard'),
      flag('archive_guardian', true)
    ], '你站在旧档与天门之间，任由契影从肩头擦过而不肯让路。')
  ], { chapterIds: ['ascension_scam'], requiresFlags: ['mist_archive'], requiresEventResolved: 'mist_archive_full' }),
  event('finale_break_contract', '撕裂天契', 'heaven', ['home', 'realm'], [
    choice('tear', '撕契断门', '撕裂天门契约阻止飞升骗局', 'high', [
      storyProgress('contractStance', 'reject'),
      storyProgress('finalChoiceMade', true),
      flag('final_break_attempted', true)
    ], '你撕开契约，天门裂隙中传来万千命灯同时熄灭又复燃的声音。'),
    choice('seal', '封门守界', '封住天门裂隙守住下界边界', 'high', [
      storyProgress('contractStance', 'guard'),
      storyProgress('finalChoiceMade', true),
      stat('player.lifespan', -4)
    ], '你以剩余命火按住裂隙，白雾在门外退开一尺。')
  ], { chapterIds: ['finale'], requiresFlags: ['heaven_gate_key'] }),
  event('finale_accept_contract', '白阶契名', 'heaven', ['home', 'realm'], [
    choice('sign', '签下飞升契', '签下天门契约换取飞升资格', 'high', [
      storyProgress('contractStance', 'accept'),
      storyProgress('finalChoiceMade', true),
      stat('player.mood', -6)
    ], '你在白阶尽头落下自己的名字，天光随即从四面八方合拢。'),
    choice('rewrite', '改写契文', '以自身寿元改写天门契约的条件', 'high', [
      storyProgress('contractStance', 'reject'),
      storyProgress('finalChoiceMade', true),
      stat('player.lifespan', -6)
    ], '你用命火改写一笔契文，天门第一次发出像人一样的怒声。')
  ], { chapterIds: ['finale'], requiresFlags: ['ascension_contract'] }),
  event('finale_guard_mist', '守雾归墟', 'realm', ['realm', 'home'], [
    choice('keep_bell', '守住铜铃', '守住雾隐秘境铜铃与石档', 'high', [
      storyProgress('contractStance', 'guard'),
      storyProgress('finalChoiceMade', true),
      flag('mist_guardian_mark', true)
    ], '你把手按在铜铃上，白雾从身后合拢，像一座终于有人看守的门。'),
    choice('open_archive', '放开全档', '放开雾隐全档让下界看见天门真相', 'high', [
      storyProgress('contractStance', 'reject'),
      storyProgress('finalChoiceMade', true),
      stat('player.qi', -12)
    ], '石档一页页飞向雾外，天门的账目在每一片云上显出黑色的字。')
  ], { chapterIds: ['finale'], requiresFlags: ['bronze_bell', 'mist_archive'] }),
  event('finale_sacrifice_lifelong', '命灯尽处', 'heaven', ['home', 'cultivation'], [
    choice('pin_lifeline', '钉住命线', '以最后的命火钉住天门契约', 'high', [
      storyProgress('contractStance', 'sacrifice'),
      storyProgress('finalChoiceMade', true),
      stat('player.lifespan', -10)
    ], '你把命灯钉进裂隙，所有追索你的契线在这一刻有了终点。'),
    choice('burn_name', '焚去姓名', '焚去自己的姓名让天门失去索引', 'high', [
      storyProgress('contractStance', 'sacrifice'),
      storyProgress('finalChoiceMade', true),
      evil(5),
      stat('player.lifespan', -6)
    ], '你的名字在命簿上烧成空白，天门的账房里终于找不到这一笔。')
  ], { chapterIds: ['finale'], lifespanRatioMax: 0.25 }),
  event('finale_npc_parting', '雨幕辞行', 'social', ['home', 'realm'], [
    choice('part', '平静辞行', '与林师姐在秘境出口平静辞行', 'low', [
      relation('lin_shijie', 5),
      flag('npc_parting_seen', true)
    ], '林师姐替你撑起旧伞，雨幕之外的雾灯一盏盏熄灭。'),
    choice('ask_help', '请求相助', '请求林师姐陪你再走一段天门路', 'medium', [
      relation('lin_shijie', -3),
      stat('player.mood', 4),
      flag('npc_parting_seen', true)
    ], '她没有答应，只把伞柄塞回你手里，像是把最后的选择也还给了你。')
  ], { chapterIds: ['finale'], npcAffinityMin: { npcId: 'lin_shijie', value: 12 }, requiresEventResolved: 'ascension_returned_message' }),
  event('finale_last_lifespan', '命灯最后一页', 'cultivation', ['home', 'cultivation'], [
    choice('leave_words', '留下遗言', '在命簿最后一页留下给故人的话', 'low', [
      relation('xuanheng', 4),
      stat('player.lifespan', -1)
    ], '你写下最后一页，墨迹还未干，命灯便替你把名字照亮。'),
    choice('force_finale', '强行赴终', '燃尽最后寿元强行走向天门终局', 'high', [
      stat('player.lifespan', -5),
      stat('player.qi', -10),
      flag('last_lifespan_warning', true)
    ], '你提起最后一口气走向天门，身后的纸页一张张自行翻回空白。')
  ], { chapterIds: ['finale'], lifespanRatioMax: 0.15 })
];

function event(id, title, category, viewIds, choices, trigger = {}) {
  const metadata = EVENT_METADATA[id] ?? {};
  return {
    id,
    title,
    category,
    priority: 10,
    weight: 1,
    ...metadata,
    trigger: { viewIds, ...(metadata.chapterIds ? { chapterIds: metadata.chapterIds } : {}), ...trigger },
    entryText: title,
    choices
  };
}

function choice(id, label, command, risk, effects, text, narrativeIntent = command) {
  return { id, label, command, risk, narrativeIntent, success: { text, effects } };
}

function eventMetadata(chapterId, cadence, scene, mood, sensoryTags, npcRoles = [], cooldownTurns = 3) {
  return {
    chapterIds: [chapterId],
    cadence,
    oneShot: cadence === 'mainline',
    cooldownTurns,
    narrativeContext: { scene, mood, npcRoles, sensoryTags }
  };
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

function treasure(id) {
  return { type: 'treasure', id };
}

function technique(id) {
  return { type: 'technique', id };
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

function attribute(path, delta) {
  return { type: 'attribute', path, delta };
}

function storyProgress(path, value) {
  return { type: 'storyProgress', path, value };
}
