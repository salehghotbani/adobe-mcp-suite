import { start } from '../mcp/server.mjs';
import { tools } from '../apps/illustrator.mjs';
start('illustrator', tools).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
