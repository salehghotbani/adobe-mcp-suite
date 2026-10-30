import { start } from '../mcp/server.mjs';
import { tools } from '../apps/indesign.mjs';
start('indesign', tools).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
