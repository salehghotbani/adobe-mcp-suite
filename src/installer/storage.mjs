import { open, mkdir, readFile, writeFile, rename, rm, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { APPS } from '../config/applications.mjs';
import { PRODUCT } from './platform.mjs';

export const versionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const stateSchema = z
  .object({
    product: z.literal(PRODUCT),
    schemaVersion: z.literal(1),
    currentVersion: versionSchema.nullable(),
    previousVersion: versionSchema.nullable(),
    selectedApps: z.array(z.enum(Object.keys(APPS))),
    serverOnly: z.boolean(),
    extensionsRoot: z.string().nullable(),
    updates: z
      .object({ enabled: z.boolean(), intervalHours: z.number().int().min(1).max(168) })
      .strict()
  })
  .strict();
export const initialState = () => ({
  product: PRODUCT,
  schemaVersion: 1,
  currentVersion: null,
  previousVersion: null,
  selectedApps: [],
  serverOnly: process.platform === 'linux',
  extensionsRoot: null,
  updates: { enabled: true, intervalHours: 24 }
});

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Cannot read ${path.basename(file)}; repair or restore this file.`);
  }
}
export async function readState(home, { optional = false } = {}) {
  const value = await readJson(path.join(home, 'state.json'), null);
  if (value === null && optional) return null;
  const parsed = stateSchema.safeParse(value);
  if (!parsed.success) throw new Error('This directory is not a valid Adobe MCP installation.');
  return parsed.data;
}
export async function atomicWrite(file, value, { raw = false } = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp-' + randomUUID();
  try {
    await writeFile(temporary, raw ? value : JSON.stringify(value, null, 2) + '\n', {
      mode: 0o600
    });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}
export function childPath(root, ...parts) {
  const base = path.resolve(root),
    target = path.resolve(base, ...parts),
    relative = path.relative(base, target);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith('..' + path.sep) ||
    path.isAbsolute(relative)
  )
    throw new Error('Path escapes the managed directory.');
  return target;
}
export async function safeRemove(target, root) {
  childPath(root, path.relative(root, target));
  let stat;
  try {
    stat = await lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  if (stat.isSymbolicLink()) throw new Error('Refusing to remove a linked installation directory.');
  const actualRoot = await realpath(root),
    actualTarget = await realpath(target);
  childPath(actualRoot, path.relative(actualRoot, actualTarget));
  await rm(target, { recursive: true, force: true });
}
export async function withLock(home, name, operation) {
  await mkdir(home, { recursive: true });
  const file = childPath(home, name);
  let lock;
  for (let attempt = 0; attempt < 2 && !lock; attempt++) {
    try {
      lock = await open(file, 'wx', 0o600);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let stale = false;
      try {
        const saved = await readJson(file, null);
        if (
          saved &&
          Number.isInteger(saved.pid) &&
          saved.pid > 0 &&
          Date.now() - Date.parse(saved.started) > 300000
        ) {
          try {
            process.kill(saved.pid, 0);
          } catch (problem) {
            stale = problem.code === 'ESRCH';
          }
        }
      } catch {}
      if (stale && attempt === 0) {
        await rm(file, { force: true });
        continue;
      }
      throw new Error(
        'Another installation or update check is already running. Retry after it finishes.'
      );
    }
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
    return await operation();
  } finally {
    await lock.close();
    await rm(file, { force: true });
  }
}
