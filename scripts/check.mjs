import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'acorn';
import { catalogs } from '../src/apps/index.mjs';
import { buildScript } from '../src/core/script.mjs';
import { ROOT } from '../src/core/config.mjs';
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
for (const dir of ['src', 'scripts', 'tests', 'cep']) await checkDirectory(path.join(ROOT, dir));
let count = 0;
for (const [app, tools] of Object.entries(catalogs)) {
  const names = new Set();
  for (const tool of tools) {
    if (names.has(tool.name)) throw new Error(`${app}: duplicate ${tool.name}`);
    names.add(tool.name);
    parse(buildScript(tool.body, {}), { ecmaVersion: 3 });
    count++;
  }
}
parse(await readFile(path.join(ROOT, 'cep', 'panel.js'), 'utf8'), { ecmaVersion: 5 });
console.error(`Syntax verified: ${count} application tools; generated host scripts are ES3 compatible.`);
