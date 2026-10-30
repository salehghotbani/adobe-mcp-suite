import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'prettier';
import { ROOT } from '../src/config/paths.mjs';
import { buildCatalog } from '../src/catalog/build-catalog.mjs';

const { catalog, markdown } = buildCatalog();
const files = {
  'docs/tools.json': await format(JSON.stringify(catalog), { parser: 'json', printWidth: 100 }),
  'docs/TOOLS.md': await format(markdown, {
    parser: 'markdown',
    proseWrap: 'preserve',
    printWidth: 100
  })
};
for (const [file, contents] of Object.entries(files)) {
  const full = path.join(ROOT, file);
  if (process.argv.includes('--check')) {
    if ((await readFile(full, 'utf8')) !== contents)
      throw new Error(`${file} is out of date. Run npm run catalog.`);
  } else await writeFile(full, contents);
}
console.error(
  process.argv.includes('--check')
    ? 'Tool documentation is up to date.'
    : 'Updated docs/TOOLS.md and docs/tools.json'
);
