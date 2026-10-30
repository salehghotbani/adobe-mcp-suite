import { z } from 'zod';
import { tool } from '../mcp/tool.mjs';
import { text, filePath, outputFieldsFor, pageSize } from '../mcp/schemas.mjs';
const doc = `
  h.require(app.documents.length > 0, 'Open a document first.');
  var d = app.activeDocument;
`;
const layer =
  doc +
  `
  function find(ls, id) {
    for (var i = 0; i < ls.length; i++) {
      if (ls[i].id === id) return ls[i];
      if (ls[i].typename === 'LayerSet') {
        var found = find(ls[i].layers, id);
        if (found) return found;
      }
    }
    return null;
  }
  var l = find(d.layers, p.layerId);
  h.require(l, 'Layer ID not found.');
`;
export const tools = [
  tool(
    'list_documents',
    'List open Photoshop documents; IDs and dimensions are in pixels.',
    {},
    `
  var a = [];
  for (var i = 0; i < app.documents.length; i++) {
    var d = app.documents[i];
    a.push({
      id: d.id,
      name: d.name,
      width: d.width.as('px'),
      height: d.height.as('px'),
      resolution: d.resolution,
      active: d === app.activeDocument
    });
  }
  return a;
`,
    true
  ),
  tool(
    'open_document',
    'Open an existing image or PSD file.',
    { path: filePath },
    `
  var d = app.open(h.input(p.path));
  return { id: d.id, name: d.name };
`
  ),
  tool(
    'create_document',
    'Create an RGB document with a transparent background. Dimensions are pixels.',
    {
      name: text,
      width: z.number().int().min(1).max(30000),
      height: z.number().int().min(1).max(30000),
      resolution: z.number().min(1).max(2400).default(72)
    },
    `
  var d = app.documents.add(
    UnitValue(p.width, 'px'),
    UnitValue(p.height, 'px'),
    p.resolution,
    p.name,
    NewDocumentMode.RGB,
    DocumentFill.TRANSPARENT
  );
  return { id: d.id, name: d.name };
`
  ),
  tool(
    'activate_document',
    'Make an open document active by ID.',
    { documentId: z.number().int().positive() },
    `
  for (var i = 0; i < app.documents.length; i++) {
    if (app.documents[i].id === p.documentId) {
      app.activeDocument = app.documents[i];
      return { id: p.documentId };
    }
  }
  throw new Error('Document ID not found.');
`
  ),
  tool(
    'list_layers',
    'Read a paginated flattened layer tree in the active document.',
    pageSize,
    doc +
      `
  var a = [],
    count = 0;
  function walk(ls, parent) {
    for (var i = 0; i < ls.length; i++) {
      var l = ls[i];
      if (count >= p.offset && a.length < p.limit)
        a.push({
          id: l.id,
          name: l.name,
          type: l.typename,
          visible: l.visible,
          opacity: l.opacity,
          parentId: parent
        });
      count++;
      if (l.typename === 'LayerSet') walk(l.layers, l.id);
    }
  }
  walk(d.layers, null);
  return { total: count, layers: a };
`,
    true
  ),
  tool(
    'create_layer',
    'Add an empty art layer to the active document.',
    { name: text },
    doc +
      `
  var l = d.artLayers.add();
  l.name = p.name;
  return { id: l.id, name: l.name };
`
  ),
  tool(
    'set_layer',
    'Set layer name, visibility and opacity by layer ID.',
    {
      layerId: z.number().int().positive(),
      name: text.optional(),
      visible: z.boolean().optional(),
      opacity: z.number().min(0).max(100).optional()
    },
    layer +
      'if(p.name!==undefined)l.name=p.name;if(p.visible!==undefined)l.visible=p.visible;if(p.opacity!==undefined)l.opacity=p.opacity;return {id:l.id,name:l.name,visible:l.visible,opacity:l.opacity};'
  ),
  tool(
    'add_text',
    'Create a text layer. Position is [x,y] in pixels and font size is points.',
    {
      text,
      name: text.default('MCP Text'),
      x: z.number().default(100),
      y: z.number().default(100),
      size: z.number().positive().max(1296).default(48)
    },
    doc +
      `
  var l = d.artLayers.add();
  l.kind = LayerKind.TEXT;
  l.name = p.name;
  l.textItem.contents = p.text;
  l.textItem.position = [UnitValue(p.x, 'px'), UnitValue(p.y, 'px')];
  l.textItem.size = UnitValue(p.size, 'pt');
  return { id: l.id, name: l.name };
`
  ),
  tool(
    'resize_image',
    'Resize the active image to explicit pixel dimensions.',
    { width: z.number().int().min(1).max(30000), height: z.number().int().min(1).max(30000) },
    doc +
      'd.resizeImage(UnitValue(p.width,"px"),UnitValue(p.height,"px"),null,ResampleMethod.BICUBIC);return {width:d.width.as("px"),height:d.height.as("px")};'
  ),
  tool(
    'save_document',
    'Save the active document to its current file. Unsaved documents must use save_as_psd.',
    {},
    doc +
      `
  var f;
  try {
    f = d.fullName;
  } catch (e) {
    throw new Error('Use save_as_psd for a document with no saved file.');
  }
  h.require(f, 'Use save_as_psd first.');
  d.save();
  return { path: f.fsName };
`
  ),
  tool(
    'save_as_psd',
    'Save the active document as PSD, preserving layers.',
    outputFieldsFor('psd'),
    doc +
      `
  var f = h.output(p.path, p.overwrite);
  var o = new PhotoshopSaveOptions();
  o.layers = true;
  d.saveAs(f, o, false, Extension.LOWERCASE);
  return { path: f.fsName };
`
  ),
  tool(
    'export_image',
    'Export a PNG or JPEG copy. The output extension must match the selected format.',
    {
      ...outputFieldsFor('png', 'jpg', 'jpeg'),
      format: z.enum(['png', 'jpeg']).default('png'),
      quality: z.number().int().min(0).max(100).default(90)
    },
    doc +
      `
  h.require(
    p.format === 'png' ? /\\.png$/i.test(p.path) : /\\.jpe?g$/i.test(p.path),
    'File extension must match the selected format.'
  );
  var f = h.output(p.path, p.overwrite),
    o = new ExportOptionsSaveForWeb();
  o.format = p.format === 'png' ? SaveDocumentType.PNG : SaveDocumentType.JPEG;
  o.PNG8 = false;
  o.transparency = true;
  o.quality = p.quality;
  d.exportDocument(f, ExportType.SAVEFORWEB, o);
  return { path: f.fsName, format: p.format };
`
  ),
  tool(
    'get_document_info',
    'Read active Photoshop document dimensions, color mode, bit depth and active layer.',
    {},
    doc +
      `
  return {
    id: d.id,
    name: d.name,
    width: d.width.as('px'),
    height: d.height.as('px'),
    resolution: d.resolution,
    mode: String(d.mode),
    bitsPerChannel: String(d.bitsPerChannel),
    activeLayerId: d.activeLayer.id
  };
`,
    true
  ),
  tool(
    'duplicate_document',
    'Duplicate the active document, preserve its layers, and activate the copy.',
    { name: text },
    doc +
      `
  var copy = d.duplicate(p.name, false);
  return { id: copy.id, name: copy.name };
`
  ),
  tool(
    'duplicate_layer',
    'Duplicate a layer or group by ID within the active document.',
    { layerId: z.number().int().positive(), name: text.optional() },
    layer +
      `
  var copy = l.duplicate();
  if (p.name !== undefined) copy.name = p.name;
  return { id: copy.id, name: copy.name };
`
  ),
  tool(
    'translate_layer',
    'Move a layer or group by a relative offset in pixels, independent of ruler preferences.',
    { layerId: z.number().int().positive(), dx: z.number(), dy: z.number() },
    layer +
      `
  h.require(!l.allLocked, 'The layer is locked.');
  l.translate(UnitValue(p.dx, 'px'), UnitValue(p.dy, 'px'));
  return { id: l.id, dx: p.dx, dy: p.dy };
`
  ),
  tool(
    'set_text_layer',
    'Replace text and optionally its font size in points, using a text layer ID. Empty text clears the layer.',
    {
      layerId: z.number().int().positive(),
      contents: z.string().max(10000),
      size: z.number().positive().max(1296).optional()
    },
    layer +
      `
  h.require(l.typename === 'ArtLayer' && l.kind === LayerKind.TEXT, 'Layer is not a text layer.');
  h.require(!l.allLocked, 'The layer is locked.');
  l.textItem.contents = p.contents;
  if (p.size !== undefined) l.textItem.size = UnitValue(p.size, 'pt');
  return { id: l.id, contents: l.textItem.contents };
`
  ),
  tool(
    'crop_document',
    'Crop the active document to [left,top,right,bottom] pixel bounds inside the current canvas.',
    {
      bounds: z
        .tuple([z.number().min(0), z.number().min(0), z.number().positive(), z.number().positive()])
        .refine((v) => v[2] > v[0] && v[3] > v[1], 'Require right > left and bottom > top')
    },
    doc +
      `
  h.require(
    p.bounds[2] <= d.width.as('px') && p.bounds[3] <= d.height.as('px'),
    'Crop bounds exceed the canvas.'
  );
  var bounds = [];
  for (var i = 0; i < 4; i++) bounds.push(UnitValue(p.bounds[i], 'px'));
  d.crop(bounds);
  return { width: d.width.as('px'), height: d.height.as('px') };
`
  )
];
