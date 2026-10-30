import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogs } from '../../src/apps/index.mjs';
import { buildCatalog } from '../../src/catalog/build-catalog.mjs';
import { commonTools } from '../../src/mcp/common-tools.mjs';

test('catalog includes every registered default tool and explicitly marks arbitrary scripting as optional', () => {
  const { catalog, markdown } = buildCatalog();
  let defaults = 0;
  for (const [app, tools] of Object.entries(catalogs)) {
    assert.deepEqual(
      catalog[app].filter((t) => t.enabledByDefault).map((t) => t.name),
      [...commonTools(app), ...tools].map((t) => t.name)
    );
    assert.equal(catalog[app].find((t) => t.name === 'run_script').enabledByDefault, false);
    assert.equal(catalog[app].filter((t) => t.name === 'connection_status').length, 1);
    defaults += catalog[app].filter((t) => t.enabledByDefault).length;
  }
  assert.equal(defaults, 93);
  assert.match(markdown, /connection_status/);
});
