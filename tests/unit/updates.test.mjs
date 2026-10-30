import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { archiveBundle, sha256 } from '../../src/installer/bundle.mjs';
import { assetName, REPOSITORY } from '../../src/installer/platform.mjs';
import { installApplications } from '../../src/installer/manager.mjs';
import {
  checkForUpdates,
  download,
  latestRelease,
  updateInstallation
} from '../../src/installer/updates.mjs';
import { atomicWrite, readState } from '../../src/installer/storage.mjs';
import { fixtureBundle, workspace } from '../helpers/installer-fixture.mjs';

function responses(
  version,
  archive = Buffer.from('archive'),
  { badChecksum = false, digestMismatch = false, corruptArchive = false } = {}
) {
  const base = `https://github.com/${REPOSITORY}/releases/download/v${version}/`,
    name = assetName(version),
    hash = sha256(archive);
  let calls = 0;
  const fetchImpl = async (url) => {
    calls++;
    if (url.startsWith('https://api.github.com/'))
      return Response.json({
        tag_name: 'v' + version,
        draft: false,
        prerelease: false,
        assets: [
          {
            name,
            browser_download_url: base + name,
            digest: 'sha256:' + (digestMismatch ? '0'.repeat(64) : hash)
          },
          { name: 'SHA256SUMS', browser_download_url: base + 'SHA256SUMS' }
        ]
      });
    if (url === base + 'SHA256SUMS')
      return new Response(`${badChecksum ? 'f'.repeat(64) : hash}  ${name}\n`);
    if (url === base + name)
      return new Response(
        corruptArchive ? Buffer.concat([archive, Buffer.from('corruption')]) : archive
      );
    throw new Error('Unexpected request');
  };
  return { fetchImpl, calls: () => calls };
}
test('release requests reject untrusted hosts, redirects and excessive responses', async () => {
  await assert.rejects(download('http://github.com/'), /not trusted/);
  await assert.rejects(download('https://evil.example/'), /not trusted/);
  await assert.rejects(
    download('https://github.com/', {
      fetchImpl: async () =>
        new Response(null, { status: 302, headers: { location: 'https://evil.example/payload' } })
    }),
    /not trusted/
  );
  await assert.rejects(
    download('https://github.com/', { maxBytes: 1, fetchImpl: async () => new Response('long') }),
    /size limits/
  );
  await assert.rejects(
    latestRelease({
      fetchImpl: async () =>
        Response.json({ tag_name: 'v1.0.0', draft: false, prerelease: true, assets: [] })
    }),
    /stable/
  );
});
test('automatic checks are cached, report newer versions and respect the opt-out', async (t) => {
  const root = await workspace(t),
    home = path.join(root, 'home'),
    source = await fixtureBundle(path.join(root, 'bundle'));
  await installApplications({ home, apps: ['photoshop'], source, serverOnly: true });
  const mock = responses('0.3.0'),
    now = Date.now();
  assert.equal(
    (await checkForUpdates(home, { automatic: true, fetchImpl: mock.fetchImpl, now })).available,
    true
  );
  const cached = await checkForUpdates(home, {
    automatic: true,
    fetchImpl: mock.fetchImpl,
    now: now + 1000
  });
  assert.equal(cached.cached, true);
  assert.equal(mock.calls(), 1);
  const state = await readState(home);
  state.updates.enabled = false;
  await atomicWrite(path.join(home, 'state.json'), state);
  assert.equal(
    (await checkForUpdates(home, { automatic: true, fetchImpl: mock.fetchImpl })).status,
    'disabled'
  );
  await checkForUpdates(home, { force: true, fetchImpl: mock.fetchImpl });
  assert.equal(mock.calls(), 2);
});
test('offline failures are cached without changing installed state', async (t) => {
  const root = await workspace(t),
    home = path.join(root, 'home'),
    source = await fixtureBundle(path.join(root, 'bundle'));
  await installApplications({ home, apps: ['photoshop'], source, serverOnly: true });
  const fetchImpl = async () => {
    throw new Error('offline');
  };
  assert.equal((await checkForUpdates(home, { automatic: true, fetchImpl })).status, 'unavailable');
  assert.equal((await checkForUpdates(home, { automatic: true, fetchImpl })).cached, true);
  assert.equal((await readState(home)).currentVersion, '0.2.0');
});
test('verified update activates a new version while preserving tokens; integrity failures do not activate', async (t) => {
  const root = await workspace(t),
    home = path.join(root, 'home'),
    source = await fixtureBundle(path.join(root, 'old')),
    next = await fixtureBundle(path.join(root, 'next'), '0.3.0');
  await installApplications({ home, apps: ['photoshop'], source, serverOnly: true });
  const before = await readFile(path.join(home, 'connections.json'), 'utf8'),
    archive = await archiveBundle(next.bundleRoot);
  await assert.rejects(
    updateInstallation(home, responses('0.3.0', archive, { badChecksum: true })),
    /digest/
  );
  await assert.rejects(
    updateInstallation(home, responses('0.3.0', archive, { digestMismatch: true })),
    /digest/
  );
  await assert.rejects(
    updateInstallation(home, responses('0.3.0', archive, { corruptArchive: true })),
    /Downloaded release checksum mismatch/
  );
  assert.equal((await readState(home)).currentVersion, '0.2.0');
  assert.equal((await updateInstallation(home, responses('0.3.0', archive))).updated, true);
  assert.equal((await readState(home)).currentVersion, '0.3.0');
  assert.equal((await readState(home)).previousVersion, '0.2.0');
  assert.equal(await readFile(path.join(home, 'connections.json'), 'utf8'), before);
  assert.equal((await updateInstallation(home, responses('0.3.0', archive))).updated, false);
});
