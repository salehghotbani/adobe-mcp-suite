import { prepareProject } from '../src/setup/prepare.mjs';

await prepareProject();
console.error('Prepared seven CEP panels in build/cep. Tokens preserved on repeat setup.');
console.error('MCP client configuration: .adobe-mcp/mcp-servers.json');
