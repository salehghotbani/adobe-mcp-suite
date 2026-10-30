import { z } from 'zod';
import { tool } from './tool.mjs';
import { APPS } from '../config/applications.mjs';

export function commonTools(app, allowScripts = false) {
  const connection = tool(
    'connection_status',
    `Check the local bridge for ${APPS[app].title}; works without Adobe connected.`,
    {},
    null,
    true
  );
  connection.localHandler = (bridge) => bridge.status();
  const result = [
    connection,
    tool(
      'get_app_info',
      'Read the connected Adobe application name and version.',
      {},
      'return {name: String(app.name || "Adobe"), version: String(app.version || "unknown")};',
      true
    )
  ];
  if (allowScripts) {
    const script = tool(
      'run_script',
      'Execute arbitrary ExtendScript with full Adobe scripting permissions. Return a plain JSON-compatible value using return. No browser or Node APIs.',
      { code: z.string().min(1).max(200000) },
      null
    );
    script.scriptBody = (params) => params.code;
    result.push(script);
  }
  return result;
}
