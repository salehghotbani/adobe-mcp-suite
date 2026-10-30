import { mkdir, writeFile, cp, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../../src/config/paths.mjs';
import { nodeName, writeBundleManifest } from '../../src/installer/bundle.mjs';
import { safeRemove } from '../../src/installer/storage.mjs';

export async function workspace(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'adobe-mcp-test-'));
  t.after(() => safeRemove(root, os.tmpdir()));
  return root;
}
export async function fixtureBundle(root, version = '0.2.0') {
  for (const dir of ['runtime', 'app/bin', 'app/src/cli'])
    await mkdir(path.join(root, dir), { recursive: true });
  await writeFile(path.join(root, 'runtime', nodeName(process.platform)), 'fixture runtime');
  await writeFile(path.join(root, 'runtime', 'LICENSE'), 'fixture license');
  await writeFile(path.join(root, 'app', 'bin', 'adobe-mcp.mjs'), '// fixture entry\n');
  await writeFile(path.join(root, 'app', 'src', 'cli', 'main.mjs'), '// fixture CLI\n');
  await writeFile(
    path.join(root, 'app', 'package.json'),
    JSON.stringify({ name: 'adobe-mcp-suite', version })
  );
  await cp(path.join(ROOT, 'cep'), path.join(root, 'app', 'cep'), { recursive: true });
  await cp(
    path.join(ROOT, 'assets', 'branding', 'adobe-mcp-icon.png'),
    path.join(root, 'app', 'assets', 'branding', 'adobe-mcp-icon.png'),
    { recursive: true }
  );
  await writeBundleManifest(root, {
    version,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node
  });
  return {
    bundleRoot: root,
    appRoot: path.join(root, 'app'),
    version,
    nodePath: path.join(root, 'runtime', nodeName(process.platform))
  };
}
