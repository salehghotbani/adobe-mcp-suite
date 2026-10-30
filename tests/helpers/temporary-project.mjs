import { cp, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../../src/config/paths.mjs';

export async function temporaryProject(t, { includeAssets = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'adobe-mcp-test-'));
  t.after(() => {
    if (
      path.dirname(root) !== path.resolve(os.tmpdir()) ||
      !path.basename(root).startsWith('adobe-mcp-test-')
    ) {
      throw new Error('Refusing to remove a directory outside the test temporary root.');
    }
    return rm(root, { recursive: true, force: true });
  });
  if (includeAssets) {
    await cp(path.join(ROOT, 'cep'), path.join(root, 'cep'), { recursive: true });
    await cp(
      path.join(ROOT, 'assets', 'branding', 'adobe-mcp-icon.png'),
      path.join(root, 'assets', 'branding', 'adobe-mcp-icon.png'),
      { recursive: true }
    );
  }
  return root;
}
