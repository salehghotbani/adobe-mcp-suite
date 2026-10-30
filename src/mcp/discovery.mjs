import { z } from 'zod';
import { APPS } from '../config/applications.mjs';
import { VERSION } from '../config/project.mjs';
import { describeTool } from '../catalog/describe-tool.mjs';
import { workflowGuide } from './workflows.mjs';

export function registerDiscovery(server, { app, bridge, tools, allowScripts }) {
  const title = APPS[app].title;
  const guide = workflowGuide(app, title);
  server.registerResource(
    'tool_catalog',
    `adobe-mcp://${app}/catalog`,
    {
      title: `${title} tool catalog`,
      description:
        'Available tools and JSON input schemas for this server instance. No Adobe connection is required.',
      mimeType: 'application/json'
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              application: app,
              version: VERSION,
              arbitraryScriptingEnabled: allowScripts,
              tools: tools.map(describeTool)
            },
            null,
            2
          )
        }
      ]
    })
  );
  server.registerResource(
    'workflow_guide',
    `adobe-mcp://${app}/workflows`,
    {
      title: `${title} workflows`,
      description: 'Application-specific tool recipes and execution guidance.',
      mimeType: 'text/markdown'
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: guide }] })
  );

  server.registerPrompt(
    'plan_workflow',
    {
      title: `Plan a ${title} workflow`,
      description: 'Create a tool-based plan for a goal without executing any tools.',
      argsSchema: z
        .object({ goal: z.string().min(1).max(4000), context: z.string().max(4000).optional() })
        .strict()
    },
    ({ goal, context }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Plan a ${title} workflow for the following goal. Use only tools in this server's catalog. Inspect the current host state before proposing edits, state the necessary inputs and output paths, and distinguish queue acceptance from completion. This prompt does not authorize or execute any operation.\n\nGoal:\n${goal}\n\nContext:\n${context || 'No additional context supplied.'}\n\nAvailable tools:\n${tools.map((t) => t.name).join(', ')}\n\n${guide}`
          }
        }
      ]
    })
  );
  server.registerPrompt(
    'diagnose_connection',
    {
      title: `Diagnose the ${title} bridge`,
      description:
        'Explain a local bridge status snapshot and suggest connection troubleshooting steps without changing state.'
    },
    () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Diagnose this ${title} bridge snapshot:\n${JSON.stringify(bridge.status(), null, 2)}\n\nExplain the fields and suggest the next troubleshooting step. Check that setup has been run, the matching Adobe CEP panel is open, and the MCP client owns only one server on this port. If uncertain is true, inspect the native operation before retrying or restarting. Do not infer that Adobe has completed a task from connection state alone.`
          }
        }
      ]
    })
  );
}
