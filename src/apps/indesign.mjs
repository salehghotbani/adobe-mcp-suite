import { z } from 'zod';
import { tool } from '../mcp/tool.mjs';
import { text, filePath, outputFieldsFor, index, pageSize } from '../mcp/schemas.mjs';
const doc = `
  h.require(app.documents.length > 0, 'Open a document first.');
  var d = app.activeDocument;
`;
const page =
  doc +
  `
  h.require(p.page <= d.pages.length, 'Page not found.');
  var page = d.pages[p.page - 1];
`;
const bounds = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine((v) => v[2] > v[0] && v[3] > v[1], 'Require bottom > top and right > left');
export const tools = [
  tool(
    'list_documents',
    'List open InDesign documents.',
    {},
    `
  var a = [];
  for (var i = 0; i < app.documents.length; i++) {
    var d = app.documents[i];
    a.push({ id: d.id, name: d.name, pages: d.pages.length });
  }
  return a;
`,
    true
  ),
  tool(
    'open_document',
    'Open an existing InDesign document.',
    { path: filePath },
    `
  var d = app.open(h.input(p.path));
  return { id: d.id, name: d.name };
`
  ),
  tool(
    'create_document',
    'Create a document with dimensions in points.',
    {
      width: z.number().positive().default(595),
      height: z.number().positive().default(842),
      pages: z.number().int().min(1).max(1000).default(1),
      facingPages: z.boolean().default(false)
    },
    `
  var d = app.documents.add();
  d.documentPreferences.properties = {
    pageWidth: p.width + 'pt',
    pageHeight: p.height + 'pt',
    pagesPerDocument: p.pages,
    facingPages: p.facingPages
  };
  return { id: d.id, pages: d.pages.length };
`
  ),
  tool(
    'list_pages',
    'Read page names and text-frame counts.',
    pageSize,
    doc +
      `
  var a = [];
  for (var i = p.offset; i < d.pages.length && a.length < p.limit; i++) {
    var page = d.pages[i];
    a.push({ page: i + 1, name: page.name, textFrames: page.textFrames.length });
  }
  return { total: d.pages.length, pages: a };
`,
    true
  ),
  tool(
    'add_page',
    'Append one page to the active document.',
    {},
    doc +
      `
  var page = d.pages.add(LocationOptions.AT_END);
  return { name: page.name, pages: d.pages.length };
`
  ),
  tool(
    'add_text_frame',
    'Add a text frame. Bounds [top,left,bottom,right] use points in the current ruler origin.',
    { page: index, bounds, text, size: z.number().positive().max(1296).default(12) },
    page +
      `
  var f = page.textFrames.add();
  f.geometricBounds = [
    p.bounds[0] + 'pt',
    p.bounds[1] + 'pt',
    p.bounds[2] + 'pt',
    p.bounds[3] + 'pt'
  ];
  f.contents = p.text;
  f.parentStory.pointSize = p.size;
  return { id: f.id, overflows: f.overflows };
`
  ),
  tool(
    'list_text_frames',
    'Read text frame IDs and contents on a page.',
    { page: index, ...pageSize },
    page +
      `
  var a = [];
  for (var i = p.offset; i < page.textFrames.length && a.length < p.limit; i++) {
    var f = page.textFrames[i];
    a.push({ id: f.id, contents: String(f.contents), overflows: f.overflows });
  }
  return { total: page.textFrames.length, frames: a };
`,
    true
  ),
  tool(
    'set_text',
    'Replace contents of a text frame by ID.',
    { frameId: z.number().int().positive(), text },
    doc +
      `
  var f = d.textFrames.itemByID(p.frameId);
  h.require(f.isValid, 'Text frame not found.');
  f.contents = p.text;
  return { id: f.id, overflows: f.overflows };
`
  ),
  tool(
    'place_image',
    'Place a local image into a new rectangular frame and fit proportionally.',
    { page: index, bounds, path: filePath },
    page +
      `
  var source = h.input(p.path);
  var r = page.rectangles.add();
  r.geometricBounds = [
    p.bounds[0] + 'pt',
    p.bounds[1] + 'pt',
    p.bounds[2] + 'pt',
    p.bounds[3] + 'pt'
  ];
  r.place(source);
  r.fit(FitOptions.PROPORTIONALLY);
  r.fit(FitOptions.CENTER_CONTENT);
  return { id: r.id };
`
  ),
  tool(
    'save_as',
    'Save the active document as INDD.',
    outputFieldsFor('indd'),
    doc +
      `
  var f = h.output(p.path, p.overwrite);
  d.save(f);
  return { path: f.fsName };
`
  ),
  tool(
    'list_pdf_presets',
    'List installed PDF export preset names.',
    {},
    `
  var a = [];
  for (var i = 0; i < app.pdfExportPresets.length; i++) a.push(app.pdfExportPresets[i].name);
  return a;
`,
    true
  ),
  tool(
    'export_pdf',
    'Export PDF, optionally using an installed preset name.',
    { ...outputFieldsFor('pdf'), preset: text.optional() },
    doc +
      `
  var f = h.output(p.path, p.overwrite);
  if (p.preset) {
    var preset = app.pdfExportPresets.itemByName(p.preset);
    h.require(preset.isValid, 'PDF preset not found.');
    d.exportFile(ExportFormat.PDF_TYPE, f, false, preset);
  } else {
    d.exportFile(ExportFormat.PDF_TYPE, f, false);
  }
  return { path: f.fsName };
`
  ),
  tool(
    'activate_document',
    'Activate an open InDesign document by its document ID.',
    { documentId: z.number().int().positive() },
    `
  var target = app.documents.itemByID(p.documentId);
  h.require(target.isValid, 'Document ID not found.');
  app.activeDocument = target;
  return { id: target.id, name: target.name };
`
  ),
  tool(
    'get_document_info',
    'Read active document identity, page/story/link counts, saved state and unsaved changes.',
    {},
    doc +
      `
  return {
    id: d.id,
    name: d.name,
    pages: d.pages.length,
    stories: d.stories.length,
    links: d.links.length,
    saved: d.saved,
    modified: d.modified
  };
`,
    true
  ),
  tool(
    'list_links',
    'List placed-file links, IDs, paths and native status values in the active document.',
    pageSize,
    doc +
      `
  var links = [];
  for (var i = p.offset; i < d.links.length && links.length < p.limit; i++) {
    var link = d.links[i];
    links.push({ id: link.id, name: link.name, path: link.filePath, status: String(link.status) });
  }
  return { total: d.links.length, links: links };
`,
    true
  ),
  tool(
    'update_link',
    'Refresh one placed-file link by ID. The linked source must still exist.',
    { linkId: z.number().int().positive() },
    doc +
      `
  var link = d.links.itemByID(p.linkId);
  h.require(link.isValid, 'Link ID not found.');
  h.input(link.filePath);
  link.update();
  return { id: link.id, status: String(link.status) };
`
  ),
  tool(
    'export_idml',
    'Export an IDML interchange copy without changing the current INDD file association.',
    outputFieldsFor('idml'),
    doc +
      `
  var f = h.output(p.path, p.overwrite);
  d.exportFile(ExportFormat.INDESIGN_MARKUP, f, false);
  return { path: f.fsName };
`
  )
];
