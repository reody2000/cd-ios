(function () {
  "use strict";

  var hostWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  if (hostWindow.BottleRenewAuto && hostWindow.BottleRenewAuto.__initialized) {
    try {
      hostWindow.BottleRenewAuto.start();
    } catch (err) {}
    return;
  }

  var state = {
    running: false,
    done: false,
    retryTimer: null,
    retryCount: 0,
    lastClaimSucceeded: false,
    lastClaimMethod: "",
    lastError: ""
  };

  function log(message, type) {
    var prefix = "[BottleRenewAuto]";
    try {
      if (type === "error") {
        console.error(prefix, message);
      } else if (type === "warn") {
        console.warn(prefix, message);
      } else {
        console.log(prefix, message);
      }
    } catch (err) {}
  }

  function clearRetryTimer() {
    if (state.retryTimer) {
      clearTimeout(state.retryTimer);
      state.retryTimer = null;
    }
  }

  function requireModule(name) {
    try {
      if (typeof hostWindow.__require !== "function") return null;
      return hostWindow.__require(name);
    } catch (err) {
      return null;
    }
  }

  function getBottleService() {
    var dataIndex = requireModule("data-index");
    return dataIndex && dataIndex.BottleHelperService;
  }

  function isGameReady() {
    var serverData = requireModule("ServerData");
    var role = serverData && serverData.ROLE;
    return !!(role && getBottleService());
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function renewBottle() {
    var bottleService = getBottleService();
    if (!bottleService || typeof bottleService.stop !== "function" || typeof bottleService.start !== "function") {
      throw new Error("BottleHelperService not available");
    }

    await bottleService.stop({ bottleType: -1 });
    await delay(200);
    await bottleService.start({ bottleType: -1 });
  }

  function getPropertyIgnoreCase(target, name) {
    var keys;
    var index;
    var key;

    if (!target || typeof target !== "object") return null;
    if (target[name]) return target[name];

    try {
      keys = Object.keys(target);
      for (index = 0; index < keys.length; index += 1) {
        key = keys[index];
        if (String(key).toLowerCase() === String(name).toLowerCase()) {
          return target[key];
        }
      }
    } catch (err) {}

    return null;
  }

  function collectHangupServiceCandidates() {
    var dataIndex = requireModule("data-index");
    var moduleNames = ["LegacyService"];
    var serviceNames = ["LegacyService"];
    var candidates = [];
    var seen = [];

    function push(label, value) {
      if (!value || (typeof value !== "object" && typeof value !== "function")) return;
      if (seen.indexOf(value) >= 0) return;
      seen.push(value);
      candidates.push({ label: label, value: value });
      if (value.default) push(label + ".default", value.default);
      if (value.instance) push(label + ".instance", value.instance);
      if (value.Instance) push(label + ".Instance", value.Instance);
    }

    function pushFromDataIndex(name) {
      var value = getPropertyIgnoreCase(dataIndex, name);
      push("data-index." + name, value);
    }

    serviceNames.forEach(pushFromDataIndex);
    moduleNames.forEach(function (name) {
      push(name, requireModule(name));
    });

    return candidates;
  }

  function findInternalClaimMethod() {
    var methodNames = ["claimHangUp"];
    var candidates = collectHangupServiceCandidates();
    var candidateIndex;
    var methodIndex;
    var candidate;
    var methodName;
    var method;

    for (candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      candidate = candidates[candidateIndex];
      for (methodIndex = 0; methodIndex < methodNames.length; methodIndex += 1) {
        methodName = methodNames[methodIndex];
        method = getPropertyIgnoreCase(candidate.value, methodName);
        if (typeof method === "function") {
          return {
            label: candidate.label + "." + methodName,
            target: candidate.value,
            method: method,
            params: {}
          };
        }
      }
    }

    return null;
  }

  async function claimHangupReward() {
    var claimMethod = findInternalClaimMethod();
    if (!claimMethod) {
      throw new Error("internal hangup claim method not found");
    }

    state.lastClaimMethod = claimMethod.label;
    return await claimMethod.method.call(claimMethod.target, claimMethod.params);
  }

  function scheduleRetry() {
    clearRetryTimer();
    if (state.done || state.retryCount >= 240) return;
    state.retryCount += 1;
    state.retryTimer = setTimeout(function () {
      start().catch(function (error) {
        state.lastError = error && error.message ? error.message : String(error || "retry failed");
        log("retry failed: " + state.lastError, "warn");
        scheduleRetry();
      });
    }, 1000);
  }

  async function start() {
    clearRetryTimer();
    if (state.done || state.running) return;

    if (!isGameReady()) {
      scheduleRetry();
      return;
    }

    try {
      state.running = true;
      state.lastError = "";

      try {
        await claimHangupReward();
        state.lastClaimSucceeded = true;
        log("hangup reward claimed by internal method: " + state.lastClaimMethod);
      } catch (error) {
        state.lastClaimSucceeded = false;
        state.lastClaimMethod = "";
        log("claim hangup reward failed: " + (error && error.message ? error.message : error), "warn");
      }

      await renewBottle();
      state.done = true;
      log("bottle renewed");
    } catch (error) {
      state.lastError = error && error.message ? error.message : String(error || "renew failed");
      log("bottle renew failed: " + state.lastError, "warn");
      scheduleRetry();
    } finally {
      state.running = false;
    }
  }

  function stop() {
    clearRetryTimer();
    state.running = false;
  }

  function runOnce() {
    state.done = false;
    state.retryCount = 0;
    state.lastClaimMethod = "";
    state.lastError = "";
    return start();
  }

  hostWindow.BottleRenewAuto = {
    __initialized: true,
    start: start,
    runOnce: runOnce,
    stop: stop,
    getStatus: function () {
      return {
        running: state.running,
        done: state.done,
        retryCount: state.retryCount,
        waitingRetry: !!state.retryTimer,
        lastClaimSucceeded: state.lastClaimSucceeded,
        lastClaimMethod: state.lastClaimMethod,
        lastError: state.lastError
      };
    }
  };

  start().catch(function () {});
})();
