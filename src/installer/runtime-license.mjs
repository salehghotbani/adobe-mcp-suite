import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function runtimeLicense(nodePath = process.execPath, version = process.versions.node) {
  for (const candidate of [
    path.join(path.dirname(nodePath), 'LICENSE'),
    path.join(path.dirname(nodePath), '..', 'LICENSE')
  ]) {
    try {
      const data = await readFile(candidate);
      if (data.toString().includes('Node.js is licensed')) return data;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid Node.js runtime version.');
  const response = await fetch(
    `https://raw.githubusercontent.com/nodejs/node/v${version}/LICENSE`,
    { signal: AbortSignal.timeout(15000) }
  );
  if (!response.ok)
    throw new Error('Cannot obtain the matching Node.js license. Retry with network access.');
  const text = await response.text();
  if (!text.includes('Node.js is licensed') || text.length > 1024 * 1024)
    throw new Error('Invalid Node.js license response.');
  return Buffer.from(text);
}
