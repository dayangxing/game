import fs from 'node:fs';
import path from 'node:path';

export function createJsonFileStore({ filePath, fsImpl = fs } = {}) {
  if (!filePath) throw new TypeError('filePath is required');

  function load() {
    try {
      return JSON.parse(fsImpl.readFileSync(filePath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      if (error instanceof SyntaxError) {
        fsImpl.renameSync(filePath, `${filePath}.corrupt`);
        return null;
      }
      throw error;
    }
  }

  function save(value) {
    fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    const text = `${JSON.stringify(value, null, 2)}\n`;
    fsImpl.writeFileSync(tempPath, text, { encoding: 'utf8', mode: 0o600 });
    fsImpl.renameSync(tempPath, filePath);
  }

  function clear() {
    try {
      fsImpl.unlinkSync(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  return { load, save, clear };
}
