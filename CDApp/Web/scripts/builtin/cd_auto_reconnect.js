(function bootstrapCdAutoReconnect() {
  "use strict";

  var VERSION = 1;
  var INSTALL_KEY = "__cdAutoReconnectInstalled";
  var NETWORK_HOOK_KEY = "__cdAutoReconnectNetworkHook";
  var STATE_KEY = "__cdAutoReconnectState";

  var gameWindow = (function () {
    try {
      if (typeof unsafeWindow !== "undefined" && unsafeWindow) {
        return unsafeWindow;
      }
    } catch (e) {}
    return window;
  })();

  function safeCall(fn, fallback) {
    try {
      return fn();
    } catch (e) {
      return fallback;
    }
  }

  function log() {}

  function bridge() {
    return safeCall(function () {
      return gameWindow.AndroidBinBridge || window.AndroidBinBridge || null;
    }, null);
  }

  function isEnabled() {
    return safeCall(function () {
      var api = bridge();
      return !!(
        api &&
        typeof api.isAutoReconnectEnabled === "function" &&
        api.isAutoReconnectEnabled()
      );
    }, false);
  }

  function getDelayMs() {
    return safeCall(function () {
      var api = bridge();
      var value = api && typeof api.getAutoReconnectDelayMillis === "function"
        ? Number(api.getAutoReconnectDelayMillis())
        : 3000;
      if (!isFinite(value)) {
        value = 3000;
      }
      if (value < 0) {
        value = 0;
      }
      if (value > 3600000) {
        value = 3600000;
      }
      return Math.round(value);
    }, 3000);
  }

  function safeRequire(name) {
    return safeCall(function () {
      if (typeof gameWindow.__require !== "function") {
        return null;
      }
      return gameWindow.__require(name);
    }, null);
  }

  function getLoginManager() {
    var mod = safeRequire("LoginManager");
    return mod && mod.LoginManager && mod.LoginManager.instance;
  }

  function isManualSwitchInProgress() {
    return safeCall(function () {
      var loginManager = getLoginManager();
      return !!(loginManager && loginManager.isManualSwitchRole);
    }, false);
  }

  function resetWaitingDialogState() {
    safeCall(function () {
      var mod = safeRequire("WaitingDialog");
      var dialog = mod && mod.WaitingDialog;
      if (!dialog) {
        return;
      }
      dialog.isKicked = false;
      if (typeof dialog.hideWaiting === "function") {
        dialog.hideWaiting();
      }
    });
  }

  var state = {
    version: VERSION,
    networkHooked: false,
    networkHookTarget: "",
    reconnecting: false,
    timer: null,
    waitTimer: null,
    deadline: 0,
    pendingReason: "",
    lastError: "",
    lastCloseError: "",
    lastEvent: "",
    scheduleCount: 0
  };

  function snapshotState() {
    return {
      version: VERSION,
      requireReady: typeof gameWindow.__require === "function",
      ccReady: !!(gameWindow.cc && gameWindow.cc.game),
      loginReady: !!getLoginManager(),
      enabled: isEnabled(),
      delayMs: getDelayMs(),
      networkHooked: state.networkHooked,
      networkHookTarget: state.networkHookTarget,
      reconnecting: state.reconnecting,
      deadline: state.deadline,
      pendingReason: state.pendingReason,
      lastError: state.lastError,
      lastCloseError: state.lastCloseError,
      lastEvent: state.lastEvent,
      scheduleCount: state.scheduleCount
    };
  }

  function updateState(patch) {
    var key;
    for (key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        state[key] = patch[key];
      }
    }
    safeCall(function () {
      gameWindow[STATE_KEY] = snapshotState();
    });
  }

  function clearPendingReconnect() {
    if (state.timer) {
      clearTimeout(state.timer);
    }
    updateState({
      timer: null,
      deadline: 0,
      pendingReason: ""
    });
  }

  function formatError(error) {
    if (!error) {
      return "unknown";
    }
    if (typeof error === "string") {
      return error;
    }
    if (error.message) {
      return error.message;
    }
    try {
      return JSON.stringify(error);
    } catch (e) {
      return String(error);
    }
  }

  function failReconnect(error) {
    var message = formatError(error);
    updateState({
      reconnecting: false,
      lastError: message
    });
    log("reconnect failed", message);
    return false;
  }

  function reconnectNow(reason) {
    var loginManager;
    var result;

    if (state.reconnecting) {
      log("reconnect already running");
      return Promise.resolve(false);
    }

    clearPendingReconnect();
    updateState({
      reconnecting: true,
      lastError: ""
    });
    log("start reconnect", reason || "");

    loginManager = getLoginManager();
    if (!loginManager || typeof loginManager.reLogin !== "function") {
      return Promise.resolve(failReconnect("LoginManager unavailable"));
    }

    resetWaitingDialogState();

    try {
      loginManager._authUserResult = null;
      loginManager._tryReLoginTimes = 0;
      loginManager.exitWhenNetClose = false;
      loginManager.repeatConnect = true;
      result = loginManager.reLogin();
    } catch (error) {
      return Promise.resolve(failReconnect(error));
    }

    return Promise.resolve(result)
      .then(function () {
        updateState({
          reconnecting: false,
          lastError: ""
        });
        resetWaitingDialogState();
        log("reconnect success");
        return true;
      })
      .catch(function (error) {
        return failReconnect(error);
      });
  }

  function scheduleReconnect(reason) {
    var delayMs;
    var deadline;

    if (!isEnabled()) {
      log("auto reconnect disabled");
      return false;
    }

    if (isManualSwitchInProgress()) {
      log("skip reconnect during manual switch");
      return false;
    }

    if (state.reconnecting) {
      log("websocket closed while reconnecting");
      return true;
    }

    if (state.deadline > Date.now()) {
      log("reconnect already scheduled");
      return true;
    }

    delayMs = getDelayMs();
    deadline = Date.now() + delayMs;
    updateState({
      deadline: deadline,
      pendingReason: reason,
      scheduleCount: state.scheduleCount + 1
    });

    state.timer = setTimeout(function () {
      updateState({
        timer: null,
        deadline: 0,
        pendingReason: ""
      });
      if (!isEnabled()) {
        log("skip scheduled reconnect, disabled before timer fired");
        return;
      }
      reconnectNow(reason);
    }, delayMs);

    updateState({ timer: state.timer });
    log("scheduled reconnect", delayMs + "ms", reason || "");
    return true;
  }

  function extractCloseErrorFromArgs(args) {
    var i;
    var item;

    for (i = 0; i < args.length; i += 1) {
      item = args[i];
      if (!item) {
        continue;
      }
      if (typeof item === "string") {
        return item;
      }
      if (typeof item.error !== "undefined") {
        return String(item.error);
      }
      if (item.data && typeof item.data.error !== "undefined") {
        return String(item.data.error);
      }
      if (typeof item.reason !== "undefined") {
        return String(item.reason);
      }
      if (typeof item.message !== "undefined") {
        return String(item.message);
      }
    }

    return "";
  }

  function summarizeArgs(args) {
    return safeCall(function () {
      var i;
      var parts = [];
      var text;

      for (i = 0; i < args.length; i += 1) {
        if (typeof args[i] === "string") {
          parts.push(args[i]);
        } else if (args[i] && typeof args[i] === "object") {
          parts.push(JSON.stringify(args[i]));
        } else {
          parts.push(String(args[i]));
        }
      }

      text = parts.join(" | ");
      return text.length > 180 ? text.slice(0, 180) + "..." : text;
    }, "");
  }

  function buildRegistrar(label, target, onMethod, offMethod) {
    return {
      label: label,
      on: function (handler, ctx) {
        return onMethod.call(target, handler, ctx);
      },
      off:
        typeof offMethod === "function"
          ? function (handler, ctx) {
              return offMethod.call(target, handler, ctx);
            }
          : null
    };
  }

  function resolveNetworkCloseRegistrar() {
    var networkModule = safeRequire("NetworkManager");
    var candidates = [];
    var i;
    var candidate;

    if (!networkModule) {
      return null;
    }

    if (networkModule.NetworkManager) {
      candidates.push({
        label: "NetworkManager",
        value: networkModule.NetworkManager
      });
    }
    if (networkModule.default) {
      candidates.push({
        label: "default",
        value: networkModule.default
      });
    }
    candidates.push({
      label: "module",
      value: networkModule
    });

    for (i = 0; i < candidates.length; i += 1) {
      candidate = candidates[i].value;
      if (!candidate) {
        continue;
      }

      if (typeof candidate.onClose === "function") {
        return buildRegistrar(
          candidates[i].label + ".onClose",
          candidate,
          candidate.onClose,
          candidate.offClose
        );
      }

      if (candidate.onClose && typeof candidate.onClose.on === "function") {
        return {
          label: candidates[i].label + ".onClose.on",
          on: function (handler, ctx) {
            return candidate.onClose.on(handler, ctx);
          },
          off:
            candidate.onClose && typeof candidate.onClose.off === "function"
              ? function (handler, ctx) {
                  return candidate.onClose.off(handler, ctx);
                }
              : null
        };
      }

      if (candidate.instance && typeof candidate.instance.onClose === "function") {
        return buildRegistrar(
          candidates[i].label + ".instance.onClose",
          candidate.instance,
          candidate.instance.onClose,
          candidate.instance.offClose
        );
      }
    }

    return null;
  }

  function installNetworkCloseHook() {
    var registrar = resolveNetworkCloseRegistrar();
    var ctx;
    var handler;

    if (!registrar) {
      return false;
    }

    if (
      gameWindow[NETWORK_HOOK_KEY] &&
      gameWindow[NETWORK_HOOK_KEY].version === VERSION
    ) {
      updateState({
        networkHooked: true,
        networkHookTarget: gameWindow[NETWORK_HOOK_KEY].label || registrar.label
      });
      return true;
    }

    if (
      gameWindow[NETWORK_HOOK_KEY] &&
      typeof gameWindow[NETWORK_HOOK_KEY].cleanup === "function"
    ) {
      safeCall(function () {
        gameWindow[NETWORK_HOOK_KEY].cleanup();
      });
    }

    ctx = {
      tag: "cdAutoReconnect",
      version: VERSION
    };
    handler = function () {
      var args = Array.prototype.slice.call(arguments);
      var errorText = extractCloseErrorFromArgs(args);
      var eventText = summarizeArgs(args);
      var reason = errorText
        ? "websocket closed: " + errorText
        : "websocket closed";

      updateState({
        lastCloseError: errorText || "",
        lastEvent: eventText || ""
      });

      if (isManualSwitchInProgress()) {
        log("ignore close during manual switch", eventText);
        return;
      }

      log("network close detected", eventText);
      scheduleReconnect(reason);
    };

    if (!safeCall(function () {
      registrar.on(handler, ctx);
      return true;
    }, false)) {
      updateState({
        lastError: "network close hook register failed"
      });
      log("network close hook register failed", registrar.label);
      return false;
    }

    gameWindow[NETWORK_HOOK_KEY] = {
      version: VERSION,
      label: registrar.label,
      cleanup: function () {
        if (registrar.off) {
          registrar.off(handler, ctx);
        }
      }
    };

    updateState({
      networkHooked: true,
      networkHookTarget: registrar.label
    });
    log("network close hook installed", registrar.label);
    return true;
  }

  function cleanup() {
    clearPendingReconnect();
    if (state.waitTimer) {
      clearInterval(state.waitTimer);
    }
    if (
      gameWindow[NETWORK_HOOK_KEY] &&
      typeof gameWindow[NETWORK_HOOK_KEY].cleanup === "function"
    ) {
      safeCall(function () {
        gameWindow[NETWORK_HOOK_KEY].cleanup();
      });
    }
    gameWindow[NETWORK_HOOK_KEY] = null;
    delete gameWindow[STATE_KEY];
  }

  function waitForHooks() {
    var startedAt = Date.now();

    if (installNetworkCloseHook()) {
      return;
    }

    state.waitTimer = setInterval(function () {
      if (installNetworkCloseHook()) {
        clearInterval(state.waitTimer);
        updateState({ waitTimer: null });
        return;
      }

      updateState({});

      if (Date.now() - startedAt > 60000) {
        clearInterval(state.waitTimer);
        updateState({
          waitTimer: null,
          lastError: "network close hook not found"
        });
        log("network close hook not found");
      }
    }, 300);
  }

  if (gameWindow[INSTALL_KEY] && gameWindow[INSTALL_KEY].version >= VERSION) {
    updateState({});
    return;
  }

  if (
    gameWindow[INSTALL_KEY] &&
    typeof gameWindow[INSTALL_KEY].cleanup === "function"
  ) {
    safeCall(function () {
      gameWindow[INSTALL_KEY].cleanup();
    });
  }

  gameWindow[INSTALL_KEY] = {
    version: VERSION,
    cleanup: cleanup
  };

  updateState({});
  waitForHooks();
})();
