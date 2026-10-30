import { z } from 'zod';
import { tool } from '../core/tool.mjs';

export function commonTools(allowScripts) {
  const result = [tool('get_app_info', 'Read the connected Adobe application name and version.', {},
    'return {name: String(app.name || "Adobe"), version: String(app.version || "unknown")};', true)];
  if (allowScripts) result.push(tool('run_script', 'Execute arbitrary ExtendScript with full Adobe scripting permissions. Return a plain JSON-compatible value using return. No browser or Node APIs.',
    { code: z.string().min(1).max(200000) }, null));
  return result;
}
