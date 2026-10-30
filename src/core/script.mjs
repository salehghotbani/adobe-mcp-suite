// This function is serialized into the ES3 ExtendScript runtime; keep it ES3.
function hostRuntime(operation, params) {
  function quote(value) {
    return '"' + String(value).replace(/[\\"\u0000-\u001f\u2028\u2029]/g, function (ch) {
      var code = ch.charCodeAt(0).toString(16);
      return '\\u' + ('0000' + code).slice(-4);
    }) + '"';
  }
  function encode(value, depth) {
    if (depth > 24) throw new Error('Result exceeds serialization depth.');
    if (value === null || typeof value === 'undefined') return 'null';
    if (typeof value === 'string') return quote(value);
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return isFinite(value) ? String(value) : 'null';
    var parts = [], i, key;
    if (value instanceof Array) {
      for (i = 0; i < value.length; i++) parts.push(encode(value[i], depth + 1));
      return '[' + parts.join(',') + ']';
    }
    if (typeof value === 'object') {
      for (key in value) if (Object.prototype.hasOwnProperty.call(value, key)) parts.push(quote(key) + ':' + encode(value[key], depth + 1));
      return '{' + parts.join(',') + '}';
    }
    return quote(String(value));
  }
  var helpers = {
    require: function (condition, message) { if (!condition) throw new Error(message); },
    input: function (name) {
      var f = new File(name);
      if (!f.exists) throw new Error('Input does not exist: ' + name);
      return f;
    },
    output: function (name, overwrite) {
      var f = new File(name);
      if (!f.parent.exists) throw new Error('Output folder does not exist: ' + f.parent.fsName);
      if (f.exists && !overwrite) throw new Error('Output exists; set overwrite=true explicitly: ' + name);
      return f;
    }
  };
  try { return encode({ ok: true, data: operation(params, helpers) }, 0); }
  catch (error) { return encode({ ok: false, error: { message: String(error.message || error), line: error.line || null } }, 0); }
}

export function buildScript(body, params) {
  // JSON is emitted as a literal, never interpolated into executable source.
  const literal = JSON.stringify(params).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `(${hostRuntime.toString()})(function(p,h){\n${body}\n},${literal});`;
}

export function decodeResult(raw) {
  let result;
  try { result = JSON.parse(raw); } catch { throw new Error('Invalid Adobe response. Check the CEP panel and scripting support.'); }
  if (!result || typeof result.ok !== 'boolean') throw new Error('Malformed Adobe response.');
  if (!result.ok) throw new Error(`Adobe: ${result.error?.message || 'Script failed'}${result.error?.line ? ` (line ${result.error.line})` : ''}`);
  return result.data;
}
