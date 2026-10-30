import path from 'node:path';
import { createServer } from 'node:net';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { ROOT } from '../../src/config/paths.mjs';
import { temporaryProject } from './temporary-project.mjs';

export async function mcpSession(t, app, { allowScripts = false } = {}) {
  const root = await temporaryProject(t);
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(ROOT, 'src', 'servers', `${app}.mjs`)],
    env: {
      ...process.env,
      ADOBE_MCP_CONFIG: path.join(root, 'config.json'),
      ADOBE_MCP_PORT: String(port),
      ADOBE_MCP_TOKEN: 'b'.repeat(64),
      ADOBE_MCP_ALLOW_SCRIPTS: String(allowScripts)
    },
    stderr: 'pipe'
  });
  const client = new Client({ name: 'adobe-suite-tests', version: '1.0.0' });
  t.after(async () => {
    await client.close();
    await transport.close();
  });
  await client.connect(transport);
  return client;
}
