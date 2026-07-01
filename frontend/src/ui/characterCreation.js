const ATTRIBUTE_DEFINITIONS = [
  { key: 'rootBone', label: '根骨', note: '筋骨越厚实，气血与体魄越稳。' },
  { key: 'comprehension', label: '悟性', note: '悟道越敏锐，闭关与参悟越快。' },
  { key: 'fortune', label: '气运', note: '机缘越浓厚，奇遇与收获越丰。' },
  { key: 'willpower', label: '心志', note: '心境越坚定，破境与险境越能稳住。' },
  { key: 'lifeSeed', label: '命元', note: '命火越旺盛，寿元与续航越长。' }
];

const ATTRIBUTE_TOTAL = 25;

export function createDefaultAllocation() {
  return Object.fromEntries(ATTRIBUTE_DEFINITIONS.map(({ key }) => [key, 5]));
}

export function randomizeAllocation(seed) {
  const allocation = Object.fromEntries(ATTRIBUTE_DEFINITIONS.map(({ key }) => [key, 1]));
  const rng = createRng(seed);
  let remaining = ATTRIBUTE_TOTAL - ATTRIBUTE_DEFINITIONS.length;

  while (remaining > 0) {
    const available = ATTRIBUTE_DEFINITIONS.filter(({ key }) => allocation[key] < 10);
    const choice = available[Math.floor(rng() * available.length)];
    allocation[choice.key] += 1;
    remaining -= 1;
  }

  return allocation;
}

export function updateAllocation(allocation, key, delta) {
  if (!ATTRIBUTE_DEFINITIONS.some((entry) => entry.key === key)) return allocation;
  const nextValue = (allocation[key] ?? 0) + delta;
  const nextTotal = totalAllocation(allocation) + delta;

  if (nextValue < 1 || nextValue > 10) return allocation;
  if (nextTotal > ATTRIBUTE_TOTAL) return allocation;

  return {
    ...allocation,
    [key]: nextValue
  };
}

export function remainingAllocationPoints(allocation) {
  return ATTRIBUTE_TOTAL - totalAllocation(allocation);
}

export function formatAttributeCards(attributes) {
  return ATTRIBUTE_DEFINITIONS.map(({ key, label, note }) => ({
    key,
    label,
    note,
    value: attributes?.[key] ?? 0
  }));
}

export function formatCharacterAttributeRows(character) {
  return [
    { label: '出身', value: character.origin },
    { label: '灵根', value: character.spiritualRoot },
    { label: '命格', value: character.traits.join('、') },
    { label: '悟性', value: String(character.comprehension) },
    { label: '体魄', value: String(character.physique) },
    { label: '气运', value: String(character.luck) },
    { label: '因果亲和', value: String(character.karmaAffinity) },
    { label: '寿元', value: `${character.initialLifespan} 年` },
    { label: '初始资源', value: formatResources(character.startingResources) }
  ];
}

function formatResources(resources) {
  const materialText = Object.entries(resources.materials ?? {})
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name} x${count}`)
    .join('、');
  return [`灵石 ${resources.spiritStones ?? 0}`, materialText].filter(Boolean).join(' / ');
}

function totalAllocation(allocation) {
  return ATTRIBUTE_DEFINITIONS.reduce((total, { key }) => total + (allocation?.[key] ?? 0), 0);
}

function createRng(seed) {
  let value = Math.abs(Math.floor(seed)) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}
