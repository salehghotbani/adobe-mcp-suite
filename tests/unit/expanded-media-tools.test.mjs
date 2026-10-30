import test from 'node:test';
import assert from 'node:assert/strict';
import { executeTool, fileFixture } from '../helpers/host-runtime.mjs';

function premiere() {
  let playhead = 0,
    inPoint = 0,
    outPoint = 5;
  const mutations = [],
    clip = { name: 'Clip', disabled: false },
    markers = [
      { guid: '1', name: 'First', comments: 'A', start: { seconds: 1 }, end: { seconds: 1 } },
      { guid: '2', name: 'Second', comments: 'B', start: { seconds: 2 }, end: { seconds: 3 } }
    ];
  const item = {
    nodeId: 'media',
    canChangeMediaPath: () => true,
    changeMediaPath: (path) => {
      item.path = path;
      return 0;
    },
    getMediaPath: () => item.path
  };
  const children = [item];
  children.numItems = 1;
  const tracks = [{ clips: [clip] }];
  tracks.numTracks = 1;
  tracks[0].clips.numItems = 1;
  const s = {
    sequenceID: 'seq',
    name: 'Sequence',
    timebase: '8467200000',
    videoTracks: tracks,
    audioTracks: tracks,
    getSettings: () => ({
      videoFrameWidth: 1920,
      videoFrameHeight: 1080,
      videoFrameRate: { seconds: 1 / 30 }
    }),
    getPlayerPosition: () => ({ seconds: playhead }),
    setPlayerPosition: (ticks) => {
      playhead = Number(ticks) / 254016000000;
      return true;
    },
    getInPointAsTime: () => ({ seconds: inPoint }),
    getOutPointAsTime: () => ({ seconds: outPoint }),
    setInPoint: (v) => {
      assert.ok(v < outPoint);
      inPoint = v;
      mutations.push('in');
    },
    setOutPoint: (v) => {
      assert.ok(v > inPoint);
      outPoint = v;
      mutations.push('out');
    },
    markers: {
      getFirstMarker: () => markers[0],
      getNextMarker: (marker) => markers[markers.indexOf(marker) + 1] || null
    }
  };
  function Time() {
    this.seconds = 0;
    Object.defineProperty(this, 'ticks', {
      get: () => String(Math.round(this.seconds * 254016000000))
    });
  }
  return {
    s,
    clip,
    item,
    mutations,
    globals: {
      app: { project: { rootItem: { nodeId: 'root', children }, activeSequence: s } },
      Time,
      File: fileFixture()
    }
  };
}
test('Premiere sequence details and marker pagination return seconds and bounded results', () => {
  const { globals } = premiere();
  const settings = executeTool('premiere-pro', 'get_sequence_settings', {}, globals);
  assert.equal(settings.width, 1920);
  assert.equal(settings.frameDurationSeconds, 1 / 30);
  const markers = executeTool('premiere-pro', 'list_markers', { offset: 1, limit: 1 }, globals);
  assert.equal(markers.total, 2);
  assert.equal(markers.markers[0].guid, '2');
  assert.equal(markers.markers[0].end, 3);
  assert.equal(executeTool('premiere-pro', 'set_playhead', { seconds: 2.5 }, globals).seconds, 2.5);
});
test('Premiere range updates preflight endpoints and retain valid intermediate native ranges', () => {
  const { globals, mutations } = premiere();
  assert.throws(
    () => executeTool('premiere-pro', 'set_sequence_range', { start: 6, end: 3 }, globals),
    /greater/
  );
  assert.equal(mutations.length, 0);
  assert.deepEqual(
    executeTool('premiere-pro', 'set_sequence_range', { start: 8, end: 9 }, globals),
    { start: 8, end: 9 }
  );
});
test('Premiere clip enablement uses zero-based indexes and refuses unsupported properties', () => {
  const { globals, clip } = premiere();
  executeTool(
    'premiere-pro',
    'set_clip_enabled',
    { trackIndex: 0, clipIndex: 0, enabled: false },
    globals
  );
  assert.equal(clip.disabled, true);
  assert.throws(
    () =>
      executeTool(
        'premiere-pro',
        'set_clip_enabled',
        { trackIndex: 0, clipIndex: 1, enabled: true },
        globals
      ),
    /not found/
  );
  delete clip.disabled;
  assert.throws(
    () =>
      executeTool(
        'premiere-pro',
        'set_clip_enabled',
        { trackIndex: 0, clipIndex: 0, enabled: true },
        globals
      ),
    /does not expose/
  );
  assert.equal(clip.disabled, undefined);
});
test('Premiere media relinking resolves node IDs and verifies the source before changing references', () => {
  const { globals, item } = premiere();
  assert.deepEqual(
    executeTool(
      'premiere-pro',
      'relink_media',
      { nodeId: 'media', path: 'E:\\replacement.mp4' },
      globals
    ),
    { nodeId: 'media', path: 'E:\\replacement.mp4' }
  );
  item.canChangeMediaPath = () => false;
  assert.throws(
    () =>
      executeTool(
        'premiere-pro',
        'relink_media',
        { nodeId: 'media', path: 'E:\\other.mp4' },
        globals
      ),
    /cannot be relinked/
  );
  assert.equal(item.path, 'E:\\replacement.mp4');
});
test('Media Encoder source inspection skips unsafe properties and limits strings', () => {
  const info = { width: 1920, description: 'x'.repeat(12000), nativeObject: { large: true } };
  Object.defineProperty(info, 'broken', {
    get() {
      throw new Error('Unavailable');
    }
  });
  info.reflect = {
    properties: ['width', 'description', 'nativeObject', 'broken'].map((name) => ({ name }))
  };
  const globals = {
    app: { getEncoderHost: () => ({ getSourceInfo: () => info }) },
    File: fileFixture()
  };
  const result = executeTool(
    'media-encoder',
    'inspect_source',
    { source: 'E:\\source.mp4' },
    globals
  );
  assert.equal(result.total, 2);
  assert.equal(result.properties[1].value.length, 10000);
});
test('Media Encoder stitching validates all sources and rejects delimiter injection before queueing', () => {
  const queued = [],
    globals = {
      app: {
        getFrontend: () => ({
          stitchFiles: (...args) => {
            queued.push(args);
            return {};
          }
        })
      },
      File: fileFixture(['E:\\missing.mp4'])
    };
  const base = { preset: 'E:\\preset.epr', path: 'E:\\out.mp4' };
  assert.throws(
    () =>
      executeTool(
        'media-encoder',
        'stitch_files',
        { ...base, sources: ['E:\\a;bad.mp4', 'E:\\b.mp4'] },
        globals
      ),
    /Semicolons/
  );
  assert.throws(
    () =>
      executeTool(
        'media-encoder',
        'stitch_files',
        { ...base, sources: ['E:\\a.mp4', 'E:\\missing.mp4'] },
        globals
      ),
    /Input does not exist/
  );
  assert.equal(queued.length, 0);
  const result = executeTool(
    'media-encoder',
    'stitch_files',
    { ...base, sources: ['E:\\a.mp4', 'E:\\b.mp4'] },
    globals
  );
  assert.equal(result.queued, true);
  assert.equal(result.completed, undefined);
  assert.equal(queued[0][0], 'E:\\a.mp4;E:\\b.mp4');
});
test('Media Encoder image sequences require a matching folder and preview writes honor overwrite controls', () => {
  let sequences = 0,
    previews = 0;
  function Folder(name) {
    this.fsName = name;
    this.exists = true;
  }
  Folder.fs = 'Windows';
  const globals = {
    app: {
      getFrontend: () => ({
        addFileSequenceToBatch: () => {
          sequences++;
          return true;
        }
      }),
      getEncoderHost: () => ({
        getCurrentBatchPreview: () => {
          previews++;
          return true;
        }
      })
    },
    File: fileFixture(),
    Folder
  };
  const base = {
    folder: 'E:\\seq',
    image: 'E:\\other\\one.png',
    preset: 'E:\\preset.epr',
    path: 'E:\\out.mp4'
  };
  assert.throws(
    () => executeTool('media-encoder', 'add_image_sequence', base, globals),
    /belong directly/
  );
  assert.equal(sequences, 0);
  executeTool(
    'media-encoder',
    'add_image_sequence',
    { ...base, image: 'E:\\SEQ\\one.png' },
    globals
  );
  assert.equal(sequences, 1);
  assert.throws(
    () => executeTool('media-encoder', 'save_batch_preview', { path: 'E:\\existing.tif' }, globals),
    /Output exists/
  );
  assert.equal(previews, 0);
  executeTool('media-encoder', 'save_batch_preview', { path: 'E:\\out.tif' }, globals);
  assert.equal(previews, 1);
});

