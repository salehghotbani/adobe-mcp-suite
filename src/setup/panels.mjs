import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { APPS } from '../config/applications.mjs';

export async function panelContents({ app, sourceRoot, connection, version }) {
  const info = APPS[app];
  if (!info) throw new Error('Unknown application.');
  const template = await readFile(path.join(sourceRoot, 'cep', 'manifest.xml.template'), 'utf8');
  const values = { APP: app, TITLE: info.title, HOST: info.host, VERSION: version };
  const manifest = template.replace(/\{\{([A-Z]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`Unknown manifest placeholder: ${key}`);
    return values[key];
  });
  const files = {
    'CSXS/manifest.xml': Buffer.from(manifest),
    'config.js': Buffer.from(
      `window.ADOBE_MCP = ${JSON.stringify({ ...connection, app, title: info.title, host: info.host })};\n`
    )
  };
  for (const file of ['index.html', 'panel.css', 'panel.js'])
    files[file] = await readFile(path.join(sourceRoot, 'cep', file));
  files['icon.png'] = await readFile(
    path.join(sourceRoot, 'assets', 'branding', 'adobe-mcp-icon.png')
  );
  return files;
}

export async function writePanel(options) {
  const files = await panelContents(options);
  for (const [name, contents] of Object.entries(files)) {
    const file = path.join(options.destination, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents, { mode: name === 'config.js' ? 0o600 : 0o644 });
  }
}
