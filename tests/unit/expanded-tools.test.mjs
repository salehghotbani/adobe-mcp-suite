import test from 'node:test';
import assert from 'node:assert/strict';
import { executeTool, UnitValue, fileFixture } from '../helpers/host-runtime.mjs';
import { catalogs } from '../../src/apps/index.mjs';
import { commonTools } from '../../src/mcp/common-tools.mjs';
import { WORKFLOWS } from '../../src/mcp/workflows.mjs';

function photoshop() {
  const textLayer = {
    id: 7,
    name: 'Title',
    typename: 'ArtLayer',
    kind: 'text',
    allLocked: false,
    textItem: { contents: 'Old' },
    translate(x, y) {
      this.offset = [x.value, y.value];
    },
    duplicate() {
      return { id: 8, name: this.name + ' copy' };
    }
  };
  const d = {
    id: 1,
    name: 'Poster',
    width: new UnitValue(1920, 'px'),
    height: new UnitValue(1080, 'px'),
    resolution: 72,
    mode: 'RGB',
    bitsPerChannel: 8,
    activeLayer: textLayer,
    layers: [textLayer],
    duplicate(name, merge) {
      this.duplicateArguments = [name, merge];
      return { id: 2, name };
    },
    crop(bounds) {
      this.cropBounds = bounds;
      this.width = new UnitValue(bounds[2].value - bounds[0].value, 'px');
      this.height = new UnitValue(bounds[3].value - bounds[1].value, 'px');
    }
  };
  return {
    d,
    textLayer,
    globals: { app: { documents: [d], activeDocument: d }, UnitValue, LayerKind: { TEXT: 'text' } }
  };
}
test('Photoshop document inspection, duplication and text editing preserve explicit units and layer IDs', () => {
  const { d, textLayer, globals } = photoshop();
  assert.equal(executeTool('photoshop', 'get_document_info', {}, globals).width, 1920);
  assert.deepEqual(executeTool('photoshop', 'duplicate_document', { name: 'Variation' }, globals), {
    id: 2,
    name: 'Variation'
  });
  assert.deepEqual(d.duplicateArguments, ['Variation', false]);
  assert.deepEqual(
    executeTool('photoshop', 'duplicate_layer', { layerId: 7, name: 'Copy' }, globals),
    { id: 8, name: 'Copy' }
  );
  executeTool(
    'photoshop',
    'set_text_layer',
    { layerId: 7, contents: 'عنوان جدید', size: 36 },
    globals
  );
  assert.equal(textLayer.textItem.contents, 'عنوان جدید');
  assert.equal(textLayer.textItem.size.unit, 'pt');
  textLayer.kind = 'normal';
  assert.throws(
    () => executeTool('photoshop', 'set_text_layer', { layerId: 7, contents: 'bad' }, globals),
    /not a text layer/
  );
  assert.equal(textLayer.textItem.contents, 'عنوان جدید');
});
test('Photoshop movement and cropping reject locked or out-of-canvas edits before mutation', () => {
  const { d, textLayer, globals } = photoshop();
  executeTool('photoshop', 'translate_layer', { layerId: 7, dx: -10, dy: 20 }, globals);
  assert.deepEqual(textLayer.offset, [-10, 20]);
  textLayer.allLocked = true;
  assert.throws(
    () => executeTool('photoshop', 'translate_layer', { layerId: 7, dx: 100, dy: 100 }, globals),
    /locked/
  );
  assert.deepEqual(textLayer.offset, [-10, 20]);
  assert.throws(
    () => executeTool('photoshop', 'crop_document', { bounds: [0, 0, 2000, 100] }, globals),
    /exceed/
  );
  assert.equal(d.cropBounds, undefined);
  assert.deepEqual(
    executeTool('photoshop', 'crop_document', { bounds: [10, 20, 110, 220] }, globals),
    { width: 100, height: 200 }
  );
  assert.ok(d.cropBounds.every((v) => v.unit === 'px'));
});
test('Illustrator selection inspection supports text ranges and bounds preview output', () => {
  const d = { selection: { typename: 'TextRange', contents: 'x'.repeat(2000) } };
  const result = executeTool(
    'illustrator',
    'get_selection',
    {},
    { app: { documents: [d], activeDocument: d } }
  );
  assert.equal(result.total, 1);
  assert.equal(result.items[0].textPreview.length, 1000);
});
test('Illustrator layer and artboard indexes are one-based and invalid targets do not modify state', () => {
  const layers = [
    { name: 'First', visible: true, locked: false },
    { name: 'Second', visible: true, locked: true }
  ];
  const artboards = [{ name: 'A' }, { name: 'B' }];
  artboards.setActiveArtboardIndex = (i) => {
    artboards.active = i;
  };
  const d = { layers, artboards },
    globals = { app: { documents: [d], activeDocument: d } };
  executeTool(
    'illustrator',
    'set_layer',
    { layerIndex: 2, name: 'Renamed', locked: false, visible: false },
    globals
  );
  assert.equal(layers[0].name, 'First');
  assert.deepEqual(layers[1], { name: 'Renamed', visible: false, locked: false });
  executeTool('illustrator', 'activate_artboard', { artboardIndex: 2 }, globals);
  assert.equal(artboards.active, 1);
  assert.throws(
    () => executeTool('illustrator', 'activate_artboard', { artboardIndex: 3 }, globals),
    /not found/
  );
  assert.equal(artboards.active, 1);
});
test('Illustrator ellipse color conversion and PDF save semantics use native options', () => {
  const item = {},
    d = {
      pathItems: {
        ellipse: (...args) => {
          item.geometry = args;
          return item;
        }
      },
      saveAs: (file, options) => {
        d.saved = { file, options };
      }
    };
  const globals = {
    app: { documents: [d], activeDocument: d },
    RGBColor: function () {},
    PDFSaveOptions: function () {},
    File: fileFixture()
  };
  executeTool(
    'illustrator',
    'add_ellipse',
    { left: 10, top: 20, width: 50, height: 30, color: [1, 0.5, 0] },
    globals
  );
  assert.deepEqual(item.geometry, [20, 10, 50, 30]);
  assert.equal(item.fillColor.green, 127.5);
  assert.equal(item.stroked, false);
  executeTool(
    'illustrator',
    'save_as_pdf',
    { path: 'E:\\out.pdf', preserveEditability: false },
    globals
  );
  assert.equal(d.saved.options.preserveEditability, false);
  assert.equal(d.saved.options.viewAfterSaving, false);
});
test('Illustrator failed image placement removes the incomplete item', () => {
  let removed = false;
  const item = {
    set file(value) {
      throw new Error('Unsupported image');
    },
    remove() {
      removed = true;
    }
  };
  const d = { placedItems: { add: () => item } },
    globals = { app: { documents: [d], activeDocument: d }, File: fileFixture() };
  assert.throws(
    () => executeTool('illustrator', 'place_image', { path: 'E:\\source.png' }, globals),
    /Unsupported image/
  );
  assert.equal(removed, true);
});
test('InDesign document activation, inspection and link pagination use stable IDs', () => {
  const link = {
    id: 9,
    name: 'Image',
    filePath: 'E:\\source.png',
    status: 'modified',
    isValid: true
  };
  const links = [link];
  links.itemByID = (id) => (id === 9 ? link : { isValid: false });
  const d = {
    id: 2,
    name: 'Book',
    pages: [{}],
    stories: [{}, {}],
    links,
    saved: true,
    modified: true,
    isValid: true
  };
  const documents = [d];
  documents.itemByID = (id) => (id === 2 ? d : { isValid: false });
  const globals = { app: { documents, activeDocument: d } };
  assert.equal(executeTool('indesign', 'activate_document', { documentId: 2 }, globals).id, 2);
  assert.equal(executeTool('indesign', 'get_document_info', {}, globals).stories, 2);
  assert.deepEqual(executeTool('indesign', 'list_links', { offset: 1 }, globals), {
    total: 1,
    links: []
  });
  assert.throws(
    () => executeTool('indesign', 'activate_document', { documentId: 8 }, globals),
    /not found/
  );
  assert.equal(globals.app.activeDocument, d);
});
test('InDesign missing source links and existing IDML outputs are rejected before writes', () => {
  let updated = 0,
    exported = 0;
  const link = {
    isValid: true,
    id: 9,
    filePath: 'E:\\missing.png',
    update() {
      updated++;
    }
  };
  const d = {
      links: { itemByID: () => link },
      exportFile() {
        exported++;
      }
    },
    globals = {
      app: { documents: [d], activeDocument: d },
      File: fileFixture(['E:\\missing.png']),
      ExportFormat: { INDESIGN_MARKUP: 'idml' }
    };
  assert.throws(
    () => executeTool('indesign', 'update_link', { linkId: 9 }, globals),
    /Input does not exist/
  );
  assert.equal(updated, 0);
  assert.throws(
    () => executeTool('indesign', 'export_idml', { path: 'E:\\existing.idml' }, globals),
    /Output exists/
  );
  assert.equal(exported, 0);
  executeTool('indesign', 'export_idml', { path: 'E:\\out.idml' }, globals);
  assert.equal(exported, 1);
});

