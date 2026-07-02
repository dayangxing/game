import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

import { sendWebResponse } from '../backend/src/server.js';

test('backend http sender flushes streamed response chunks before the body closes', async () => {
  let releaseSecondChunk;
  const encoder = new TextEncoder();
  const writes = [];
  const outgoing = {
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    write(chunk) {
      writes.push(new TextDecoder().decode(chunk));
      return true;
    },
    end(chunk) {
      if (chunk) writes.push(new TextDecoder().decode(chunk));
      this.ended = true;
    },
    destroy(error) {
      this.error = error;
    }
  };
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('event: first\ndata: {"ok":true}\n\n'));
      releaseSecondChunk = () => {
        controller.enqueue(encoder.encode('event: done\ndata: {"ok":true}\n\n'));
        controller.close();
      };
    }
  }), {
    headers: { 'content-type': 'text/event-stream; charset=utf-8' }
  });

  const sendPromise = sendWebResponse(outgoing, response);
  await delay(30);

  assert.equal(outgoing.status, 200);
  assert.match(writes.join(''), /event: first/);
  assert.equal(outgoing.ended, undefined);

  releaseSecondChunk();
  await sendPromise;

  assert.match(writes.join(''), /event: done/);
  assert.equal(outgoing.ended, true);
  assert.equal(outgoing.error, undefined);
});
