import { start } from '../core/server.mjs';
import { tools } from '../apps/media-encoder.mjs';
start('media-encoder', tools).catch(error => { console.error(error.message); process.exit(1); });
