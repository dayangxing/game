const RESOURCE_BONUS_KEY_LIST = [
  'cultivationGain',
  'breakthroughChance',
  'maxHealth',
  'maxLifespan',
  'damageReduction'
];

export const RESOURCE_BONUS_KEYS = freezeValue([...RESOURCE_BONUS_KEY_LIST]);

function resourceEntry({
  id,
  name,
  grade,
  type,
  realmAtLeast,
  tags,
  description,
  detail,
  bonuses
}) {
  return {
    id,
    name,
    grade,
    type,
    realmAtLeast,
    tags: [...tags],
    description,
    detail,
    bonuses: { ...bonuses }
  };
}

const TECHNIQUE_ENTRIES = [
  resourceEntry({
    id: 'qingmu_jue',
    name: '青木诀',
    grade: '凡品',
    type: '心法',
    realmAtLeast: '炼气一层',
    tags: ['养元', '木灵'],
    description: '以木息润养经脉，适合稳步修行。',
    detail: '青木诀走的是温和长进的路子，能把散乱木息化作稳定修为，也让气血恢复更顺一些。',
    bonuses: { cultivationGain: 6, maxHealth: 6 }
  }),
  resourceEntry({
    id: 'mist_step',
    name: '雾隐步',
    grade: '良品',
    type: '身法',
    realmAtLeast: '炼气一层',
    tags: ['雾隐', '神识'],
    description: '借雾线藏身，避开秘境里的杀机。',
    detail: '雾隐步讲究借势与错位，越是迷雾与回声交错的地方越能显出身法精妙，也能削弱失手时的代价。',
    bonuses: { breakthroughChance: 2, damageReduction: 5 }
  }),
  resourceEntry({
    id: 'thunder_pulse_manual',
    name: '雷脉引气篇',
    grade: '良品',
    type: '心法',
    realmAtLeast: '炼气三层',
    tags: ['雷法', '引气'],
    description: '以雷息引导周天，兼顾修为与破境。',
    detail: '这册手记记载了以雷脉引气的法门，能推动修为进度，也能让破境时的契机更清晰。',
    bonuses: { cultivationGain: 4, breakthroughChance: 1 }
  }),
  resourceEntry({
    id: 'crimson_sword_intent',
    name: '赤霄剑意',
    grade: '上品',
    type: '剑诀',
    realmAtLeast: '炼气三层',
    tags: ['炼体', '战斗'],
    description: '剑意如霄火，能在决断时护住心神。',
    detail: '赤霄剑意把锋芒与定力绑在一起，越是生死交锋越能看出用剑者的根骨与胆气。',
    bonuses: { breakthroughChance: 2, damageReduction: 4 }
  }),
  resourceEntry({
    id: 'earth_veil_body',
    name: '厚土炼体篇',
    grade: '良品',
    type: '炼体',
    realmAtLeast: '炼气三层',
    tags: ['炼体', '土行'],
    description: '以厚土沉身，强化肉身与韧性。',
    detail: '厚土炼体篇强调沉稳压实，既能补足气血，也能在突破失败时帮肉身扛下更多冲击。',
    bonuses: { maxHealth: 10, damageReduction: 2 }
  }),
  resourceEntry({
    id: 'danxin_nourishing',
    name: '丹心养元诀',
    grade: '良品',
    type: '养元',
    realmAtLeast: '炼气三层',
    tags: ['养元', '丹道'],
    description: '养护元气，兼顾寿元与修行。',
    detail: '丹心养元诀偏重调元固本，既能延长寿元，也能让日常修行更顺畅。',
    bonuses: { maxLifespan: 8, cultivationGain: 3 }
  }),
  resourceEntry({
    id: 'taixu_heart_mirror',
    name: '太虚心镜',
    grade: '上品',
    type: '神识',
    realmAtLeast: '炼气五层',
    tags: ['神识', '太虚'],
    description: '以心镜照虚，令识海更稳。',
    detail: '太虚心镜能映照心念中的细小波纹，帮助修士在破境前后稳住神识，也让失误代价更低。',
    bonuses: { breakthroughChance: 4, damageReduction: 2 }
  }),
  resourceEntry({
    id: 'moonwater_returning_tide',
    name: '月华回潮经',
    grade: '上品',
    type: '心法',
    realmAtLeast: '炼气五层',
    tags: ['水行', '养元'],
    description: '借月水回潮，润泽气血与寿元。',
    detail: '月华回潮经讲的是潮起潮落之间的养息之道，既能润养气血，也能缓慢补回寿元。',
    bonuses: { maxLifespan: 5, maxHealth: 4 }
  })
];

