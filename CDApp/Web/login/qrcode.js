
(function () {
  'use strict';

  // ============================================================
  //  Bridge / 工具
  // ============================================================
  var Bridge = (typeof AndroidBridge !== 'undefined') ? AndroidBridge : null;
  function brLog(tag, msg) {
    try { if (Bridge && Bridge.log) Bridge.log(tag || 'js', String(msg)); } catch (e) {}
    try { console.log('[' + (tag || 'js') + ']', msg); } catch (e) {}
  }
  function toast(msg) {
    try { if (Bridge && Bridge.toast) Bridge.toast(String(msg)); } catch (e) {}
  }
  function finishAll(msg) {
    if (Bridge && Bridge.finishAll) Bridge.finishAll(String(msg || ''));
    else window.close();
  }

  // ============================================================
  //  DOM
  // ============================================================
  var $status = document.getElementById('status');
  var $qrImg  = document.getElementById('qrImg');
  var $qrPh   = document.getElementById('qrPlaceholder');
  var $btnGen = document.getElementById('btnGen');
  var $btnCancel = document.getElementById('btnCancel');
  var $log    = document.getElementById('log');
  var $roleRequestBanner = document.getElementById('roleRequestBanner');

  var $roleMask = document.getElementById('roleMask');
  var $roleList = document.getElementById('roleList');
  var $roleCount = document.getElementById('roleCount');
  var $chkAll = document.getElementById('chkAll');
  var $selInfo = document.getElementById('selInfo');
  var $btnDlgOk = document.getElementById('btnDlgOk');
  var $btnDlgCancel = document.getElementById('btnDlgCancel');

  function setStatus(text, type) {
    $status.textContent = text;
    $status.className = 'status ' + (type || 'info');
    brLog('status', text);
  }
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
    $log.appendChild(p);
    $log.classList.add('show');
    $log.scrollTop = $log.scrollHeight;
    // 同步到 chromium console（再被 logcat 捕获），方便排查
    try {
      var line = '[' + (kind || 'log') + '] ' + text;
      if (kind === 'err') console.error(line);
      else if (kind === 'warn') console.warn(line);
      else console.log(line);
    } catch (e) {}
  }

  // ============================================================
  //  Base64 / ArrayBuffer 工具
  // ============================================================
  function abToB64(buf) {
    var u8 = (buf instanceof Uint8Array) ? buf : new Uint8Array(buf);
    var s = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < u8.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK));
    }
    return btoa(s);
  }
  function b64ToU8(b64) {
    var bin = atob(b64 || '');
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  // ============================================================
  //  encodePayload (与 wxqrcode.vue 完全一致)
  // ============================================================
  var CIPHER_TABLE = "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";
  var XOR_SHIFT = 1, SHUFFLE_TIMES = 6, STEP = 3;

  function encodeBase64(text) {
    if (!text) return null;
    return btoa(unescape(encodeURIComponent(text)));
  }
  function rightSide(s) { return s.length % 2 ? null : s.substring(s.length / 2); }
  function leftSide(s)  { return s.length % 2 ? null : s.substring(0, s.length / 2); }
  function transCode(s, times) {
    if (times <= 0) return s;
    if (s.length % 2) return null;
    return transCode(rightSide(s), times - 1) + transCode(leftSide(s), times - 1);
  }
  function getCodeKey(s, step) {
    var out = '', n = Math.floor(s.length / step);
    for (var i = 0; i < n; i++) out += s.charAt(i * step);
    return out;
  }
  function dealWithString(src, key, shift) {
    if (!src || !key) return null;
    var out = '';
    var idx = key.length >> shift;
    for (var i = 0; i < src.length; i++) {
      if (idx >= key.length) idx = 0;
      out += String.fromCharCode(src.charCodeAt(i) ^ key.charCodeAt(idx));
      idx++;
    }
    return out;
  }
  function encodePayload(text) {
    var b64 = encodeBase64(text);
    var shuffled = transCode(CIPHER_TABLE, SHUFFLE_TIMES);
    var key = getCodeKey(shuffled, STEP);
    var mid = dealWithString(b64, key, XOR_SHIFT);
    return encodeBase64(mid);
  }

  // ============================================================
  //  状态机
  // ============================================================
  var state = {
    qrUUID: null,
    pollTimer: null,
    pollStart: 0,
    pollTimeout: 120000, // 120s
    busy: false,
    // 选服上下文
    nickname: '',
    combUser: null,         // 登录返回的 combUser 原始对象
    originalBinData: null,  // decMsg 解出的原始 bin 业务对象（含 platform/info/serverId 等）
    roles: [],              // 排序后的角色数组
  };

  function resetQR() {
    state.qrUUID = null;
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
    $qrImg.src = '';
    $qrImg.style.display = 'none';
    $qrPh.style.display = '';
  }

  // ============================================================
  //  GET 二维码（GET 走 WebView 拦截 → OkHttp 反代）
  // ============================================================
  function fetchText(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = timeoutMs || 15000;
      xhr.onload = function () { resolve({ status: xhr.status, text: xhr.responseText }); };
      xhr.onerror = function () { reject(new Error('网络错误')); };
      xhr.ontimeout = function () { reject(new Error('请求超时')); };
      xhr.send();
    });
  }

  function tryGetWeixinQR() {
    // 原生直取（WKWebView 中 HTML 解析链路不可靠，优先走 Bridge）
    try {
      var nativeBridge = (typeof AndroidBinBridge !== 'undefined') ? AndroidBinBridge : null;
      if (nativeBridge && nativeBridge.getWeixinQR) {
        var raw = nativeBridge.getWeixinQR();
        var nativeRes = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (nativeRes && nativeRes.ok && nativeRes.qrUrl) {
          state.qrUUID = nativeRes.uuid || String(nativeRes.qrUrl).split('/').pop().split('?')[0];
          $qrImg.src = nativeRes.qrUrl;
          $qrImg.style.display = '';
          $qrPh.style.display = 'none';
          return Promise.resolve(true);
        }
        if (nativeRes && nativeRes.ok === false) {
          brLog('wx', '原生取码失败 status=' + nativeRes.status + ' len=' + nativeRes.htmlLength + ' head=' + (nativeRes.head || ''));
        }
      }
    } catch (e) {
      brLog('wx', '原生取码异常 ' + e);
    }
    var url = '/api/weixin/connect/app/qrconnect'
      + '?appid=wxfb0d5667e5cb1c44'
      + '&bundleid=com.hortor.games.xyzw'
      + '&scope=snsapi_base,snsapi_userinfo,snsapi_friend,snsapi_message'
      + '&state=weixin';
    return fetchText(url, 15000).then(function (resp) {
      if (resp.status !== 200) throw new Error('HTTP ' + resp.status);
      var html = resp.text || '';
      var qrUrl = null;
      try {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var img = doc.querySelector('img.auth_qrcode');
        if (img) qrUrl = img.getAttribute('src');
      } catch (e) {}
      if (!qrUrl) {
        var m = html.match(/https?:\/\/[^"']*qrcode[^"']*/i);
        if (m) qrUrl = m[0];
      }
      if (!qrUrl) {
        var m2 = html.match(/\/connect\/qrcode\/[A-Za-z0-9_-]+/);
        if (m2) qrUrl = 'https://open.weixin.qq.com' + m2[0];
      }
      if (!qrUrl) throw new Error('未找到二维码图片地址');
      if (qrUrl.indexOf('//') === 0) qrUrl = 'https:' + qrUrl;
      else if (qrUrl.charAt(0) === '/') qrUrl = 'https://open.weixin.qq.com' + qrUrl;
      var tail = qrUrl.split('/').pop().split('?')[0];
      state.qrUUID = tail;
      $qrImg.src = qrUrl;
      $qrImg.style.display = '';
      $qrPh.style.display = 'none';
      return true;
    });
  }

  // ============================================================
  //  轮询扫码状态
  // ============================================================
  function startPolling() {
    state.pollStart = Date.now();
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(checkScanStatus, 1000);
  }
  function stopPolling() {
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = null; }
  }

  function checkScanStatus() {
    if (!state.qrUUID) return;
    var elapsed = Date.now() - state.pollStart;
    if (elapsed > state.pollTimeout) {
      stopPolling(); resetQR();
      setStatus('二维码已超时，请重新获取', 'err');
      $btnGen.disabled = false;
      return;
    }
    var url = '/api/weixin/connect/l/qrconnect?uuid=' + encodeURIComponent(state.qrUUID)
      + '&f=url&_=' + Date.now();
    fetchText(url, 5000).then(function (res) {
      if (res.status !== 200) return;
      var text = res.text || '';
      if (text.indexOf('window.wx_errcode=405') !== -1) {
        var codeMatch = text.match(/wx_redirecturl='[^']*code=([a-zA-Z0-9]+)/);
        var nameMatch = text.match(/window\.wx_nickname\s*=\s*['"]([^'"]+)['"]/);
        if (codeMatch) {
          stopPolling();
          var code = codeMatch[1];
          var nickname = nameMatch ? nameMatch[1] : '';
          setStatus('扫码成功，正在登录…' + (nickname ? ' (' + nickname + ')' : ''), 'ok');
          handleScanSuccess(code, nickname);
        }
        return;
      }
      if (text.indexOf('window.wx_errcode=408') !== -1) {
        stopPolling(); resetQR();
        setStatus('二维码已过期，请重新生成', 'err');
        $btnGen.disabled = false;
        return;
      }
      var remain = Math.ceil((state.pollTimeout - elapsed) / 1000);
      if (remain % 30 === 0) {
        setStatus('请使用微信扫码登录', 'info');
      }
    }).catch(function () { /* 忽略瞬时错误 */ });
  }

  // ============================================================
  //  POST 桥接（走 AndroidBridge.proxyPost）
  // ============================================================
  function proxyPost(url, headers, body, contentType) {
    return new Promise(function (resolve, reject) {
      try {
        if (!Bridge || !Bridge.proxyPost) return reject(new Error('AndroidBridge.proxyPost 不可用'));
        var bodyB64;
        if (body == null) bodyB64 = '';
        else if (typeof body === 'string') bodyB64 = btoa(unescape(encodeURIComponent(body)));
        else if (body instanceof ArrayBuffer || body instanceof Uint8Array) bodyB64 = abToB64(body);
        else bodyB64 = btoa(unescape(encodeURIComponent(String(body))));

        var rawJson = Bridge.proxyPost(
          url,
          JSON.stringify(headers || {}),
          bodyB64,
          contentType || ''
        );
        var r = JSON.parse(rawJson || '{}');
        if (r.status === 0) return reject(new Error(r.error || 'proxyPost failed'));
        var u8 = b64ToU8(r.bodyBase64 || '');
        var text = '';
        try { text = new TextDecoder('utf-8').decode(u8); } catch (e) {
          for (var i = 0; i < u8.length; i++) text += String.fromCharCode(u8[i]);
        }
        resolve({ status: r.status, statusText: r.statusText, headers: r.headers, text: text, raw: u8 });
      } catch (e) { reject(e); }
    });
  }

  // ============================================================
  //  GameCrypto 解析/打包工具
  // ============================================================
  function parseBin(arrayBuffer) {
    var GC = window.GameCrypto;
    if (!GC || !GC.decMsg) throw new Error('GameCrypto.decMsg 不可用');
    var msg = GC.decMsg(arrayBuffer, { decrypt: GC.lz4XorDecode, encrypt: GC.lz4XorEncode });
    // 优先 rawData（解析后的业务对象）；为空则退回 _raw
    var data = null;
    try { data = msg.rawData; } catch (e) {}
    if (!data && msg && msg._raw) data = Object.assign({}, msg._raw);
    if (!data) throw new Error('bin 解析为空');
    return data;
  }
  function encodeBin(obj) {
    var GC = window.GameCrypto;
    if (!GC || !GC.encMsg) throw new Error('GameCrypto.encMsg 不可用');
    // ===== DEBUG: 验证 encrypt 函数到底是不是 lz4XorEncode =====
    try {
      appendLog('[encMsg.in] lz4XorEncode is fn=' + (typeof GC.lz4XorEncode)
        + ' name=' + (GC.lz4XorEncode && GC.lz4XorEncode.name)
        + ' obj.keys=' + Object.keys(obj).join(','));
    } catch (e) {}
    var buf = GC.encMsg(obj, { decrypt: GC.lz4XorDecode, encrypt: GC.lz4XorEncode });
    // ===== DEBUG: 看 encMsg 返回的原始 buf 头部，确认是否经过 lz4XorEncode 头改写（应为 0x70 0x6c）=====
    try {
      var dbgU8 = (buf instanceof Uint8Array) ? buf : new Uint8Array(buf);
      appendLog('[encMsg.out] type=' + (buf instanceof Uint8Array ? 'Uint8Array' : 'ArrayBuffer')
        + ' len=' + dbgU8.length
        + ' bufBL=' + (buf.buffer ? buf.buffer.byteLength : (buf.byteLength || -1))
        + ' head=' + u8ToHex(dbgU8, 16)
        + ' (want头2字节: 70 6c)');
    } catch (e) {}
    // ⚠️ 关键：encMsg 内部 DataWriter.getBytes() 默认返回 subarray，
    //   也就是底层大 ArrayBuffer 的视图（buf.buffer.byteLength 远大于 buf.length）。
    //   如果直接把 buf.buffer 给 proxyPost / base64 编码，会带上尾部一堆 0 字节，
    //   服务端收到的 ProtoMsg 后面多了若干 0，业务字段错位 → 返回 code=200020 "出了点小问题"。
    //   vue 那边的写法是 `new Uint8Array(encryptedBuffer)`，会自动 copy 出一份独立 buffer，
    //   恰好绕过了这个坑。我们这里手动复制一份，使 .buffer 正好等于 byteLength。
    var src = (buf instanceof Uint8Array) ? buf : new Uint8Array(buf);
    var out = new Uint8Array(src.length);
    out.set(src);
    return out;
  }

  /**
   * 自动检测加密方式的解密器（对应 bonProtocol.js 中的 passthrough）：
   *   - 0x70 0x6c ("pl") -> lx (lz4XorDecode)
   *   - 0x70 0x78 ("px") -> x  (xorDecode)
   *   - 0x70 0x74 ("pt") -> xtm
   * encrypt 默认走 x（与 vue passthrough 一致）。
   */
  function getAutoEnc() {
    var GC = window.GameCrypto;
    return {
      encrypt: function (e) { return GC.xorEncode(e); },
      decrypt: function (e) {
        if (e.length > 4 && e[0] === 0x70 && e[1] === 0x6c) return GC.lz4XorDecode(e);
        if (e.length > 4 && e[0] === 0x70 && e[1] === 0x78) return GC.xorDecode(e);
        if (e.length > 3 && e[0] === 0x70 && e[1] === 0x74 && GC.getEncryptor) {
          var xtm = GC.getEncryptor('xtm');
          if (xtm && xtm.decrypt) return xtm.decrypt(e);
        }
        return e; // 兜底：原样返回
      }
    };
  }

  // ============================================================
  //  服务器列表请求 + 解析
  // ============================================================
  function u8ToHex(u8, n) {
    n = Math.min(n || 32, u8.length);
    var s = '';
    for (var i = 0; i < n; i++) {
      var h = u8[i].toString(16);
      if (h.length < 2) h = '0' + h;
      s += h;
    }
    return s;
  }
  function getServerList(arrBuf) {
    return proxyPost(
      '/api/xxz/login/serverlist?_seq=3',
      { 'Accept': '*/*' },
      arrBuf,
      'application/octet-stream'
    ).then(function (resp) {
      // —— 调试日志 ——
      appendLog('serverlist HTTP ' + resp.status + ' (' + (resp.statusText || '') + ')', resp.status === 200 ? 'ok' : 'err');
      var raw = resp.raw || new Uint8Array(0);
      appendLog('serverlist body bytes=' + raw.length + ', head=' + u8ToHex(raw, 32));
      // 如果像文本（HTML/JSON），把开头 200 字节打出来
      var looksText = true;
      for (var i = 0; i < Math.min(raw.length, 64); i++) {
        var c = raw[i];
        if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) continue;
        looksText = false; break;
      }
      if (looksText && raw.length > 0) {
        appendLog('serverlist 响应像文本：' + (resp.text || '').slice(0, 200), 'warn');
      }
      if (resp.status !== 200) throw new Error('serverlist HTTP ' + resp.status);
      if (raw.length === 0) throw new Error('serverlist 响应为空');

      var GC = window.GameCrypto;
      var msg;
      // 服务器返回的加密方式不固定（lx/x/xtm 都可能），用自动检测解密器
      var autoEnc = getAutoEnc();
      try {
        // 传 Uint8Array 而不是 .buffer，避免 buffer 偏移
        msg = GC.decMsg(raw, autoEnc);
      } catch (e) {
        appendLog('decMsg 抛错: ' + e.message + '（head=' + u8ToHex(raw, 8) + '）', 'err');
        // 兜底：再分别用 lx / x 各试一次，便于诊断
        try {
          var msg2 = GC.decMsg(raw.slice(), { decrypt: GC.lz4XorDecode, encrypt: GC.lz4XorEncode });
          appendLog('lx 强解结果 keys=' + (msg2 && msg2._raw ? Object.keys(msg2._raw).join(',') : 'null'), 'warn');
        } catch (e2) { appendLog('lx 强解失败: ' + e2.message, 'warn'); }
        try {
          var msg3 = GC.decMsg(raw.slice(), { decrypt: GC.xorDecode, encrypt: GC.xorEncode });
          appendLog('x 强解结果 keys=' + (msg3 && msg3._raw ? Object.keys(msg3._raw).join(',') : 'null'), 'warn');
        } catch (e3) { appendLog('x 强解失败: ' + e3.message, 'warn'); }
        throw new Error('serverlist decMsg 失败：' + e.message);
      }
      if (!msg) throw new Error('serverlist decMsg 返回 null');
      var data = null;
      try { data = msg.rawData; } catch (e) { appendLog('rawData 取值失败: ' + e.message, 'warn'); }
      if (!data && msg && msg._raw) data = msg._raw;
      if (!data) {
        appendLog('serverlist 解析后 data 为空，msg keys=' + (msg ? Object.keys(msg).join(',') : 'null'), 'err');
        return [];
      }
      appendLog('serverlist data keys=' + Object.keys(data).join(','));
      // 打印各顶层字段的类型/大小，避免 JSON.stringify 巨型对象卡死
      try {
        var info = [];
        Object.keys(data).forEach(function (k) {
          var v = data[k];
          var t = (v && v.constructor && v.constructor.name) || typeof v;
          var sz = '';
          if (v == null) sz = 'null';
          else if (v instanceof Uint8Array || v instanceof ArrayBuffer) sz = 'bytes=' + (v.byteLength || v.length || 0);
          else if (v instanceof Map) sz = 'mapSize=' + v.size;
          else if (Array.isArray(v)) sz = 'arrLen=' + v.length;
          else if (typeof v === 'object') {
            try { sz = 'objKeys=' + Object.keys(v).length; } catch (e) { sz = 'objKeys=?'; }
          } else sz = String(v).slice(0, 80);
          info.push(k + ':' + t + '(' + sz + ')');
        });
        appendLog('serverlist data fields=' + info.join(' | '));
      } catch (e) { appendLog('dump data 失败: ' + e.message, 'warn'); }

      // 服务端 code != 0 时是错误响应，没有 body/roles
      if (data.code && data.code !== 0) {
        appendLog('服务端错误 code=' + data.code + ' error=' + (data.error || ''), 'err');
        throw new Error('serverlist 失败 code=' + data.code + ' ' + (data.error || ''));
      }

      // body 还在的话再 BON 解一次拿 roles（vue 里 msg.getData() === msg.rawData，
      // ProtoMsg.rawData 内部就是 bon.decode(body)；我们这里 msg.rawData 已经做过了，
      // 但万一服务器 schema 不同，data 本身可能就是顶层 cmd/body 结构，roles 在 body 里）
      if (!data.roles && data.body && (data.body instanceof Uint8Array || data.body instanceof ArrayBuffer)) {
        try {
          var inner = GC.bon ? GC.bon.decode(data.body instanceof Uint8Array ? data.body : new Uint8Array(data.body)) : null;
          if (inner) {
            appendLog('inner body keys=' + Object.keys(inner).join(','));
            if (inner.roles) data = inner;
          }
        } catch (e) { appendLog('inner body decode 失败: ' + e.message, 'warn'); }
      }

      if (!data.roles) {
        appendLog('serverlist 响应缺少 roles 字段', 'err');
        return [];
      }
      // roles 可能是普通对象也可能是 Map
      var rolesObj = data.roles;
      var rolesType = (rolesObj && rolesObj.constructor && rolesObj.constructor.name) || typeof rolesObj;
      appendLog('roles type=' + rolesType
        + (rolesObj instanceof Map ? ' mapSize=' + rolesObj.size : '')
        + (Array.isArray(rolesObj) ? ' arrLen=' + rolesObj.length : '')
        + (rolesObj && typeof rolesObj === 'object' && !(rolesObj instanceof Map) && !Array.isArray(rolesObj) ? ' objKeys=' + Object.keys(rolesObj).length : ''));
      var arr = [];
      try {
        if (rolesObj instanceof Map) {
          rolesObj.forEach(function (v) { arr.push(v); });
        } else if (Array.isArray(rolesObj)) {
          for (var i = 0; i < rolesObj.length; i++) arr.push(rolesObj[i]);
        } else if (rolesObj && typeof rolesObj === 'object') {
          var keys = Object.keys(rolesObj);
          for (var i = 0; i < keys.length; i++) arr.push(rolesObj[keys[i]]);
        }
      } catch (e) {
        appendLog('roles 遍历失败: ' + e.message, 'err');
      }
      appendLog('roles 收集完成，数量=' + arr.length);
      // 打印第 1 个 role 的字段，便于排查结构
      if (arr.length > 0) {
        try {
          var r0 = arr[0];
          var rk = r0 && typeof r0 === 'object' ? Object.keys(r0).slice(0, 30).join(',') : String(r0);
          appendLog('role[0] keys=' + rk);
        } catch (e) {}
      }
      // 按战力降序
      try {
        arr.sort(function (a, b) { return getRolePower(b) - getRolePower(a); });
      } catch (e) {
        appendLog('roles 排序失败: ' + e.message, 'warn');
      }
      return arr;
    });
  }

  // ============================================================
  //  弹窗：选择角色
  // ============================================================
  function formatServer(serverIdRaw) {
    var rawServerId = Number(serverIdRaw) || 0;
    var sid = rawServerId;
    var roleIndex = 0;
    if (sid >= 2000000) { roleIndex = 2; sid -= 2000000; }
    else if (sid >= 1000000) { roleIndex = 1; sid -= 1000000; }
    var displayServerId = sid > 1000 ? sid - 27 : sid;
    return { rawServerId: rawServerId, baseServerId: sid, serverId: displayServerId, roleIndex: roleIndex };
  }

  function getRoleServerId(role) {
    return role && (role.serverId || role.sid || role.server || 0);
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

  function buildFileName(role, nickname) {
    var roleName = role.name || ('角色_' + role.roleId);
    var serverInfo = formatServer(getRoleServerId(role));
    var fname = roleName + '-区服' + (serverInfo.serverId || serverInfo.rawServerId || 0);
    return fname.replace(/[\\/:*?"<>|]+/g, '_');
  }

  function renderRoleList(roles) {
    $roleList.innerHTML = '';
    $roleCount.textContent = '共 ' + roles.length + ' 个';
    if (roles.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '没有获取到任何角色，请关闭重试。';
      $roleList.appendChild(empty);
      $btnDlgOk.disabled = true;
      return;
    }
    $btnDlgOk.disabled = false;
    roles.forEach(function (role, idx) {
      var item = document.createElement('label');
      item.className = 'role-item';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.idx = String(idx);
      cb.addEventListener('change', function () {
        item.classList.toggle('checked', cb.checked);
        updateSelInfo();
      });

      var meta = document.createElement('div');
      meta.className = 'meta';

      var nm = document.createElement('div');
      nm.className = 'name';
      nm.textContent = role.name || ('角色_' + role.roleId);

      var inf = document.createElement('div');
      inf.className = 'info';
      var b1 = document.createElement('span'); b1.className = 'badge';
      var serverInfo = formatServer(getRoleServerId(role));
      b1.textContent = '区服 ' + (serverInfo.serverId || '?');
      var pwr = document.createElement('span'); pwr.className = 'pwr';
      pwr.textContent = '战力 ' + formatPower(getRolePower(role));
      var rid = document.createElement('span');
      rid.className = 'rid';
      rid.textContent = 'ID ' + role.roleId;
      inf.appendChild(b1);
      inf.appendChild(pwr);
      inf.appendChild(rid);

      meta.appendChild(nm);
      meta.appendChild(inf);

      item.appendChild(cb);
      item.appendChild(meta);
      $roleList.appendChild(item);
    });
    updateSelInfo();
  }

  function getCheckedIndices() {
    var out = [];
    var cbs = $roleList.querySelectorAll('input[type=checkbox]');
    for (var i = 0; i < cbs.length; i++) {
      if (cbs[i].checked) out.push(Number(cbs[i].dataset.idx));
    }
    return out;
  }

  function updateSelInfo() {
    var n = getCheckedIndices().length;
    var total = state.roles.length;
    $selInfo.textContent = '已选 ' + n + ' / ' + total;
    $chkAll.checked = (n > 0 && n === total);
    $chkAll.indeterminate = (n > 0 && n < total);
    $btnDlgOk.disabled = (n === 0);
  }

  $chkAll.addEventListener('change', function () {
    var checked = $chkAll.checked;
    var cbs = $roleList.querySelectorAll('input[type=checkbox]');
    for (var i = 0; i < cbs.length; i++) {
      cbs[i].checked = checked;
      cbs[i].closest('.role-item').classList.toggle('checked', checked);
    }
    updateSelInfo();
  });

  function showRoleDialog(roles) {
    hideRoleRequest();
    state.roles = roles;
    renderRoleList(roles);
    $roleMask.classList.add('show');
  }
  function hideRoleDialog() {
    $roleMask.classList.remove('show');
  }

  $btnDlgCancel.addEventListener('click', function () {
    hideRoleDialog();
    state.busy = false;
    $btnGen.disabled = false;
    setStatus('已取消导入', 'warn');
  });

  $btnDlgOk.addEventListener('click', function () {
    var picks = getCheckedIndices();
    if (picks.length === 0) { toast('请至少选择一个角色'); return; }
    $btnDlgOk.disabled = true;
    $btnDlgCancel.disabled = true;
    importPickedRoles(picks).then(function (result) {
      hideRoleDialog();
      $btnDlgCancel.disabled = false;
      var ok = result.ok, fail = result.fail;
      var msg = '导入完成：成功 ' + ok + ' / 失败 ' + fail;
      setStatus(msg, fail > 0 ? 'warn' : 'ok');
      toast(msg);
      setTimeout(function () { finishAll(msg); }, 700);
    }).catch(function (e) {
      $btnDlgOk.disabled = false;
      $btnDlgCancel.disabled = false;
      setStatus('导入失败：' + e.message, 'err');
      appendLog('ERR ' + e.message, 'err');
    });
  });

  // ============================================================
  //  扫码成功 → 登录 → 拉服务器列表 → 弹窗 → 多角色导入
  // ============================================================
  function handleScanSuccess(code, nickname) {
    if (state.busy) return;
    state.busy = true;
    state.nickname = nickname || '';
    setStatus('正在与服务器换取账号信息…', 'info');

    var payload = {
      gameId: 'xyzwapp',
      code: code,
      gameTp: 'app',
      sysInfo: '{"system":"Android","hortorSDKVersion":"4.0.6-cn","model":"22081212C","brand":"Redmi"}',
      channel: 'android',
      appFrom: 'com.tencent.mm',
      noLogin: '2',
      distinctId: 'DID-a38175b7-14ce-4b36-aa89-3e092ea03ea6',
      state: 'hortor',
      packageName: 'com.hortor.games.xyzw',
      tp: 'app-we',
      signPrint: 'E6:F7:FE:A9:EC:8E:24:D0:4F:2A:32:50:28:78:E1:C5:5E:70:81:13'
    };
    var rawJson = JSON.stringify(payload);
    var encoded;
    try { encoded = encodePayload(rawJson); }
    catch (e) {
      state.busy = false;
      setStatus('登录请求加密失败：' + e.message, 'err');
      $btnGen.disabled = false;
      return;
    }

    var loginUrl = '/api/hortor/comb-login-server/api/v1/login'
      + '?gameId=xyzwapp'
      + '&timestamp=' + Date.now()
      + '&version=android-4.2.1-cn-release'
      + '&cryptVersion=1.1.0'
      + '&gameTp=app&system=android'
      + '&deviceUniqueId=DID-0e782e88-2f3b-4f5b-9020-47f5e5a5a026'
      + '&packageName=com.hortor.games.xyzw';

    proxyPost(loginUrl, { 'Accept': '*/*', 'Origin': 'https://open.weixin.qq.com', 'Referer': 'https://open.weixin.qq.com/' }, encoded, 'text/plain; charset=utf-8')
      .then(function (resp) {
        if (resp.status !== 200) throw new Error('登录 HTTP ' + resp.status);
        var json;
        try { json = JSON.parse(resp.text); }
        catch (e) { throw new Error('登录响应不是 JSON: ' + (resp.text || '').slice(0, 80)); }
        if (!json || !json.meta || json.meta.errCode !== 0) {
          throw new Error('登录失败：' + (json && json.meta && json.meta.errMsg || 'unknown'));
        }
        var combUser = json.data && json.data.combUser;
        if (!combUser) throw new Error('登录响应结构异常：缺少 combUser');
        appendLog('combUser 已获取 type=' + (typeof combUser) + ' len=' + (combUser && combUser.length) , 'ok');
        // ===== DEBUG: 把 combUser 字符串原文打出来（看是否能 JSON.parse 出 encryptCombUser/sign/timestamp）=====
        try {
          if (typeof combUser === 'string') {
            var p = JSON.parse(combUser);
            appendLog('[combUser parsed] keys=' + Object.keys(p).join(',')
              + ' timestamp=' + p.timestamp
              + ' sign=' + p.sign
              + ' encLen=' + (p.encryptCombUser && p.encryptCombUser.length));
          } else {
            appendLog('[combUser] 不是 string，是 ' + typeof combUser + '：' + JSON.stringify(combUser).slice(0, 200), 'warn');
          }
        } catch (e) { appendLog('[combUser] 解析失败: ' + e.message, 'warn'); }
        state.combUser = combUser;

        // 生成原始 bin
        // 注意：vue 源码里写的是 serverId:null、且没有 deviceUniqueId 字段，
        //   但抓真实流量 payload 后发现实际请求里 serverId=0、且必须带 deviceUniqueId:""。
        //   服务端对 serverId 类型敏感（BON null vs number 是两种 tag），
        //   传 null 会被判错走到 code=200020 "出了点小问题"。
        //   所以这里以真实流量为准：serverId=0，deviceUniqueId=""。
        var binData = {
          platform: 'hortor',
          platformExt: 'mix',
          info: combUser,
          serverId: 0,
          scene: 0,
          referrerInfo: '',
          deviceUniqueId: ''
        };
        // ===== DEBUG: 打印加密前的完整明文 binData，便于和真实流量逐字段对照 =====
        try {
          var dbgPlain = {
            platform: binData.platform,
            platformExt: binData.platformExt,
            // info 太长（>1KB），分段打
            info: typeof binData.info === 'string' ? ('<string len=' + binData.info.length + '>') : ('<' + (typeof binData.info) + '>'),
            serverId: binData.serverId,
            scene: binData.scene,
            referrerInfo: binData.referrerInfo,
            deviceUniqueId: binData.deviceUniqueId
          };
          appendLog('[plain] binData=' + JSON.stringify(dbgPlain));
          if (typeof binData.info === 'string') {
            // 把 info 完整打出来（多行也认了，方便比对）
            var INFO = binData.info;
            var CHUNK = 800;
            for (var oi = 0; oi < INFO.length; oi += CHUNK) {
              appendLog('[plain.info ' + oi + '..' + Math.min(INFO.length, oi + CHUNK) + '] ' + INFO.substr(oi, CHUNK));
            }
          }
        } catch (e) { appendLog('[plain] dump 失败: ' + e.message, 'warn'); }
        var u8 = encodeBin(binData);
        appendLog('原始 bin 生成成功，size=' + u8.length + ' head=' + u8ToHex(u8, 32) + ' tail=' + u8ToHex(u8.subarray(Math.max(0, u8.length - 16)), 16), 'ok');

        // ⚠️ 重要：state.originalBinData 直接用手头的 binData，不要再 parseBin(u8.buffer)！
        //    parseBin → decMsg → lz4XorDecode(V) 是 in-place 修改 buffer 的，
        //    会把 u8.buffer 头 4 字节从 70 6c xx xx 改回 04 22 4d 18，
        //    后续 getServerList(u8.buffer) 就发的是已被破坏的明文 LZ4，
        //    服务端直接拒绝 → code=200020 "出了点小问题"。
        //    binData 本身就是这次构造时的源对象，字段完全等价。
        state.originalBinData = binData;
        appendLog('originalBinData 已就绪（直接复用源对象，避免破坏 u8.buffer）', 'ok');

        // 拉服务器列表
        showRoleRequest();
        return getServerList(u8.buffer);
      })
      .then(function (roles) {
        if (!roles || roles.length === 0) {
          throw new Error('没有获取到任何角色');
        }
        hideRoleRequest();
        appendLog('服务器列表获取成功，角色数=' + roles.length, 'ok');
        setStatus('请选择要导入的角色（' + roles.length + ' 个）', 'ok');
        showRoleDialog(roles);
      })
      .catch(function (e) {
        hideRoleRequest();
        state.busy = false;
        $btnGen.disabled = false;
        setStatus('处理失败：' + e.message, 'err');
        appendLog('ERR ' + e.message, 'err');
        brLog('err', e.message);
      });
  }

  // ============================================================
  //  对每个勾选角色生成 bin 并保存
  // ============================================================
  function importPickedRoles(indices) {
    return new Promise(function (resolve) {
      var ok = 0, fail = 0;
      var done = 0;
      var total = indices.length;
      setStatus('正在导入 0 / ' + total + ' …', 'info');

      function next(i) {
        if (i >= total) {
          resolve({ ok: ok, fail: fail });
          return;
        }
        var role = state.roles[indices[i]];
        try {
          // 浅拷贝原 bin 数据，替换 serverId
          var newData = Object.assign({}, state.originalBinData);
          newData.serverId = getRoleServerId(role);
          var u8 = encodeBin(newData);
          var fileName = buildFileName(role, state.nickname);
          var b64 = abToB64(u8);
          var saveResStr = Bridge.saveBin(fileName, b64);
          var saveRes;
          try { saveRes = JSON.parse(saveResStr || '{}'); } catch (e) { saveRes = {}; }
          if (saveRes.ok) {
            ok++;
            appendLog('√ ' + fileName, 'ok');
          } else {
            fail++;
            appendLog('× ' + fileName + ' :: ' + (saveRes.error || saveResStr), 'err');
          }
        } catch (e) {
          fail++;
          appendLog('× role[' + indices[i] + ']: ' + e.message, 'err');
        }
        done++;
        setStatus('正在导入 ' + done + ' / ' + total + ' …', 'info');
        // 给 UI 留一帧
        setTimeout(function () { next(i + 1); }, 0);
      }
      next(0);
    });
  }

  // ============================================================
  //  按钮事件
  // ============================================================
  $btnGen.addEventListener('click', function () {
    if (state.busy) return;
    $btnGen.disabled = true;
    setStatus('正在获取二维码…', 'info');
    resetQR();
    tryGetWeixinQR().then(function () {
      setStatus('请使用微信扫码登录', 'info');
      $btnGen.disabled = false;
      $btnGen.textContent = '重新获取';
      startPolling();
    }).catch(function (e) {
      $btnGen.disabled = false;
      setStatus('二维码获取失败：' + e.message, 'err');
      appendLog('ERR ' + e.message, 'err');
    });
  });

  $btnCancel.addEventListener('click', function () {
    stopPolling();
    finishAll('');
  });

  // 启动自检
  window.addEventListener('load', function () {
    if (!window.GameCrypto || !window.GameCrypto.encMsg) {
      setStatus('警告：lz4_encryptor.js 未加载，bin 生成将失败', 'warn');
      appendLog('window.GameCrypto missing', 'err');
    } else {
      appendLog('GameCrypto loaded: ' + Object.keys(window.GameCrypto).join(','), 'ok');
    }
  });
})();
