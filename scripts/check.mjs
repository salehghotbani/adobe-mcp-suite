import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'acorn';
import { catalogs } from '../src/apps/index.mjs';
import { buildScript } from '../src/bridge/extendscript.mjs';
import { ROOT } from '../src/config/paths.mjs';
import { commonTools } from '../src/mcp/common-tools.mjs';
async function checkDirectory(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, file.name);
    if (file.isDirectory()) await checkDirectory(full);
    else if (/\.(mjs|js)$/.test(file.name)) {
      const checked = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
      if (checked.status !== 0) throw new Error(checked.stderr);
    }
  }
}
for (const dir of ['bin', 'src', 'scripts', 'tests', 'cep'])
  await checkDirectory(path.join(ROOT, dir));
let count = 0;
for (const [app, tools] of Object.entries(catalogs)) {
  const names = new Set();
  for (const tool of [...commonTools(app, true), ...tools]) {
    if (names.has(tool.name)) throw new Error(`${app}: duplicate ${tool.name}`);
    names.add(tool.name);
    if (tool.body) parse(buildScript(tool.body, {}), { ecmaVersion: 3 });
    if (!tool.scriptBody) count++;
  }
}
parse(await readFile(path.join(ROOT, 'cep', 'panel.js'), 'utf8'), { ecmaVersion: 5 });
console.error(
  `Syntax verified: ${count} default tools; generated host scripts are ES3 compatible.`
);
