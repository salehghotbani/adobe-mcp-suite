import { readFile, readdir, mkdir, writeFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { unzipSync, zipSync } from 'fflate';
import { PRODUCT } from './platform.mjs';
import { childPath, versionSchema } from './storage.mjs';

export const APP_ITEMS = [
  'bin',
  'src',
  'cep',
  'assets/branding',
  'docs',
  'package.json',
  'package-lock.json',
  'README.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'LICENSE',
  'NOTICE',
  'SECURITY.md'
];
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
export const nodeName = (platform) => (platform === 'win32' ? 'node.exe' : 'node');
export async function fileMap(root, prefix = '') {
  const files = {};
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const name = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isSymbolicLink()) throw new Error('Release bundles cannot contain symbolic links.');
    if (entry.isDirectory()) Object.assign(files, await fileMap(root, name));
    else files[name] = await readFile(path.join(root, name));
  }
  return files;
}
export async function writeBundleManifest(root, { version, platform, arch, nodeVersion }) {
  versionSchema.parse(version);
  const files = await fileMap(root);
  delete files['release.json'];
  const manifest = {
    product: PRODUCT,
    formatVersion: 1,
    version,
    platform,
    arch,
    nodeVersion,
    files: Object.fromEntries(
      Object.entries(files)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, data]) => [name, sha256(data)])
    )
  };
  await writeFile(path.join(root, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
export async function verifyBundle(
  root,
  { platform = process.platform, arch = process.arch } = {}
) {
  const manifest = JSON.parse(await readFile(path.join(root, 'release.json'), 'utf8'));
  if (
    manifest.product !== PRODUCT ||
    manifest.formatVersion !== 1 ||
    manifest.platform !== platform ||
    manifest.arch !== arch ||
    !versionSchema.safeParse(manifest.version).success ||
    !manifest.files ||
    typeof manifest.files !== 'object'
  )
    throw new Error('Bundle version, platform or format is incompatible.');
  const files = await fileMap(root);
  delete files['release.json'];
  if (Object.keys(files).length !== Object.keys(manifest.files).length)
    throw new Error('Bundle contains missing or unexpected files.');
  for (const [name, expected] of Object.entries(manifest.files)) {
    childPath(root, name);
    if (!/^[a-f0-9]{64}$/.test(expected) || !files[name] || sha256(files[name]) !== expected)
      throw new Error(`Bundle checksum mismatch: ${name}`);
  }
  for (const required of [
    `runtime/${nodeName(platform)}`,
    'app/package.json',
    'app/bin/adobe-mcp.mjs',
    'app/src/cli/main.mjs'
  ])
    if (!files[required]) throw new Error(`Bundle is missing ${required}.`);
  const pkg = JSON.parse(files['app/package.json'].toString('utf8'));
  if (pkg.name !== PRODUCT || pkg.version !== manifest.version)
    throw new Error('Bundle package metadata does not match its release.');
  return manifest;
}
function archiveName(name) {
  if (
    !name ||
    name.includes('\\') ||
    name.startsWith('/') ||
    name.includes(':') ||
    name.split('/').some((p) => p === '..' || p === '.' || !p)
  )
    throw new Error('Unsafe path in release archive.');
}
export async function extractBundle(data, destination) {
  try {
    if ((await lstat(destination)).isSymbolicLink() || (await readdir(destination)).length)
      throw new Error('Release extraction requires a new empty directory.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let total = 0;
  const files = unzipSync(data, {
    filter: (entry) => {
      archiveName(entry.name);
      total += entry.originalSize;
      if (entry.originalSize > 200 * 1024 * 1024 || total > 512 * 1024 * 1024)
        throw new Error('Release archive exceeds extraction limits.');
      return true;
    }
  });
  await mkdir(destination, { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    archiveName(name);
    const file = childPath(destination, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contents, {
      mode: name === 'runtime/node' || name === 'adobe-mcp' ? 0o755 : 0o644
    });
  }
  return destination;
}
export async function archiveBundle(root) {
  const files = await fileMap(root);
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, data]) => [
        name,
        [
          data,
          {
            level: 6,
            os: 3,
            attrs:
              ((name === 'runtime/node' || name === 'adobe-mcp' ? 0o100755 : 0o100644) << 16) >>> 0
          }
        ]
      ])
    )
  );
}
