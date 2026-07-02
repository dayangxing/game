import fs from 'node:fs';
import path from 'node:path';

const LOCAL_ENV_FILES = ['.env', '.env.local'];

export function loadLocalEnv({ cwd = process.cwd(), env = process.env } = {}) {
  const loadedFiles = [];

  for (const file of LOCAL_ENV_FILES) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;

    const values = parseEnvFile(fs.readFileSync(fullPath, 'utf8'));
    for (const [key, value] of Object.entries(values)) {
      env[key] = value;
    }
    loadedFiles.push(file);
  }

  return { loadedFiles };
}

function parseEnvFile(source) {
  const values = {};

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const separator = normalized.indexOf('=');
    if (separator === -1) continue;

    const key = normalized.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    values[key] = unquoteEnvValue(normalized.slice(separator + 1).trim());
  }

  return values;
}

function unquoteEnvValue(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replaceAll('\\"', '"');
  }

  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  return value;
}
