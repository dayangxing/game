export const ATTRIBUTE_KEYS = ['rootBone', 'comprehension', 'fortune', 'willpower', 'lifeSeed'];
export const ATTRIBUTE_TOTAL = 25;

export function validateAttributeAllocation(attributes) {
  const normalized = {};
  let total = 0;

  for (const key of ATTRIBUTE_KEYS) {
    const value = attributes?.[key];

    if (!Number.isInteger(value) || value < 1 || value > 10) {
      throw new Error(`ATTRIBUTE_ALLOCATION_INVALID:${key}`);
    }

    normalized[key] = value;
    total += value;
  }

  if (total !== ATTRIBUTE_TOTAL) {
    throw new Error('ATTRIBUTE_ALLOCATION_INVALID:total');
  }

  return normalized;
}

export function rollAttributeAllocation(seed) {
  const allocation = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 1]));
  const rng = createRng(seed);
  let remaining = ATTRIBUTE_TOTAL - ATTRIBUTE_KEYS.length;

  while (remaining > 0) {
    const availableKeys = ATTRIBUTE_KEYS.filter((key) => allocation[key] < 10);
    const key = availableKeys[Math.floor(rng() * availableKeys.length)];
    allocation[key] += 1;
    remaining -= 1;
  }

  return allocation;
}

export function deriveMaxHealth(attributes) {
  return 80 + attributes.rootBone * 8 + attributes.lifeSeed * 2;
}

export function deriveMaxLifespan(initialLifespan, attributes) {
  return initialLifespan + attributes.lifeSeed * 8;
}

function createRng(seed) {
  let value = Math.abs(Math.floor(seed)) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}
