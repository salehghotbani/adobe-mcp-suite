import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { APPS } from './apps.mjs';
import { decodeResult } from './script.mjs';

const pollSchema = z.object({ app: z.string(), host: z.string(), version: z.string().max(100), instance: z.string().min(1).max(100) }).strict();
const resultSchema = z.object({ id: z.string().uuid(), instance: z.string().min(1).max(100), result: z.string().max(4 * 1024 * 1024) }).strict();

export class Bridge {
  constructor(config) {
    this.config = config;
    this.queue = [];
    this.inflight = null;
    this.panel = null;
    this.waiter = null;
    this.closed = false;
    this.server = createServer((req, res) => { this.handle(req, res).catch(error => {
      if (!res.headersSent) this.send(res, error.status || 400, { error: error.message });
      else res.end();
    }); });
    this.server.requestTimeout = 30000;
    this.server.headersTimeout = 10000;
  }
  async start() {
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.config.port, '127.0.0.1', () => { this.server.off('error', reject); resolve(); });
    });
    this.config.port = this.server.address().port;
    return this;
  }
  status() {
    return { app: this.config.app, port: this.config.port,
      connected: !!this.panel && Date.now() - this.panel.seen < 30000,
      hostVersion: this.panel?.version || null,
      busy: !!this.inflight, uncertain: !!this.inflight?.expired, queued: this.queue.length };
  }
  send(res, status, data) {
    if (res.destroyed || res.writableEnded) return;
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  }
  async body(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) throw new Error('Request exceeds 8 MiB.');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  async handle(req, res) {
    const origin = req.headers.origin;
    if (origin && origin !== 'null' && origin !== 'file://') return this.send(res, 403, { error: 'Origin denied' });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const supplied = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from(`Bearer ${this.config.token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return this.send(res, 401, { error: 'Unauthorized' });
    if (req.url === '/v1/status' && req.method === 'GET') return this.send(res, 200, this.status());
    if (req.url === '/v1/poll' && req.method === 'POST') {
      const panel = pollSchema.parse(await this.body(req));
      if (panel.app !== this.config.app || panel.host !== APPS[this.config.app].host) return this.send(res, 409, { error: 'Wrong Adobe host' });
      if (this.panel && this.panel.instance !== panel.instance && (this.inflight || Date.now() - this.panel.seen < 30000)) return this.send(res, 409, { error: 'Another Adobe panel is connected. Close the duplicate panel.' });
      if (this.waiter) return this.send(res, 409, { error: 'Duplicate poll' });
      this.panel = { ...panel, seen: Date.now() };
      const timer = setTimeout(() => { if (this.waiter?.res === res) this.waiter = null; this.send(res, 200, { job: null }); }, 20000);
      this.waiter = { res, timer };
      res.on('close', () => { clearTimeout(timer); if (this.waiter?.res === res) this.waiter = null; });
      this.dispatch();
      return;
    }
    if (req.url === '/v1/result' && req.method === 'POST') {
      const result = resultSchema.parse(await this.body(req));
      const current = this.inflight;
      if (!current || current.id !== result.id || current.instance !== result.instance) return this.send(res, 404, { error: 'Unknown job' });
      clearTimeout(current.timer);
      this.inflight = null;
      if (!current.expired) {
        try { current.resolve(decodeResult(result.result)); } catch (error) { current.reject(error); }
      }
      if (this.panel) this.panel.seen = Date.now();
      this.send(res, 200, { accepted: true });
      this.dispatch();
      return;
    }
    return this.send(res, 404, { error: 'Not found' });
  }
  execute(script) {
    if (this.closed) return Promise.reject(new Error('Bridge is closed.'));
    if (!this.status().connected) return Promise.reject(new Error(`Open Window > Extensions > Adobe MCP — ${APPS[this.config.app].title} in Adobe, then retry.`));
    if (this.inflight?.expired) return Promise.reject(new Error('Previous operation timed out after dispatch. Its result is unknown; wait for Adobe to finish before retrying.'));
    if (this.queue.length >= 50) return Promise.reject(new Error('Adobe command queue is full.'));
    return new Promise((resolve, reject) => {
      const job = { id: randomUUID(), script, resolve, reject };
      job.timer = setTimeout(() => {
        if (this.inflight === job) {
          job.expired = true;
          reject(new Error('Adobe operation timed out after dispatch; it may still be running. Do not retry a modifying operation until you inspect Adobe.'));
        } else {
          this.queue = this.queue.filter(item => item !== job);
          reject(new Error('Operation timed out in queue and was not executed.'));
        }
      }, this.config.timeoutMs);
      this.queue.push(job);
      this.dispatch();
    });
  }
  dispatch() {
    if (this.inflight || !this.waiter || !this.queue.length) return;
    const waiter = this.waiter;
    this.waiter = null;
    clearTimeout(waiter.timer);
    const job = this.queue.shift();
    this.inflight = job;
    job.instance = this.panel.instance;
    this.send(waiter.res, 200, { job: { id: job.id, script: job.script } });
  }
  async close() {
    this.closed = true;
    if (this.waiter) { clearTimeout(this.waiter.timer); this.send(this.waiter.res, 503, { error: 'Bridge closing' }); this.waiter = null; }
    for (const job of [...this.queue, ...(this.inflight ? [this.inflight] : [])]) { clearTimeout(job.timer); if (!job.expired) job.reject(new Error('Bridge closed. A dispatched operation may still finish in Adobe.')); }
    this.queue = []; this.inflight = null;
    const done = new Promise(resolve => this.server.close(resolve));
    this.server.closeAllConnections();
    await done;
  }
}
