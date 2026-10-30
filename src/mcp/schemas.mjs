import { z } from 'zod';

export const text = z.string().min(1).max(10000);
export const filePath = z
  .string()
  .min(1)
  .max(32767)
  .refine((v) => !/[\x00-\x1f]/.test(v), 'Path contains control characters')
  .refine(
    (v) => /^(?:[A-Za-z]:[\\/]|\/)/.test(v) && !/^[/\\]{2}/.test(v),
    'Use an absolute local path, not a network path'
  );
export const index = z.number().int().min(1);
export const rgb = z.tuple([
  z.number().min(0).max(1),
  z.number().min(0).max(1),
  z.number().min(0).max(1)
]);
export const overwrite = z
  .boolean()
  .default(false)
  .describe('Explicitly permit replacing an existing output file');
export const outputFields = { path: filePath, overwrite };
export function outputFieldsFor(...extensions) {
  return {
    path: filePath.refine(
      (v) => extensions.some((ext) => v.toLowerCase().endsWith('.' + ext)),
      `Use the file extension: ${extensions.join(', ')}`
    ),
    overwrite
  };
}
export const pageSize = {
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(500).default(100)
};
