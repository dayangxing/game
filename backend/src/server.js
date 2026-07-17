import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

import { createBackendApp } from './app.js';
import { loadLocalEnv } from './config/env.js';

loadLocalEnv();

export function startBackendServer({
  host = process.env.HOST || '127.0.0.1',
  port = process.env.PORT || 8787,
  app = createBackendApp()
} = {}) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = await toWebRequest(incoming);
      const response = await app.handle(request);
      await sendWebResponse(outgoing, response);
    } catch (error) {
      outgoing.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      outgoing.end(JSON.stringify({
        ok: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: '后端服务异常。' },
        requestId: 'req_server'
      }));
    }
  });

  server.listen(port, host);
  return server;
}

export function waitForServerListening(server) {
  if (server.listening) return Promise.resolve(server.address());

  return new Promise((resolve, reject) => {
    const onListening = () => {
      cleanup();
      resolve(server.address());
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      server.off('listening', onListening);
      server.off('error', onError);
    };

    server.once('listening', onListening);
    server.once('error', onError);
  });
}

export function closeBackendServer(server) {
  if (!server || !server.listening) return Promise.resolve();

  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function toWebRequest(incoming) {
  const chunks = [];
  for await (const chunk of incoming) {
    chunks.push(chunk);
  }

  const protocol = 'http';
  const host = incoming.headers.host ?? 'localhost';
  const url = `${protocol}://${host}${incoming.url}`;
  const body = chunks.length === 0 ? undefined : Buffer.concat(chunks);

  return new Request(url, {
    method: incoming.method,
    headers: incoming.headers,
    body
  });
}

export async function sendWebResponse(outgoing, response) {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (!response.body) {
    outgoing.end();
    return;
  }

  const reader = response.body.getReader?.();
  if (!reader) {
    outgoing.end(Buffer.from(await response.arrayBuffer()));
    return;
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) outgoing.write(Buffer.from(value));
    }
    outgoing.end();
  } catch (error) {
    outgoing.destroy(error);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST || '127.0.0.1';
  const port = process.env.PORT || 8787;
  startBackendServer({ host, port });
  console.log(`Cultivation backend listening on http://${host}:${port}`);
}
