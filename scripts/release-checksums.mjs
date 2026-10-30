import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sha256 } from '../src/installer/bundle.mjs';
const directory = path.resolve(process.argv[2] || 'dist');
const lines = [];
for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
  a.name.localeCompare(b.name)
)) {
  if (entry.name === 'SHA256SUMS') continue;
  if (!entry.isFile() || !/^[a-zA-Z0-9._-]+$/.test(entry.name))
    throw new Error('Release assets must be regular files with safe names.');
  lines.push(`${sha256(await readFile(path.join(directory, entry.name)))}  ${entry.name}`);
}
await writeFile(path.join(directory, 'SHA256SUMS'), lines.join('\n') + '\n');
console.log(`Checksummed ${lines.length} release assets.`);
