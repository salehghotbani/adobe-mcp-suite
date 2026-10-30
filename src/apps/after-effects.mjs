import { z } from 'zod';
import { tool } from '../mcp/tool.mjs';
import {
  text,
  filePath,
  outputFields,
  outputFieldsFor,
  index,
  pageSize,
  rgb
} from '../mcp/schemas.mjs';
const project = `
  h.require(app.project, 'Open or create a project first.');
`;
const comp =
  project +
  `
  h.require(p.compIndex <= app.project.numItems, 'Item not found.');
  var c = app.project.item(p.compIndex);
  h.require(c instanceof CompItem, 'Item is not a composition.');
`;
const layer =
  comp +
  `
  h.require(p.layerIndex <= c.numLayers, 'Layer not found.');
  var l = c.layer(p.layerIndex);
`;
const transform = `
  var t = l.property('ADBE Transform Group');
`;
export const tools = [
  tool(
    'get_project',
    'Read current After Effects project information.',
    {},
    project +
      `
  return { file: app.project.file ? app.project.file.fsName : null, items: app.project.numItems };
`,
    true
  ),
  tool(
    'open_project',
    'Open an existing AEP project. Refuse if another project is already open with items.',
    { path: filePath },
    `
  h.require(
    !app.project || app.project.numItems === 0,
    'Save and close the current project before opening another.'
  );
  var f = h.input(p.path);
  app.open(f);
  return { file: app.project.file.fsName };
`
  ),
  tool(
    'save_project_as',
    'Save the current project as an AEP file.',
    outputFieldsFor('aep'),
    project +
      `
  var f = h.output(p.path, p.overwrite);
  app.project.save(f);
  return { path: f.fsName };
`
  ),
  tool(
    'list_items',
    'List project items with one-based indexes and stable item IDs.',
    pageSize,
    project +
      `
  var a = [];
  for (var i = p.offset + 1; i <= app.project.numItems && a.length < p.limit; i++) {
    var item = app.project.item(i);
    a.push({
      index: i,
      id: item.id,
      name: item.name,
      type: item.typeName,
      isComposition: item instanceof CompItem
    });
  }
  return { total: app.project.numItems, items: a };
`,
    true
  ),
  tool(
    'import_file',
    'Import a local media file into the project.',
    { path: filePath },
    project +
      `
  var item = app.project.importFile(new ImportOptions(h.input(p.path)));
  return { id: item.id, name: item.name };
`
  ),
  tool(
    'create_composition',
    'Create a composition with pixel dimensions and duration in seconds.',
    {
      name: text,
      width: z.number().int().min(4).max(30000).default(1920),
      height: z.number().int().min(4).max(30000).default(1080),
      duration: z.number().min(0.01).max(10800).default(10),
      frameRate: z.number().min(1).max(120).default(30)
    },
    project +
      `
  var c = app.project.items.addComp(p.name, p.width, p.height, 1, p.duration, p.frameRate);
  return { id: c.id, name: c.name };
`
  ),
  tool(
    'list_layers',
    'Read layers of a composition, with one-based layer indexes.',
    { compIndex: index, ...pageSize },
    comp +
      `
  var a = [];
  for (var i = p.offset + 1; i <= c.numLayers && a.length < p.limit; i++) {
    var l = c.layer(i);
    a.push({
      index: i,
      name: l.name,
      enabled: l.enabled,
      inPoint: l.inPoint,
      outPoint: l.outPoint
    });
  }
  return { total: c.numLayers, layers: a };
`,
    true
  ),
  tool(
    'add_text',
    'Add a text layer to a composition.',
    { compIndex: index, text, size: z.number().positive().max(1296).default(72) },
    comp +
      `
  var l = c.layers.addText(p.text);
  var prop = l.property('ADBE Text Properties').property('ADBE Text Document');
  var td = prop.value;
  td.fontSize = p.size;
  prop.setValue(td);
  return { index: l.index, name: l.name };
`
  ),
  tool(
    'add_solid',
    'Add a full-frame solid layer with RGB values from zero to one.',
    { compIndex: index, name: text, color: rgb.default([0.1, 0.1, 0.1]) },
    comp +
      `
  var l = c.layers.addSolid(p.color, p.name, c.width, c.height, c.pixelAspect, c.duration);
  return { index: l.index, name: l.name };
`
  ),
  tool(
    'add_footage_layer',
    'Add an existing project footage or composition item to a composition.',
    { compIndex: index, itemIndex: index },
    comp +
      `
  h.require(p.itemIndex <= app.project.numItems, 'Source item not found.');
  var source = app.project.item(p.itemIndex);
  h.require(
    source instanceof CompItem || source instanceof FootageItem,
    'Source is not footage or a composition.'
  );
  h.require(source !== c, 'Cannot nest a composition inside itself.');
  var l = c.layers.add(source);
  return { index: l.index, name: l.name };
`
  ),
  tool(
    'set_transform',
    'Set static 2D position, scale, rotation and opacity. Existing keyframes cause Adobe to reject static changes.',
    {
      compIndex: index,
      layerIndex: index,
      position: z.tuple([z.number(), z.number()]).optional(),
      scale: z.tuple([z.number().positive(), z.number().positive()]).optional(),
      rotation: z.number().optional(),
      opacity: z.number().min(0).max(100).optional()
    },
    layer +
      transform +
      `
  h.require(!l.threeDLayer, 'This tool supports 2D layers only.');
  if (p.position) t.property('ADBE Position').setValue(p.position);
  if (p.scale) t.property('ADBE Scale').setValue(p.scale);
  if (p.rotation !== undefined) t.property('ADBE Rotate Z').setValue(p.rotation);
  if (p.opacity !== undefined) t.property('ADBE Opacity').setValue(p.opacity);
  return { index: l.index, name: l.name };
`
  ),
  tool(
    'set_opacity_keyframe',
    'Set an opacity keyframe at a time in seconds.',
    {
      compIndex: index,
      layerIndex: index,
      time: z.number().min(0),
      opacity: z.number().min(0).max(100)
    },
    layer +
      transform +
      `
  h.require(p.time <= c.duration, 'Time exceeds composition duration.');
  t.property('ADBE Opacity').setValueAtTime(p.time, p.opacity);
  return { time: p.time, opacity: p.opacity };
`
  ),
  tool(
    'add_to_render_queue',
    'Queue a composition for rendering using existing Render Settings / Output Module template names.',
    {
      compIndex: index,
      ...outputFields,
      renderTemplate: text.optional(),
      outputTemplate: text.optional()
    },
    comp +
      `
  var f = h.output(p.path, p.overwrite);
  var r = app.project.renderQueue.items.add(c);
  try {
    if (p.renderTemplate) r.applyTemplate(p.renderTemplate);
    var om = r.outputModule(1);
    if (p.outputTemplate) om.applyTemplate(p.outputTemplate);
    om.file = f;
    h.output(om.file.fsName, p.overwrite);
    return {
      index: app.project.renderQueue.numItems,
      path: om.file.fsName,
      status: String(r.status)
    };
  } catch (e) {
    r.remove();
    throw e;
  }
`
  ),
  tool(
    'list_render_queue',
    'Read queued render items and their native status values.',
    {},
    project +
      `
  var a = [];
  for (var i = 1; i <= app.project.renderQueue.numItems; i++) {
    var r = app.project.renderQueue.item(i);
    a.push({ index: i, composition: r.comp.name, status: String(r.status), render: r.render });
  }
  return a;
`,
    true
  ),
  tool(
    'render_queue',
    'Render all enabled queued items synchronously. This can take a long time; configure ADOBE_MCP_TIMEOUT_MS accordingly.',
    {},
    project + 'app.project.renderQueue.render();return {completed:true};'
  ),
  tool(
    'get_composition',
    'Read composition size, frame rate, duration, layer count and work area by project item index.',
    { compIndex: index },
    comp +
      `
  return {
    id: c.id,
    name: c.name,
    width: c.width,
    height: c.height,
    frameRate: c.frameRate,
    duration: c.duration,
    layers: c.numLayers,
    workAreaStart: c.workAreaStart,
    workAreaDuration: c.workAreaDuration
  };
`,
    true
  ),
  tool(
    'set_work_area',
    'Set a composition work area in seconds. Duration must be at least one frame and fit inside the composition.',
    { compIndex: index, start: z.number().min(0), duration: z.number().positive() },
    comp +
      `
  h.require(p.duration >= c.frameDuration, 'Work area must include at least one frame.');
  h.require(
    p.start + p.duration <= c.duration + 0.0000001,
    'Work area exceeds composition duration.'
  );
  var duration = Math.min(p.duration, c.duration - p.start);
  c.workAreaDuration = Math.min(c.workAreaDuration, duration);
  c.workAreaStart = p.start;
  c.workAreaDuration = duration;
  return { start: c.workAreaStart, duration: c.workAreaDuration };
`
  ),
  tool(
    'add_composition_marker',
    'Add a composition marker at seconds; an existing marker at that time requires replaceExisting=true.',
    {
      compIndex: index,
      time: z.number().min(0),
      comment: text,
      duration: z.number().min(0).default(0),
      replaceExisting: z.boolean().default(false)
    },
    comp +
      `
  h.require(c.markerProperty, 'Composition markers are unavailable in this host.');
  h.require(p.time + p.duration <= c.duration, 'Marker exceeds composition duration.');
  if (!p.replaceExisting)
    for (var i = 1; i <= c.markerProperty.numKeys; i++)
      h.require(
        Math.abs(c.markerProperty.keyTime(i) - p.time) > 0.0000001,
        'A marker already exists at this time; set replaceExisting=true.'
      );
  var marker = new MarkerValue(p.comment);
  marker.duration = p.duration;
  c.markerProperty.setValueAtTime(p.time, marker);
  return { time: p.time, comment: p.comment, duration: p.duration };
`
  ),
  tool(
    'duplicate_layer',
    'Duplicate a layer within a composition and optionally rename the copy.',
    { compIndex: index, layerIndex: index, name: text.optional() },
    layer +
      `
  var copy = l.duplicate();
  if (p.name !== undefined) copy.name = p.name;
  return { index: copy.index, name: copy.name };
`
  ),
  tool(
    'set_layer_timing',
    'Set layer in/out points in composition seconds and optionally its start-time offset.',
    {
      compIndex: index,
      layerIndex: index,
      inPoint: z.number().min(0),
      outPoint: z.number().positive(),
      startTime: z.number().optional()
    },
    layer +
      `
  h.require(!l.locked, 'Layer is locked.');
  h.require(
    p.outPoint > p.inPoint && p.outPoint <= c.duration,
    'Require inPoint < outPoint within composition duration.'
  );
  if (p.startTime !== undefined) l.startTime = p.startTime;
  l.outPoint = Math.max(l.outPoint, p.outPoint);
  l.inPoint = p.inPoint;
  l.outPoint = p.outPoint;
  return { index: l.index, startTime: l.startTime, inPoint: l.inPoint, outPoint: l.outPoint };
`
  ),
  tool(
    'add_effect',
    'Add an effect by its stable Adobe match name to a layer. Unsupported effects are rejected before insertion.',
    { compIndex: index, layerIndex: index, matchName: text },
    layer +
      `
  h.require(!l.locked, 'Layer is locked.');
  var effects = l.property('ADBE Effect Parade');
  h.require(
    effects && effects.canAddProperty(p.matchName),
    'Effect is unavailable or incompatible with this layer.'
  );
  var effect = effects.addProperty(p.matchName);
  return { name: effect.name, matchName: effect.matchName, index: effect.propertyIndex };
`
  ),
  tool(
    'set_transform_keyframe',
    'Set a 2D transform keyframe. Position/scale use two numbers; rotation/opacity use one number.',
    {
      compIndex: index,
      layerIndex: index,
      time: z.number().min(0),
      property: z.enum(['position', 'scale', 'rotation', 'opacity']),
      value: z.union([z.number(), z.tuple([z.number(), z.number()])])
    },
    layer +
      transform +
      `
  h.require(!l.locked, 'Layer is locked.');
  h.require(!l.threeDLayer, 'This tool supports 2D layers only.');
  h.require(p.time <= c.duration, 'Time exceeds composition duration.');
  var vector = p.property === 'position' || p.property === 'scale';
  h.require(
    vector ? p.value instanceof Array : typeof p.value === 'number',
    'Value shape does not match the transform property.'
  );
  if (p.property === 'opacity')
    h.require(p.value >= 0 && p.value <= 100, 'Opacity must be between 0 and 100.');
  if (p.property === 'scale')
    h.require(p.value[0] > 0 && p.value[1] > 0, 'Scale values must be positive.');
  var names = {
    position: 'ADBE Position',
    scale: 'ADBE Scale',
    rotation: 'ADBE Rotate Z',
    opacity: 'ADBE Opacity'
  };
  t.property(names[p.property]).setValueAtTime(p.time, p.value);
  return { property: p.property, time: p.time, value: p.value };
`
  ),
  tool(
    'get_render_templates',
    'Read Render Settings and Output Module template names from an existing render-queue item.',
    { queueIndex: index },
    project +
      `
  h.require(p.queueIndex <= app.project.renderQueue.numItems, 'Render queue item not found.');
  var item = app.project.renderQueue.item(p.queueIndex),
    render = [],
    output = [],
    i;
  for (i = 0; i < item.templates.length; i++) render.push(String(item.templates[i]));
  var module = item.outputModule(1);
  for (i = 0; i < module.templates.length; i++) output.push(String(module.templates[i]));
  return { renderSettings: render, outputModules: output };
`,
    true
  )
];
