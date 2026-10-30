import { start } from '../core/server.mjs';
import { tools } from '../apps/audition.mjs';
start('audition', tools).catch(error => { console.error(error.message); process.exit(1); });
