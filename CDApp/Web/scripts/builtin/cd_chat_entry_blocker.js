(function () {
  "use strict";

  if (window.__chatEntryBlockerInstalled) return;
  window.__chatEntryBlockerInstalled = true;

  var TAG = "[ChatEntryBlocker]";
  var WRAP_FLAG = "__chatEntryBlockerWrapped_";
  var CLASS_MARK = "__chatEntryBlockerName";
  var TICK_MS = 500;

  var enabled = readEnabledSetting();
  var safeClosedProxy = null;
  var timer = null;

  var stats = {
    patched: 0,
    blockedGoto: 0,
    blockedProxy: 0,
    hidden: 0,
    attempts: 0
  };

  var CHAT_PROXY_NAMES = {
    NewChatPanel: true,
    ChatDialog: true,
    TopChatDialog: true,
    TopPlushChatDialog: true,
    UI_NewChatPanel: true
  };

  var CHAT_ENTRY_NAMES = {
    MainPanelChat: true,
    MainPanelChatItem: true,
    MainPanelChatComp: true,
    BtnChat: true,
    UI_MainPanelChat: true,
    UI_MainPanelChatItem: true,
    UI_BtnChat: true
  };

  var CHAT_RESOURCE_URLS = {
    "ui://r6ibbv0plmbho": true,
    "ui://h3ae88appwx71v6f4j6": true
  };

  function warnOnce(key, err) {
    var flag = "__chatEntryBlockerWarned_" + key;
    if (window[flag]) return;
    window[flag] = true;
    console.warn(TAG, key, err);
  }

  function safeRun(key, fn, fallback) {
    try {
      return fn();
    } catch (err) {
      warnOnce(key, err);
      return fallback == null ? null : fallback;
    }
  }

  function safeRequire(name) {
    return safeRun("require:" + name, function () {
      if (typeof window.__require !== "function") return null;
      return window.__require(name);
    }, null);
  }

  function readEnabledSetting() {
    if (window.__cdShellSettings && typeof window.__cdShellSettings.chatEntryBlocker !== "undefined") {
      return !!window.__cdShellSettings.chatEntryBlocker;
    }
    try {
      if (window.AndroidBinBridge && typeof window.AndroidBinBridge.isChatEntryBlockerEnabled === "function") {
        return !!window.AndroidBinBridge.isChatEntryBlockerEnabled();
      }
    } catch (err) {}
    return false;
  }

  function syncEnabledSetting() {
    enabled = readEnabledSetting();
    return enabled;
  }

  function isGameReadyForChatBlocker() {
    return safeRun("gameReady", function () {
      if (typeof window.__require !== "function") return false;
      var uiMod = safeRequire("index-ui");
      var mainMod = safeRequire("MainPanel");
      if (uiMod && mainMod && mainMod.MainPanel && typeof uiMod.GET_PROXY === "function") {
        var proxy = uiMod.GET_PROXY(mainMod.MainPanel);
        return !!(proxy && proxy.ui);
      }
      return false;
    }, false) === true;
  }

  function resolved(value) {
    if (typeof Promise !== "undefined" && Promise.resolve) {
      return Promise.resolve(value == null ? null : value);
    }
    return value == null ? null : value;
  }

  function getSafeClosedProxy() {
    if (safeClosedProxy) return safeClosedProxy;
    safeClosedProxy = {
      isShow: false,
      ui: {},
      model: {
        values: {},
        get: function () {
          return null;
        },
        set: function () {},
        sets: function () {},
        clear: function () {}
      },
      show: function () {
        return resolved(null);
      },
      hide: function () {
        return resolved(null);
      },
      close: function () {
        return resolved(null);
      }
    };
    return safeClosedProxy;
  }

  function markClass(cls, name) {
    if (!cls) return false;
    if (cls[CLASS_MARK] === name) return true;
    safeRun("markClass:" + name, function () {
      cls[CLASS_MARK] = name;
      cls.__chatEntryBlockerName = name;
    });
    return true;
  }

  function pushName(list, value) {
    if (typeof value === "string" && value && list.indexOf(value) < 0) {
      list.push(value);
    }
  }

  function collectNames(target) {
    var names = [];
    if (!target) return names;

    pushName(names, target[CLASS_MARK]);
    pushName(names, target.__chatEntryBlockerName);
    pushName(names, target.name);
    pushName(names, target.URL);
    pushName(names, target.PackageURI);
    pushName(names, target.resourceURL);
    pushName(names, target._resourceURL);

    if (target.constructor) {
      pushName(names, target.constructor[CLASS_MARK]);
      pushName(names, target.constructor.__chatEntryBlockerName);
      pushName(names, target.constructor.name);
      pushName(names, target.constructor.URL);
      pushName(names, target.constructor.PackageURI);
    }

    if (target.ui) {
      pushName(names, target.ui.name);
      pushName(names, target.ui.URL);
      pushName(names, target.ui.PackageURI);
      pushName(names, target.ui.resourceURL);
      pushName(names, target.ui._resourceURL);
    }

    if (target.packageItem) {
      pushName(names, target.packageItem.name);
      pushName(names, target.packageItem.owner && target.packageItem.owner.name);
    }

    return names;
  }

  function isChatProxy(target) {
    var names = collectNames(target);
    for (var i = 0; i < names.length; i++) {
      if (CHAT_PROXY_NAMES[names[i]]) return true;
      if (CHAT_RESOURCE_URLS[names[i]]) return true;
    }
    return false;
  }

  function wrapMethod(target, method, handler) {
    if (!target || typeof target[method] !== "function") return false;
    var flag = WRAP_FLAG + method;
    if (target[flag]) return true;

    var original = target[method];
    return safeRun("wrap:" + method, function () {
      target[method] = function () {
        return handler.call(this, original, arguments, method);
      };
      target[flag] = true;
      stats.patched++;
      return true;
    }, false);
  }

  function blockProxyReturn(method) {
    if (/try/i.test(method)) {
      return resolved({ isOk: false, blocked: true });
    }
    if (/over|deferred|queue/i.test(method)) {
      return resolved(getSafeClosedProxy());
    }
    return getSafeClosedProxy();
  }

  function blockProxyOpen(method) {
    stats.blockedProxy++;
    return null;
  }

  function isChatModuleType(value) {
    var configs = safeRequire("Configs");
    var moduleType = configs && configs.ModuleType;
    if (moduleType) {
      if (value === moduleType.CHAT) return true;
      if (moduleType[value] === "CHAT") return true;
    }
    return value === "CHAT" || value === "chat";
  }

  function hideObject(obj) {
    if (!obj) return false;
    if (!isSafeChatEntryObject(obj)) return false;
    return safeRun("hideObject", function () {
      if (!obj.__chatEntryBlockerHidden) {
        obj.__chatEntryBlockerHidden = true;
        obj.__chatEntryBlockerState = {
          visible: obj.visible,
          touchable: obj.touchable,
          alpha: "alpha" in obj ? obj.alpha : null
        };
        stats.hidden++;
      }
      obj.visible = false;
      obj.touchable = false;
      if ("alpha" in obj) obj.alpha = 0;
      if (typeof obj.clearClick === "function") obj.clearClick();
      if (obj.m_showRed) obj.m_showRed.selectedPage = "false";
      if (obj.m_showChatRed) obj.m_showChatRed.selectedPage = "false";
      if (obj.m_redDot) obj.m_redDot.visible = false;
      if (obj.m_chatItemList) obj.m_chatItemList.numItems = 0;
      return true;
    }, false);
  }

  function restoreObject(obj) {
    if (!obj || !obj.__chatEntryBlockerHidden) return false;
    return safeRun("restoreObject", function () {
      var state = obj.__chatEntryBlockerState || {};
      if (typeof state.visible !== "undefined") obj.visible = state.visible;
      if (typeof state.touchable !== "undefined") obj.touchable = state.touchable;
      if (state.alpha != null && "alpha" in obj) obj.alpha = state.alpha;
      obj.__chatEntryBlockerHidden = false;
      return true;
    }, false);
  }

  function hideProxy(proxy) {
    if (!proxy) return;
    if (proxy.ui) {
      hideObject(proxy.ui.m_chat);
      hideObject(proxy.ui.m_btnChat);
      hideObject(proxy.ui.m_btnChatRed);
    }
  }

  function getObjectName(obj) {
    var names = collectNames(obj);
    for (var i = 0; i < names.length; i++) {
      if (names[i]) return names[i];
    }
    return "";
  }

  function shouldHideObject(obj) {
    if (!obj) return false;
    var names = collectNames(obj);
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (CHAT_RESOURCE_URLS[name] || CHAT_ENTRY_NAMES[name] || CHAT_PROXY_NAMES[name]) {
        return true;
      }
      if (/^(m_)?btn_?chat$/i.test(name) || /^(m_)?chat$/i.test(name)) {
        return true;
      }
    }
    return false;
  }

  function isSafeChatEntryObject(obj) {
    if (!obj) return false;
    if (shouldHideObject(obj)) return true;
    if (obj.m_chatItemList || obj.m_showChatRed) return true;
    if (obj.m_showRed && obj.m_redDot) return true;
    if (obj.name && /^(m_)?(btn_?)?chat(red)?$/i.test(String(obj.name))) return true;
    return false;
  }

  function walkFgui(obj, visit) {
    if (!obj) return;
    visit(obj);
    var count = Number(obj.numChildren || 0);
    for (var i = 0; i < count; i++) {
      var child = null;
      safeRun("getChildAt", function () {
        child = obj.getChildAt(i);
      });
      if (child) walkFgui(child, visit);
    }
  }

  function sweepFgui() {
    if (!enabled) return false;
    return hideMainPanelEntry();
  }

  function hideMainPanelEntry() {
    if (!enabled) return false;
    return safeRun("hideMainPanelEntry", function () {
      var uiMod = safeRequire("index-ui");
      var mainMod = safeRequire("MainPanel");
      if (!uiMod || !mainMod || !mainMod.MainPanel || typeof uiMod.GET_PROXY !== "function") {
        return false;
      }
      var proxy = uiMod.GET_PROXY(mainMod.MainPanel);
      if (!proxy || !proxy.ui) return false;
      hideObject(proxy.ui.m_chat);
      hideObject(proxy.ui.m_btnChat);
      hideObject(proxy.ui.m_btnChatRed);
      return true;
    }, false);
  }

  function restoreMainPanelEntry() {
    return safeRun("restoreMainPanelEntry", function () {
      var uiMod = safeRequire("index-ui");
      var mainMod = safeRequire("MainPanel");
      if (!uiMod || !mainMod || !mainMod.MainPanel || typeof uiMod.GET_PROXY !== "function") {
        return false;
      }
      var proxy = uiMod.GET_PROXY(mainMod.MainPanel);
      if (!proxy || !proxy.ui) return false;
      restoreObject(proxy.ui.m_chat);
      restoreObject(proxy.ui.m_btnChat);
      restoreObject(proxy.ui.m_btnChatRed);
      return true;
    }, false);
  }

  function restoreFgui() {
    return false;
  }

  function restoreAll() {
    restoreMainPanelEntry();
    restoreFgui();
  }

  function closeOpenChatProxies() {
    return;
  }

  function patchUiOpeners() {
    return false;
  }

  function patchModuleGoto() {
    var patched = false;
    var moduleMod = safeRequire("ModuleManager");
    if (!moduleMod) return false;

    patched =
      wrapMethod(moduleMod, "GOTO", function (original, args) {
        if (enabled && isChatModuleType(args[0])) {
          stats.blockedGoto++;
          return false;
        }
        return original.apply(this, args);
      }) || patched;

    if (moduleMod.ModuleManager && moduleMod.ModuleManager.prototype) {
      patched =
        wrapMethod(moduleMod.ModuleManager.prototype, "goto", function (original, args) {
          if (enabled && isChatModuleType(args[0])) {
            stats.blockedGoto++;
            return false;
          }
          return original.apply(this, args);
        }) || patched;
    }

    var configs = safeRequire("Configs");
    var chatType = configs && configs.ModuleType && configs.ModuleType.CHAT;
    var chatModule = null;
    if (chatType != null && typeof moduleMod.GET_MODULE === "function") {
      chatModule = moduleMod.GET_MODULE(chatType);
    }
    if (chatModule) {
      patched =
        wrapMethod(chatModule, "goto", function (original, args) {
          if (enabled) {
            stats.blockedGoto++;
            return false;
          }
          return original.apply(this, args);
        }) || patched;
    }

    return patched;
  }

  function patchChatClasses() {
    var patched = false;

    var chatPanel = safeRequire("ChatPanel");
    if (chatPanel && chatPanel.NewChatPanel) {
      markClass(chatPanel.NewChatPanel, "NewChatPanel");
      if (chatPanel.NewChatPanel.prototype) {
        patched = true;
      }
    }

    var chatDialog = safeRequire("ChatDialog");
    if (chatDialog && chatDialog.ChatDialog) {
      markClass(chatDialog.ChatDialog, "ChatDialog");
    }

    var topChat = safeRequire("TopChatDIalog");
    if (topChat) {
      markClass(topChat.TopChatDialog, "TopChatDialog");
      markClass(topChat.TopPlushChatDialog, "TopPlushChatDialog");
    }

    var chatModule = safeRequire("ChatModule");
    if (chatModule && chatModule.ChatModule && chatModule.ChatModule.prototype) {
      patched =
        wrapMethod(chatModule.ChatModule.prototype, "goto", function (original, args) {
          if (enabled) {
            stats.blockedGoto++;
            return false;
          }
          return original.apply(this, args);
        }) || patched;
    }

    var mainChat = safeRequire("MainPanelChatComp");
    if (mainChat && mainChat.MainPanelChatComp && mainChat.MainPanelChatComp.prototype) {
      var proto = mainChat.MainPanelChatComp.prototype;

      patched =
        wrapMethod(proto, "_showChatPanel", function (original, args) {
          if (enabled) {
            hideObject(this._chatUI);
            stats.blockedGoto++;
            return false;
          }
          return original.apply(this, args);
        }) || patched;

      patched =
        wrapMethod(proto, "_jumpToChat", function (original, args) {
          if (enabled) {
            hideObject(this._chatUI);
            stats.blockedGoto++;
            return false;
          }
          return original.apply(this, args);
        }) || patched;

      patched =
        wrapMethod(proto, "onAwake", function (original, args) {
          var ret = original.apply(this, args);
          if (enabled) hideObject(this._chatUI);
          return ret;
        }) || patched;

      patched =
        wrapMethod(proto, "onShow", function (original, args) {
          var ret = original.apply(this, args);
          if (enabled) hideObject(this._chatUI);
          return ret;
        }) || patched;

      patched =
        wrapMethod(proto, "_refresh", function (original, args) {
          var ret = original.apply(this, args);
          if (enabled) {
            hideObject(this._chatUI);
          }
          return ret;
        }) || patched;

      patched =
        wrapMethod(proto, "_refreshRed", function (original, args) {
          var ret = original.apply(this, args);
          if (enabled) {
            hideObject(this._chatUI);
          }
          return ret;
        }) || patched;
    }

    return patched;
  }

  function patchAll() {
    syncEnabledSetting();
    stats.attempts++;
    if (!isGameReadyForChatBlocker()) {
      return false;
    }
    patchChatClasses();
    patchModuleGoto();
    patchUiOpeners();
    if (enabled) {
      hideMainPanelEntry();
      sweepFgui();
      closeOpenChatProxies();
    }
    return true;
  }

  function start() {
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      if (patchAll() && enabled) {
        clearInterval(timer);
        timer = setInterval(patchAll, 3000);
      }
    }, TICK_MS);
    console.log(TAG + " installed.");
  }

  window.__chatEntryBlocker = {
    stats: stats,
    patch: patchAll,
    sweep: sweepFgui,
    enable: function () {
      enabled = true;
      window.__cdShellSettings = window.__cdShellSettings || {};
      window.__cdShellSettings.chatEntryBlocker = true;
      patchAll();
    },
    disable: function () {
      enabled = false;
      window.__cdShellSettings = window.__cdShellSettings || {};
      window.__cdShellSettings.chatEntryBlocker = false;
      restoreAll();
    },
    isEnabled: function () {
      return enabled;
    },
    getHiddenName: getObjectName
  };

  start();
})();
