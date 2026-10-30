import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, symlink, access } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import {
  applications,
  assetName,
  compareVersions,
  extensionsHome,
  installHome
} from '../../src/installer/platform.mjs';
import { archiveBundle, extractBundle, verifyBundle } from '../../src/installer/bundle.mjs';
import {
  atomicWrite,
  childPath,
  readState,
  safeRemove,
  withLock
} from '../../src/installer/storage.mjs';
import {
  diagnoseInstallation,
  enableUnsigned,
  installApplications,
  replacePanels,
  rollbackInstallation,
  uninstallApplications
} from '../../src/installer/manager.mjs';
import { fixtureBundle, workspace } from '../helpers/installer-fixture.mjs';

test('application selection validates aliases, all, unknown mixed selections and version ordering', () => {
  assert.deepEqual(applications(['ps,pr', 'PS']), ['premiere-pro', 'photoshop']);
  assert.equal(applications(['all']).length, 7);
  assert.throws(() => applications(['all,bogus']), /Unknown/);
  assert.throws(() => applications(['']), /Choose/);
  assert.equal(compareVersions('0.10.0', '0.2.0'), 1);
  assert.equal(compareVersions('0.2.0', '0.2.0'), 0);
  assert.throws(() => assetName('0.2.0', 'win32', 'arm64'), /No portable/);
  assert.equal(assetName('0.2.0', 'darwin', 'arm64'), 'adobe-mcp-suite-v0.2.0-macos-arm64.zip');
});

test('per-user installation and panel locations respect platform settings', () => {
  const home = path.resolve('fixture-home');
  assert.equal(
    installHome({ platform: 'darwin', home, env: {} }),
    path.join(home, 'Library', 'Application Support', 'AdobeMCPSuite')
  );
  assert.equal(
    installHome({ platform: 'linux', home, env: { XDG_DATA_HOME: home } }),
    path.join(home, 'adobe-mcp-suite')
  );
  assert.equal(
    extensionsHome({ platform: 'win32', env: { APPDATA: home }, home }),
    path.join(home, 'Adobe', 'CEP', 'extensions')
  );
  assert.throws(() => extensionsHome({ platform: 'linux' }), /server-only/);
});

