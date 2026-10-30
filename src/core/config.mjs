import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { APPS } from './apps.mjs';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const CONFIG_PATH = path.join(ROOT, '.adobe-mcp', 'config.json');

export async function loadConfig(app) {
  if (!APPS[app]) throw new Error(`Unknown application: ${app}`);
  let saved = {};
  try { saved = JSON.parse(await readFile(process.env.ADOBE_MCP_CONFIG || CONFIG_PATH, 'utf8'))[app] || {}; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const token = process.env.ADOBE_MCP_TOKEN || saved.token;
  const port = Number(process.env.ADOBE_MCP_PORT || saved.port || APPS[app].port);
  const timeoutMs = Number(process.env.ADOBE_MCP_TIMEOUT_MS || 60000);
  if (typeof token !== 'string' || token.length < 32) throw new Error('Missing bridge token. Run npm run setup first.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid bridge port.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 3600000) throw new Error('Invalid timeout (100–3600000 ms).');
  return { app, port, token, timeoutMs, allowScripts: process.env.ADOBE_MCP_ALLOW_SCRIPTS === 'true' };
}
