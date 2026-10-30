import { z } from 'zod';

export function describeTool(t) {
  return {
    name: t.name,
    description: t.description,
    inputSchema: z.toJSONSchema(t.schema),
    annotations: t.annotations,
    enabledByDefault: !t.scriptBody
  };
}
