import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogs } from '../../src/apps/index.mjs';
import { mcpSession } from '../helpers/mcp-session.mjs';

for (const app of Object.keys(catalogs))
  test(`${app}: resources and prompts work without Adobe and reveal only this server's tools`, async (t) => {
    const client = await mcpSession(t, app);
    const tools = (await client.listTools()).tools;
    assert.equal((await client.listResources()).resources.length, 2);
    const resource = await client.readResource({ uri: `adobe-mcp://${app}/catalog` });
    const described = JSON.parse(resource.contents[0].text);
    assert.deepEqual(
      described.tools.map((t) => t.name),
      tools.map((t) => t.name)
    );
    assert.equal(described.arbitraryScriptingEnabled, false);
    assert.equal(JSON.stringify(described).includes('b'.repeat(64)), false);
    const guide = await client.readResource({ uri: `adobe-mcp://${app}/workflows` });
    assert.match(guide.contents[0].text, /connection_status/);
    assert.deepEqual((await client.listPrompts()).prompts.map((p) => p.name).sort(), [
      'diagnose_connection',
      'plan_workflow'
    ]);
    const plan = await client.getPrompt({
      name: 'plan_workflow',
      arguments: { goal: 'Review this project', context: 'Use disposable test media.' }
    });
    assert.match(plan.messages[0].content.text, /Review this project/);
    const diagnostic = await client.getPrompt({ name: 'diagnose_connection' });
    assert.match(diagnostic.messages[0].content.text, /"connected": false/);
    await assert.rejects(client.getPrompt({ name: 'plan_workflow', arguments: { goal: '' } }));
  });

test('catalog resources include optional scripting only when it is enabled', async (t) => {
  const client = await mcpSession(t, 'photoshop', { allowScripts: true });
  const described = JSON.parse(
    (await client.readResource({ uri: 'adobe-mcp://photoshop/catalog' })).contents[0].text
  );
  assert.equal(described.arbitraryScriptingEnabled, true);
  assert.equal(
    described.tools.some((t) => t.name === 'run_script'),
    true
  );
});
