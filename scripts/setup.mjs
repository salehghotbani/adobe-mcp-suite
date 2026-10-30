import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { APPS } from '../src/core/apps.mjs';
import { ROOT, CONFIG_PATH } from '../src/core/config.mjs';

await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
let config = {};
try { config = JSON.parse(await readFile(CONFIG_PATH, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const [app, info] of Object.entries(APPS)) {
  if (!config[app]) config[app] = { port: info.port, token: randomBytes(32).toString('hex') };
  const panel = path.join(ROOT, 'build', 'cep', `com.adobemcp.${app}`);
  await mkdir(path.join(panel, 'CSXS'), { recursive: true });
  for (const file of ['index.html', 'panel.css', 'panel.js']) await copyFile(path.join(ROOT, 'cep', file), path.join(panel, file));
  await copyFile(path.join(ROOT, 'assets', 'adobe-mcp-icon.png'), path.join(panel, 'icon.png'));
  await writeFile(path.join(panel, 'config.js'), `window.ADOBE_MCP = ${JSON.stringify({ app, title: info.title, host: info.host, ...config[app] })};\n`, { mode: 0o600 });
  await writeFile(path.join(panel, 'CSXS', 'manifest.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<ExtensionManifest Version="7.0" ExtensionBundleId="com.adobemcp.${app}" ExtensionBundleVersion="0.1.0" ExtensionBundleName="Adobe MCP ${info.title}">
  <ExtensionList><Extension Id="com.adobemcp.${app}.panel" Version="0.1.0"/></ExtensionList>
  <ExecutionEnvironment><HostList><Host Name="${info.host}" Version="[0.0,99.9]"/></HostList><LocaleList><Locale Code="All"/></LocaleList><RequiredRuntimeList><RequiredRuntime Name="CSXS" Version="10.0"/></RequiredRuntimeList></ExecutionEnvironment>
  <DispatchInfoList><Extension Id="com.adobemcp.${app}.panel"><DispatchInfo>
    <Resources><MainPath>./index.html</MainPath></Resources>
    <Lifecycle><AutoVisible>true</AutoVisible></Lifecycle>
    <UI><Type>Panel</Type><Menu>Adobe MCP — ${info.title}</Menu><Geometry><Size><Height>340</Height><Width>360</Width></Size><MinSize><Height>270</Height><Width>280</Width></MinSize></Geometry></UI>
  </DispatchInfo></Extension></DispatchInfoList>
</ExtensionManifest>\n`);
}
await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
const mcpServers = Object.fromEntries(Object.keys(APPS).map(app => [`adobe-${app}`, { command: process.execPath, args: [path.join(ROOT, 'src', 'servers', `${app}.mjs`)] }]));
await writeFile(path.join(ROOT, '.adobe-mcp', 'mcp-servers.json'), JSON.stringify({ mcpServers }, null, 2) + '\n');
console.error('Prepared seven CEP panels in build/cep. Tokens preserved on repeat setup.');
console.error('MCP client configuration: .adobe-mcp/mcp-servers.json');
