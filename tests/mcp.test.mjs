import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { catalogs } from '../src/apps/index.mjs';
import { ROOT } from '../src/core/config.mjs';

for (const [app, tools] of Object.entries(catalogs)) {
  test(`${app}: real MCP stdio initialization, isolated catalog, validation and disconnected errors`,async()=>{
    // Reserve an ephemeral free port while retaining production configuration validation.
    const {createServer}=await import('node:net');const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));
    const port=socket.address().port;await new Promise(r=>socket.close(r));
    const transport=new StdioClientTransport({command:process.execPath,args:[path.join(ROOT,'src','servers',`${app}.mjs`)],env:{...process.env,ADOBE_MCP_PORT:String(port),ADOBE_MCP_TOKEN:'b'.repeat(64),ADOBE_MCP_ALLOW_SCRIPTS:'false'},stderr:'pipe'});
    const client=new Client({name:'adobe-suite-tests',version:'1.0.0'});
    try {
      await client.connect(transport);
      const catalog=await client.listTools();
      assert.equal(catalog.tools.length,tools.length+2);
      assert.equal(catalog.tools.some(t=>t.name==='run_script'),false);
      const status=await client.callTool({name:'connection_status',arguments:{}});
      assert.equal(JSON.parse(status.content[0].text).app,app);
      const result=await client.callTool({name:'get_app_info',arguments:{}});
      assert.equal(result.isError,true);assert.match(result.content[0].text,/Open Window/);
      const invalid=await client.callTool({name:'get_app_info',arguments:{unexpected:1}});
      assert.equal(invalid.isError,true);
    } finally { await client.close(); await transport.close(); }
  });
}
