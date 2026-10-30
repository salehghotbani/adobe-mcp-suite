import { cp, copyFile, mkdir, mkdtemp, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../src/config/paths.mjs';
import { VERSION } from '../src/config/project.mjs';
import {
  APP_ITEMS,
  archiveBundle,
  nodeName,
  writeBundleManifest
} from '../src/installer/bundle.mjs';
import { assetName } from '../src/installer/platform.mjs';
import { safeRemove } from '../src/installer/storage.mjs';
import { runtimeLicense } from '../src/installer/runtime-license.mjs';

await mkdir(path.join(ROOT, '.release-build'), { recursive: true });
await mkdir(path.join(ROOT, 'dist'), { recursive: true });
const staging = await mkdtemp(path.join(ROOT, '.release-build', 'bundle-'));
try {
  const app = path.join(staging, 'app');
  await mkdir(app, { recursive: true });
  for (const item of APP_ITEMS)
    await cp(path.join(ROOT, item), path.join(app, item), { recursive: true, dereference: true });
  if (!process.env.npm_execpath) throw new Error('Run packaging with npm run package:release.');
  const installed = spawnSync(
    process.execPath,
    [
      process.env.npm_execpath,
      'ci',
      '--omit=dev',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--bin-links=false'
    ],
    { cwd: app, stdio: 'inherit' }
  );
  if (installed.status !== 0) throw new Error('Production dependency installation failed.');
  await mkdir(path.join(staging, 'runtime'));
  await copyFile(process.execPath, path.join(staging, 'runtime', nodeName(process.platform)));
  await writeFile(path.join(staging, 'runtime', 'LICENSE'), await runtimeLicense());
  await writeFile(
    path.join(staging, 'adobe-mcp.cmd'),
    '@echo off\r\n"%~dp0runtime\\node.exe" "%~dp0app\\bin\\adobe-mcp.mjs" %*\r\n'
  );
  await writeFile(
    path.join(staging, 'adobe-mcp'),
    '#!/bin/sh\nbase=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$base/runtime/node" "$base/app/bin/adobe-mcp.mjs" "$@"\n'
  );
  if (process.platform !== 'win32') {
    await chmod(path.join(staging, 'runtime', 'node'), 0o755);
    await chmod(path.join(staging, 'adobe-mcp'), 0o755);
  }
  await writeBundleManifest(staging, {
    version: VERSION,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node
  });
  const destination = path.join(ROOT, 'dist', assetName(VERSION));
  await writeFile(destination, await archiveBundle(staging));
  console.log(destination);
} finally {
  await safeRemove(staging, path.join(ROOT, '.release-build'));
}
