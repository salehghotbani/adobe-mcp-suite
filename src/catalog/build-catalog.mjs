import { z } from 'zod';
import { APPS } from '../config/applications.mjs';
import { catalogs } from '../apps/index.mjs';
import { commonTools } from '../mcp/common-tools.mjs';

export function buildCatalog() {
  const catalog = {};
  let markdown =
    '# Tool catalog\n\nEvery server exposes `connection_status` and `get_app_info`. `run_script` is optional and is registered only when `ADOBE_MCP_ALLOW_SCRIPTS=true`. The JSON catalog includes all tools, including these shared tools.\n\n';
  for (const [app, tools] of Object.entries(catalogs)) {
    const defaults = [...commonTools(app), ...tools];
    const all = [...defaults, ...commonTools(app, true).filter((t) => t.scriptBody)];
    catalog[app] = all.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: z.toJSONSchema(t.schema),
      annotations: t.annotations,
      enabledByDefault: !t.scriptBody
    }));
    markdown += `## ${APPS[app].title} (${defaults.length} default tools)\n\n| Tool | Behavior |\n| --- | --- |\n`;
    for (const t of all)
      markdown += `| \`${t.name}\`${t.scriptBody ? ' (optional)' : ''} | ${t.description.replaceAll('|', '\\|')} |\n`;
    markdown += '\n';
  }
  return { catalog, markdown: markdown.trimEnd() + '\n' };
}
