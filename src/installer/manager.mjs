import {
  cp,
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  access,
  chmod,
  rm,
  lstat
} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { APPS } from '../config/applications.mjs';
import { ROOT } from '../config/paths.mjs';
import { VERSION } from '../config/project.mjs';
import { readConfiguration } from '../config/settings.mjs';
import { writePanel } from '../setup/panels.mjs';
import { APP_ITEMS, nodeName, verifyBundle, writeBundleManifest } from './bundle.mjs';
import { PRODUCT, compareVersions, extensionsHome } from './platform.mjs';
import { runtimeLicense } from './runtime-license.mjs';
import {
  atomicWrite,
  childPath,
  initialState,
  readJson,
  readState,
  safeRemove,
  withLock
} from './storage.mjs';

const execFile = promisify(execFileCallback);
const exists = (file) =>
  access(file).then(
    () => true,
    () => false
  );
const ordered = (ids) => Object.keys(APPS).filter((id) => ids.includes(id));

export async function sourceInstallation(appRoot = ROOT) {
  const bundleRoot = path.dirname(appRoot);
  if (await exists(path.join(bundleRoot, 'release.json'))) {
    const metadata = await verifyBundle(bundleRoot);
    return {
      appRoot,
      bundleRoot,
      version: metadata.version,
      nodePath: path.join(bundleRoot, 'runtime', nodeName(process.platform))
    };
  }
  return { appRoot, bundleRoot: null, version: VERSION, nodePath: process.execPath };
}

async function copySource(source, destination) {
  if (source.bundleRoot) {
    await cp(source.bundleRoot, destination, { recursive: true, dereference: true });
    return;
  }
  await mkdir(path.join(destination, 'app'), { recursive: true });
  for (const item of [...APP_ITEMS, 'node_modules']) {
    // npm tarballs omit package-lock.json; their dependencies are already installed.
    if (item === 'package-lock.json' && !(await exists(path.join(source.appRoot, item)))) continue;
    await cp(path.join(source.appRoot, item), path.join(destination, 'app', item), {
      recursive: true,
      dereference: true
    });
  }
  await mkdir(path.join(destination, 'runtime'), { recursive: true });
  await copyFile(source.nodePath, path.join(destination, 'runtime', nodeName(process.platform)));
  await atomicWrite(
    path.join(destination, 'runtime', 'LICENSE'),
    await runtimeLicense(source.nodePath),
    { raw: true }
  );
  await writeBundleManifest(destination, {
    version: source.version,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node
  });
}

async function ensureHome(home) {
  const resolved = path.resolve(home);
  if (
    resolved === path.parse(resolved).root ||
    resolved === path.resolve(os.homedir()) ||
    resolved === path.resolve(ROOT)
  )
    throw new Error('Choose a dedicated installation directory.');
  await mkdir(resolved, { recursive: true });
  if ((await lstat(resolved)).isSymbolicLink())
    throw new Error('Choose a real installation directory rather than a symbolic link.');
  const saved = await readState(resolved, { optional: true });
  if (!saved) {
    if ((await readdir(resolved)).length)
      throw new Error('The installation directory must be empty or already managed by Adobe MCP.');
    await atomicWrite(path.join(resolved, 'state.json'), initialState());
  }
  return resolved;
}

const launcher = `import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const home=fileURLToPath(new URL('../',import.meta.url));
try {
  const version=readFileSync(path.join(home,'current'),'utf8').trim();
  if(!/^\\d+\\.\\d+\\.\\d+$/.test(version))throw new Error('Invalid installation pointer.');
  const base=path.join(home,'versions',version);
  const child=spawn(path.join(base,'runtime',process.platform==='win32'?'node.exe':'node'),[path.join(base,'app','bin','adobe-mcp.mjs'),...process.argv.slice(2)],{stdio:'inherit',windowsHide:true,env:{...process.env,ADOBE_MCP_HOME:home}});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
  child.on('error',error=>{console.error(error.message);process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code??1;});
} catch(error){console.error(error.message);process.exitCode=1;}
`;

