import { z } from 'zod';
export function tool(name, description, shape, body, readOnly = false) {
  return {
    name,
    description,
    schema: z.object(shape).strict(),
    body,
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: !readOnly,
      idempotentHint: readOnly,
      openWorldHint: false
    }
  };
}
