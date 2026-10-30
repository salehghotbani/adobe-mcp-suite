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
  )
];