const TREASURE_ENTRIES = [
  resourceEntry({
    id: 'calm_lotus_incense',
    name: '静心莲香',
    grade: '良品',
    type: '香',
    realmAtLeast: '炼气一层',
    tags: ['养元', '神识'],
    description: '点燃后可令识海宁静，破境时更易定神。',
    detail: '静心莲香的气息绵长柔和，适合在调息、突破和稳固心神时使用。',
    bonuses: { breakthroughChance: 3 }
  }),
  resourceEntry({
    id: 'tiger_bone_guard',
    name: '虎骨护腕',
    grade: '良品',
    type: '护具',
    realmAtLeast: '炼气一层',
    tags: ['炼体', '战斗'],
    description: '赤焰虎骨制成，大幅增强体魄。',
    detail: '虎骨护腕硬中带韧，戴上后不仅气血更厚实，面对冲击时也更能减轻伤势。',
    bonuses: { damageReduction: 8, maxHealth: 8 }
  }),
  resourceEntry({
    id: 'bronze_bell_fragment',
    name: '青铜铃片',
    grade: '良品',
    type: '法器',
    realmAtLeast: '炼气三层',
    tags: ['雾隐', '神识'],
    description: '残缺铃片仍有回响，适合在雾境中护念。',
    detail: '青铜铃片带着雾里回音，既能帮助定神，也能在秘境压力下稍稍减轻失误损伤。',
    bonuses: { breakthroughChance: 2, damageReduction: 2 }
  }),
  resourceEntry({
    id: 'lifespan_lamp_core',
    name: '命灯残芯',
    grade: '良品',
    type: '命器',
    realmAtLeast: '炼气三层',
    tags: ['命火', '养元'],
    description: '残存灯芯仍能护住一线命火。',
    detail: '命灯残芯看似微弱，却能在寿元受损的修士身上留下缓冲余地，让命火不至于一下熄灭。',
    bonuses: { maxLifespan: 10 }
  }),
  resourceEntry({
    id: 'danxia_jade_furnace',
    name: '丹霞玉炉',
    grade: '上品',
    type: '丹炉',
    realmAtLeast: '炼气三层',
    tags: ['丹道', '养元'],
    description: '丹霞映炉，炼火更稳更顺。',
    detail: '丹霞玉炉的炉火温润而不躁，适合炼丹与调养，并能顺带让气血恢复得更扎实。',
    bonuses: { cultivationGain: 3, maxHealth: 3 }
  }),
  resourceEntry({
    id: 'taixu_star_disk',
    name: '太虚星盘',
    grade: '上品',
    type: '法器',
    realmAtLeast: '炼气五层',
    tags: ['神识', '太虚'],
    description: '星盘对照虚空，破境时更易把握方向。',
    detail: '太虚星盘能让修士在神识观照中更快辨认虚实，适合需要稳住破境脉络的场合。',
    bonuses: { breakthroughChance: 4 }
  }),
  resourceEntry({
    id: 'spiritwood_heart',
    name: '千年灵木心',
    grade: '上品',
    type: '灵材',
    realmAtLeast: '炼气五层',
    tags: ['木灵', '养元'],
    description: '灵木心蕴含浓厚生机，能补气养身。',
    detail: '千年灵木心像一块活着的木中灵髓，既能抬高气血上限，也能让寿元缓慢回升。',
    bonuses: { maxHealth: 5, maxLifespan: 4 }
  }),
  resourceEntry({
    id: 'mist_veil',
    name: '雾蚀披帛',
    grade: '良品',
    type: '法器',
    realmAtLeast: '炼气三层',
    tags: ['雾隐', '身法'],
    description: '披帛如雾，可在迷阵中减损冲击。',
    detail: '雾蚀披帛像一层轻薄的雾膜，既能遮住身形，也能在强烈冲击中减轻肉身承受的伤害。',
    bonuses: { damageReduction: 6, maxHealth: 2 }
  })
];

export const TECHNIQUE_CATALOG = freezeValue(indexById(TECHNIQUE_ENTRIES));
export const TREASURE_CATALOG = freezeValue(indexById(TREASURE_ENTRIES));

