import { start } from '../mcp/server.mjs';
import { tools } from '../apps/after-effects.mjs';
start('after-effects', tools).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
