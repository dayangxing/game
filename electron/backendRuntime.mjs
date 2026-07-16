import { createGameSaveStore } from '../backend/src/storage/gameSaveStore.js';
import { createBackendApp } from '../backend/src/app.js';
import { closeBackendServer, startBackendServer, waitForServerListening } from '../backend/src/server.js';

export async function startDesktopBackend({ savePath, env = process.env } = {}) {
  if (!savePath) throw new TypeError('savePath is required');

  const saveStore = createGameSaveStore({ filePath: savePath });
  const app = createBackendApp({
    env,
    initialGame: saveStore.load() ?? undefined,
    persistGame: (game) => saveStore.save(game)
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
