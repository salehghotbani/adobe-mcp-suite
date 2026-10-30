import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { APPS } from './apps.mjs';
import { loadConfig } from './config.mjs';
import { Bridge } from './bridge.mjs';
import { buildScript } from './script.mjs';
import { commonTools } from '../apps/common.mjs';

export function createMcpServer(app, bridge, tools, allowScripts = false) {
  const server = new McpServer({ name: `adobe-${app}`, version: '0.1.0' });
  const asResult = value => ({ content: [{ type: 'text', text: JSON.stringify(value ?? null, null, 2) }] });
  server.registerTool('connection_status', {
    description: `Check the local bridge for ${APPS[app].title}; works without Adobe connected.`,
    inputSchema: z.object({}).strict(), annotations: { readOnlyHint: true, openWorldHint: false }
  }, async () => asResult(bridge.status()));
  for (const t of [...commonTools(allowScripts), ...tools]) {
    server.registerTool(t.name, { description: t.description, inputSchema: t.schema, annotations: t.annotations }, async params => {
      try { return asResult(await bridge.execute(buildScript(t.name === 'run_script' ? params.code : t.body, params))); }
      catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
    });
  }
  return server;
}

export async function start(app, tools) {
  const config = await loadConfig(app);
  const bridge = await new Bridge(config).start();
  const stop = async () => { await bridge.close(); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.stdin.once('end', stop);
  console.error(`Adobe MCP: ${APPS[app].title}, bridge 127.0.0.1:${config.port}`);
  await serveStdio(() => createMcpServer(app, bridge, tools, config.allowScripts));
}
