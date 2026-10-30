import { start } from '../core/server.mjs';
import { tools } from '../apps/premiere-pro.mjs';
start('premiere-pro', tools).catch(error => { console.error(error.message); process.exit(1); });