test('managed paths, symbolic links and concurrent mutation are guarded', async (t) => {
  const root = await workspace(t),
    outside = await workspace(t);
  assert.throws(() => childPath(root, '..', 'elsewhere'), /escapes/);
  await assert.rejects(safeRemove(root, root), /escapes/);
  const link = path.join(root, 'linked');
  await symlink(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(safeRemove(link, root), /linked/);
  await withLock(root, '.install.lock', async () => {
    await assert.rejects(
      withLock(root, '.install.lock', () => {}),
      /already running/
    );
  });
  await withLock(root, '.install.lock', () => atomicWrite(path.join(root, 'worked'), { ok: true }));
  assert.deepEqual(JSON.parse(await readFile(path.join(root, 'worked'), 'utf8')), { ok: true });
});

test('bundle integrity rejects corruption, platform mismatch, extra files and unsafe archives', async (t) => {
  const root = await workspace(t),
    source = await fixtureBundle(path.join(root, 'bundle'));
  await verifyBundle(source.bundleRoot);
  await assert.rejects(
    verifyBundle(source.bundleRoot, { platform: 'unsupported' }),
    /incompatible/
  );
  const archive = await archiveBundle(source.bundleRoot),
    extracted = path.join(root, 'extracted');
  await extractBundle(archive, extracted);
  await verifyBundle(extracted);
  await assert.rejects(extractBundle(archive, extracted), /empty directory/);
  await writeFile(path.join(extracted, 'app', 'bin', 'adobe-mcp.mjs'), 'tampered');
  await assert.rejects(verifyBundle(extracted), /checksum mismatch/);
  await writeFile(path.join(source.bundleRoot, 'extra'), 'unexpected');
  await assert.rejects(verifyBundle(source.bundleRoot), /unexpected/);
  for (const name of ['../escape', '/absolute', 'C:/absolute', 'nested\\escape'])
    await assert.rejects(
      extractBundle(zipSync({ [name]: Buffer.from('x') }), path.join(root, 'unsafe')),
      /Unsafe path/
    );
});

test('incremental install, update, rollback and selective removal preserve credentials and settings', async (t) => {
  const root = await workspace(t),
    home = path.join(root, 'home'),
    first = await fixtureBundle(path.join(root, 'first'), '0.1.0'),
    second = await fixtureBundle(path.join(root, 'second'), '0.2.0');
  await installApplications({ home, apps: ['photoshop'], source: first, serverOnly: true });
  const original = JSON.parse(await readFile(path.join(home, 'connections.json'), 'utf8'));
  await installApplications({ home, apps: ['illustrator'], source: first });
  const state = await readState(home);
  state.updates.enabled = false;
  await atomicWrite(path.join(home, 'state.json'), state);
  await installApplications({ home, apps: [], source: second });
  assert.equal((await readState(home)).previousVersion, '0.1.0');
  assert.equal((await readState(home)).updates.enabled, false);
  assert.equal(
    JSON.parse(await readFile(path.join(home, 'connections.json'), 'utf8')).photoshop.token,
    original.photoshop.token
  );
  assert.equal((await diagnoseInstallation(home)).healthy, true);
  await rollbackInstallation(home);
  assert.equal((await readState(home)).currentVersion, '0.1.0');
  await uninstallApplications(home, ['photoshop']);
  assert.deepEqual((await readState(home)).selectedApps, ['illustrator']);
  assert.ok(JSON.parse(await readFile(path.join(home, 'connections.json'), 'utf8')).photoshop);
  await assert.rejects(uninstallApplications(home, ['audition']), /not installed/);
  await writeFile(path.join(home, 'current'), '0.9.0');
  assert.equal((await diagnoseInstallation(home)).healthy, false);
});

test('installer refuses unrelated directories and mode changes without deleting selections', async (t) => {
  const root = await workspace(t),
    source = await fixtureBundle(path.join(root, 'bundle')),
    home = path.join(root, 'home');
  await mkdir(home);
  await writeFile(path.join(home, 'personal-file'), 'keep');
  await assert.rejects(
    installApplications({ home, apps: ['photoshop'], source, serverOnly: true }),
    /empty or already managed/
  );
  assert.equal(await readFile(path.join(home, 'personal-file'), 'utf8'), 'keep');
  const managed = path.join(root, 'managed');
  await installApplications({ home: managed, apps: ['photoshop'], source, serverOnly: true });
  await assert.rejects(
    installApplications({ home: managed, apps: ['illustrator'], source, serverOnly: false }),
    /Uninstall/
  );
  assert.deepEqual((await readState(managed)).selectedApps, ['photoshop']);
});

test('panel replacement backs up unmanaged panels only with explicit replacement and supports undo', async (t) => {
  const root = await workspace(t),
    source = await fixtureBundle(path.join(root, 'bundle')),
    home = path.join(root, 'home'),
    extensions = path.join(root, 'extensions'),
    panel = path.join(extensions, 'com.adobemcp.photoshop');
  await mkdir(panel, { recursive: true });
  await writeFile(path.join(panel, 'original'), 'preserve');
  const state = { serverOnly: false, extensionsRoot: extensions, selectedApps: ['photoshop'] },
    connections = { photoshop: { port: 19102, token: 'a'.repeat(64) } };
  await assert.rejects(
    replacePanels(home, state, source.appRoot, '0.2.0', connections),
    /unmanaged/
  );
  const undo = await replacePanels(home, state, source.appRoot, '0.2.0', connections, {
    replaceExisting: true
  });
  assert.equal(
    JSON.parse(await readFile(path.join(panel, 'adobe-mcp-owner.json'), 'utf8')).home,
    path.resolve(home)
  );
  assert.match(await readFile(path.join(panel, 'config.js'), 'utf8'), /19102/);
  await undo();
  assert.equal(await readFile(path.join(panel, 'original'), 'utf8'), 'preserve');
  await assert.rejects(access(path.join(panel, 'config.js')));
});

test('unsigned panel settings use explicit per-user Windows and macOS commands', async () => {
  const calls = [],
    runner = async (...args) => calls.push(args);
  await enableUnsigned('win32', runner);
  assert.equal(calls.length, 3);
  assert.match(calls[0][1][1], /^HKCU/);
  calls.length = 0;
  await enableUnsigned('darwin', runner);
  assert.equal(calls.length, 3);
  assert.equal(calls[0][0], 'defaults');
  await assert.rejects(enableUnsigned('linux', runner), /only/);
});
