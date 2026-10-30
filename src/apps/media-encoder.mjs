import { z } from 'zod';
import { tool } from '../mcp/tool.mjs';
import { text, filePath, outputFields } from '../mcp/schemas.mjs';
const encoder = `
  var e = app.getEncoderHost();
  h.require(e, 'Encoder host is unavailable.');
`;
const frontend = `
  var f = app.getFrontend();
  h.require(f, 'Encoder frontend is unavailable.');
`;
export const tools = [
  tool(
    'get_batch_status',
    'Read batch running state and status (detailed status requires AME 23.3+).',
    {},
    encoder +
      `
  return {
    running: e.isBatchRunning(),
    status:
      typeof e.getBatchEncoderStatus === 'function' ? e.getBatchEncoderStatus() : 'unavailable'
  };
`,
    true
  ),
  tool(
    'list_formats',
    'List available encoder output formats.',
    {},
    encoder +
      `
  var list = e.getFormatList(),
    a = [];
  for (var i = 0; i < list.length; i++) a.push(String(list[i]));
  return a;
`,
    true
  ),
  tool(
    'list_import_types',
    'List supported source media file types.',
    {},
    encoder +
      `
  var list = e.getSupportedImportFileTypes(),
    a = [];
  for (var i = 0; i < list.length; i++) a.push(String(list[i]));
  return a;
`,
    true
  ),
  tool(
    'add_to_queue',
    'Queue one source file with an explicit output path and .epr preset. Queue acceptance does not mean encoding is complete.',
    {
      source: filePath,
      preset: filePath,
      ...outputFields,
      format: z.string().max(100).default('')
    },
    frontend +
      'h.input(p.source);h.input(p.preset);var out=h.output(p.path,p.overwrite);var item=f.addFileToBatch(p.source,p.format,p.preset,out.fsName);h.require(item,"AME rejected the queue item.");return {queued:true,source:p.source,output:out.fsName};'
  ),
  tool(
    'list_dynamic_link_items',
    'Read root composition/sequence GUIDs from an AEP or Premiere project.',
    { path: filePath },
    frontend +
      'h.input(p.path);var list=f.getDLItemsAtRoot(p.path),a=[];for(var i=0;i<list.length;i++)a.push(String(list[i]));return a;',
    true
  ),
  tool(
    'add_dynamic_link_to_queue',
    'Queue a composition/sequence using its GUID, project path and preset.',
    {
      project: filePath,
      guid: text,
      preset: filePath,
      ...outputFields,
      format: z.string().max(100).default('')
    },
    frontend +
      'h.input(p.project);h.input(p.preset);var out=h.output(p.path,p.overwrite);var item=f.addDLToBatch(p.project,p.format,p.preset,p.guid,out.fsName);h.require(item,"AME rejected the Dynamic Link item.");return {queued:true,guid:p.guid,output:out.fsName};'
  ),
  tool(
    'start_batch',
    'Start or resume the Media Encoder batch. Returns immediately; use get_batch_status for progress.',
    {},
    encoder + 'e.runBatch();return {started:true};'
  ),
  tool(
    'pause_batch',
    'Pause the active batch.',
    {},
    encoder + 'e.pauseBatch();return {paused:true};'
  ),
  tool(
    'stop_batch',
    'Stop the batch. An in-progress output may be incomplete.',
    {},
    encoder + 'e.stopBatch();return {stopRequested:true};'
  )
];
