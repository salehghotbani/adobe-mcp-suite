import { request } from 'node:http';
import { z } from 'zod';

const statusSchema = z.object({
  app: z.string(),
  port: z.number().int(),
  connected: z.boolean(),
  hostVersion: z.string().max(100).nullable(),
  busy: z.boolean(),
  uncertain: z.boolean(),
  queued: z.number().int().nonnegative()
});

export async function probeBridge(app, connection, { serverOnly = false, timeoutMs = 2000 } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve({ name: `${app} live bridge`, ...result });
    };
    const call = request(
      {
        hostname: '127.0.0.1',
        port: connection.port,
        path: '/v1/status',
        method: 'GET',
        agent: false,
        headers: { Authorization: `Bearer ${connection.token}` }
      },
      (response) => {
        if (response.statusCode !== 200) {
          finish({
            ok: false,
            message:
              response.statusCode === 401
                ? 'Bridge authentication failed. Match the saved and server connection settings.'
                : `Bridge status request failed (HTTP ${response.statusCode}).`
          });
          response.destroy();
          call.destroy();
          return;
        }
        let bytes = 0;
        const chunks = [];
        response.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes > 64 * 1024) {
            finish({ ok: false, message: 'Bridge status response exceeds size limits.' });
            response.destroy();
            call.destroy();
          } else chunks.push(chunk);
        });
        response.on('error', () =>
          finish({ ok: false, message: 'Bridge status response was interrupted.' })
        );
        response.on('end', () => {
          if (settled) return;
          let status;
          try {
            status = statusSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch {
            finish({ ok: false, message: 'Invalid bridge status response.' });
            return;
          }
          if (status.app !== app || status.port !== connection.port) {
            finish({
              ok: false,
              message: 'This port belongs to a different application or bridge.'
            });
            return;
          }
          const ok = !status.uncertain && (serverOnly || status.connected);
          finish({
            ok,
            status,
            ...(ok
              ? {}
              : {
                  message: status.uncertain
                    ? 'An earlier native operation is uncertain. Inspect Adobe before retrying mutations.'
                    : 'The bridge is running but the matching Adobe panel is disconnected.'
                })
          });
        });
      }
    );
    const deadline = setTimeout(() => {
      finish({ ok: false, message: 'Bridge status request timed out.' });
      call.destroy();
    }, timeoutMs);
    call.on('error', () =>
      finish({
        ok: false,
        message:
          'Bridge is unavailable. Start this application server in the MCP client and check its port.'
      })
    );
    call.end();
  });
}
