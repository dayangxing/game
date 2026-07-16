const EXPECTED_CHAPTER_COUNTS = {
  prologue: 6,
  qi: 7,
  foundation: 7,
  golden_core: 7,
  mist: 8,
  ascension_scam: 8,
  finale: 7
};

export function validateEventCatalog(catalog = []) {
  const errors = [];
  const ids = new Set();
  const counts = Object.fromEntries(Object.keys(EXPECTED_CHAPTER_COUNTS).map((id) => [id, 0]));

  for (const event of catalog) {
    if (!event?.id || ids.has(event.id)) {
      errors.push(`duplicate or missing id: ${event?.id ?? '<empty>'}`);
    }
    ids.add(event?.id);

    const chapterId = event?.chapterIds?.[0];
    if (!(chapterId in EXPECTED_CHAPTER_COUNTS)) {
      errors.push(`unknown chapter: ${event?.id ?? '<empty>'}`);
    } else {
      counts[chapterId] += 1;
    }

    if (!['mainline', 'side'].includes(event?.cadence)) {
      errors.push(`invalid cadence: ${event?.id ?? '<empty>'}`);
    }
    if (event?.oneShot !== (event?.cadence === 'mainline')) {
      errors.push(`cadence/oneShot mismatch: ${event?.id ?? '<empty>'}`);
    }
    if (!event?.narrativeContext?.scene || !Array.isArray(event?.narrativeContext?.sensoryTags)) {
      errors.push(`missing narrative context: ${event?.id ?? '<empty>'}`);
    }
    if (!Array.isArray(event?.choices) || event.choices.length < 2) {
      errors.push(`need two choices: ${event?.id ?? '<empty>'}`);
    }
    for (const choice of event?.choices ?? []) {
      if (!choice?.id || !choice?.label || !choice?.command || !choice?.risk || !choice?.narrativeIntent) {
        errors.push(`incomplete choice: ${event?.id ?? '<empty>'}`);
      }
    }
  }

  for (const [chapterId, expected] of Object.entries(EXPECTED_CHAPTER_COUNTS)) {
    if (counts[chapterId] !== expected) {
      errors.push(`${chapterId}: expected ${expected}, got ${counts[chapterId]}`);
    }
  }
  if (catalog.length !== 50) errors.push(`expected 50 formal events, got ${catalog.length}`);

  const knownIds = new Set(catalog.map((event) => event?.id));
  for (const event of catalog) {
    const references = [
      event?.trigger?.requiresEventResolved,
      event?.trigger?.forbidEventResolved,
      event?.trigger?.requiresFutureEvent
    ];
    for (const choice of event?.choices ?? []) {
      for (const effect of choice?.success?.effects ?? []) {
        if (effect?.type === 'futureEvent') references.push(effect.id);
      }
    }
    for (const reference of references.filter(Boolean)) {
      if (!knownIds.has(reference)) errors.push(`dangling event reference: ${event.id} -> ${reference}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export { EXPECTED_CHAPTER_COUNTS };
