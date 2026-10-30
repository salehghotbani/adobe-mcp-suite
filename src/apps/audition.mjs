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
  )
];
