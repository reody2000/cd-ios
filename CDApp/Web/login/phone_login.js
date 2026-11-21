
(function () {
  'use strict';

  var Bridge = (typeof AndroidBridge !== 'undefined') ? AndroidBridge : null;
  function brLog(tag, msg) { try { if (Bridge && Bridge.log) Bridge.log(tag, String(msg)); } catch (e) {} console.log('[' + tag + ']', msg); }
  function toast(msg) { try { if (Bridge && Bridge.toast) Bridge.toast(String(msg)); } catch (e) {} }
  function finishAll(msg) { if (Bridge && Bridge.finishAll) Bridge.finishAll(String(msg || '')); else window.close(); }

  var $status = document.getElementById('status');
  var $log = document.getElementById('log');
  var $roleRequestBanner = document.getElementById('roleRequestBanner');
  var $roleList = document.getElementById('roleList');
  var $roleCount = document.getElementById('roleCount');
  var $roleMask = document.getElementById('roleMask');
  var $chkAll = document.getElementById('chkAll');
  var $selInfo = document.getElementById('selInfo');
  var $btnDlgOk = document.getElementById('btnDlgOk');
  var $btnDlgCancel = document.getElementById('btnDlgCancel');

  function setStatus(text, type) { $status.textContent = text; $status.className = 'status ' + (type || 'info'); }
  function showRoleRequest() {
    if ($roleRequestBanner) $roleRequestBanner.classList.add('show');
    setStatus('正在请求角色', 'info');
  }
  function hideRoleRequest() {
    if ($roleRequestBanner) $roleRequestBanner.classList.remove('show');
  }
  function appendLog(text, kind) {
    var p = document.createElement('div');
    p.className = 'log-line' + (kind ? (' ' + kind) : '');
    p.textContent = '[' + new Date().toLocaleTimeString() + '] ' + text;
    $log.appendChild(p); $log.classList.add('show'); $log.scrollTop = $log.scrollHeight;
  }

  // Base64 / ArrayBuffer
  function abToB64(buf) { var u8 = (buf instanceof Uint8Array) ? buf : new Uint8Array(buf); var s = ''; for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function b64ToU8(b64) { var bin = atob(b64 || ''); var u8 = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }
  function u8ToHex(u8, n) { n = Math.min(n || 32, u8.length); var s = ''; for (var i = 0; i < n; i++) { var h = u8[i].toString(16); if (h.length < 2) h = '0' + h; s += h; } return s; }

  // encodePayload (与 wxqrcode 完全一致)
  var CIPHER_TABLE = "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";
  var XOR_SHIFT = 1, SHUFFLE_TIMES = 6, STEP = 3;
  function encodeBase64(text) { return text ? btoa(unescape(encodeURIComponent(text))) : null; }
  function rightSide(s) { return s.substring(s.length / 2); }
  function leftSide(s) { return s.substring(0, s.length / 2); }
  function transCode(s, t) { if (t <= 0) return s; return transCode(rightSide(s), t - 1) + transCode(leftSide(s), t - 1); }
  function getCodeKey(s, step) { var o = '', n = Math.floor(s.length / step); for (var i = 0; i < n; i++) o += s.charAt(i * step); return o; }
  function dealWithString(src, key, shift) { if (!src || !key) return null; var o = '', idx = key.length >> shift; for (var i = 0; i < src.length; i++) { if (idx >= key.length) idx = 0; o += String.fromCharCode(src.charCodeAt(i) ^ key.charCodeAt(idx)); idx++; } return o; }
  function encodePayload(text) { var b64 = encodeBase64(text); var shuffled = transCode(CIPHER_TABLE, SHUFFLE_TIMES); var key = getCodeKey(shuffled, STEP); return encodeBase64(dealWithString(b64, key, XOR_SHIFT)); }

  // proxyPost (走 AndroidBridge)
  function proxyPost(url, headers, body, contentType) {
    return new Promise(function (resolve, reject) {
      if (!Bridge || !Bridge.proxyPost) return reject(new Error('AndroidBridge 不可用'));
      var bodyB64;
      if (body == null) bodyB64 = '';
      else if (typeof body === 'string') bodyB64 = btoa(unescape(encodeURIComponent(body)));
      else if (body instanceof ArrayBuffer || body instanceof Uint8Array) bodyB64 = abToB64(body);
      else bodyB64 = btoa(unescape(encodeURIComponent(String(body))));
      var rawJson = Bridge.proxyPost(url, JSON.stringify(headers || {}), bodyB64, contentType || '');
      var r = JSON.parse(rawJson || '{}');
      if (r.status === 0) return reject(new Error(r.error || 'proxyPost failed'));
      var u8 = b64ToU8(r.bodyBase64 || '');
      var text = ''; try { text = new TextDecoder('utf-8').decode(u8); } catch (e) { for (var i = 0; i < u8.length; i++) text += String.fromCharCode(u8[i]); }
      resolve({ status: r.status, statusText: r.statusText, headers: r.headers, text: text, raw: u8 });
    });
  }

  // GameCrypto
  function encodeBin(obj) {
    var GC = window.GameCrypto;
    if (!GC || !GC.encMsg) throw new Error('GameCrypto.encMsg 不可用');
    var buf = GC.encMsg(obj, { decrypt: GC.lz4XorDecode, encrypt: GC.lz4XorEncode });
    var src = (buf instanceof Uint8Array) ? buf : new Uint8Array(buf);
    var out = new Uint8Array(src.length); out.set(src);
    return out;
  }
  function getAutoEnc() {
    var GC = window.GameCrypto;
    return {
      encrypt: function (e) { return GC.xorEncode(e); },
      decrypt: function (e) {
        if (e.length > 4 && e[0] === 0x70 && e[1] === 0x6c) return GC.lz4XorDecode(e);
        if (e.length > 4 && e[0] === 0x70 && e[1] === 0x78) return GC.xorDecode(e);
        if (e.length > 3 && e[0] === 0x70 && e[1] === 0x74 && GC.getEncryptor) { var xtm = GC.getEncryptor('xtm'); if (xtm && xtm.decrypt) return xtm.decrypt(e); }
        return e;
      }
    };
  }
  function getRolePower(role) {
    return Number(role && (role.power || role.fightPower || role.combatPower || role.zhanli || role.fighting)) || 0;
  }

  function formatPower(value) {
    var n = Number(value) || 0;
    function trim(v) { return v.toFixed(2).replace(/\.?0+$/, ''); }
    if (Math.abs(n) >= 100000000) return trim(n / 100000000) + '亿';
    if (Math.abs(n) >= 10000) return trim(n / 10000) + '万';
    return String(n);
  }

  function getServerList(arrBuf) {
    return proxyPost('/api/xxz/login/serverlist?_seq=3', { 'Accept': '*/*' }, arrBuf, 'application/octet-stream')
      .then(function (resp) {
        appendLog('serverlist HTTP ' + resp.status, resp.status === 200 ? 'ok' : 'err');
        if (resp.status !== 200) throw new Error('serverlist HTTP ' + resp.status);
        var raw = resp.raw || new Uint8Array(0);
        if (raw.length === 0) throw new Error('serverlist 响应为空');
        var GC = window.GameCrypto;
        var msg = GC.decMsg(raw, getAutoEnc());
        if (!msg) throw new Error('decMsg 返回 null');
        var data = null;
        try { data = msg.rawData; } catch (e) {}
        if (!data && msg && msg._raw) data = msg._raw;
        if (!data) return [];
        if (data.code && data.code !== 0) throw new Error('serverlist code=' + data.code);
        if (!data.roles && data.body) {
          try { var inner = GC.bon ? GC.bon.decode(data.body instanceof Uint8Array ? data.body : new Uint8Array(data.body)) : null; if (inner && inner.roles) data = inner; } catch (e) {}
        }
        if (!data.roles) return [];
        var rolesObj = data.roles;
        var arr = [];
        if (rolesObj instanceof Map) { rolesObj.forEach(function (v) { arr.push(v); }); }
        else if (Array.isArray(rolesObj)) { arr = rolesObj; }
        else { Object.keys(rolesObj).forEach(function (k) { arr.push(rolesObj[k]); }); }
        arr.sort(function (a, b) { return getRolePower(b) - getRolePower(a); });
        return arr;
      });
  }

  // 角色弹窗
  var state = { busy: false, nickname: '', combUser: null, originalBinData: null, roles: [] };

  function getRoleServerId(role) {
    return role && (role.serverId || role.sid || role.server || 0);
  }

  function formatServer(sid) {
    var rawServerId = Number(sid) || 0;
    var baseServerId = rawServerId;
    var ri = 0;
    if (baseServerId >= 2000000) {
      ri = 2;
      baseServerId -= 2000000;
    } else if (baseServerId >= 1000000) {
      ri = 1;
      baseServerId -= 1000000;
    }
    var displayServerId = baseServerId > 1000 ? baseServerId - 27 : baseServerId;
    return { rawServerId: rawServerId, baseServerId: baseServerId, serverId: displayServerId, roleIndex: ri };
  }

  function buildFileName(role) {
    var serverInfo = formatServer(getRoleServerId(role));
    var serverId = serverInfo.serverId || serverInfo.rawServerId || 0;
    return ((role.name || ('角色_' + role.roleId)) + '-区服' + serverId).replace(/[\\/:*?"<>|]+/g, '_');
  }

  function renderRoleList(roles) {
    $roleList.innerHTML = '';
    $roleCount.textContent = '共 ' + roles.length + ' 个';
    roles.forEach(function (role, idx) {
      var item = document.createElement('label'); item.className = 'role-item checked';
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.idx = String(idx); cb.checked = true;
      cb.addEventListener('change', function () {
        item.classList.toggle('checked', cb.checked);
        updateSelInfo();
      });
      var meta = document.createElement('div'); meta.className = 'meta';
      var nm = document.createElement('div'); nm.className = 'name'; nm.textContent = role.name || ('角色_' + role.roleId);
      var inf = document.createElement('div'); inf.className = 'info';
      var serverInfo = formatServer(getRoleServerId(role));
      var server = document.createElement('span'); server.className = 'badge'; server.textContent = '区服 ' + (serverInfo.serverId || '?');
      var pwr = document.createElement('span'); pwr.className = 'pwr'; pwr.textContent = '战力 ' + formatPower(getRolePower(role));
      var rid = document.createElement('span'); rid.className = 'rid'; rid.textContent = 'ID ' + (role.roleId || '');
      inf.appendChild(server); inf.appendChild(pwr);
      if (role.roleId) inf.appendChild(rid);
      meta.appendChild(nm); meta.appendChild(inf);
      item.appendChild(cb); item.appendChild(meta);
      $roleList.appendChild(item);
    });
    updateSelInfo();
  }
  function updateSelInfo() {
    var cbs = $roleList.querySelectorAll('input[type=checkbox]');
    var cnt = 0; cbs.forEach(function (c) { if (c.checked) cnt++; });
    $selInfo.textContent = '已选 ' + cnt + ' / ' + cbs.length;
    $chkAll.checked = cnt === cbs.length && cnt > 0;
  }
  $chkAll.addEventListener('change', function () {
    var cbs = $roleList.querySelectorAll('input[type=checkbox]');
    cbs.forEach(function (c) {
      c.checked = $chkAll.checked;
      var item = c.closest('.role-item');
      if (item) item.classList.toggle('checked', $chkAll.checked);
    });
    updateSelInfo();
  });
  function showRoleDialog(roles) {
    hideRoleRequest();
    state.roles = roles;
    renderRoleList(roles);
    $roleMask.classList.add('show');
  }
  $btnDlgCancel.addEventListener('click', function () { $roleMask.classList.remove('show'); state.busy = false; });
  $btnDlgOk.addEventListener('click', function () {
    var cbs = $roleList.querySelectorAll('input[type=checkbox]');
    var picks = [];
    cbs.forEach(function (c) { if (c.checked) picks.push(Number(c.dataset.idx)); });
    if (picks.length === 0) { toast('请至少选择一个角色'); return; }
    $roleMask.classList.remove('show');
    importPickedRoles(picks);
  });

  function importPickedRoles(indices) {
    var ok = 0, fail = 0, total = indices.length;
    setStatus('正在导入 0 / ' + total + ' …', 'info');
    function next(i) {
      if (i >= total) {
        setStatus('导入完成：成功 ' + ok + '，失败 ' + fail, ok > 0 ? 'ok' : 'err');
        state.busy = false;
        if (ok > 0) setTimeout(function () { finishAll('导入成功 ' + ok + ' 个角色'); }, 1500);
        return;
      }
      var role = state.roles[indices[i]];
      var binData = JSON.parse(JSON.stringify(state.originalBinData));
      binData.serverId = Number(getRoleServerId(role)) || 0;
      try {
        var u8 = encodeBin(binData);
        var b64 = abToB64(u8);
        var fname = buildFileName(role);
        var res = Bridge.saveBin(fname, b64);
        var r = JSON.parse(res || '{}');
        if (r.ok) { ok++; appendLog('✓ ' + fname, 'ok'); }
        else { fail++; appendLog('✗ ' + fname + ': ' + (r.error || ''), 'err'); }
      } catch (e) { fail++; appendLog('✗ ' + (role.name || '') + ': ' + e.message, 'err'); }
      setStatus('正在导入 ' + (i + 1) + ' / ' + total + ' …', 'info');
      setTimeout(function () { next(i + 1); }, 50);
    }
    next(0);
  }

  // ============================================================
  //  手机号登录逻辑
  // ============================================================
  var $phoneInput = document.getElementById('phoneInput');
  var $codeInput = document.getElementById('codeInput');
  var $btnSendCode = document.getElementById('btnSendCode');
  var $btnLogin = document.getElementById('btnLogin');
  var $btnCancel = document.getElementById('btnCancel');
  var activeLoginMatchId = null;

  function generateLoginMatchId() {
    return Date.now() + '_DID-' + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) {
      return (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16);
    });
  }

  $btnSendCode.addEventListener('click', function () {
    var phone = $phoneInput.value.trim();
    if (!/^1\d{10}$/.test(phone)) { setStatus('请输入正确的11位手机号', 'err'); return; }
    $btnSendCode.disabled = true;
    setStatus('正在发送验证码...', 'info');
    activeLoginMatchId = generateLoginMatchId();
    var reqData = JSON.stringify({
      gameId: 'xyzwapp', gameTp: 'app', accountNum: phone,
      sysInfo: JSON.stringify({ system: 'Android 12', hortorSDKVersion: '4.2.1-cn-release', model: '22081212C', brand: 'Redmi' }),
      activeLoginMatchId: activeLoginMatchId, channel: 'android', verifyCodeTp: 'login',
      distinctId: activeLoginMatchId.split('_')[1],
      oaidThirdSdk: '', ipv6: '', limit: true,
      packageName: 'com.hortor.games.xyzw',
      signPrint: 'E6:F7:FE:A9:EC:8E:24:D0:4F:2A:32:50:28:78:E1:C5:5E:70:81:13',
      androidId: '554e4fb740b853e1', oaId: '', oaid: ''
    });
    proxyPost('/api/ucenter/ucenter-app-server/api/v1/login/verify/code', { 'Content-Type': 'application/json; charset=utf-8' }, reqData, 'application/json; charset=utf-8')
      .then(function (resp) {
        if (resp.status !== 200) throw new Error('HTTP ' + resp.status);
        var json = JSON.parse(resp.text);
        if (json.meta && json.meta.errCode !== 0) throw new Error(json.meta.errMsg || '发送失败');
        if (json.data && json.data.sendSuccess) {
          setStatus('验证码已发送，请查看短信', 'ok');
          var sec = json.data.waitSecond || 60;
          var timer = setInterval(function () { sec--; if (sec <= 0) { clearInterval(timer); $btnSendCode.disabled = false; $btnSendCode.textContent = '获取验证码'; } else { $btnSendCode.textContent = '(' + sec + 's)'; } }, 1000);
        } else { throw new Error(json.data && json.data.msg || '发送失败'); }
      }).catch(function (e) { setStatus('发送失败: ' + e.message, 'err'); $btnSendCode.disabled = false; });
  });

  $btnLogin.addEventListener('click', function () {
    var phone = $phoneInput.value.trim(), code = $codeInput.value.trim();
    if (!phone || !code) { setStatus('请输入手机号和验证码', 'err'); return; }
    if (!activeLoginMatchId) { setStatus('请先获取验证码', 'err'); return; }
    $btnLogin.disabled = true;
    setStatus('正在验证登录...', 'info');

    var payload = JSON.stringify({
      gameId: 'xyzwapp', gameTp: 'app',
      sysInfo: JSON.stringify({ system: 'Android 12', hortorSDKVersion: '4.2.1-cn-release', model: '22081212C', brand: 'Redmi' }),
      activeLoginMatchId: activeLoginMatchId, smsCode: code, mobile: phone,
      channel: 'android', distinctId: activeLoginMatchId.split('_')[1],
      oaidThirdSdk: '', ipv6: '', packageName: 'com.hortor.games.xyzw',
      signPrint: 'E6:F7:FE:A9:EC:8E:24:D0:4F:2A:32:50:28:78:E1:C5:5E:70:81:13',
      tp: 'app-mobile', androidId: '554e4fb740b853e1', oaId: '', oaid: ''
    });
    var encoded;
    try { encoded = encodePayload(payload); } catch (e) { setStatus('加密失败: ' + e.message, 'err'); $btnLogin.disabled = false; return; }

    var loginUrl = '/api/hortor/comb-login-server/api/v1/login?gameId=xyzwapp&timestamp=' + Date.now()
      + '&version=android-4.2.1-cn-release&cryptVersion=1.1.0&gameTp=app&system=android'
      + '&deviceUniqueId=' + activeLoginMatchId.split('_')[1] + '&packageName=com.hortor.games.xyzw';

    proxyPost(loginUrl, { 'Accept': '*/*' }, encoded, 'text/plain; charset=utf-8')
      .then(function (resp) {
        if (resp.status !== 200) throw new Error('HTTP ' + resp.status);
        var json = JSON.parse(resp.text);
        if (!json || !json.meta || json.meta.errCode !== 0) throw new Error(json && json.meta && json.meta.errMsg || '登录失败');
        var combUser = json.data && json.data.combUser;
        if (!combUser) throw new Error('缺少 combUser');
        appendLog('登录成功', 'ok');
        showRoleRequest();
        state.combUser = combUser; state.nickname = phone; state.busy = true;
        var binData = { platform: 'hortor', platformExt: 'mix', info: combUser, serverId: 0, scene: 0, referrerInfo: '', deviceUniqueId: '' };
        var u8 = encodeBin(binData);
        state.originalBinData = binData;
        return getServerList(u8.buffer);
      })
      .then(function (roles) {
        if (!roles || roles.length === 0) throw new Error('没有获取到角色');
        hideRoleRequest();
        setStatus('请选择要导入的角色（' + roles.length + ' 个）', 'ok');
        showRoleDialog(roles);
      })
      .catch(function (e) {
        hideRoleRequest();
        state.busy = false; $btnLogin.disabled = false;
        setStatus('失败: ' + e.message, 'err');
        appendLog('ERR: ' + e.message, 'err');
      });
  });

  $btnCancel.addEventListener('click', function () { finishAll(''); });

  // 自检
  window.addEventListener('load', function () {
    if (!window.GameCrypto || !window.GameCrypto.encMsg) {
      setStatus('警告：lz4_encryptor.js 未加载', 'warn');
    }
  });
})();
