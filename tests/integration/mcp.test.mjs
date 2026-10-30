import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogs } from '../../src/apps/index.mjs';
import { mcpSession } from '../helpers/mcp-session.mjs';

for (const [app, tools] of Object.entries(catalogs)) {
  test(`${app}: real MCP stdio initialization, isolated catalog, validation and disconnected errors`, async (t) => {
    const client = await mcpSession(t, app);
    const catalog = await client.listTools();
    assert.equal(catalog.tools.length, tools.length + 2);
    assert.equal(
      catalog.tools.some((t) => t.name === 'run_script'),
      false
    );
    const status = await client.callTool({ name: 'connection_status', arguments: {} });
    assert.equal(JSON.parse(status.content[0].text).app, app);
    const result = await client.callTool({ name: 'get_app_info', arguments: {} });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Open Window/);
    const invalid = await client.callTool({ name: 'get_app_info', arguments: { unexpected: 1 } });
    assert.equal(invalid.isError, true);
  });
}

test('arbitrary scripting is exposed only through explicit opt-in and still requires a connected host', async (t) => {
  const client = await mcpSession(t, 'photoshop', { allowScripts: true });
  assert.equal(
    (await client.listTools()).tools.filter((tool) => tool.name === 'run_script').length,
    1
  );
  const result = await client.callTool({ name: 'run_script', arguments: { code: 'return 42;' } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Open Window/);
});
