import { start } from '../core/server.mjs';
import { tools } from '../apps/photoshop.mjs';
start('photoshop', tools).catch(error => { console.error(error.message); process.exit(1); });
