import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { APPS } from '../config/applications.mjs';
import { ROOT } from '../config/paths.mjs';
import { VERSION } from '../config/project.mjs';
import { readConfiguration, validateConnection } from '../config/settings.mjs';
import { writePanel } from './panels.mjs';

export async function prepareProject({ root = ROOT, nodePath = process.execPath } = {}) {
  const configPath = path.join(root, '.adobe-mcp', 'config.json');
  const saved = await readConfiguration(configPath);
  const config = Object.fromEntries(
    Object.entries(APPS).map(([app, info]) => [
      app,
      validateConnection(
        saved[app] || { port: info.port, token: randomBytes(32).toString('hex') },
        app
      )
    ])
  );
  await mkdir(path.dirname(configPath), { recursive: true });
  // Persist tokens before generating panels so a failed copy cannot discard them.
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });

  for (const app of Object.keys(APPS)) {
    const panel = path.join(root, 'build', 'cep', `com.adobemcp.${app}`);
    await writePanel({
      app,
      sourceRoot: root,
      destination: panel,
      connection: config[app],
      version: VERSION
    });
  }

  const mcpServers = Object.fromEntries(
    Object.keys(APPS).map((app) => [
      `adobe-${app}`,
      {
        command: nodePath,
        args: [path.join(root, 'src', 'servers', `${app}.mjs`)]
      }
    ])
  );
  const clientConfigPath = path.join(root, '.adobe-mcp', 'mcp-servers.json');
  await writeFile(clientConfigPath, JSON.stringify({ mcpServers }, null, 2) + '\n');
  return { configPath, clientConfigPath, applications: Object.keys(APPS) };
}
