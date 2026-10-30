import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { APPS } from '../config/applications.mjs';
import { VERSION } from '../config/project.mjs';
import { loadConfig } from '../config/settings.mjs';
import { Bridge } from '../bridge/http-bridge.mjs';
import { buildScript } from '../bridge/extendscript.mjs';
import { commonTools } from './common-tools.mjs';
import { registerDiscovery } from './discovery.mjs';

export function createMcpServer(app, bridge, tools, allowScripts = false) {
  const server = new McpServer({ name: `adobe-${app}`, version: VERSION });
  const asResult = (value) => ({
    content: [{ type: 'text', text: JSON.stringify(value ?? null, null, 2) }]
  });
  const registeredTools = [...commonTools(app, allowScripts), ...tools];
  registerDiscovery(server, { app, bridge, tools: registeredTools, allowScripts });
  for (const t of registeredTools) {
    server.registerTool(
      t.name,
      { description: t.description, inputSchema: t.schema, annotations: t.annotations },
      async (params) => {
        try {
          const value = t.localHandler
            ? await t.localHandler(bridge, params)
            : await bridge.execute(
                buildScript(t.scriptBody ? t.scriptBody(params) : t.body, params)
              );
          return asResult(value);
        } catch (error) {
          return { isError: true, content: [{ type: 'text', text: error.message }] };
        }
      }
    );
  }
  return server;
}

export async function start(app, tools) {
  const config = await loadConfig(app);
  const bridge = await new Bridge(config).start();
  let stopping = false,
    transport;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await transport?.close();
    } finally {
      await bridge.close();
    }
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.stdin.once('end', stop);
  console.error(`Adobe MCP: ${APPS[app].title}, bridge 127.0.0.1:${config.port}`);
  try {
    transport = serveStdio(() => createMcpServer(app, bridge, tools, config.allowScripts));
  } catch (error) {
    await stop();
    throw error;
  }
}
