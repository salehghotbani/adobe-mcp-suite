import { z } from 'zod';
import { tool } from '../mcp/tool.mjs';
import { text, pageSize } from '../mcp/schemas.mjs';
const wave = `
  var d = app.activeDocument;
  h.require(
    d && d.reflect.name === 'WaveDocument',
    'Activate a waveform document (not a multitrack session).'
  );
`;
export const tools = [
  tool(
    'list_commands',
    'Discover actual Audition command IDs and help from the installed version. Filter before invoking commands.',
    { ...pageSize, query: z.string().max(200).default('') },
    `
  var props = Application.reflect.properties,
    a = [],
    count = 0;
  for (var i = 0; i < props.length; i++) {
    var name = String(props[i].name);
    if (name.indexOf('COMMAND_') !== 0) continue;
    var id = String(Application[name]);
    if (p.query && (name + ' ' + id).toLowerCase().indexOf(p.query.toLowerCase()) < 0) continue;
    if (count >= p.offset && a.length < p.limit)
      a.push({ property: name, id: id, help: String(props[i].help || '') });
    count++;
  }
  return { total: count, commands: a };
`,
    true
  ),
  tool(
    'is_command_enabled',
    'Check whether an Audition command ID is enabled in the current workspace.',
    { commandId: text },
    `
  return { id: p.commandId, enabled: app.isCommandEnabled(p.commandId) };
`,
    true
  ),
  tool(
    'invoke_command',
    'Invoke an enabled Audition command discovered with list_commands. It may modify audio or open a native dialog.',
    { commandId: text },
    `
  h.require(app.isCommandEnabled(p.commandId), 'Command is disabled or unknown.');
  app.invokeCommand(p.commandId);
  return { invoked: p.commandId };
`
  ),
  tool(
    'get_active_document',
    'Read active document type; waveform timing is in samples and seconds.',
    {},
    `
  var d = app.activeDocument;
  if (!d) return null;
  var result = { type: String(d.reflect.name) };
  if (d.reflect.name === 'WaveDocument') {
    result.sampleRate = d.sampleRate;
    result.durationSamples = d.duration;
    result.durationSeconds = d.sampleRate ? d.duration / d.sampleRate : 0;
    result.playheadSamples = d.playheadPosition;
    result.playheadSeconds = d.sampleRate ? d.playheadPosition / d.sampleRate : 0;
  }
  return result;
`,
    true
  ),
  tool(
    'set_playhead',
    'Move the waveform playhead to an absolute time in seconds.',
    { seconds: z.number().min(0) },
    wave +
      `
  h.require(d.sampleRate > 0, 'Invalid sample rate.');
  var sample = Math.round(p.seconds * d.sampleRate);
  h.require(sample <= d.duration, 'Time exceeds waveform duration.');
  d.playheadPosition = sample;
  return { seconds: d.playheadPosition / d.sampleRate };
`
  ),
  tool(
    'inspect_api',
    'Read reflected property and method names from Audition to discover version-specific scripting capabilities.',
    { target: z.enum(['application', 'active_document']).default('application'), ...pageSize },
    `
  var target = p.target === 'application' ? app : app.activeDocument;
  h.require(target, 'No active document.');
  var r = target.reflect,
    all = [],
    i;
  for (i = 0; i < r.properties.length; i++)
    all.push({
      kind: 'property',
      name: String(r.properties[i].name),
      help: String(r.properties[i].help || '')
    });
  for (i = 0; i < r.methods.length; i++)
    all.push({
      kind: 'method',
      name: String(r.methods[i].name),
      help: String(r.methods[i].help || '')
    });
  return {
    type: String(r.name),
    total: all.length,
    members: all.slice(p.offset, p.offset + p.limit)
  };
`,
    true
  ),
  tool(
    'seek_playhead',
    'Move the waveform playhead by a relative number of seconds. Optional clamping keeps it within waveform bounds.',
    { offsetSeconds: z.number(), clamp: z.boolean().default(false) },
    wave +
      `
  h.require(d.sampleRate > 0, 'Invalid sample rate.');
  var target = Math.round(d.playheadPosition + p.offsetSeconds * d.sampleRate);
  if (p.clamp) target = Math.max(0, Math.min(d.duration, target));
  h.require(target >= 0 && target <= d.duration, 'Relative seek exceeds waveform bounds.');
  d.playheadPosition = target;
  return { samples: d.playheadPosition, seconds: d.playheadPosition / d.sampleRate };
`
  ),
  tool(
    'get_api_member',
    'Read type, help and argument metadata for one reflected Audition property or method without invoking it.',
    { target: z.enum(['application', 'active_document']).default('application'), name: text },
    `
  var target = p.target === 'application' ? app : app.activeDocument;
  h.require(target, 'No active document.');
  var groups = [target.reflect.properties, target.reflect.methods],
    k,
    i,
    member = null;
  for (k = 0; k < groups.length && !member; k++)
    for (i = 0; i < groups[k].length; i++)
      if (String(groups[k][i].name) === p.name) {
        member = groups[k][i];
        break;
      }
  h.require(member, 'API member not found.');
  var args = [];
  if (member.arguments)
    for (i = 0; i < member.arguments.length; i++)
      args.push({
        name: String(member.arguments[i].name),
        dataType: String(member.arguments[i].dataType || ''),
        help: String(member.arguments[i].help || '')
      });
  return {
    name: String(member.name),
    type: String(member.type || ''),
    dataType: String(member.dataType || ''),
    help: String(member.help || ''),
    arguments: args
  };
`,
    true
  ),
  tool(
    'invoke_commands',
    'Invoke up to 20 discovered command IDs in order. Stops on the first disabled or failing command and returns completed commands; index values start at zero. Avoid commands that open dialogs.',
    { commandIds: z.array(text).min(1).max(20) },
    `
  var props = Application.reflect.properties,
    known = {},
    i,
    j;
  for (i = 0; i < props.length; i++) {
    var name = String(props[i].name);
    if (name.indexOf('COMMAND_') === 0) known['$' + String(Application[name])] = true;
  }
  for (i = 0; i < p.commandIds.length; i++)
    h.require(known['$' + p.commandIds[i]] === true, 'Unknown command ID at index ' + i + '.');
  var completed = [];
  for (i = 0; i < p.commandIds.length; i++) {
    var id = p.commandIds[i];
    try {
      if (!app.isCommandEnabled(id))
        return {
          completed: false,
          completedCommands: completed,
          failed: { index: i, id: id, message: 'Command is disabled.' }
        };
      var result = app.invokeCommand(id);
      if (result === false)
        return {
          completed: false,
          completedCommands: completed,
          failed: { index: i, id: id, message: 'Command returned failure.' }
        };
      completed.push(id);
    } catch (error) {
      return {
        completed: false,
        completedCommands: completed,
        failed: { index: i, id: id, message: String(error.message || error) }
      };
    }
  }
  return { completed: true, completedCommands: completed };
`
  )
];