async function writeLaunchers(home, versionRoot) {
  const bootstrap = childPath(home, 'bootstrap'),
    bin = childPath(home, 'bin');
  await mkdir(bootstrap, { recursive: true });
  await mkdir(bin, { recursive: true });
  const runtime = path.join(bootstrap, nodeName(process.platform));
  // The tiny bootstrap is kept stable while Windows may have its executable open.
  if (!(await exists(runtime)))
    await copyFile(path.join(versionRoot, 'runtime', nodeName(process.platform)), runtime);
  if (await exists(path.join(versionRoot, 'runtime', 'LICENSE')))
    await copyFile(path.join(versionRoot, 'runtime', 'LICENSE'), path.join(bootstrap, 'LICENSE'));
  await atomicWrite(path.join(bootstrap, 'launcher.mjs'), launcher, { raw: true });
  await atomicWrite(
    path.join(bin, 'adobe-mcp.cmd'),
    '@echo off\r\n"%~dp0..\\bootstrap\\node.exe" "%~dp0..\\bootstrap\\launcher.mjs" %*\r\n',
    { raw: true }
  );
  await atomicWrite(
    path.join(bin, 'adobe-mcp'),
    '#!/bin/sh\nbase=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)\nexec "$base/bootstrap/node" "$base/bootstrap/launcher.mjs" "$@"\n',
    { raw: true }
  );
  if (process.platform !== 'win32') {
    await chmod(runtime, 0o755);
    await chmod(path.join(bin, 'adobe-mcp'), 0o755);
  }
}

async function ownedPanel(destination, home) {
  const owner = await readJson(path.join(destination, 'adobe-mcp-owner.json'), null);
  return owner?.product === PRODUCT && owner.home === path.resolve(home);
}

export async function replacePanels(
  home,
  state,
  sourceRoot,
  version,
  connections,
  { replaceExisting = false } = {}
) {
  if (state.serverOnly) return async () => {};
  const extensions = state.extensionsRoot;
  await mkdir(extensions, { recursive: true });
  for (const app of state.selectedApps) {
    const target = childPath(extensions, `com.adobemcp.${app}`);
    if ((await exists(target)) && !(await ownedPanel(target, home)) && !replaceExisting)
      throw new Error(
        `An unmanaged ${app} panel already exists. Use --replace-existing to back it up explicitly.`
      );
  }
  const session = randomUUID(),
    staging = childPath(extensions, '.adobe-mcp-staging', session),
    backups = childPath(extensions, '.adobe-mcp-backups', session),
    changed = [];
  await mkdir(staging, { recursive: true });
  try {
    for (const app of state.selectedApps) {
      const prepared = path.join(staging, app);
      await writePanel({
        app,
        sourceRoot,
        destination: prepared,
        connection: connections[app],
        version
      });
      await atomicWrite(path.join(prepared, 'adobe-mcp-owner.json'), {
        product: PRODUCT,
        home: path.resolve(home),
        app
      });
    }
    for (const app of state.selectedApps) {
      const target = childPath(extensions, `com.adobemcp.${app}`),
        backup = path.join(backups, app);
      const previous = await exists(target);
      if (previous) {
        await mkdir(backups, { recursive: true });
        await rename(target, backup);
      }
      changed.push({ target, backup, previous });
      await rename(path.join(staging, app), target);
    }
  } catch (error) {
    for (const entry of changed.reverse()) {
      await safeRemove(entry.target, extensions);
      if (entry.previous) await rename(entry.backup, entry.target);
    }
    throw new Error(`Panel installation failed; close Adobe and retry. ${error.message}`);
  } finally {
    await safeRemove(staging, extensions);
  }
  return async () => {
    for (const entry of [...changed].reverse()) {
      await safeRemove(entry.target, extensions);
      if (entry.previous) await rename(entry.backup, entry.target);
    }
  };
}

export function clientConfiguration(home, selectedApps) {
  return {
    mcpServers: Object.fromEntries(
      selectedApps.map((app) => [
        `adobe-${app}`,
        {
          command: path.join(home, 'bootstrap', nodeName(process.platform)),
          args: [path.join(home, 'bootstrap', 'launcher.mjs'), 'run', app]
        }
      ])
    )
  };
}