export const RESOURCE_POOL_CATALOG = freezeValue({
  mistRelics: {
    id: 'mistRelics',
    label: '雾隐遗物',
    tags: ['雾隐', '神识'],
    resourceIds: ['mist_step', 'calm_lotus_incense', 'bronze_bell_fragment', 'mist_veil'],
    narrativeReason: '你从雾灯、残碑与青铜铃的回声中辨认出几件可以带走的遗物。'
  },
  scriptureArchive: {
    id: 'scriptureArchive',
    label: '藏经阁残卷',
    tags: ['神识', '养元', '太虚'],
    resourceIds: ['qingmu_jue', 'thunder_pulse_manual', 'crimson_sword_intent', 'taixu_heart_mirror'],
    narrativeReason: '你在残卷与旧注里认出几门适合带走的功法。'
  },
  alchemyFinds: {
    id: 'alchemyFinds',
    label: '丹房灵藏',
    tags: ['养元', '命火', '丹道'],
    resourceIds: ['calm_lotus_incense', 'danxin_nourishing', 'lifespan_lamp_core', 'danxia_jade_furnace'],
    narrativeReason: '你在药火与炉灰之间辨认出几件适合调养气血的灵藏。'
  },
  beastSpoils: {
    id: 'beastSpoils',
    label: '巡山兽藏',
    tags: ['炼体', '战斗', '木灵'],
    resourceIds: ['tiger_bone_guard', 'crimson_sword_intent', 'earth_veil_body', 'spiritwood_heart'],
    narrativeReason: '你从妖兽尸骨与巡山遗物里翻出几件更擅长护身的收获。'
  },
  ancientRuins: {
    id: 'ancientRuins',
    label: '古修遗府',
    tags: ['太虚', '命火', '养元', '神识'],
    resourceIds: ['lifespan_lamp_core', 'taixu_heart_mirror', 'taixu_star_disk', 'moonwater_returning_tide'],
    narrativeReason: '你在古修遗府的旧匣里找到几件与命火和星图有关的遗物。'
  }
});

export const RESONANCE_CATALOG = freezeValue({
  thunder_resonance: {
    id: 'thunder_resonance',
    name: '雷法共鸣',
    tag: '雷法',
    thresholds: {
      2: {
        count: 2,
        label: '两件共鸣',
        bonuses: { breakthroughChance: 2 },
        effectText: '突破 +2'
      },
      3: {
        count: 3,
        label: '三件共鸣',
        bonuses: { breakthroughChance: 4 },
        effectText: '突破 +4'
      }
    }
  },
  lifespan_resonance: {
    id: 'lifespan_resonance',
    name: '养元共鸣',
    tag: '养元',
    thresholds: {
      2: {
        count: 2,
        label: '两件共鸣',
        bonuses: { maxLifespan: 4 },
        effectText: '寿元上限 +4'
      },
      3: {
        count: 3,
        label: '三件共鸣',
        bonuses: { maxLifespan: 8 },
        effectText: '寿元上限 +8'
      }
    }
  },
  body_resonance: {
    id: 'body_resonance',
    name: '炼体共鸣',
    tag: '炼体',
    thresholds: {
      2: {
        count: 2,
        label: '两件共鸣',
        bonuses: { maxHealth: 6 },
        effectText: '气血上限 +6'
      },
      3: {
        count: 3,
        label: '三件共鸣',
        bonuses: { maxHealth: 12 },
        effectText: '气血上限 +12'
      }
    }
  },
  mist_resonance: {
    id: 'mist_resonance',
    name: '雾隐共鸣',
    tag: '雾隐',
    thresholds: {
      2: {
        count: 2,
        label: '两件共鸣',
        bonuses: { damageReduction: 2 },
        effectText: '减伤 +2'
      },
      3: {
        count: 3,
        label: '三件共鸣',
        bonuses: { damageReduction: 5 },
        effectText: '减伤 +5'
      }
    }
  },
  mind_resonance: {
    id: 'mind_resonance',
    name: '神识共鸣',
    tag: '神识',
    thresholds: {
      2: {
        count: 2,
        label: '两件共鸣',
        bonuses: { breakthroughChance: 2 },
        effectText: '突破 +2'
      },
      3: {
        count: 3,
        label: '三件共鸣',
        bonuses: { breakthroughChance: 4 },
        effectText: '突破 +4'
      }
    }
  }
});

const ALL_RESOURCES_BY_ID = freezeValue({
  ...TECHNIQUE_CATALOG,
  ...TREASURE_CATALOG
});

export function getResourceById(kind, id) {
  if (kind === 'technique') {
    return TECHNIQUE_CATALOG[id];
  }

  if (kind === 'treasure') {
    return TREASURE_CATALOG[id];
  }

  return undefined;
}

export function validateResourceCatalog() {
  validateEntries(TECHNIQUE_CATALOG, 'technique');
  validateEntries(TREASURE_CATALOG, 'treasure');
  validatePools();
  validateResonances();

  return true;
}

