import { z } from 'zod';
import { tool } from '../mcp/tool.mjs';
import { text, filePath, outputFields, outputFieldsFor, pageSize } from '../mcp/schemas.mjs';
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
  ),
  tool(
    'inspect_source',
    'Inspect readable primitive source-media metadata exposed by the installed AME version. Property names are discovered through reflection.',
    { source: filePath, ...pageSize },
    encoder +
      `
  h.input(p.source);
  h.require(
    typeof e.getSourceInfo === 'function',
    'Source inspection is unavailable in this host.'
  );
  var info = e.getSourceInfo(p.source);
  h.require(info && info.reflect, 'Source metadata is unavailable.');
  var props = info.reflect.properties,
    items = [],
    count = 0;
  for (var i = 0; i < props.length; i++) {
    var name = String(props[i].name);
    try {
      var value = info[name],
        type = typeof value;
      if (type !== 'string' && type !== 'number' && type !== 'boolean') continue;
      if (count >= p.offset && items.length < p.limit)
        items.push({ name: name, value: type === 'string' ? value.slice(0, 10000) : value });
      count++;
    } catch (error) {}
  }
  return { source: p.source, total: count, properties: items };
`,
    true
  ),
  tool(
    'add_image_sequence',
    'Queue an image sequence using a folder and one image in that folder. Other images with the same extension may be included by AME.',
    { folder: filePath, image: filePath, preset: filePath, ...outputFields },
    frontend +
      `
  var folder = new Folder(p.folder),
    image = h.input(p.image);
  h.require(folder.exists, 'Image sequence folder does not exist.');
  var parent = image.parent.fsName,
    expected = folder.fsName;
  if (Folder.fs === 'Windows') {
    parent = parent.toLowerCase();
    expected = expected.toLowerCase();
  }
  h.require(parent === expected, 'The image must belong directly to the sequence folder.');
  h.input(p.preset);
  var out = h.output(p.path, p.overwrite);
  h.require(
    typeof f.addFileSequenceToBatch === 'function',
    'Image sequence queueing is unavailable in this host.'
  );
  h.require(
    f.addFileSequenceToBatch(folder.fsName, image.fsName, p.preset, out.fsName),
    'AME rejected the image sequence.'
  );
  return { queued: true, folder: folder.fsName, output: out.fsName };
`
  ),
  tool(
    'stitch_files',
    'Queue multiple media files as one stitched output in the supplied order. Source paths cannot contain semicolons.',
    {
      sources: z
        .array(
          filePath.refine(
            (v) => !v.includes(';'),
            'Semicolons are not allowed in stitched source paths'
          )
        )
        .min(2)
        .max(50),
      preset: filePath,
      ...outputFields,
      format: z.string().max(100).default('')
    },
    frontend +
      `
  for (var i = 0; i < p.sources.length; i++) h.input(p.sources[i]);
  h.input(p.preset);
  var out = h.output(p.path, p.overwrite);
  h.require(typeof f.stitchFiles === 'function', 'File stitching is unavailable in this host.');
  h.require(
    f.stitchFiles(p.sources.join(';'), p.format, p.preset, out.fsName),
    'AME rejected the stitched item.'
  );
  return { queued: true, sources: p.sources, output: out.fsName };
`
  ),
  tool(
    'save_batch_preview',
    'Write the current batch preview to a TIFF file. A current preview must be available.',
    outputFieldsFor('tif', 'tiff'),
    encoder +
      `
  var out = h.output(p.path, p.overwrite);
  h.require(
    typeof e.getCurrentBatchPreview === 'function',
    'Batch previews are unavailable in this host.'
  );
  h.require(e.getCurrentBatchPreview(out.fsName), 'No batch preview was written.');
  return { path: out.fsName };
`
  )
];