export async function diagnoseInstallation(home) {
  const state = await readState(home),
    checks = [];
  const check = async (name, operation) => {
    try {
      await operation();
      checks.push({ name, ok: true });
    } catch (error) {
      checks.push({ name, ok: false, message: error.message });
    }
  };
  await check('active bundle', async () => {
    if (!state.currentVersion) throw new Error('No version is installed.');
    await verifyBundle(childPath(home, 'versions', state.currentVersion));
    if ((await readFile(path.join(home, 'current'), 'utf8')).trim() !== state.currentVersion)
      throw new Error('Active version pointer differs from state.');
  });
  await check('connection settings', async () => {
    const settings = await readConfiguration(path.join(home, 'connections.json'));
    for (const app of state.selectedApps)
      if (!settings[app]) throw new Error(`Missing connection settings for ${app}.`);
  });
  await check('client configuration', async () => {
    const saved = await readJson(path.join(home, 'mcp-servers.json'), null);
    if (JSON.stringify(saved) !== JSON.stringify(clientConfiguration(home, state.selectedApps)))
      throw new Error('Regenerate the MCP client configuration with install.');
    await access(path.join(home, 'bootstrap', nodeName(process.platform)));
    await access(path.join(home, 'bootstrap', 'launcher.mjs'));
  });
  if (!state.serverOnly)
    for (const app of state.selectedApps)
      await check(`${app} panel`, async () => {
        if (!(await ownedPanel(childPath(state.extensionsRoot, `com.adobemcp.${app}`), home)))
          throw new Error('Panel is missing or owned by another installation.');
      });
  return { healthy: checks.every((item) => item.ok), checks, nativeAdobeVerified: false };
}

async function activate(home, state, version, { replaceExisting = false } = {}) {
  const versionRoot = childPath(home, 'versions', version);
  await verifyBundle(versionRoot);
  const connections = await readConfiguration(path.join(home, 'connections.json'));
  for (const app of state.selectedApps)
    if (!connections[app])
      connections[app] = { port: APPS[app].port, token: randomBytes(32).toString('hex') };
  await atomicWrite(path.join(home, 'connections.json'), connections);
  await writeLaunchers(home, versionRoot);
  const undo = await replacePanels(
    home,
    state,
    path.join(versionRoot, 'app'),
    version,
    connections,
    { replaceExisting }
  );
  const previous = await readState(home),
    oldPointer = await readFile(path.join(home, 'current'), 'utf8').catch(() => null);
  const next = {
    ...state,
    currentVersion: version,
    previousVersion:
      previous.currentVersion !== version ? previous.currentVersion : previous.previousVersion
  };
  try {
    await atomicWrite(
      path.join(home, 'mcp-servers.json'),
      clientConfiguration(home, next.selectedApps)
    );
    await atomicWrite(path.join(home, 'current'), version + '\n', { raw: true });
    await atomicWrite(path.join(home, 'state.json'), next);
  } catch (error) {
    await undo();
    await atomicWrite(
      path.join(home, 'mcp-servers.json'),
      clientConfiguration(home, previous.selectedApps)
    );
    if (oldPointer !== null)
      await atomicWrite(path.join(home, 'current'), oldPointer, { raw: true });
    else await rm(path.join(home, 'current'), { force: true });
    await atomicWrite(path.join(home, 'state.json'), previous);
    throw error;
  }
  return next;
}

