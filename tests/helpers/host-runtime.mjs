import vm from 'node:vm';
import { catalogs } from '../../src/apps/index.mjs';
import { buildScript, decodeResult } from '../../src/bridge/extendscript.mjs';

export function executeTool(app, name, args = {}, globals = {}) {
  const definition = catalogs[app].find((t) => t.name === name);
  if (!definition) throw new Error(`Unknown test tool: ${app}/${name}`);
  return decodeResult(
    vm.runInNewContext(buildScript(definition.body, definition.schema.parse(args)), globals)
  );
}

export function UnitValue(value, unit) {
  if (!(this instanceof UnitValue)) return new UnitValue(value, unit);
  this.value = value;
  this.unit = unit;
  this.as = () => value;
}

export function fileFixture(missing = []) {
  return function File(name) {
    this.fsName = name;
    this.exists = !missing.includes(name) && !/^.*[\\/]out\./.test(name);
    this.parent = {
      exists: true,
      fsName: name.slice(0, Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\')))
    };
  };
}
