import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile as callback } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from '../../src/config/paths.mjs';
import { atomicWrite, readState } from '../../src/installer/storage.mjs';
import {
  diagnoseInstallation,
  installApplications,
  repairInstallation
} from '../../src/installer/manager.mjs';
import { validateSelectedConnections } from '../../src/config/settings.mjs';
import { fixtureBundle, workspace } from '../helpers/installer-fixture.mjs';
import { Bridge } from '../../src/bridge/http-bridge.mjs';
const execFile = promisify(callback);

test('doctor live uses saved credentials against a real bridge without starting servers', async (t) => {
  const root = await workspace(t),
    home = path.join(root, 'home'),
    source = await fixtureBundle(path.join(root, 'bundle'));
  await installApplications({ home, apps: ['photoshop'], source, serverOnly: true });
  const settings = JSON.parse(await readFile(path.join(home, 'connections.json'), 'utf8'));
  const bridge = await new Bridge({
    app: 'photoshop',
    token: settings.photoshop.token,
    port: 0,
    timeoutMs: 1000
  }).start();
  t.after(() => bridge.close());
  settings.photoshop.port = bridge.config.port;
  await atomicWrite(path.join(home, 'connections.json'), settings);
  const cli = path.join(ROOT, 'bin', 'adobe-mcp.mjs');
  const result = JSON.parse(
    (await execFile(process.execPath, [cli, 'doctor', '--live', '--root', home])).stdout
  );
  assert.equal(result.healthy, true);
  assert.equal(
    result.checks.find((item) => item.name === 'photoshop live bridge').status.connected,
    false
  );
  bridge.config.token = 'z'.repeat(64);
  await assert.rejects(
    execFile(process.execPath, [cli, 'doctor', '--live', '--root', home]),
    (error) => {
      const failed = JSON.parse(error.stdout);
      assert.equal(failed.healthy, false);
      assert.equal(error.stdout.includes(settings.photoshop.token), false);
      return true;
    }
  );
});

test('repair restores generated files and pointer while preserving selections, credentials, preferences and rollback', async (t) => {
  const root = await workspace(t),
    home = path.join(root, 'home');
  const first = await fixtureBundle(path.join(root, 'first'), '0.1.0'),
    next = await fixtureBundle(path.join(root, 'next'), '0.2.0');
  await installApplications({
    home,
    apps: ['photoshop', 'illustrator'],
    source: first,
    serverOnly: true
  });
  await installApplications({ home, apps: [], source: next });
  const state = await readState(home);
  state.updates.enabled = false;
  await atomicWrite(path.join(home, 'state.json'), state);
  const connections = await readFile(path.join(home, 'connections.json'), 'utf8');
  await writeFile(path.join(home, 'current'), 'broken');
  await writeFile(path.join(home, 'mcp-servers.json'), '{');
  await rm(path.join(home, 'bootstrap', 'launcher.mjs'));
  assert.equal((await diagnoseInstallation(home)).healthy, false);
  await repairInstallation(home);
  assert.equal((await diagnoseInstallation(home)).healthy, true);
  assert.deepEqual(await readState(home), state);
  assert.equal(await readFile(path.join(home, 'connections.json'), 'utf8'), connections);
  await writeFile(path.join(home, 'versions', '0.2.0', 'app', 'bin', 'adobe-mcp.mjs'), 'corrupt');
  await assert.rejects(repairInstallation(home), /checksum mismatch/);
  assert.deepEqual(await readState(home), state);
});

test('selected connection ports must be unique; retained unselected entries do not conflict', () => {
  const config = {
    photoshop: { port: 19102, token: 's'.repeat(64) },
    illustrator: { port: 19102, token: 't'.repeat(64) }
  };
  assert.doesNotThrow(() => validateSelectedConnections(config, ['photoshop']));
  assert.throws(
    () => validateSelectedConnections(config, ['photoshop', 'illustrator']),
    /shared by/
  );
});

test('duplicate ports prevent activation before changing the saved selection', async (t) => {
  const root = await workspace(t),
    home = path.join(root, 'home'),
    source = await fixtureBundle(path.join(root, 'bundle'));
  await installApplications({ home, apps: ['photoshop'], source, serverOnly: true });
  const config = JSON.parse(await readFile(path.join(home, 'connections.json'), 'utf8'));
  config.illustrator = { port: config.photoshop.port, token: 'i'.repeat(64) };
  await atomicWrite(path.join(home, 'connections.json'), config);
  await assert.rejects(installApplications({ home, apps: ['illustrator'], source }), /shared by/);
  assert.deepEqual((await readState(home)).selectedApps, ['photoshop']);
});

test('CLI rejects incompatible or ignored flags and uninstalled selections without changing state', async (t) => {
  const root = await workspace(t),
    home = path.join(root, 'home'),
    source = await fixtureBundle(path.join(root, 'bundle'));
  await installApplications({ home, apps: ['photoshop'], source, serverOnly: true });
  const state = await readFile(path.join(home, 'state.json'), 'utf8');
  const invalid = [
    ['install', '--all'],
    ['uninstall', '--apps', 'ai'],
    ['uninstall', '--all', '--apps', 'ps'],
    ['install', '--server-only', '--with-panels', '--apps', 'ps'],
    ['updates', 'check', '--hours', '3'],
    ['status', '--live'],
    ['install', '--enable-unsigned', '--apps', 'ai']
  ];
  for (const args of invalid)
    await assert.rejects(
      execFile(process.execPath, [path.join(ROOT, 'bin', 'adobe-mcp.mjs'), ...args, '--root', home])
    );
  assert.equal(await readFile(path.join(home, 'state.json'), 'utf8'), state);
});

test(
  'doctor detects stale panels and repair regenerates them without replacing foreign ownership',
  { skip: process.platform === 'linux' },
  async (t) => {
    const root = await workspace(t),
      home = path.join(root, 'home'),
      extensions = path.join(root, 'extensions');
    const source = await fixtureBundle(path.join(root, 'bundle'));
    await installApplications({
      home,
      apps: ['photoshop'],
      source,
      serverOnly: false,
      extensionsRoot: extensions
    });
    const panel = path.join(extensions, 'com.adobemcp.photoshop');
    await writeFile(path.join(panel, 'panel.js'), 'damaged');
    assert.equal((await diagnoseInstallation(home)).healthy, false);
    await repairInstallation(home);
    assert.equal((await diagnoseInstallation(home)).healthy, true);
    const config = JSON.parse(await readFile(path.join(home, 'connections.json'), 'utf8'));
    config.photoshop.port++;
    await atomicWrite(path.join(home, 'connections.json'), config);
    assert.equal((await diagnoseInstallation(home)).healthy, false);
    await repairInstallation(home);
    assert.equal((await diagnoseInstallation(home)).healthy, true);
    await atomicWrite(path.join(panel, 'adobe-mcp-owner.json'), {
      product: 'another-product',
      home,
      app: 'photoshop'
    });
    await assert.rejects(repairInstallation(home), /unmanaged/);
  }
);