export async function installApplications({
  home,
  apps,
  source,
  serverOnly,
  extensionsRoot,
  replaceExisting = false
}) {
  const root = await ensureHome(home);
  return withLock(root, '.install.lock', async () => {
    const state = await readState(root),
      mode = serverOnly ?? state.serverOnly;
    if (
      state.selectedApps.length &&
      (mode !== state.serverOnly ||
        (extensionsRoot && path.resolve(extensionsRoot) !== state.extensionsRoot))
    )
      throw new Error(
        'Uninstall the selected tools before changing installation mode or CEP directory.'
      );
    for (const app of apps)
      if (!Object.hasOwn(APPS, app)) throw new Error('Unknown application selection.');
    if (!apps.length && !state.currentVersion) throw new Error('Select at least one application.');
    if (!mode && process.platform === 'linux')
      throw new Error('Use --server-only on Linux; Adobe desktop CEP hosts are unavailable.');
    const version = versionSchemaCheck(source.version),
      versionRoot = childPath(root, 'versions', version);
    if (state.currentVersion && compareVersions(version, state.currentVersion) < 0)
      throw new Error('Use rollback to return to a previous installed version.');
    if (!(await exists(versionRoot))) {
      const staging = childPath(root, 'versions', '.stage-' + randomUUID());
      try {
        await copySource(source, staging);
        await verifyBundle(staging);
        await rename(staging, versionRoot);
      } finally {
        await safeRemove(staging, root);
      }
    }
    const next = {
      ...state,
      selectedApps: ordered([...state.selectedApps, ...apps]),
      serverOnly: mode,
      extensionsRoot: mode
        ? null
        : path.resolve(extensionsRoot || state.extensionsRoot || extensionsHome())
    };
    return activate(root, next, version, { replaceExisting });
  });
}
function versionSchemaCheck(value) {
  if (!/^\d+\.\d+\.\d+$/.test(value)) throw new Error('Invalid installation version.');
  return value;
}

export async function uninstallApplications(home, apps) {
  return withLock(home, '.install.lock', async () => {
    const state = await readState(home);
    for (const app of apps)
      if (!Object.hasOwn(APPS, app) || !state.selectedApps.includes(app))
        throw new Error('Application is not installed.');
    const targets = [];
    if (!state.serverOnly)
      for (const app of apps) {
        const target = childPath(state.extensionsRoot, `com.adobemcp.${app}`);
        if (await exists(target)) {
          if (!(await ownedPanel(target, home)))
            throw new Error('Refusing to remove a panel owned by another installation.');
          targets.push({
            target,
            backup: childPath(state.extensionsRoot, '.adobe-mcp-backups', randomUUID(), app)
          });
        }
      }
    const next = {
      ...state,
      selectedApps: state.selectedApps.filter((app) => !apps.includes(app))
    };
    const changed = [];
    try {
      for (const entry of targets) {
        await mkdir(path.dirname(entry.backup), { recursive: true });
        await rename(entry.target, entry.backup);
        changed.push(entry);
      }
      await atomicWrite(
        path.join(home, 'mcp-servers.json'),
        clientConfiguration(home, next.selectedApps)
      );
      await atomicWrite(path.join(home, 'state.json'), next);
      return next;
    } catch (error) {
      for (const entry of changed.reverse()) await rename(entry.backup, entry.target);
      await atomicWrite(
        path.join(home, 'mcp-servers.json'),
        clientConfiguration(home, state.selectedApps)
      );
      await atomicWrite(path.join(home, 'state.json'), state);
      throw error;
    }
  });
}
export async function rollbackInstallation(home) {
  return withLock(home, '.install.lock', async () => {
    const state = await readState(home);
    if (!state.previousVersion) throw new Error('No previous version is available.');
    return activate(home, state, state.previousVersion);
  });
}
export async function enableUnsigned(platform = process.platform, runner = execFile) {
  if (platform === 'linux')
    throw new Error('Unsigned CEP settings apply only to Windows and macOS.');
  for (const version of [10, 11, 12]) {
    if (platform === 'win32')
      await runner(
        'reg.exe',
        [
          'add',
          `HKCU\\Software\\Adobe\\CSXS.${version}`,
          '/v',
          'PlayerDebugMode',
          '/t',
          'REG_SZ',
          '/d',
          '1',
          '/f'
        ],
        { windowsHide: true }
      );
    else if (platform === 'darwin')
      await runner('defaults', [
        'write',
        `com.adobe.CSXS.${version}`,
        'PlayerDebugMode',
        '-string',
        '1'
      ]);
    else throw new Error('Unsupported platform.');
  }
}
