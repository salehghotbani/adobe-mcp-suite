import { z } from 'zod';
import { tool } from '../mcp/tool.mjs';
import { text, filePath, outputFields, pageSize } from '../mcp/schemas.mjs';
const project = `
  h.require(app.project && app.project.rootItem, 'Open a project first.');
`;
const sequence =
  project +
  `
  var s = app.project.activeSequence;
  h.require(s, 'Activate a sequence first.');
`;
const findItem = `
  function find(item, id) {
    if (String(item.nodeId) === id) return item;
    if (item.children) {
      for (var i = 0; i < item.children.numItems; i++) {
        var r = find(item.children[i], id);
        if (r) return r;
      }
    }
    return null;
  }
`;
export const tools = [
  tool(
    'get_project',
    'Read the open Premiere Pro project.',
    {},
    project +
      `
  return {
    name: app.project.name,
    path: app.project.path,
    sequences: app.project.sequences.numSequences
  };
`,
    true
  ),
  tool(
    'list_sequences',
    'List project sequences and their IDs.',
    {},
    project +
      `
  var a = [];
  for (var i = 0; i < app.project.sequences.numSequences; i++) {
    var s = app.project.sequences[i];
    a.push({
      id: s.sequenceID,
      name: s.name,
      videoTracks: s.videoTracks.numTracks,
      audioTracks: s.audioTracks.numTracks
    });
  }
  return a;
`,
    true
  ),
  tool(
    'activate_sequence',
    'Open a sequence in the timeline by sequence ID.',
    { sequenceId: text },
    project +
      `
  var found = false;
  for (var i = 0; i < app.project.sequences.numSequences; i++)
    if (String(app.project.sequences[i].sequenceID) === p.sequenceId) found = true;
  h.require(found, 'Sequence ID not found.');
  h.require(app.project.openSequence(p.sequenceId) !== false, 'Could not open sequence.');
  return { id: p.sequenceId };
`
  ),
  tool(
    'list_project_items',
    'Read a paginated flattened project bin tree with node IDs.',
    pageSize,
    project +
      `
  var a = [],
    count = 0;
  function walk(item, parent) {
    if (count >= p.offset && a.length < p.limit)
      a.push({ nodeId: String(item.nodeId), name: item.name, type: item.type, parentId: parent });
    count++;
    if (item.children) {
      for (var i = 0; i < item.children.numItems; i++) walk(item.children[i], String(item.nodeId));
    }
  }
  walk(app.project.rootItem, null);
  return { total: count, items: a };
`,
    true
  ),
  tool(
    'create_bin',
    'Create a root-level project bin.',
    { name: text },
    project +
      `
  var b = app.project.rootItem.createBin(p.name);
  h.require(b, 'Could not create bin.');
  return { nodeId: String(b.nodeId), name: b.name };
`
  ),
  tool(
    'import_media',
    'Import local media into the project root, suppressing import dialogs.',
    { paths: z.array(filePath).min(1).max(100) },
    project +
      `
  for (var i = 0; i < p.paths.length; i++) h.input(p.paths[i]);
  h.require(app.project.importFiles(p.paths, true, app.project.rootItem, false), 'Import failed.');
  return { imported: p.paths };
`
  ),
  tool(
    'create_sequence_from_clips',
    'Create a sequence from project-item node IDs.',
    { name: text, nodeIds: z.array(text).min(1).max(100) },
    project +
      findItem +
      `
  var items = [];
  for (var i = 0; i < p.nodeIds.length; i++) {
    var item = find(app.project.rootItem, p.nodeIds[i]);
    h.require(item, 'Project item not found: ' + p.nodeIds[i]);
    items.push(item);
  }
  h.require(
    app.project.createNewSequenceFromClips(p.name, items, app.project.rootItem),
    'Sequence creation failed.'
  );
  return { name: p.name };
`
  ),
  tool(
    'get_timeline',
    'Read clips on a video or audio track of the active sequence. Track index starts at zero.',
    {
      kind: z.enum(['video', 'audio']).default('video'),
      trackIndex: z.number().int().min(0).default(0),
      ...pageSize
    },
    sequence +
      `
  var tracks = p.kind === 'video' ? s.videoTracks : s.audioTracks;
  h.require(p.trackIndex < tracks.numTracks, 'Track index not found.');
  var clips = tracks[p.trackIndex].clips,
    a = [];
  for (var i = p.offset; i < clips.numItems && a.length < p.limit; i++) {
    var c = clips[i];
    a.push({
      index: i,
      name: c.name,
      start: c.start.seconds,
      end: c.end.seconds,
      inPoint: c.inPoint.seconds,
      outPoint: c.outPoint.seconds,
      nodeId: String(c.nodeId)
    });
  }
  return { sequence: s.name, total: clips.numItems, clips: a };
`,
    true
  ),
  tool(
    'insert_clip',
    'Insert a project item on a track at a time in seconds. Inserting can ripple the timeline.',
    {
      nodeId: text,
      kind: z.enum(['video', 'audio']).default('video'),
      trackIndex: z.number().int().min(0).default(0),
      seconds: z.number().min(0)
    },
    sequence +
      findItem +
      `
  var item = find(app.project.rootItem, p.nodeId);
  h.require(item, 'Project item not found.');
  var tracks = p.kind === 'video' ? s.videoTracks : s.audioTracks;
  h.require(p.trackIndex < tracks.numTracks, 'Track index not found.');
  var time = new Time();
  time.seconds = p.seconds;
  tracks[p.trackIndex].insertClip(item, time.ticks);
  return { inserted: true, seconds: p.seconds };
`
  ),
  tool(
    'add_marker',
    'Add a comment marker to the active sequence at seconds.',
    { seconds: z.number().min(0), name: text, comments: z.string().max(10000).default('') },
    sequence +
      `
  var m = s.markers.createMarker(p.seconds);
  m.name = p.name;
  m.comments = p.comments;
  return { name: m.name, seconds: m.start.seconds };
`
  ),
  tool(
    'save_project',
    'Save the current Premiere project in place.',
    {},
    project +
      `
  h.require(app.project.path, 'Save the project in Premiere first.');
  var result = app.project.save();
  h.require(
    result === 0 || result === true || result === undefined,
    'Project save failed: ' + result
  );
  return { path: app.project.path };
`
  ),
  tool(
    'export_sequence',
    'Export the active sequence directly using a local .epr preset. This waits for the native export call.',
    {
      ...outputFields,
      preset: filePath,
      range: z.enum(['entire', 'in_out', 'work_area']).default('entire')
    },
    sequence +
      `
  var f = h.output(p.path, p.overwrite);
  h.input(p.preset);
  var r = p.range === 'entire' ? 0 : p.range === 'in_out' ? 1 : 2;
  h.require(s.exportAsMediaDirect(f.fsName, p.preset, r), 'Export failed.');
  return { path: f.fsName };
`
  )
];
