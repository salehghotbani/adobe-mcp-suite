import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { APPS } from '../config/applications.mjs';

export async function writePanel({ app, sourceRoot, destination, connection, version }) {
  const info = APPS[app];
  if (!info) throw new Error('Unknown application.');
  const template = await readFile(path.join(sourceRoot, 'cep', 'manifest.xml.template'), 'utf8');
  const values = { APP: app, TITLE: info.title, HOST: info.host, VERSION: version };
  const manifest = template.replace(/\{\{([A-Z]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`Unknown manifest placeholder: ${key}`);
    return values[key];
  });
  await mkdir(path.join(destination, 'CSXS'), { recursive: true });
  for (const file of ['index.html', 'panel.css', 'panel.js'])
    await copyFile(path.join(sourceRoot, 'cep', file), path.join(destination, file));
  await copyFile(
    path.join(sourceRoot, 'assets', 'branding', 'adobe-mcp-icon.png'),
    path.join(destination, 'icon.png')
  );
  await writeFile(
    path.join(destination, 'config.js'),
    `window.ADOBE_MCP = ${JSON.stringify({ ...connection, app, title: info.title, host: info.host })};\n`,
    { mode: 0o600 }
  );
  await writeFile(path.join(destination, 'CSXS', 'manifest.xml'), manifest);
}
