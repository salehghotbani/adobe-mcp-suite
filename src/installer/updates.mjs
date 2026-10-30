import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { VERSION } from '../config/project.mjs';
import { assetName, compareVersions, REPOSITORY } from './platform.mjs';
import { atomicWrite, readJson, readState, safeRemove, withLock } from './storage.mjs';
import { extractBundle, sha256, verifyBundle } from './bundle.mjs';
import { installApplications } from './manager.mjs';

const api = `https://api.github.com/repos/${REPOSITORY}/releases/latest`;
const allowedHosts = new Set([
  'api.github.com',
  'github.com',
  'release-assets.githubusercontent.com',
  'objects.githubusercontent.com'
]);

export async function download(
  url,
  { fetchImpl = fetch, maxBytes = 160 * 1024 * 1024, timeoutMs = 120000, signal } = {}
) {
  let current = new URL(url);
  const deadline = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);
  for (let redirects = 0; redirects < 6; redirects++) {
    if (
      current.protocol !== 'https:' ||
      current.username ||
      current.password ||
      !allowedHosts.has(current.hostname)
    )
      throw new Error('Release download host is not trusted.');
    const response = await fetchImpl(current.href, {
      redirect: 'manual',
      signal: deadline,
      headers: { 'User-Agent': `adobe-mcp-suite/${VERSION}`, Accept: 'application/vnd.github+json' }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Invalid release redirect.');
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`GitHub release request failed (HTTP ${response.status}).`);
    if (Number(response.headers.get('content-length') || 0) > maxBytes)
      throw new Error('Release download exceeds size limits.');
    const chunks = [];
    let size = 0;
    if (!response.body) throw new Error('Empty release response.');
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > maxBytes) throw new Error('Release download exceeds size limits.');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new Error('Too many release redirects.');
}

export async function latestRelease(options = {}) {
  const release = JSON.parse(
    (
      await download(api, {
        ...options,
        maxBytes: 2 * 1024 * 1024,
        timeoutMs: options.timeoutMs || 10000
      })
    ).toString('utf8')
  );
  if (
    release.draft ||
    release.prerelease ||
    !/^v\d+\.\d+\.\d+$/.test(release.tag_name) ||
    !Array.isArray(release.assets)
  )
    throw new Error('Latest release is not a valid stable release.');
  const version = release.tag_name.slice(1),
    name = assetName(version),
    asset = release.assets.find((item) => item.name === name),
    checksums = release.assets.find((item) => item.name === 'SHA256SUMS');
  if (!asset || !checksums)
    throw new Error('Latest release is missing a bundle or checksums for this platform.');
  const base = `https://github.com/${REPOSITORY}/releases/download/${release.tag_name}/`;
  for (const item of [asset, checksums])
    if (item.browser_download_url !== base + item.name)
      throw new Error('Unexpected release asset URL.');
  return {
    version,
    tag: release.tag_name,
    url: `https://github.com/${REPOSITORY}/releases/tag/${release.tag_name}`,
    asset,
    checksums
  };
}

export async function checkForUpdates(
  home,
  { force = false, automatic = false, now = Date.now(), fetchImpl = fetch, signal } = {}
) {
  const state = await readState(home);
  if (!state.currentVersion)
    throw new Error('Finish installing at least one tool before checking for updates.');
  if (automatic && !state.updates.enabled) return { status: 'disabled' };
  const cacheFile = path.join(home, 'update-cache.json');
  let cache;
  try {
    cache = await readJson(cacheFile, null);
  } catch {
    cache = null;
  }
  const age = now - Date.parse(cache?.checkedAt || '');
  if (!force && cache && age >= 0 && age < state.updates.intervalHours * 3600000)
    return {
      ...cache,
      cached: true,
      available: cache.latestVersion
        ? compareVersions(cache.latestVersion, state.currentVersion) > 0
        : false
    };
  try {
    return await withLock(home, '.update-check.lock', async () => {
      try {
        const release = await latestRelease({
          fetchImpl,
          signal,
          timeoutMs: automatic ? 3000 : 10000
        });
        const result = {
          status: 'ok',
          checkedAt: new Date(now).toISOString(),
          latestVersion: release.version,
          releaseUrl: release.url,
          available: compareVersions(release.version, state.currentVersion) > 0,
          cached: false
        };
        await atomicWrite(cacheFile, result);
        return result;
      } catch (error) {
        const result = {
          status: 'unavailable',
          checkedAt: new Date(now).toISOString(),
          available: false,
          message: error.message,
          cached: false
        };
        await atomicWrite(cacheFile, result);
        return result;
      }
    });
  } catch (error) {
    if (error.message.includes('already running')) return { status: 'busy', available: false };
    throw error;
  }
}

export function startUpdateMonitor(
  home,
  { notify = (message) => console.error(message), fetchImpl = fetch } = {}
) {
  const controller = new AbortController();
  const check = () =>
    checkForUpdates(home, { automatic: true, fetchImpl, signal: controller.signal })
      .then((result) => {
        if (result.available && !result.cached)
          notify(
            `Adobe MCP ${result.latestVersion} is available. Run adobe-mcp update to install it.`
          );
      })
      .catch(() => {});
  void check();
  const timer = setInterval(check, 3600000);
  timer.unref();
  return () => {
    clearInterval(timer);
    controller.abort();
  };
}

export async function updateInstallation(home, { fetchImpl = fetch } = {}) {
  const state = await readState(home);
  if (!state.currentVersion) throw new Error('Install at least one tool before updating.');
  const release = await latestRelease({ fetchImpl });
  if (compareVersions(release.version, state.currentVersion) <= 0)
    return { updated: false, version: state.currentVersion };
  const checksumText = (
    await download(release.checksums.browser_download_url, { fetchImpl, maxBytes: 1024 * 1024 })
  ).toString('utf8');
  const matches = checksumText
    .split(/\r?\n/)
    .map((line) => line.match(/^([a-fA-F0-9]{64})\s+\*?(.+)$/))
    .filter((match) => match && match[2] === release.asset.name);
  if (matches.length !== 1) throw new Error('Release checksum entry is missing or ambiguous.');
  const expected = matches[0][1].toLowerCase();
  if (release.asset.digest && release.asset.digest !== `sha256:${expected}`)
    throw new Error('GitHub asset digest does not match SHA256SUMS.');
  const data = await download(release.asset.browser_download_url, { fetchImpl });
  if (sha256(data) !== expected)
    throw new Error('Downloaded release checksum mismatch; the installation was not changed.');
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'adobe-mcp-update-'));
  try {
    const bundle = path.join(temporary, 'bundle');
    await extractBundle(data, bundle);
    const metadata = await verifyBundle(bundle);
    if (metadata.version !== release.version)
      throw new Error('Archive version does not match its release tag.');
    const result = await installApplications({
      home,
      apps: [],
      source: {
        bundleRoot: bundle,
        appRoot: path.join(bundle, 'app'),
        version: metadata.version,
        nodePath: path.join(bundle, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node')
      }
    });
    return {
      updated: true,
      version: result.currentVersion,
      previousVersion: result.previousVersion,
      restartRequired: true
    };
  } finally {
    await safeRemove(temporary, os.tmpdir());
  }
}
