import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildScript, decodeResult } from '../src/core/script.mjs';
import { catalogs } from '../src/apps/index.mjs';
import { filePath } from '../src/core/tool.mjs';

function execute(body, params = {}, globals = {}) {
  return decodeResult(vm.runInNewContext(buildScript(body, params), globals));
}
test('host runtime preserves Persian, paths, quotes, arrays and control characters without JSON globals', () => {
  const input = { text: 'سلام "Adobe"\n\t\\\u2028\u2029', path: 'E:\\پروژه\\file.psd', a: [true, null, 1, { x: 'y' }] };
  assert.deepEqual(execute('return p;', input, { JSON: undefined }), input);
});
test('parameters cannot become host code', () => {
  const input = { text: '"); app.dangerous(); //', constructor: 'literal', value: ');throw new Error("injected")' };
  assert.deepEqual(execute('return p;', input), input);
});
test('native failures become actionable errors and non-JSON output is rejected', () => {
  assert.throws(() => execute('throw new Error("No document");'), /Adobe: No document/);
  assert.throws(() => decodeResult('EvalScript error.'), /Invalid Adobe response/);
  assert.throws(() => decodeResult('{}'), /Malformed Adobe response/);
});
test('host checks input existence, output parent and explicit overwrite before writing', () => {
  let exists = true, parentExists = true;
  function File(name) { this.fsName = name; this.exists = exists; this.parent = { exists: parentExists, fsName: '/output' }; }
  assert.throws(() => execute('return h.output(p.path,p.overwrite).fsName;', {path:'/output/a.psd',overwrite:false}, {File}), /Output exists/);
  assert.equal(execute('return h.output(p.path,p.overwrite).fsName;', {path:'/output/a.psd',overwrite:true}, {File}), '/output/a.psd');
  parentExists = false;
  assert.throws(() => execute('return h.output(p.path,true);', {path:'/missing/a.psd'}, {File}), /folder does not exist/);
  exists = false;
  assert.throws(() => execute('return h.input(p.path);', {path:'/missing/a.psd'}, {File}), /Input does not exist/);
});
test('schemas reject relative paths, network shares, invalid dimensions and unexpected fields', () => {
  for (const p of ['relative.psd','\\\\server\\file.psd','//server/file.psd','C:\\x\u0000.psd']) assert.equal(filePath.safeParse(p).success, false);
  for (const p of ['E:\\media\\clip.mp4','/Users/test/image.png']) assert.equal(filePath.safeParse(p).success, true);
  const create = catalogs.photoshop.find(t => t.name === 'create_document');
  assert.equal(create.schema.safeParse({name:'x',width:-1,height:10}).success, false);
  assert.equal(create.schema.safeParse({name:'x',width:10,height:10,extra:true}).success, false);
});
test('Audition uses real command discovery and sample-based playhead positions', () => {
  const list = catalogs.audition.find(t => t.name === 'list_commands');
  const Application = { COMMAND_FILE_SAVE: 'file.save', reflect: { properties: [{name:'COMMAND_FILE_SAVE',help:'Save audio'},{name:'not_a_command'}] } };
  assert.deepEqual(execute(list.body, list.schema.parse({query:'save'}), {Application}), {total:1,commands:[{property:'COMMAND_FILE_SAVE',id:'file.save',help:'Save audio'}]});
  const set = catalogs.audition.find(t => t.name === 'set_playhead');
  const activeDocument = {reflect:{name:'WaveDocument'},sampleRate:48000,duration:480000,playheadPosition:0};
  assert.deepEqual(execute(set.body,{seconds:2.5},{app:{activeDocument}}),{seconds:2.5});
  assert.equal(activeDocument.playheadPosition,120000);
  assert.throws(()=>execute(set.body,{seconds:11},{app:{activeDocument}}),/exceeds/);
});
test('Media Encoder queues a job without starting or claiming completion', () => {
  const t = catalogs['media-encoder'].find(t => t.name === 'add_to_queue');
  let args;
  function File(name) { this.fsName = name; this.exists = !name.endsWith('out.mp4'); this.parent={exists:true}; }
  const app = {getFrontend:()=>({addFileToBatch:(...a)=>{args=a;return {};}})};
  const result=execute(t.body,t.schema.parse({source:'E:\\in.mp4',preset:'E:\\preset.epr',path:'E:\\out.mp4'}),{app,File});
  assert.equal(result.queued,true);
  assert.deepEqual(args,['E:\\in.mp4','','E:\\preset.epr','E:\\out.mp4']);
  assert.equal(result.completed,undefined);
});
test('After Effects accepts concrete footage classes without relying on a nonexistent AVItem constructor', () => {
  function CompItem() { this.layers={add:source=>({index:1,name:source.name})}; }
  function FootageItem() { this.name='Media'; }
  const comp=new CompItem(),footage=new FootageItem();
  const app={project:{numItems:2,item:i=>[comp,footage][i-1]}};
  const t=catalogs['after-effects'].find(t=>t.name==='add_footage_layer');
  assert.deepEqual(execute(t.body,{compIndex:1,itemIndex:2},{app,CompItem,FootageItem}),{index:1,name:'Media'});
  assert.throws(()=>execute(t.body,{compIndex:1,itemIndex:1},{app,CompItem,FootageItem}),/inside itself/);
});