function validateEntries(catalog, kind) {
  const ids = new Set();

  for (const entry of Object.values(catalog)) {
    if (ids.has(entry.id)) {
      throw new Error(`RESOURCE_CATALOG_DUPLICATE_ID:${kind}:${entry.id}`);
    }

    ids.add(entry.id);
    validateEntry(entry, kind);
  }
}

function validateEntry(entry, kind) {
  const requiredKeys = ['id', 'name', 'grade', 'type', 'realmAtLeast', 'tags', 'description', 'detail', 'bonuses'];
  for (const key of requiredKeys) {
    if (entry[key] === undefined) {
      throw new Error(`RESOURCE_CATALOG_MISSING_FIELD:${kind}:${entry.id}:${key}`);
    }
  }

  if (!Array.isArray(entry.tags) || entry.tags.length < 2) {
    throw new Error(`RESOURCE_CATALOG_INVALID_TAGS:${kind}:${entry.id}`);
  }

  if (!entry.detail.length || !entry.description.length) {
    throw new Error(`RESOURCE_CATALOG_EMPTY_TEXT:${kind}:${entry.id}`);
  }

  if (!entry.realmAtLeast.length) {
    throw new Error(`RESOURCE_CATALOG_EMPTY_REALM:${kind}:${entry.id}`);
  }

  if (!entry.bonuses || typeof entry.bonuses !== 'object' || Array.isArray(entry.bonuses)) {
    throw new Error(`RESOURCE_CATALOG_INVALID_BONUSES:${kind}:${entry.id}`);
  }

  for (const key of Object.keys(entry.bonuses)) {
    if (!RESOURCE_BONUS_KEYS.includes(key)) {
      throw new Error(`RESOURCE_CATALOG_INVALID_BONUS_KEY:${kind}:${entry.id}:${key}`);
    }
  }
}

function validatePools() {
  for (const pool of Object.values(RESOURCE_POOL_CATALOG)) {
    if (!pool.id || !pool.label || !pool.narrativeReason) {
      throw new Error(`RESOURCE_CATALOG_INVALID_POOL:${pool.id ?? 'unknown'}`);
    }

    if (!Array.isArray(pool.tags) || pool.tags.length < 1) {
      throw new Error(`RESOURCE_CATALOG_INVALID_POOL_TAGS:${pool.id}`);
    }

    if (!Array.isArray(pool.resourceIds) || pool.resourceIds.length < 4) {
      throw new Error(`RESOURCE_CATALOG_INVALID_POOL_RESOURCES:${pool.id}`);
    }

    for (const resourceId of pool.resourceIds) {
      if (!ALL_RESOURCES_BY_ID[resourceId]) {
        throw new Error(`RESOURCE_CATALOG_UNKNOWN_POOL_RESOURCE:${pool.id}:${resourceId}`);
      }
    }
  }
}

function validateResonances() {
  for (const resonance of Object.values(RESONANCE_CATALOG)) {
    if (!resonance.id || !resonance.name || !resonance.tag) {
      throw new Error(`RESOURCE_CATALOG_INVALID_RESONANCE:${resonance.id ?? 'unknown'}`);
    }

    const two = resonance.thresholds?.[2];
    const three = resonance.thresholds?.[3];

    if (!two || !three) {
      throw new Error(`RESOURCE_CATALOG_INVALID_RESONANCE_THRESHOLDS:${resonance.id}`);
    }

    if (JSON.stringify(two) === JSON.stringify(three)) {
      throw new Error(`RESOURCE_CATALOG_NON_DISTINCT_RESONANCE:${resonance.id}`);
    }

    validateThresholdBonuses(resonance.id, two);
    validateThresholdBonuses(resonance.id, three);
  }
}

function validateThresholdBonuses(resonanceId, threshold) {
  if (!threshold.bonuses || typeof threshold.bonuses !== 'object' || Array.isArray(threshold.bonuses)) {
    throw new Error(`RESOURCE_CATALOG_INVALID_RESONANCE_BONUSES:${resonanceId}`);
  }

  for (const key of Object.keys(threshold.bonuses)) {
    if (!RESOURCE_BONUS_KEYS.includes(key)) {
      throw new Error(`RESOURCE_CATALOG_INVALID_RESONANCE_BONUS_KEY:${resonanceId}:${key}`);
    }
  }
}

function indexById(entries) {
  const catalog = {};

  for (const entry of entries) {
    catalog[entry.id] = entry;
  }

  return catalog;
}

function freezeValue(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) {
      freezeValue(nested);
    }

    Object.freeze(value);
  }

  return value;
}
