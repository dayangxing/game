import path from 'node:path';

import { createGameSaveStore } from '../backend/src/storage/gameSaveStore.js';
import { createJsonFileStore } from '../backend/src/storage/jsonFileStore.js';
import { createBackendApp } from '../backend/src/app.js';
import { closeBackendServer, startBackendServer, waitForServerListening } from '../backend/src/server.js';

export async function startDesktopBackend({ savePath, modelConfigPath, env = process.env } = {}) {
  if (!savePath) throw new TypeError('savePath is required');

  const saveStore = createGameSaveStore({ filePath: savePath });
  const modelConfigStore = createJsonFileStore({
    filePath: modelConfigPath ?? path.join(path.dirname(savePath), 'model-config.json')
  });
  const app = createBackendApp({
    env,
    initialGame: saveStore.load() ?? undefined,
    modelConfig: modelConfigStore.load() ?? undefined,
    persistGame: (game) => saveStore.save(game),
    persistModelConfig: (config) => modelConfigStore.save(config)
  });
  const server = startBackendServer({ host: '127.0.0.1', port: 0, app });

  let address;
  try {
    address = await waitForServerListening(server);
  } catch (error) {
    await closeBackendServer(server);
    throw error;
  }

  let stopPromise = null;
  const stop = () => {
    if (!stopPromise) {
      stopPromise = closeBackendServer(server);
    }
    return stopPromise;
  };

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    stop
  };
}
