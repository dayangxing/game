import { createJsonFileStore } from './jsonFileStore.js';

export function createGameSaveStore(options = {}) {
  return createJsonFileStore(options);
}
