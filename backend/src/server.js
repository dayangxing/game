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

async function sendWebResponse(outgoing, response) {
  outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (!response.body) {
    outgoing.end();
    return;
  }

  const body = Buffer.from(await response.arrayBuffer());
  outgoing.end(body);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = process.env.HOST || '127.0.0.1';
  const port = process.env.PORT || 8787;
  startBackendServer({ host, port });
  console.log(`Cultivation backend listening on http://${host}:${port}`);
}
