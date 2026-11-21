(function () {
  function log() {}

  window.CD = window.CD || {};
  window.CD.saveImage = function (name, data) {
    try { return JSON.parse(AndroidBinBridge.saveImage(name || '', data || '')); } catch (e) { return { ok: false, error: String(e) }; }
  };
  window.CD.saveFile = function (name, data, mime) {
    try { return JSON.parse(AndroidBinBridge.saveFile(name || '', data || '', mime || '')); } catch (e) { return { ok: false, error: String(e) }; }
  };
  window.CD.saveDataUrl = function (name, data) {
    try { return JSON.parse(AndroidBinBridge.saveDataUrl(name || '', data || '')); } catch (e) { return { ok: false, error: String(e) }; }
  };

  if (!window.__cdDownloadHookInstalled) {
    window.__cdDownloadHookInstalled = true;
    (function () {
      var blobs = {};
      var origCreate = URL.createObjectURL;
      var origRevoke = URL.revokeObjectURL;
      URL.createObjectURL = function (obj) {
        var url = origCreate.call(this, obj);
        try { if (obj instanceof Blob) blobs[url] = obj; } catch (e) {}
        return url;
      };
      URL.revokeObjectURL = function (url) {
        try { delete blobs[url]; } catch (e) {}
        return origRevoke.call(this, url);
      };
      function blobToDataUrl(blob, cb) {
        var reader = new FileReader();
        reader.onload = function () { cb(String(reader.result || '')); };
        reader.onerror = function () { cb(''); };
        reader.readAsDataURL(blob);
      }
      function looksImage(name, href, type) {
        return /^image\//i.test(String(type || '')) ||
          /^data:image\//i.test(String(href || '')) ||
          /\.(png|jpe?g|webp|gif|bmp)(?:$|[?#])/i.test(String(name || '')) ||
          /\.(png|jpe?g|webp|gif|bmp)(?:$|[?#])/i.test(String(href || ''));
      }
      function savePayload(name, data, mime) {
        if (looksImage(name, data, mime)) return window.CD.saveImage(name, data);
        return window.CD.saveDataUrl(name, data);
      }
      function saveDownload(anchor) {
        try {
          var href = anchor && anchor.href || '';
          var name = anchor && anchor.download || '';
          if (!href) return false;
          if (href.indexOf('data:') === 0) {
            savePayload(name, href, '');
            return true;
          }
          if (href.indexOf('blob:') === 0 && blobs[href]) {
            blobToDataUrl(blobs[href], function (data) { savePayload(name, data, blobs[href] && blobs[href].type); });
            return true;
          }
          if (/^(file|content):\/\//i.test(href) || /^[A-Za-z]:[\\/]/.test(href)) {
            window.CD.saveImage(name, href);
            return true;
          }
          if (/^https?:\/\//i.test(href) && looksImage(name, href, '')) {
            if (typeof GM_download === 'function') {
              GM_download({ url: href, name: name || ('cd-image-' + Date.now() + '.png') });
            } else {
              fetch(href, { credentials: 'omit' }).then(function (res) { return res.blob(); }).then(function (blob) {
                blobToDataUrl(blob, function (data) { savePayload(name, data, blob && blob.type); });
              }).catch(function () {});
            }
            return true;
          }
        } catch (e) {}
        return false;
      }
      document.addEventListener('click', function (e) {
        var anchor = e.target && e.target.closest && e.target.closest('a[download]');
        if (anchor && saveDownload(anchor)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }, true);
      var origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (saveDownload(this)) return;
        return origClick.call(this);
      };

      function installWxAlbumBridge() {
        try {
          window.wx = window.wx || {};
          if (window.wx.__cdSaveImageToPhotosAlbumPatched) return;
          window.wx.__cdSaveImageToPhotosAlbumPatched = true;
          var originalSave = window.wx.saveImageToPhotosAlbum;
          window.wx.saveImageToPhotosAlbum = function (opt) {
            opt = opt || {};
            try {
              var path = opt.filePath || opt.url || opt.imagePath || '';
              if (path) {
                var result = window.CD.saveImage(opt.name || ('cd-image-' + Date.now() + '.png'), path);
                if (result && result.ok !== false) {
                  if (typeof opt.success === 'function') opt.success(result);
                  if (typeof opt.complete === 'function') opt.complete(result);
                  return;
                }
              }
            } catch (e) {}
            if (typeof originalSave === 'function') return originalSave.apply(this, arguments);
            var err = { errMsg: 'saveImageToPhotosAlbum:fail' };
            if (typeof opt.fail === 'function') opt.fail(err);
            if (typeof opt.complete === 'function') opt.complete(err);
          };
        } catch (e) {}
      }
      installWxAlbumBridge();
      var wxTimer = setInterval(function () {
        installWxAlbumBridge();
      }, 1000);
      setTimeout(function () { clearInterval(wxTimer); }, 30000);
    })();
  }

  function clearServerCache() {
    try {
      ['serverId', 'currentServerId', 'selectServerId', 'selectedServerId', 'lastServerId'].forEach(function (key) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
    } catch (e) {}
  }
  function getHex() {
    try { return AndroidBinBridge.getBinHex() || ''; } catch (e) { return ''; }
  }

  function hexToBytes(hex) {
    if (!hex) return null;
    var len = Math.floor(hex.length / 2);
    var out = new Uint8Array(len);
    for (var i = 0; i < len; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16) || 0;
    return out;
  }

  function bytesToHex(bytes) {
    var out = '';
    if (!bytes) return out;
    for (var i = 0; i < bytes.length; i++) {
      var h = (bytes[i] & 255).toString(16);
      if (h.length < 2) h = '0' + h;
      out += h;
    }
    return out;
  }

  function bytesToBase64(bytes) {
    var s = '';
    var step = 0x8000;
    for (var i = 0; i < bytes.length; i += step) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return btoa(s);
  }

  function base64ToBytes(text) {
    var bin = atob(String(text || ''));
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 255;
    return out;
  }

  function copyBytes(value) {
    var src = value instanceof Uint8Array ? value : new Uint8Array(value);
    var out = new Uint8Array(src.length);
    out.set(src);
    return out;
  }

  function getAutoEnc(dataModule) {
    return {
      encrypt: function (e) { return dataModule.xorEncode(e); },
      decrypt: function (e) {
        if (e && e.length > 4 && e[0] === 0x70 && e[1] === 0x6c) return dataModule.lz4XorDecode(e);
        if (e && e.length > 4 && e[0] === 0x70 && e[1] === 0x78) return dataModule.xorDecode(e);
        if (e && e.length > 3 && e[0] === 0x70 && e[1] === 0x74 && dataModule.getEncryptor) {
          var xtm = dataModule.getEncryptor('xtm');
          if (xtm && xtm.decrypt) return xtm.decrypt(e);
        }
        return e;
      }
    };
  }

  function encodeAccountPayload(dataModule, payload) {
    return copyBytes(dataModule.encMsg(payload, { decrypt: dataModule.lz4XorDecode, encrypt: dataModule.lz4XorEncode }));
  }

  function formatServer(serverIdRaw) {
    var rawServerId = Number(serverIdRaw) || 0;
    var sid = rawServerId;
    var roleIndex = 0;
    if (sid >= 2000000) { roleIndex = 2; sid -= 2000000; }
    else if (sid >= 1000000) { roleIndex = 1; sid -= 1000000; }
    return {
      rawServerId: rawServerId,
      baseServerId: sid,
      displayServerId: sid > 1000 ? sid - 27 : sid,
      roleIndex: roleIndex
    };
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

  function normalizeRoleList(rolesObj) {
    var arr = [];
    if (rolesObj instanceof Map) {
      rolesObj.forEach(function (v) { arr.push(v); });
    } else if (Array.isArray(rolesObj)) {
      arr = rolesObj.slice();
    } else if (rolesObj && typeof rolesObj === 'object') {
      Object.keys(rolesObj).forEach(function (key) { arr.push(rolesObj[key]); });
    }
    arr.sort(function (a, b) { return getRolePower(b) - getRolePower(a); });
    return arr.map(function (role) {
      var serverInfo = formatServer(getRoleServerId(role));
      var power = getRolePower(role);
      return {
        name: String(role && (role.name || role.nick || role.nickname) || ('角色_' + (role && role.roleId || ''))),
        roleId: String(role && (role.roleId || role.id || role.uid) || ''),
        rawServerId: serverInfo.rawServerId,
        baseServerId: serverInfo.baseServerId,
        displayServerId: serverInfo.displayServerId,
        roleIndex: serverInfo.roleIndex,
        power: power,
        powerText: formatPower(power)
      };
    });
  }

  function decodeServerList(dataModule, raw) {
    var msg = dataModule.decMsg(raw, getAutoEnc(dataModule));
    var data = null;
    try { data = msg && msg.rawData; } catch (e) {}
    if (!data && msg && msg._raw) data = msg._raw;
    if (!data) throw new Error('empty serverlist');
    if (data.code && data.code !== 0) throw new Error('serverlist code=' + data.code);
    if (!data.roles && data.body && (data.body instanceof Uint8Array || data.body instanceof ArrayBuffer)) {
      try {
        var body = data.body instanceof Uint8Array ? data.body : new Uint8Array(data.body);
        var inner = dataModule.bon ? dataModule.bon.decode(body) : null;
        if (inner && inner.roles) data = inner;
      } catch (e) {}
    }
    if (!data.roles) return [];
    return normalizeRoleList(data.roles);
  }

  function reportRoleError(message) {
    try {
      if (window.AndroidBinBridge && AndroidBinBridge.reportRoleListError) {
        AndroidBinBridge.reportRoleListError(String(message || 'request failed'));
      }
    } catch (e) {}
  }

  window.__cdRoleProxyCallbacks = window.__cdRoleProxyCallbacks || {};

  function proxyPostAsync(url, headers, bodyBytes, contentType, cb) {
    if (!window.AndroidBinBridge || typeof AndroidBinBridge.proxyPostAsync !== 'function') {
      cb({ status: 0, error: 'proxyPostAsync unavailable', bodyBase64: '' });
      return;
    }
    var id = 'role_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
    window.__cdRoleProxyCallbacks[id] = function (result) {
      delete window.__cdRoleProxyCallbacks[id];
      cb(result || { status: 0, error: 'empty response', bodyBase64: '' });
    };
    try {
      AndroidBinBridge.proxyPostAsync(id, url, JSON.stringify(headers || {}), bytesToBase64(bodyBytes), contentType || '');
    } catch (e) {
      delete window.__cdRoleProxyCallbacks[id];
      cb({ status: 0, error: String(e), bodyBase64: '' });
    }
  }

  window.__cdRoleProxyResponse = function (id, result) {
    try {
      var cb = window.__cdRoleProxyCallbacks && window.__cdRoleProxyCallbacks[id];
      if (cb) cb(result || {});
    } catch (e) {}
  };

  window.__cdPendingLoginCalls = window.__cdPendingLoginCalls || [];

  function replayPendingLogin() {
    var queue = window.__cdPendingLoginCalls || [];
    if (!queue.length || !window.__cdNativeAccount) return;
    window.__cdPendingLoginCalls = [];
    queue.forEach(function (job) {
      try {
        Promise.resolve(job.fn.apply(job.ctx, job.args)).then(job.resolve, job.reject);
      } catch (e) {
        try { job.reject(e); } catch (_) {}
      }
    });
  }

  function pauseLoginCall(label, fn, ctx, args) {
    return new Promise(function (resolve, reject) {
      window.__cdPendingLoginCalls.push({
        fn: fn,
        ctx: ctx,
        args: Array.prototype.slice.call(args || []),
        resolve: resolve,
        reject: reject
      });
      log('[CD Native Login] ' + label + ' paused until account selected');
    });
  }

  function markLoginLinked(tag) {
    try {
      window.__cdNativeLoginOk = true;
      window.__cdNativeLoginOkAt = Date.now();
      window.__cdNativeLoginOkTag = String(tag || '');
    } catch (e) {}
  }

  function watchLoginResult(ret, tag) {
    try {
      if (ret && typeof ret.then === 'function') {
        ret.then(function (res) {
          markLoginLinked(tag);
          return res;
        }, function (err) {
          return err;
        });
      } else if (ret !== undefined) {
        markLoginLinked(tag);
      }
    } catch (e) {}
    return ret;
  }

  function hasServerIdField(params) {
    return params && params.serverId !== undefined && params.serverId !== null && String(params.serverId) !== '';
  }

  function simpleHash(str) {
    str = String(str || '');
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  function generateUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getDeviceIdCacheKey(account) {
    var basis = '';
    try {
      if (account && account.info) {
        basis = account.info;
      } else if (account && account.payload && account.payload.info) {
        basis = account.payload.info;
      } else {
        var hex = getHex();
        if (hex) basis = hex.slice(0, 64);
      }
    } catch (e) {}
    return '__deviceUniqueId_' + (basis ? simpleHash(String(basis)) : 'default');
  }

  function getDeviceUniqueId(account) {
    try {
      var key = getDeviceIdCacheKey(account);
      var deviceId = localStorage.getItem(key);
      if (deviceId && deviceId.indexOf('DID-') === 0) return deviceId;
      deviceId = 'DID-' + generateUuid();
      localStorage.setItem(key, deviceId);
      return deviceId;
    } catch (e) {
      return 'DID-' + generateUuid();
    }
  }

  function copyPayloadFields(target, payload) {
    if (!target || !payload) return target;
    Object.keys(payload).forEach(function (key) {
      if (payload[key] !== undefined && payload[key] !== null) {
        target[key] = payload[key];
      }
    });
    return target;
  }

  function applyAccountFields(target, account, mode) {
    target = target || {};
    var payload = account && account.payload ? account.payload : {};
    if (!payload) return target;

    if (mode === 'auth-first') {
      Object.keys(target).forEach(function (key) { delete target[key]; });
      copyPayloadFields(target, payload);
    } else if (mode === 'auth-switch') {
      var gameServerId = target.serverId;
      copyPayloadFields(target, payload);
      if (gameServerId !== undefined && gameServerId !== null && String(gameServerId) !== '') {
        target.serverId = gameServerId;
      }
    } else {
      if (payload.info !== undefined && payload.info !== null) target.info = payload.info;
      if (payload.platform !== undefined && payload.platform !== null) target.platform = payload.platform;
      if (payload.platformExt !== undefined && payload.platformExt !== null) target.platformExt = payload.platformExt;
      if (!hasServerIdField(target) && payload.serverId !== undefined && payload.serverId !== null) {
        target.serverId = payload.serverId;
      }
    }

    try { target.deviceUniqueId = getDeviceUniqueId(account); } catch (e) {}
    return target;
  }

  function base64ToArrayBuffer(base64) {
    var binaryString = atob(String(base64 || ''));
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i) & 255;
    }
    return bytes.buffer;
  }

  function tryParseJsonAccount(base64Data) {
    try {
      var jsonStr = atob(String(base64Data || ''));
      var data = JSON.parse(jsonStr);
      if (data && data.data && data.data.info) return data.data;
      if (data && data.info) return data;
    } catch (e) {}
    return null;
  }

  function patchHttpDelegate() {
    try {
      var proto = window.o4e && window.o4e.HttpDelegate && window.o4e.HttpDelegate.prototype;
      var orig = proto && proto.sendAsync;
      if (typeof orig !== 'function') return false;
      if (orig.__cdNativeHttpPatched) return true;

      var wrapped = function (request) {
        var account = window.__cdNativeAccount;
        var wireParams = account && account.wireParams;
        if (wireParams && request && request.params && request.params.info) {
          var requestServerId = request.params.serverId;
          request.params = Object.assign({}, wireParams,
            requestServerId ? { serverId: requestServerId } : {});
          if (account.injectServerId) {
            request.params.serverId = account.injectServerId;
            account.injectServerId = null;
          }
        }
        return orig.call(this, request);
      };
      wrapped.__cdNativeHttpPatched = true;
      wrapped.__cdNativeOrig = orig;
      proto.sendAsync = wrapped;
      return true;
    } catch (e) {
      return false;
    }
  }

  function restoreLoginService(loginService) {
    if (!loginService) return;
    if (loginService.authUser && loginService.authUser.__cdNativeOrig) {
      loginService.authUser = loginService.authUser.__cdNativeOrig;
    }
    if (loginService.serverList && loginService.serverList.__cdNativeOrig) {
      loginService.serverList = loginService.serverList.__cdNativeOrig;
    }
  }

  function restoreNativePatches(dataIndex) {
    try { restoreLoginService(dataIndex && dataIndex.LoginService); } catch (e) {}
    try {
      if (dataIndex && dataIndex.Isolate && dataIndex.Isolate.__cdNativeOrig) {
        dataIndex.Isolate = dataIndex.Isolate.__cdNativeOrig;
      }
    } catch (e) {}
  }

  function patchLoginService(loginService) {
    if (!loginService) return;
    if (loginService.authUser && !loginService.authUser.__cdNativePatched) {
      var origAuth = loginService.authUser;
      var wrappedAuth = function (params) {
        var account = window.__cdNativeAccount;
        if (!account || !patchHttpDelegate()) {
          return pauseLoginCall('auth', wrappedAuth, this, arguments);
        }
        window.__cdFirstAuthDone = true;
        return watchLoginResult(origAuth.apply(this, arguments), 'auth');
      };
      wrappedAuth.__cdNativePatched = true;
      wrappedAuth.__cdNativeOrig = origAuth;
      loginService.authUser = wrappedAuth;
    }
    if (loginService.serverList && !loginService.serverList.__cdNativePatched) {
      var origServerList = loginService.serverList;
      var wrappedServerList = function (params) {
        var account = window.__cdNativeAccount;
        if (!account || !patchHttpDelegate()) {
          return pauseLoginCall('server list', wrappedServerList, this, arguments);
        }
        return watchLoginResult(origServerList.apply(this, arguments), 'server-list');
      };
      wrappedServerList.__cdNativePatched = true;
      wrappedServerList.__cdNativeOrig = origServerList;
      loginService.serverList = wrappedServerList;
    }
  }

  function patchIsolate(dataIndex) {
    if (!dataIndex || !dataIndex.Isolate || dataIndex.Isolate.__cdNativePatched) return;
    var OrigIsolate = dataIndex.Isolate;
    var WrappedIsolate = function () {
      var args = Array.prototype.slice.call(arguments);
      var instance = new (Function.prototype.bind.apply(OrigIsolate, [null].concat(args)))();
      try { patchLoginService(instance && instance.LoginService); } catch (e) {}
      return instance;
    };
    try {
      WrappedIsolate.prototype = OrigIsolate.prototype;
      Object.keys(OrigIsolate).forEach(function (key) { WrappedIsolate[key] = OrigIsolate[key]; });
    } catch (e) {}
    WrappedIsolate.__cdNativePatched = true;
    WrappedIsolate.__cdNativeOrig = OrigIsolate;
    dataIndex.Isolate = WrappedIsolate;
  }

  function decodeAccount(dataModule) {
    var hex = getHex();
    if (!hex) return null;
    var bytes = hexToBytes(hex);
    if (!bytes || !bytes.length) return null;
    var binBase64 = bytesToBase64(bytes);
    var decoded = null;
    var raw = tryParseJsonAccount(binBase64);
    if (!raw) {
      decoded = dataModule.decMsg(base64ToArrayBuffer(binBase64), {
        decrypt: dataModule.lz4XorDecode,
        encrypt: dataModule.lz4XorEncode
      });
      raw = decoded && (decoded._raw || decoded.rawData || decoded);
    }
    var payload = null;
    var platformExt = 'mix';
    var info = null;
    var serverId = raw && raw.serverId || null;
    if (raw && raw.info) {
      payload = Object.assign({}, raw);
      if (payload.info && typeof payload.info === 'object') {
        payload.info = JSON.stringify(payload.info);
      }
      platformExt = payload.platformExt || 'mix';
      info = payload.info;
      serverId = payload.serverId || null;
    } else {
      info = JSON.stringify(raw || decoded || {});
      payload = {
        platform: 'hortor',
        platformExt: platformExt,
        info: info,
        serverId: null,
        scene: 0,
        referrerInfo: '',
        rtt: 0
      };
    }
    return {
      payload: payload,
      platformExt: platformExt,
      info: info,
      serverId: serverId,
      wireParams: raw,
      injectServerId: serverId
    };
  }

  function requestRoleList(force) {
    if (window.__cdRoleListReady && !force) return;
    if (window.__cdRoleListLoading && !force) return;
    window.__cdRoleListLoading = true;
    setTimeout(function () {
      var dataModule = null;
      try {
        var req = window.__require;
        dataModule = req && req('13');
        if (!dataModule || !dataModule.encMsg || !dataModule.decMsg) throw new Error('GameCrypto not ready');
        var account = decodeAccount(dataModule);
        if (!account || !account.payload || !account.info) throw new Error('account not ready');
        var payload = Object.assign({}, account.payload);
        payload.serverId = 0;
        var body = encodeAccountPayload(dataModule, payload);
        proxyPostAsync('/api/xxz/login/serverlist?_seq=3', { Accept: '*/*' }, body, 'application/octet-stream', function (result) {
          try {
            if (!result || result.status !== 200) throw new Error('HTTP ' + (result && result.status || 0));
            var roles = decodeServerList(dataModule, base64ToBytes(result.bodyBase64 || ''));
            window.__cdRoleListReady = true;
            if (window.AndroidBinBridge && AndroidBinBridge.reportRoleList) {
              AndroidBinBridge.reportRoleList(JSON.stringify(roles));
            }
          } catch (e) {
            reportRoleError(e && e.message || e);
          } finally {
            window.__cdRoleListLoading = false;
          }
        });
      } catch (e) {
        window.__cdRoleListLoading = false;
        reportRoleError(e && e.message || e);
      }
    }, 0);
  }

  window.__cdPreloadRoleList = requestRoleList;

  window.__cdBuildRoleBinHex = function (serverId) {
    var req = window.__require;
    var dataModule = req && req('13');
    if (!dataModule || !dataModule.encMsg) return '';
    var account = decodeAccount(dataModule);
    if (!account || !account.payload) return '';
    var payload = Object.assign({}, account.payload);
    payload.serverId = Number(serverId) || 0;
    return bytesToHex(encodeAccountPayload(dataModule, payload));
  };

  function applyNativeAccount(resetPatch) {
    if (typeof window.__require !== 'function') return false;
    var dataModule = window.__require('13');
    var dataIndex = window.__require('data-index');
    var loginService = dataIndex && dataIndex.LoginService;
    if (!dataModule || !dataIndex || !loginService) return false;
    var account = decodeAccount(dataModule);
    if (!account || !account.info) return false;

    window.__cdNativeAccount = account;
    if (!patchHttpDelegate()) return false;
    if (resetPatch) restoreNativePatches(dataIndex);
    patchLoginService(dataIndex.LoginService);
    patchIsolate(dataIndex);
    try {
      if (window.AndroidBinBridge && AndroidBinBridge.reportCurrentServer) {
        AndroidBinBridge.reportCurrentServer(String(account.serverId || ''));
      }
    } catch (e) {}
    log('[CD Native Login] account injected', AndroidBinBridge.getBinName && AndroidBinBridge.getBinName(), account.serverId || '');
    replayPendingLogin();
    return true;
  }

  function tryPatch() {
    try {
      return applyNativeAccount(false);
    } catch (e) {
      return false;
    }
  }

  function triggerGameSwitch() {
    try {
      var req = window.__require;
      if (!req) {
        location.reload();
        return false;
      }
      var gameMod = req('Game');
      var typesMod = req('types-common');
      var loginManagerMod = req('LoginManager');
      var Game = gameMod && gameMod.Game;
      var GameState = typesMod && typesMod.GameState;
      var LoginManager = loginManagerMod && loginManagerMod.LoginManager;
      if (!Game || !Game.instance || !Game.instance.stateMachine || !GameState) {
        location.reload();
        return false;
      }
      if (LoginManager && LoginManager.instance) {
        LoginManager.instance.isManualSwitchRole = true;
      }
      Game.instance.stateMachine.transition(GameState.SwitchRole, 1, null, 0, null);
      return true;
    } catch (e) {}
    location.reload();
    return false;
  }

  window.__cdTryNativeLoginPatch = tryPatch;
  window.__cdHotSwitchBin = function () {
    try {
      clearServerCache();
      window.__binHex = getHex();
      if (window.__cdSyncShellSettings) window.__cdSyncShellSettings();
      if (!applyNativeAccount(true)) {
        location.reload();
        return false;
      }
      setTimeout(triggerGameSwitch, 150);
      return true;
    } catch (e) {
      location.reload();
      return false;
    }
  };

  if (!window.__cdNativeLoginPatchInstalled) {
    window.__cdNativeLoginPatchInstalled = true;
  }

  try {
    if (window.__cdNativeLoginPatchTimer) {
      clearInterval(window.__cdNativeLoginPatchTimer);
    }
  } catch (e) {}
  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    if (tryPatch()) {
      clearInterval(timer);
      window.__cdNativeLoginPatchTimer = null;
      return;
    }
    if (tries > 300) {
      clearInterval(timer);
      timer = setInterval(function () { tryPatch(); }, 1000);
      window.__cdNativeLoginPatchTimer = timer;
    }
  }, 50);
  window.__cdNativeLoginPatchTimer = timer;
  tryPatch();
})();
