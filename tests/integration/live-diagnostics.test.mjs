import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { probeBridge } from '../../src/installer/live-diagnostics.mjs';

const token = 's'.repeat(64);
async function server(t, handler) {
  const instance = createServer(handler);
  await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        instance.closeAllConnections();
        instance.close(resolve);
      })
  );
  return { port: instance.address().port, token };
}
function status(port, overrides = {}) {
  return {
    app: 'photoshop',
    port,
    connected: true,
    hostVersion: 'test',
    busy: false,
    uncertain: false,
    queued: 0,
    ...overrides
  };
}

test('live diagnostics sends only an authenticated read request and reports panel state', async (t) => {
  let reply = {};
  const connection = await server(t, (request, response) => {
    assert.equal(request.method, 'GET');
    assert.equal(request.url, '/v1/status');
    assert.equal(request.headers.authorization, 'Bearer ' + token);
    response.end(JSON.stringify(status(connection.port, reply)));
  });
  assert.equal((await probeBridge('photoshop', connection)).ok, true);
  reply = { connected: false };
  assert.equal((await probeBridge('photoshop', connection)).ok, false);
  assert.equal((await probeBridge('photoshop', connection, { serverOnly: true })).ok, true);
  reply = { uncertain: true };
  assert.match((await probeBridge('photoshop', connection)).message, /uncertain/);
  reply = { app: 'illustrator' };
  assert.match((await probeBridge('photoshop', connection)).message, /different application/);
});

test('live diagnostics rejects redirects, failed authentication, malformed and oversized replies without exposing bodies', async (t) => {
  let mode = 'auth';
  const connection = await server(t, (_request, response) => {
    if (mode === 'auth') {
      response.writeHead(401);
      response.end(token);
    }
    if (mode === 'redirect') {
      response.writeHead(302, { location: 'https://example.invalid/' + token });
      response.end();
    }
    if (mode === 'malformed') response.end(token);
    if (mode === 'oversized') response.end(token.repeat(2000));
  });
  for (const value of ['auth', 'redirect', 'malformed', 'oversized']) {
    mode = value;
    const result = await probeBridge('photoshop', connection);
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes(token), false);
  }
});

test('live diagnostics bounds hanging requests and handles unavailable servers', async (t) => {
  const connection = await server(t, () => {});
  assert.match(
    (await probeBridge('photoshop', connection, { timeoutMs: 50 })).message,
    /timed out/
  );
  const instance = createServer();
  await new Promise((resolve) => instance.listen(0, '127.0.0.1', resolve));
  const port = instance.address().port;
  await new Promise((resolve) => instance.close(resolve));
  assert.match((await probeBridge('photoshop', { port, token })).message, /unavailable/);
});
