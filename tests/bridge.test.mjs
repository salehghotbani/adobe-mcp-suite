import test from 'node:test';
import assert from 'node:assert/strict';
import { Bridge } from '../src/core/bridge.mjs';
const token='a'.repeat(64);
async function bridge(t, timeoutMs=1000) {
  const b=await new Bridge({app:'photoshop',port:0,token,timeoutMs}).start();
  t.after(()=>b.close());
  return b;
}
async function request(b, route, body, auth=token, origin) {
  return fetch(`http://127.0.0.1:${b.config.port}/v1/${route}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json',...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
const panel={app:'photoshop',host:'PHXS',version:'27.0',instance:'panel-1'};
async function ready(b) {
  const promise=request(b,'poll',panel);
  for(let i=0;i<100&&!b.waiter;i++)await new Promise(r=>setTimeout(r,2));
  assert.ok(b.waiter);
  return {promise};
}
async function result(b,job,data) { const r=await request(b,'result',{id:job.id,instance:panel.instance,result:JSON.stringify({ok:true,data})}); assert.equal(r.status,200); }
test('bridge authenticates, denies web origins and rejects a different Adobe host',async t=>{
  const b=await bridge(t);
  assert.equal((await request(b,'status',null,'wrong')).status,401);
  assert.equal((await request(b,'status',null,token,'https://evil.example')).status,403);
  assert.equal((await request(b,'poll',{...panel,host:'ILST'})).status,409);
  const res=await request(b,'status',null,token,'null');assert.equal(res.headers.get('Access-Control-Allow-Origin'),'null');assert.equal((await res.json()).connected,false);
  await assert.rejects(b.execute('anything'),/Open Window/);
});
test('bridge serializes operations, decodes results and propagates native failures',async t=>{
  const b=await bridge(t);
  const first=await ready(b);
  const a=b.execute('first'), c=assert.rejects(b.execute('second'),/Layer locked/);
  const job=(await (await first.promise).json()).job; assert.equal(job.script,'first');
  const second=await ready(b); assert.equal(b.inflight.id,job.id); assert.equal(b.queue.length,1);
  await result(b,job,{ok:'first'});assert.deepEqual(await a,{ok:'first'});
  const job2=(await (await second.promise).json()).job;assert.equal(job2.script,'second');
  await request(b,'result',{id:job2.id,instance:panel.instance,result:JSON.stringify({ok:false,error:{message:'Layer locked'}})});
  await c;
});
test('dispatched timeout remains uncertain; queued timeout is never dispatched',async t=>{
  const b=await bridge(t,100);
  const next=await ready(b);
  const a=assert.rejects(b.execute('long'),/may still be running/);
  const queued=assert.rejects(b.execute('queued'),/was not executed/);
  const job=(await (await next.promise).json()).job;
  await Promise.all([a,queued]);
  assert.equal(b.status().uncertain,true);assert.equal(b.queue.length,0);
  await assert.rejects(b.execute('retry'),/Previous operation/);
  await result(b,job,'late');assert.equal(b.status().uncertain,false);
});
test('results from another panel cannot complete a job or steal the lease',async t=>{
  const b=await bridge(t);
  const next=await ready(b), operation=b.execute('script');
  const job=(await (await next.promise).json()).job;
  assert.equal((await request(b,'poll',{...panel,instance:'other'})).status,409);
  assert.equal((await request(b,'result',{id:job.id,instance:'other',result:'{}'})).status,404);
  assert.ok(b.inflight);
  await result(b,job,'done');assert.equal(await operation,'done');
});
