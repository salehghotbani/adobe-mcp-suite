(function () {
  'use strict';
  var config = window.ADOBE_MCP, enabled = true, completed = 0, idle = true, timer;
  var instance = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
  var cep = window.__adobe_cep__, host;
  var state = document.getElementById('state'), detail = document.getElementById('detail');
  function status(label, message, type) { state.textContent = label; state.className = type || ''; detail.textContent = message; }
  if (!config || !cep) { status('Unavailable', 'Load this extension inside the matching Adobe application.', 'error'); return; }
  try { host = JSON.parse(cep.getHostEnvironment()); }
  catch (error) { status('Unavailable', String(error), 'error'); return; }
  if (host.appId !== config.host) { status('Wrong host', 'This panel belongs to ' + config.title, 'error'); return; }
  document.getElementById('app').textContent = config.title;
  function request(route, body, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://127.0.0.1:' + config.port + '/v1/' + route, true);
    xhr.timeout = 26000;
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + config.token);
    xhr.onload = function () {
      if (xhr.status < 200 || xhr.status >= 300) { callback(new Error('Bridge HTTP ' + xhr.status), null, xhr.status); return; }
      try { callback(null, JSON.parse(xhr.responseText)); } catch (error) { callback(error); }
    };
    xhr.onerror = xhr.ontimeout = function () { callback(new Error('Waiting for the MCP server. Start it in your MCP client.')); };
    xhr.send(JSON.stringify(body));
  }
  function schedule(delay) {
    idle = true;
    clearTimeout(timer);
    if (enabled) timer = setTimeout(poll, delay);
    else status('Disconnected', 'Reconnect to accept new operations.');
  }
  function next() { schedule(150); }
  // Retain a completed result until acknowledged. Never repeat the Adobe script.
  function deliver(job, result) {
    request('result', {id:job.id, instance:instance, result:result}, function (error, data, httpStatus) {
      if (error && httpStatus !== 404) { status('Sending result', 'Retrying delivery; the operation will not be repeated.'); setTimeout(function () { deliver(job, result); }, 2000); return; }
      completed++;
      document.getElementById('count').textContent = completed + ' operations completed';
      status('Connected', httpStatus === 404 ? 'Server restarted; inspect Adobe before retrying the last operation.' : 'Ready for the next operation.', 'connected');
      next();
    });
  }
  function poll() {
    if (!enabled) return;
    idle = false;
    request('poll', {app:config.app, host:host.appId, version:host.appVersion || 'unknown', instance:instance}, function (error, data) {
      if (error) { status('Waiting', error.message, 'error'); schedule(2000); return; }
      status('Connected', 'Ready. Keep this panel open.', 'connected');
      if (!data.job) { next(); return; }
      status('Working', 'Adobe is executing an operation.');
      cep.evalScript(data.job.script, function (result) {
        result = String(result);
        if (result.length > 4 * 1024 * 1024) result = JSON.stringify({ok:false,error:{message:'Adobe result exceeds 4 MiB. Request a smaller page or narrower result.'}});
        deliver(data.job, result);
      });
    });
  }
  document.getElementById('toggle').onclick = function () {
    enabled = !enabled;
    this.textContent = enabled ? 'Disconnect' : 'Reconnect';
    // An outstanding poll may already receive a job; complete it before stopping.
    if (enabled && idle) schedule(0);
    else status('Disconnecting', 'Any operation already received will finish.');
  };
  poll();
}());
