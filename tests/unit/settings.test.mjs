import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, readConfiguration } from '../../src/config/settings.mjs';
import { temporaryProject } from '../helpers/temporary-project.mjs';

const token = 'valid-token-'.repeat(4);
test('settings apply per-process overrides without changing the saved connection', async (t) => {
  const root = await temporaryProject(t);
  const configPath = path.join(root, 'config.json');
  await writeFile(configPath, JSON.stringify({ photoshop: { port: 19102, token } }));
  const config = await loadConfig('photoshop', {
    configPath,
    env: {
      ADOBE_MCP_PORT: '20000',
      ADOBE_MCP_TIMEOUT_MS: '120000',
      ADOBE_MCP_ALLOW_SCRIPTS: 'true'
    }
  });
  assert.deepEqual(config, {
    app: 'photoshop',
    port: 20000,
    token,
    timeoutMs: 120000,
    allowScripts: true
  });
  assert.equal((await readConfiguration(configPath)).photoshop.port, 19102);
});
test('missing configuration supports explicit environment credentials and errors redact values', async (t) => {
  const root = await temporaryProject(t);
  const options = { configPath: path.join(root, 'missing.json'), env: { ADOBE_MCP_TOKEN: token } };
  assert.equal((await loadConfig('photoshop', options)).port, 19102);
  const badToken = 'sensitive\r\n'.repeat(4);
  await assert.rejects(
    loadConfig('photoshop', { ...options, env: { ADOBE_MCP_TOKEN: badToken } }),
    (error) => {
      assert.match(error.message, /token/);
      assert.equal(error.message.includes(badToken), false);
      return true;
    }
  );
  await assert.rejects(loadConfig('photoshop', { ...options, env: {} }), /token/);
  await assert.rejects(loadConfig('toString', options), /Unknown application/);
  await assert.rejects(
    loadConfig('photoshop', { ...options, env: { ADOBE_MCP_TOKEN: token, ADOBE_MCP_PORT: '0' } }),
    /port/
  );
  await assert.rejects(
    loadConfig('photoshop', {
      ...options,
      env: { ADOBE_MCP_TOKEN: token, ADOBE_MCP_TIMEOUT_MS: 'NaN' }
    }),
    /timeout/
  );
});
test('malformed or host-overriding saved configurations are rejected without exposing credentials', async (t) => {
  const root = await temporaryProject(t),
    file = path.join(root, 'config.json');
  await writeFile(file, '{"photoshop":{"token":"' + token + '"');
  await assert.rejects(readConfiguration(file), (error) => {
    assert.match(error.message, /JSON/);
    assert.equal(error.message.includes(token), false);
    return true;
  });
  await writeFile(file, JSON.stringify({ photoshop: { port: 19102, token, host: 'ILST' } }));
  await assert.rejects(readConfiguration(file), /Invalid local configuration/);
  await writeFile(file, JSON.stringify({ unknown: { port: 19102, token } }));
  await assert.rejects(readConfiguration(file), /Invalid local configuration/);
});
