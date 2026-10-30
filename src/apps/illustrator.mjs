import { z } from 'zod';
import { tool } from '../mcp/tool.mjs';
import { text, filePath, outputFieldsFor, pageSize, rgb, index } from '../mcp/schemas.mjs';
const doc = `
  h.require(app.documents.length > 0, 'Open a document first.');
  var d = app.activeDocument;
`;
const color = `
  function color(v) {
    var c = new RGBColor();
    c.red = v[0] * 255;
    c.green = v[1] * 255;
    c.blue = v[2] * 255;
    return c;
  }
`;
export const tools = [
  tool(
    'list_documents',
    'List open Illustrator documents with one-based indexes.',
    {},
    `
  var a = [];
  for (var i = 0; i < app.documents.length; i++) {
    var d = app.documents[i];
    a.push({ index: i + 1, name: d.name, artboards: d.artboards.length });
  }
  return a;
`,
    true
  ),
  tool(
    'open_document',
    'Open an Illustrator-compatible local file.',
    { path: filePath },
    `
  var d = app.open(h.input(p.path));
  return { name: d.name };
`
  ),
  tool(
    'create_document',
    'Create an RGB document. Dimensions are points; Illustrator assigns the initial name.',
    {
      width: z.number().positive().max(16000).default(1920),
      height: z.number().positive().max(16000).default(1080)
    },
    `
  var d = app.documents.add(DocumentColorSpace.RGB, p.width, p.height);
  return { name: d.name };
`
  ),
  tool(
    'activate_document',
    'Activate a document using its one-based index.',
    { documentIndex: index },
    `
  h.require(p.documentIndex <= app.documents.length, 'Document index not found.');
  app.documents[p.documentIndex - 1].activate();
  return { name: app.activeDocument.name };
`
  ),
  tool(
    'list_layers',
    'List top-level layers in the active document.',
    pageSize,
    doc +
      `
  var a = [];
  for (var i = p.offset; i < d.layers.length && a.length < p.limit; i++) {
    var l = d.layers[i];
    a.push({ index: i + 1, name: l.name, visible: l.visible, locked: l.locked });
  }
  return { total: d.layers.length, layers: a };
`,
    true
  ),
  tool(
    'create_layer',
    'Create a named layer in the active document.',
    { name: text },
    doc +
      `
  var l = d.layers.add();
  l.name = p.name;
  return { name: l.name };
`
  ),
  tool(
    'list_artboards',
    'Read artboard rectangles [left,top,right,bottom] in points.',
    {},
    doc +
      `
  var a = [];
  for (var i = 0; i < d.artboards.length; i++)
    a.push({ index: i + 1, name: d.artboards[i].name, rect: d.artboards[i].artboardRect });
  return a;
`,
    true
  ),
  tool(
    'add_artboard',
    'Add an artboard using [left,top,right,bottom] points.',
    {
      name: text,
      rect: z
        .tuple([z.number(), z.number(), z.number(), z.number()])
        .refine((r) => r[2] > r[0] && r[1] > r[3], 'Require right > left and top > bottom')
    },
    doc +
      `
  var a = d.artboards.add(p.rect);
  a.name = p.name;
  return { name: a.name, rect: a.artboardRect };
`
  ),
  tool(
    'add_rectangle',
    'Draw a filled rectangle. Coordinates and dimensions are points.',
    {
      left: z.number(),
      top: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
      color: rgb.default([1, 0.1, 0.1]),
      name: text.default('MCP Rectangle')
    },
    doc +
      color +
      `
  var r = d.pathItems.rectangle(p.top, p.left, p.width, p.height);
  r.name = p.name;
  r.stroked = false;
  r.filled = true;
  r.fillColor = color(p.color);
  return { name: r.name };
`
  ),
  tool(
    'add_text',
    'Create point text at [x,y] in points.',
    {
      text,
      x: z.number().default(100),
      y: z.number().default(100),
      size: z.number().positive().max(1296).default(48)
    },
    doc +
      `
  var t = d.textFrames.add();
  t.contents = p.text;
  t.position = [p.x, p.y];
  t.textRange.characterAttributes.size = p.size;
  return { name: t.name, contents: t.contents };
`
  ),
  tool(
    'save_as_ai',
    'Save the active Illustrator document as AI.',
    outputFieldsFor('ai'),
    doc +
      `
  var f = h.output(p.path, p.overwrite);
  d.saveAs(f, new IllustratorSaveOptions());
  return { path: f.fsName };
`
  ),
  tool(
    'export_svg',
    'Export the active document as SVG.',
    outputFieldsFor('svg'),
    doc +
      `
  var f = h.output(p.path, p.overwrite);
  var o = new ExportOptionsSVG();
  o.embedRasterImages = true;
  d.exportFile(f, ExportType.SVG, o);
  return { path: f.fsName };
`
  ),
  tool(
    'export_png',
    'Export PNG24 with artboard clipping. Scale is a percentage.',
    { ...outputFieldsFor('png'), scale: z.number().min(1).max(1000).default(100) },
    doc +
      `
  var f = h.output(p.path, p.overwrite);
  var o = new ExportOptionsPNG24();
  o.transparency = true;
  o.artBoardClipping = true;
  o.horizontalScale = p.scale;
  o.verticalScale = p.scale;
  d.exportFile(f, ExportType.PNG24, o);
  return { path: f.fsName };
`
  ),
  tool(
    'get_selection',
    'Read selected Illustrator objects with bounded text previews. Text selections are supported.',
    pageSize,
    doc +
      `
  var selected = d.selection,
    a = [];
  if (!selected) return { total: 0, items: a };
  if (selected.typename) selected = [selected];
  for (var i = p.offset; i < selected.length && a.length < p.limit; i++) {
    var item = selected[i],
      entry = { index: i + 1, type: String(item.typename) };
    try {
      entry.name = String(item.name || '');
    } catch (e) {}
    try {
      var b = item.geometricBounds;
      if (b) entry.bounds = [Number(b[0]), Number(b[1]), Number(b[2]), Number(b[3])];
    } catch (e) {}
    if (item.typename === 'TextFrame' || item.typename === 'TextRange')
      entry.textPreview = String(item.contents).slice(0, 1000);
    a.push(entry);
  }
  return { total: selected.length, items: a };
`,
    true
  ),
  tool(
    'set_layer',
    'Rename, show, hide, lock or unlock a top-level Illustrator layer by one-based index.',
    {
      layerIndex: index,
      name: text.optional(),
      visible: z.boolean().optional(),
      locked: z.boolean().optional()
    },
    doc +
      `
  h.require(p.layerIndex <= d.layers.length, 'Layer index not found.');
  var l = d.layers[p.layerIndex - 1];
  if (p.locked === false) l.locked = false;
  if (p.name !== undefined) l.name = p.name;
  if (p.visible !== undefined) l.visible = p.visible;
  if (p.locked === true) l.locked = true;
  return { index: p.layerIndex, name: l.name, visible: l.visible, locked: l.locked };
`
  ),
  tool(
    'activate_artboard',
    'Activate an artboard by one-based index.',
    { artboardIndex: index },
    doc +
      `
  h.require(p.artboardIndex <= d.artboards.length, 'Artboard index not found.');
  d.artboards.setActiveArtboardIndex(p.artboardIndex - 1);
  return { index: p.artboardIndex, name: d.artboards[p.artboardIndex - 1].name };
`
  ),
  tool(
    'add_ellipse',
    'Draw a filled ellipse. Position and dimensions are points; RGB components range from zero to one.',
    {
      left: z.number(),
      top: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
      color: rgb.default([0.1, 0.4, 1]),
      name: text.default('MCP Ellipse')
    },
    doc +
      color +
      `
  var item = d.pathItems.ellipse(p.top, p.left, p.width, p.height);
  item.name = p.name;
  item.stroked = false;
  item.filled = true;
  item.fillColor = color(p.color);
  return { name: item.name };
`
  ),
  tool(
    'place_image',
    'Place a linked local image at [x,y] points using its natural size.',
    {
      path: filePath,
      x: z.number().default(0),
      y: z.number().default(0),
      name: text.default('MCP Image')
    },
    doc +
      `
  var source = h.input(p.path),
    item = d.placedItems.add();
  try {
    item.file = source;
    item.position = [p.x, p.y];
    item.name = p.name;
    return { name: item.name, width: item.width, height: item.height };
  } catch (error) {
    item.remove();
    throw error;
  }
`
  ),
  tool(
    'save_as_pdf',
    'Save the active Illustrator document as PDF. This changes its current file association.',
    { ...outputFieldsFor('pdf'), preserveEditability: z.boolean().default(true) },
    doc +
      `
  var f = h.output(p.path, p.overwrite),
    options = new PDFSaveOptions();
  options.preserveEditability = p.preserveEditability;
  options.viewAfterSaving = false;
  d.saveAs(f, options);
  return { path: f.fsName, preserveEditability: p.preserveEditability };
`
  )
];
