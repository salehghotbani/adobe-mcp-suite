import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { VERSION } from '../src/config/project.mjs';
import { assetName } from '../src/installer/platform.mjs';
import { extractBundle, nodeName, verifyBundle } from '../src/installer/bundle.mjs';
import { safeRemove } from '../src/installer/storage.mjs';

const execFile = promisify(execFileCallback),
  temporary = await mkdtemp(path.join(os.tmpdir(), 'adobe-mcp-smoke-'));
try {
  const bundle = path.join(temporary, 'bundle'),
    home = path.join(temporary, 'installation with spaces');
  await extractBundle(
    await readFile(path.resolve(process.argv[2] || path.join('dist', assetName(VERSION)))),
    bundle
  );
  await verifyBundle(bundle);
  const runtime = path.join(bundle, 'runtime', nodeName(process.platform)),
    entry = path.join(bundle, 'app', 'bin', 'adobe-mcp.mjs');
  const run = (...args) =>
    execFile(runtime, [entry, ...args], {
      env: { ...process.env, ADOBE_MCP_NO_UPDATE_CHECK: '1' }
    });
  await run('install', '--apps', 'ps,premiere', '--server-only', '--root', home);
  const first = JSON.parse(await readFile(path.join(home, 'connections.json'), 'utf8'));
  await run('install', '--apps', 'ai', '--root', home);
  assert.equal(
    JSON.parse(await readFile(path.join(home, 'connections.json'), 'utf8')).photoshop.token,
    first.photoshop.token
  );
  const config = JSON.parse((await run('config', '--root', home)).stdout);
  assert.equal(Object.keys(config.mcpServers).length, 3);
  for (const app of ['photoshop', 'premiere-pro', 'illustrator']) {
    const server = config.mcpServers['adobe-' + app];
    const transport = new StdioClientTransport({
      ...server,
      env: { ...process.env, ADOBE_MCP_NO_UPDATE_CHECK: '1' },
      stderr: 'pipe'
    });
    const client = new Client({ name: 'release-smoke', version: VERSION }, { capabilities: {} });
    try {
      await client.connect(transport);
      assert.ok((await client.listTools()).tools.length >= 19);
      assert.equal((await client.listResources()).resources.length, 2);
    } finally {
      await client.close();
    }
  }
  await run('uninstall', '--apps', 'ps', '--root', home);
  assert.equal(JSON.parse((await run('status', '--root', home)).stdout).applications.length, 2);
  console.log(
    'Portable installation, stable launchers, incremental selection and MCP stdio passed.'
  );
} finally {
  await safeRemove(temporary, os.tmpdir());
}