function afterEffects() {
  let workStart = 0,
    workDuration = 10;
  function CompItem() {}
  const writes = [],
    l = {
      index: 1,
      name: 'Text',
      locked: false,
      threeDLayer: false,
      startTime: 0,
      inPoint: 0,
      outPoint: 2,
      duplicate: () => ({ index: 1, name: 'Text copy' }),
      property: (name) =>
        name === 'ADBE Transform Group'
          ? {
              property: (property) => ({
                setValueAtTime: (time, value) => writes.push({ property, time, value })
              })
            }
          : {
              canAddProperty: (name) => name === 'ADBE Gaussian Blur 2',
              addProperty: () => ({
                name: 'Blur',
                matchName: 'ADBE Gaussian Blur 2',
                propertyIndex: 1
              })
            }
    };
  const c = new CompItem();
  Object.assign(c, {
    id: 1,
    name: 'Comp',
    width: 1920,
    height: 1080,
    frameRate: 30,
    frameDuration: 1 / 30,
    duration: 10,
    numLayers: 1,
    layer: () => l
  });
  Object.defineProperties(c, {
    workAreaStart: {
      get: () => workStart,
      set: (v) => {
        assert.ok(v + workDuration <= 10 + 1e-7);
        workStart = v;
      }
    },
    workAreaDuration: {
      get: () => workDuration,
      set: (v) => {
        assert.ok(workStart + v <= 10 + 1e-7);
        workDuration = v;
      }
    }
  });
  return { c, l, writes, globals: { app: { project: { numItems: 1, item: () => c } }, CompItem } };
}
test('After Effects work-area updates respect host setter invariants and reject invalid ranges without changes', () => {
  const { c, globals } = afterEffects();
  assert.equal(
    executeTool('after-effects', 'get_composition', { compIndex: 1 }, globals).width,
    1920
  );
  assert.deepEqual(
    executeTool('after-effects', 'set_work_area', { compIndex: 1, start: 8, duration: 2 }, globals),
    { start: 8, duration: 2 }
  );
  assert.deepEqual(
    executeTool('after-effects', 'set_work_area', { compIndex: 1, start: 1, duration: 8 }, globals),
    { start: 1, duration: 8 }
  );
  assert.throws(
    () =>
      executeTool(
        'after-effects',
        'set_work_area',
        { compIndex: 1, start: 8, duration: 3 },
        globals
      ),
    /exceeds/
  );
  assert.equal(c.workAreaStart, 1);
  assert.equal(c.workAreaDuration, 8);
});
test('After Effects transform keyframes validate value dimensions and ranges before writing', () => {
  const { writes, globals } = afterEffects(),
    base = { compIndex: 1, layerIndex: 1, time: 2 };
  assert.throws(
    () =>
      executeTool(
        'after-effects',
        'set_transform_keyframe',
        { ...base, property: 'position', value: 10 },
        globals
      ),
    /shape/
  );
  assert.throws(
    () =>
      executeTool(
        'after-effects',
        'set_transform_keyframe',
        { ...base, property: 'opacity', value: 101 },
        globals
      ),
    /Opacity/
  );
  assert.equal(writes.length, 0);
  executeTool(
    'after-effects',
    'set_transform_keyframe',
    { ...base, property: 'position', value: [100, 200] },
    globals
  );
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0])), {
    property: 'ADBE Position',
    time: 2,
    value: [100, 200]
  });
});
test('After Effects effect compatibility and layer timing are checked before mutation', () => {
  const { l, globals } = afterEffects(),
    base = { compIndex: 1, layerIndex: 1 };
  assert.throws(
    () => executeTool('after-effects', 'add_effect', { ...base, matchName: 'Unknown' }, globals),
    /unavailable/
  );
  assert.equal(
    executeTool(
      'after-effects',
      'add_effect',
      { ...base, matchName: 'ADBE Gaussian Blur 2' },
      globals
    ).index,
    1
  );
  assert.throws(
    () =>
      executeTool(
        'after-effects',
        'set_layer_timing',
        { ...base, inPoint: 4, outPoint: 2 },
        globals
      ),
    /Require/
  );
  assert.equal(l.inPoint, 0);
  executeTool('after-effects', 'set_layer_timing', { ...base, inPoint: 5, outPoint: 8 }, globals);
  assert.equal(l.inPoint, 5);
  assert.equal(l.outPoint, 8);
  assert.equal(
    executeTool('after-effects', 'duplicate_layer', { ...base, name: 'Variation' }, globals).name,
    'Variation'
  );
});
test('After Effects marker replacement requires explicit permission and template reads do not add queue items', () => {
  const { c, globals } = afterEffects();
  let writes = 0;
  c.markerProperty = {
    numKeys: 1,
    keyTime: () => 2,
    setValueAtTime: () => {
      writes++;
    }
  };
  globals.MarkerValue = function (comment) {
    this.comment = comment;
  };
  assert.throws(
    () =>
      executeTool(
        'after-effects',
        'add_composition_marker',
        { compIndex: 1, time: 2, comment: 'New' },
        globals
      ),
    /already exists/
  );
  assert.equal(writes, 0);
  executeTool(
    'after-effects',
    'add_composition_marker',
    { compIndex: 1, time: 2, comment: 'New', replaceExisting: true },
    globals
  );
  assert.equal(writes, 1);
  globals.app.project.renderQueue = {
    numItems: 1,
    item: () => ({ templates: ['Best'], outputModule: () => ({ templates: ['Lossless'] }) })
  };
  assert.deepEqual(
    executeTool('after-effects', 'get_render_templates', { queueIndex: 1 }, globals),
    { renderSettings: ['Best'], outputModules: ['Lossless'] }
  );
});

test('workflow recipes reference tools that actually exist on each server', () => {
  for (const [app, recipes] of Object.entries(WORKFLOWS)) {
    const names = new Set([...commonTools(app), ...catalogs[app]].map((t) => t.name));
    for (const recipe of recipes)
      for (const name of recipe.tools) assert.ok(names.has(name), `${app}: ${name}`);
  }
});
