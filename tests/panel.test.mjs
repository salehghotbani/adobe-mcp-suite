import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Bridge } from '../src/core/bridge.mjs';
import { buildScript } from '../src/core/script.mjs';

test('actual CEP panel code polls, evaluates once, and retries result delivery without repeating mutations',async t=>{
  const token='c'.repeat(64), b=await new Bridge({app:'photoshop',port:0,token,timeoutMs:5000}).start();
  const timers=new Set(),controllers=new Set();let failResult=true,evaluations=0;
  t.after(async()=>{for(const timer of timers)clearTimeout(timer);for(const ctrl of controllers)ctrl.abort();await b.close();});
  const elements={};const document={getElementById:id=>elements[id]||(elements[id]={textContent:'',className:''})};
  class XMLHttpRequest {
    open(method,url){this.method=method;this.url=url;this.headers={};}
    setRequestHeader(k,v){this.headers[k]=v;}
    async send(body){
      if(this.url.endsWith('/result')&&failResult){failResult=false;this.onerror();return;}
      const controller=new AbortController();controllers.add(controller);
      try{const r=await fetch(this.url,{method:this.method,headers:{...this.headers,Origin:'null'},body,signal:controller.signal});this.status=r.status;this.responseText=await r.text();this.onload();}
      catch(e){if(!controller.signal.aborted)this.onerror();}
      finally{controllers.delete(controller);}
    }
  }
  const app={name:'Photoshop test host',version:'27.0',mutations:0};
  const context={document,XMLHttpRequest,setTimeout:(fn,ms)=>{const timer=setTimeout(()=>{timers.delete(timer);fn();},ms);timers.add(timer);return timer;},clearTimeout};
  context.window={ADOBE_MCP:{app:'photoshop',title:'Photoshop',host:'PHXS',port:b.config.port,token},__adobe_cep__:{getHostEnvironment:()=>JSON.stringify({appId:'PHXS',appVersion:'27.0'}),evalScript:(script,callback)=>{evaluations++;callback(vm.runInNewContext(script,{app}));}}};
  vm.runInNewContext(await readFile(new URL('../cep/panel.js',import.meta.url),'utf8'),context);
  for(let i=0;i<100&&!b.waiter;i++)await new Promise(r=>setTimeout(r,5));
  assert.ok(b.waiter);
  const result=await b.execute(buildScript('app.mutations++;return {count:app.mutations,text:p.text};',{text:'آزمون اتصال'}));
  assert.deepEqual(result,{count:1,text:'آزمون اتصال'});
  assert.equal(evaluations,1);assert.equal(app.mutations,1);
  for(let i=0;i<100&&!elements.count;i++)await new Promise(r=>setTimeout(r,5));
  assert.equal(elements.count.textContent,'1 operations completed');
});
