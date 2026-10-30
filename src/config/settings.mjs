import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { APPS } from './applications.mjs';
import { CONFIG_PATH } from './paths.mjs';

export const connectionSchema = z
  .object({
    port: z.number().int().min(1).max(65535),
    token: z
      .string()
      .min(32)
      .max(1024)
      .regex(/^[\x21-\x7e]+$/, 'Token must use visible ASCII characters')
  })
  .strict();
const configurationSchema = z
  .object(Object.fromEntries(Object.keys(APPS).map((app) => [app, connectionSchema.optional()])))
  .strict();

export function validateConnection(value, app) {
  const result = connectionSchema.safeParse(value);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join('.') || 'configuration'))
    ];
    throw new Error(
      `Invalid connection settings for ${app}: ${fields.join(', ')}. Check the port and token; run npm run setup if needed.`
    );
  }
  return result.data;
}

export async function readConfiguration(file = CONFIG_PATH) {
  let contents;
  try {
    contents = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  let data;
  try {
    data = JSON.parse(contents);
  } catch {
    throw new Error(
      'Invalid local configuration JSON. Repair the configuration file before running setup.'
    );
  }
  const result = configurationSchema.safeParse(data);
  if (!result.success)
    throw new Error(
      'Invalid local configuration. Use only known application IDs with valid port and token fields.'
    );
  return result.data;
}

export async function loadConfig(app, { env = process.env, configPath = CONFIG_PATH } = {}) {
  if (!Object.hasOwn(APPS, app)) throw new Error(`Unknown application: ${app}`);
  const saved = (await readConfiguration(env.ADOBE_MCP_CONFIG || configPath))[app] || {};
  const connection = validateConnection(
    {
      token: env.ADOBE_MCP_TOKEN ?? saved.token,
      port: Number(env.ADOBE_MCP_PORT ?? saved.port ?? APPS[app].port)
    },
    app
  );
  const timeoutMs = Number(env.ADOBE_MCP_TIMEOUT_MS ?? 60000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3600000)
    throw new Error('Invalid timeout (100–3600000 ms).');
  return { app, ...connection, timeoutMs, allowScripts: env.ADOBE_MCP_ALLOW_SCRIPTS === 'true' };
}
