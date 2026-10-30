import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { APPS } from '../../src/config/applications.mjs';
import { VERSION } from '../../src/config/project.mjs';
import { prepareProject } from '../../src/setup/prepare.mjs';
import { temporaryProject } from '../helpers/temporary-project.mjs';

test('setup builds seven matching panels, preserves tokens, and produces portable client paths', async (t) => {
  const root = await temporaryProject(t, { includeAssets: true });
  const first = await prepareProject({ root, nodePath: '/example/node' });
  const config = JSON.parse(await readFile(first.configPath, 'utf8'));
  assert.equal(new Set(Object.values(config).map((v) => v.token)).size, 7);
  assert.equal((await readdir(path.join(root, 'build', 'cep'))).length, 7);
  for (const [app, info] of Object.entries(APPS)) {
    const panel = path.join(root, 'build', 'cep', `com.adobemcp.${app}`),
      context = { window: {} };
    vm.runInNewContext(await readFile(path.join(panel, 'config.js'), 'utf8'), context);
    assert.equal(context.window.ADOBE_MCP.host, info.host);
    assert.equal(context.window.ADOBE_MCP.token, config[app].token);
    const manifest = await readFile(path.join(panel, 'CSXS', 'manifest.xml'), 'utf8');
    assert.ok(manifest.includes(`Name="${info.host}"`));
    assert.ok(manifest.includes(`ExtensionBundleVersion="${VERSION}"`));
    assert.equal(manifest.includes('{{'), false);
  }
  const client = JSON.parse(await readFile(first.clientConfigPath, 'utf8'));
  assert.equal(client.mcpServers['adobe-photoshop'].command, '/example/node');
  assert.deepEqual(client.mcpServers['adobe-photoshop'].args, [
    path.join(root, 'src', 'servers', 'photoshop.mjs')
  ]);
  const original = await readFile(first.configPath, 'utf8');
  await prepareProject({ root });
  assert.equal(await readFile(first.configPath, 'utf8'), original);
});
test('setup refuses invalid saved settings before changing configuration or panels', async (t) => {
  const root = await temporaryProject(t, { includeAssets: true });
  const result = await prepareProject({ root });
  const invalid = JSON.stringify({ photoshop: { port: 0, token: 'invalid' } });
  await writeFile(result.configPath, invalid);
  const panelFile = path.join(root, 'build', 'cep', 'com.adobemcp.photoshop', 'config.js');
  const previous = await readFile(panelFile, 'utf8');
  await assert.rejects(prepareProject({ root }), /Invalid local configuration/);
  assert.equal(await readFile(result.configPath, 'utf8'), invalid);
  assert.equal(await readFile(panelFile, 'utf8'), previous);
});
