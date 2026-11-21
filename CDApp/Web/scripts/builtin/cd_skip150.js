(function () {
  "use strict";

  var hostWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  if (hostWindow.Skip150Auto && hostWindow.Skip150Auto.__initialized) {
    if (typeof hostWindow.Skip150Auto.applyHook === "function") {
      hostWindow.Skip150Auto.applyHook();
    }
    return;
  }

  var state = {
    hookInjected: false,
    retryTimer: null,
    retryCount: 0
  };

  function cloneLevelConfigWithEmptyMonsters(levelConfig) {
    if (!levelConfig || typeof levelConfig !== "object") {
      return levelConfig;
    }
    if (!Object.prototype.hasOwnProperty.call(levelConfig, "monsters")) {
      return levelConfig;
    }
    var copy;
    var key;
    if (Object.prototype.toString.call(levelConfig) === "[object Array]") {
      copy = levelConfig.slice();
    } else {
      copy = {};
      for (key in levelConfig) {
        if (Object.prototype.hasOwnProperty.call(levelConfig, key)) {
          copy[key] = levelConfig[key];
        }
      }
    }
    if (!copy.monsters || Object.prototype.toString.call(copy.monsters) !== "[object Array]") {
      return levelConfig;
    }
    copy.monsters = [[[0]]];
    return copy;
  }

  var api = {
    __initialized: true,
    state: state,
    applyHook: function () {
      try {
        var requireFn = hostWindow.__require;
        if (typeof requireFn !== "function") {
          state.hookInjected = false;
          return false;
        }
        var configs = requireFn("Configs");
        if (!configs || !configs.LevelConf || typeof configs.LevelConf.getById !== "function") {
          state.hookInjected = false;
          return false;
        }
        if (configs.LevelConf.getById.__skip150Auto) {
          state.hookInjected = true;
          return true;
        }

        var originalGetById = configs.LevelConf.getById.__skip150Original__
          || configs.LevelConf.getById.bind(configs.LevelConf);
        var patchedGetById = function (levelId) {
          var levelConfig = originalGetById(levelId);
          var id = Number(levelId);
          if (id >= 2 && id <= 150) {
            return cloneLevelConfigWithEmptyMonsters(levelConfig);
          }
          return levelConfig;
        };
        patchedGetById.__skip150Auto = true;
        patchedGetById.__skip150Original__ = originalGetById;
        configs.LevelConf.getById = patchedGetById;
        state.hookInjected = true;
        return true;
      } catch (error) {
        state.hookInjected = false;
        return false;
      }
    },
    stopRetry: function () {
      if (state.retryTimer) {
        clearInterval(state.retryTimer);
        state.retryTimer = null;
      }
    },
    startRetry: function () {
      if (state.retryTimer) {
        return;
      }
      state.retryCount = 0;
      state.retryTimer = setInterval(function () {
        state.retryCount++;
        if (api.applyHook() || state.retryCount >= 120) {
          api.stopRetry();
        }
      }, 1000);
    }
  };

  hostWindow.Skip150Auto = api;
  if (!api.applyHook()) {
    api.startRetry();
  }
})();