function audition() {
  const calls = [],
    wave = {
      reflect: { name: 'WaveDocument' },
      sampleRate: 48000,
      duration: 480000,
      playheadPosition: 48000
    };
  const app = {
    activeDocument: wave,
    isCommandEnabled: (id) => id !== 'second',
    invokeCommand: (id) => {
      calls.push(id);
    },
    reflect: {
      properties: [],
      methods: [
        {
          name: 'invokeCommand',
          type: 'method',
          dataType: 'boolean',
          help: 'Invoke a command',
          arguments: [{ name: 'commandId', dataType: 'string', help: 'A command identifier' }]
        }
      ]
    }
  };
  const Application = {
    COMMAND_FIRST: 'first',
    COMMAND_SECOND: 'second',
    reflect: { properties: [{ name: 'COMMAND_FIRST' }, { name: 'COMMAND_SECOND' }] }
  };
  return { calls, wave, globals: { app, Application } };
}
test('Audition relative seeks use sample units and optionally clamp without moving on invalid input', () => {
  const { wave, globals } = audition();
  assert.throws(
    () => executeTool('audition', 'seek_playhead', { offsetSeconds: -2 }, globals),
    /bounds/
  );
  assert.equal(wave.playheadPosition, 48000);
  assert.equal(
    executeTool('audition', 'seek_playhead', { offsetSeconds: -2, clamp: true }, globals).samples,
    0
  );
  assert.equal(
    executeTool('audition', 'seek_playhead', { offsetSeconds: 2.5 }, globals).seconds,
    2.5
  );
});
test('Audition API member inspection returns reflected argument metadata without invoking it', () => {
  const { calls, globals } = audition();
  const member = executeTool('audition', 'get_api_member', { name: 'invokeCommand' }, globals);
  assert.equal(member.arguments[0].dataType, 'string');
  assert.equal(calls.length, 0);
  assert.throws(
    () => executeTool('audition', 'get_api_member', { name: 'missing' }, globals),
    /not found/
  );
});
test('Audition command batches preflight unknown IDs and return partial completion on a later disabled command', () => {
  const { calls, globals } = audition();
  assert.throws(
    () => executeTool('audition', 'invoke_commands', { commandIds: ['first', 'unknown'] }, globals),
    /Unknown command/
  );
  assert.equal(calls.length, 0);
  const result = executeTool(
    'audition',
    'invoke_commands',
    { commandIds: ['first', 'second'] },
    globals
  );
  assert.deepEqual(result.completedCommands, ['first']);
  assert.equal(result.failed.index, 1);
  assert.equal(result.completed, false);
  assert.deepEqual(calls, ['first']);
});
