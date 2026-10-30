import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { catalogs } from '../src/apps/index.mjs';
import { commonTools } from '../src/apps/common.mjs';
import { APPS } from '../src/core/apps.mjs';
import { ROOT } from '../src/core/config.mjs';
import path from 'node:path';
const catalog = {};
let md = '# Tool catalog\n\nEvery server also exposes `connection_status` and `get_app_info`. `run_script` is registered only when `ADOBE_MCP_ALLOW_SCRIPTS=true`.\n\n';
for (const [app, tools] of Object.entries(catalogs)) {
  catalog[app] = [...commonTools(true), ...tools].map(t => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.schema), annotations: t.annotations }));
  md += `## ${APPS[app].title} (${tools.length + 2} default tools)\n\n| Tool | Behavior |\n| --- | --- |\n`;
  for (const t of tools) md += `| \`${t.name}\` | ${t.description.replaceAll('|', '\\|')} |\n`;
  md += '\n';
}
await writeFile(path.join(ROOT, 'docs', 'tools.json'), JSON.stringify(catalog, null, 2) + '\n');
await writeFile(path.join(ROOT, 'docs', 'TOOLS.md'), md.trimEnd() + '\n');
console.error('Updated docs/TOOLS.md and docs/tools.json');
