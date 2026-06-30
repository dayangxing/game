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
