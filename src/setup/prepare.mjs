import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { APPS } from '../config/applications.mjs';
import { ROOT } from '../config/paths.mjs';
import { VERSION } from '../config/project.mjs';
import { readConfiguration, validateConnection } from '../config/settings.mjs';

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
  const template = await readFile(path.join(root, 'cep', 'manifest.xml.template'), 'utf8');
  await mkdir(path.dirname(configPath), { recursive: true });
  // Persist tokens before generating panels so a failed copy cannot discard them.
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });

  for (const [app, info] of Object.entries(APPS)) {
    const panel = path.join(root, 'build', 'cep', `com.adobemcp.${app}`);
    await mkdir(path.join(panel, 'CSXS'), { recursive: true });
    for (const file of ['index.html', 'panel.css', 'panel.js'])
      await copyFile(path.join(root, 'cep', file), path.join(panel, file));
    await copyFile(
      path.join(root, 'assets', 'branding', 'adobe-mcp-icon.png'),
      path.join(panel, 'icon.png')
    );
    await writeFile(
      path.join(panel, 'config.js'),
      `window.ADOBE_MCP = ${JSON.stringify({ ...config[app], app, title: info.title, host: info.host })};\n`,
      { mode: 0o600 }
    );
    const values = { APP: app, TITLE: info.title, HOST: info.host, VERSION };
    const manifest = template.replace(/\{\{([A-Z]+)\}\}/g, (_, key) => {
      if (!Object.hasOwn(values, key)) throw new Error(`Unknown manifest placeholder: ${key}`);
      return values[key];
    });
    await writeFile(path.join(panel, 'CSXS', 'manifest.xml'), manifest);
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
