import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const CONFIG_PATH = path.join(ROOT, '.adobe-mcp', 'config.json');
