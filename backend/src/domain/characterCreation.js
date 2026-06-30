const ORIGINS = ['山野孤子', '没落世家', '药铺学徒', '渔村遗孤', '外门杂役', '散修之后'];
const ROOTS = ['雷木双灵根', '金火双灵根', '水木双灵根', '土灵根', '风雷异灵根', '五行杂灵根'];
const TRAITS = ['早慧', '命火绵长', '经脉坚韧', '福缘深厚', '灵根不稳', '心魔易感', '丹道亲和', '剑心微明'];

export function rollCharacter({ seed, name }) {
  const rng = createRng(seed);
  const traits = pickUnique(TRAITS, 2 + Math.floor(rng() * 2), rng);
  const character = {
    name: sanitizeName(name) || randomName(rng),
    origin: pick(ORIGINS, rng),
    spiritualRoot: pick(ROOTS, rng),
    traits,
    comprehension: rollStat(rng, 20, 90),
    physique: rollStat(rng, 20, 90),
    luck: rollStat(rng, 10, 95),
    karmaAffinity: rollStat(rng, -30, 40),
    initialLifespan: rollStat(rng, 60, 140),
    startingResources: {
      spiritStones: rollStat(rng, 40, 180),
      materials: {
        雷纹草: rollStat(rng, 0, 3),
        凝露草: rollStat(rng, 1, 5)
      },
      pills: {}
    }
  };
  assertPlayableCharacter(character);
  return character;
}

export function assertPlayableCharacter(character) {
  const checks = [
    ['comprehension', 20, 90],
    ['physique', 20, 90],
    ['luck', 10, 95],
    ['initialLifespan', 60, 140]
  ];
  for (const [key, min, max] of checks) {
    if (typeof character[key] !== 'number' || character[key] < min || character[key] > max) {
      throw new Error(`CHARACTER_ROLL_INVALID:${key}`);
    }
  }
}

export function applyCharacterToGame(game, character, seed) {
  return {
    seed,
    turn: 0,
    mode: game.mode,
    calendar: game.calendar,
    id: `game_${seed.toString(36)}`,
    characterSeed: seed,
    character,
    player: createFormalPlayer(character),
    npcs: createFormalNpcs(character),
    worldEvents: createFormalWorldEvents(character),
    foreshadows: createFormalForeshadows(character),
    timeline: createFormalTimeline(game.calendar, character),
    suggestions: createFormalSuggestions(),
    inventory: {
      materials: character.startingResources.materials,
      pills: character.startingResources.pills
    },
    flags: {},
    cooldowns: {},
    karma: {
      karma: 0,
      evil: 0,
      fate: character.karmaAffinity,
      debts: [],
      vendettas: [],
      futureEventFlags: []
    },
    log: [createFormalOpeningLog(character)]
  };
}

function createRng(seed) {
  let value = Math.abs(Math.floor(seed)) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function rollStat(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function pick(values, rng) {
  return values[Math.floor(rng() * values.length)];
}

function pickUnique(values, count, rng) {
  const pool = [...values];
  const picked = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return picked;
}

function randomName(rng) {
  const surnames = ['沈', '顾', '陆', '林', '许', '温'];
  const given = ['问星', '清河', '玄微', '照夜', '听澜', '知白'];
  return `${pick(surnames, rng)}${pick(given, rng)}`;
}

function sanitizeName(name) {
  return String(name ?? '').trim().slice(0, 12);
}

function createFormalPlayer(character) {
  return {
    name: character.name,
    origin: character.origin,
    realm: '炼气一层',
    spiritualRoot: character.spiritualRoot,
    lifespan: character.initialLifespan,
    spiritStones: character.startingResources.spiritStones,
    qi: 50,
    mood: 50,
    cultivationProgress: 0,
    sectRelation: 0,
    location: '青云宗山门'
  };
}

function createFormalNpcs(character) {
  return [
    {
      name: '林师姐',
      role: '内门弟子',
      affinity: 0,
      tone: '温和而谨慎',
      memories: [`见到${character.name}初入山门，仍在试探此人的心性。`]
    },
    {
      name: '玄衡长老',
      role: '传功长老',
      affinity: 0,
      tone: '庄重严厉',
      memories: [`为${character.name}登记命簿，暂记${character.spiritualRoot}入册。`]
    }
  ];
}

function createFormalWorldEvents(character) {
  return [
    {
      title: '命簿初开',
      detail: `${character.name}于青云山门登记命簿，正式踏上修行路。`,
      turn: 0
    }
  ];
}

function createFormalForeshadows(character) {
  return [
    `${character.spiritualRoot}或将引来不同寻常的修行际遇。`,
    `${character.name}的出身${character.origin}背后，也许还藏着未明因果。`
  ];
}

function createFormalTimeline(calendar, character) {
  return [
    {
      type: 'season',
      title: `玄历${calendar.year}年 ${calendar.season}`,
      detail: `青云山门为${character.name}开启命簿，新一段修行因果自此起笔。`
    }
  ];
}

function createFormalSuggestions() {
  return ['闭关修炼一日', '拜见玄衡长老请教功法', '找林师姐熟悉青云山门'];
}

function createFormalOpeningLog(character) {
  return {
    id: 'formal-opening',
    title: '命簿初开',
    command: '创建角色',
    body: `${character.name}出身${character.origin}，以${character.spiritualRoot}踏入青云山门。`,
    npcLine: '玄衡长老翻过命簿：“此后因果，自行承受。”',
    worldEvent: '命簿初开'
  };
}
