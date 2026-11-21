(function () {
  "use strict";

  var hostWindow = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  if (hostWindow.WeirdTowerButtonCombined && hostWindow.WeirdTowerButtonCombined.__initialized) {
    try {
      if (typeof hostWindow.WeirdTowerButtonCombined.enable === "function") {
        hostWindow.WeirdTowerButtonCombined.enable();
      }
    } catch (error) {}
    return;
  }

  var BUTTON_TEXT = "自动爬塔";
  var BUTTON_BUSY_TEXT = "爬塔中";
  var BUTTON_PACKAGE = "ui_common";
  var BUTTON_OBJECT = "btnTowerHelp";
  var BUTTON_GAP = 80;
  var CMD_GET_INFO = "evotower_getinfo";
  var CMD_READY_FIGHT = "evotower_readyfight";
  var CMD_FIGHT = "evotower_fight";
  var CMD_CLAIM_REWARD = "evotower_claimreward";
  var PATCH_FLAG = "__weirdTowerButtonCombinedPatched";
  var PANEL_BUTTON_KEY = "__weirdTowerButtonCombined";
  var RUNNING_FLAG = "__weirdTowerButtonCombinedRunning";

  var state = {
    enabled: true,
    running: false,
    winCount: 0,
    loseCount: 0,
    towerInfo: null,
    loopTimer: null
  };

  var activeButtons = new Set();

  function safeRequire(moduleName) {
    try {
      if (typeof hostWindow.__require !== "function") return null;
      return hostWindow.__require(moduleName);
    } catch (error) {
      return null;
    }
  }

  function showTip(message) {
    try {
      var tipsManager = safeRequire("TipsManager");
      if (tipsManager && typeof tipsManager.SHOW_TIP === "function") {
        tipsManager.SHOW_TIP(message);
        return;
      }
    } catch (error) {}

    try {
      console.log("[WeirdTowerButtonCombined]", message);
    } catch (error) {}
  }

  function log(message, type) {
    if (type === "error") {
      console.error("[WeirdTowerButtonCombined]", message);
      return;
    }
    if (type === "warn") {
      console.warn("[WeirdTowerButtonCombined]", message);
      return;
    }
    console.log("[WeirdTowerButtonCombined]", message);
  }

  function setButtonTitle(button, title) {
    try {
      if (button) button.title = title;
    } catch (error) {}
  }

  function setButtonTouchable(button, touchable) {
    try {
      if (button) button.touchable = touchable;
    } catch (error) {}
  }

  function syncButtonState(button) {
    if (!button) return;
    setButtonTitle(button, state.running ? BUTTON_BUSY_TEXT : BUTTON_TEXT);
    setButtonTouchable(button, true);
  }

  function syncAllButtons() {
    Array.from(activeButtons).forEach(function (button) {
      if (!button || (button.parent == null && button.displayObject == null)) {
        activeButtons.delete(button);
        return;
      }
      syncButtonState(button);
    });
  }

  function getCommandCode(response) {
    if (!response) return -1;
    if (typeof response.code !== "undefined") return response.code;
    if (response.rawData && typeof response.rawData.code !== "undefined") return response.rawData.code;
    if (response._rawData && typeof response._rawData.code !== "undefined") return response._rawData.code;
    if (response.data && typeof response.data.code !== "undefined") return response.data.code;
    return undefined;
  }

  function isCommandSuccess(response) {
    var code = getCommandCode(response);
    return code === 0 || code === "0" || typeof code === "undefined" || code === null;
  }

  async function sendGameCommand(cmd, params) {
    if (!hostWindow.ws || typeof hostWindow.ws.sendAsync !== "function") {
      throw new Error("ws.sendAsync not ready");
    }

    var response = await hostWindow.ws.sendAsync({
      ack: 0,
      cmd: cmd,
      params: params || {},
      seq: Date.now(),
      time: Date.now()
    });

    if (!isCommandSuccess(response)) {
      throw new Error("cmd failed: " + cmd + " code=" + getCommandCode(response));
    }

    return response;
  }

  function formatFloor(towerId) {
    towerId = Number(towerId) || 0;
    if (towerId === 0) return "1-1";
    return Math.floor(towerId / 10) + 1 + "-" + (towerId % 10 + 1);
  }

  async function getTowerInfo() {
    var response = await sendGameCommand(CMD_GET_INFO, {});
    var evoTower = response && response._rawData && response._rawData.evoTower;
    if (!evoTower) return null;

    state.towerInfo = {
      energy: Number(evoTower.energy) || 0,
      rawTowerId: Number(evoTower.towerId) || 0,
      displayFloor: formatFloor(evoTower.towerId),
      lotteryLeftCnt: Number(evoTower.lotteryLeftCnt) || 0
    };
    return state.towerInfo;
  }

  function stopClimb(reason) {
    state.running = false;
    hostWindow[RUNNING_FLAG] = false;
    if (state.loopTimer) {
      clearTimeout(state.loopTimer);
      state.loopTimer = null;
    }
    syncAllButtons();
    if (reason) {
      log(reason + " | 胜/败: " + state.winCount + "/" + state.loseCount);
    }
  }

  async function climbLoop() {
    if (!state.running) return;

    try {
      var currentTowerInfo = state.towerInfo || await getTowerInfo();
      var currentFloorText = currentTowerInfo ? currentTowerInfo.displayFloor : "-";

      await sendGameCommand(CMD_READY_FIGHT, {});

      var fightResponse = await sendGameCommand(CMD_FIGHT, {
        battleNum: 1,
        winNum: 1
      });

      if (!(fightResponse && fightResponse._rawData && fightResponse._rawData.evoTower)) {
        state.loseCount++;
        log("战斗返回异常，记 1 负", "warn");
        showTip("挑战异常，记 1 负");
        await getTowerInfo().catch(function () {});
      } else {
        var didWin = fightResponse._rawData.winList && fightResponse._rawData.winList[0] === true;
        if (didWin) {
          state.winCount++;
        } else {
          state.loseCount++;
        }

        var latestInfo = await getTowerInfo();
        showTip(
          (didWin ? "挑战成功" : "挑战失败") +
          "，当前层 " +
          (latestInfo ? latestInfo.displayFloor : "-") +
          "，剩余小鱼干 " +
          (latestInfo ? latestInfo.energy : "-")
        );
        if (latestInfo && didWin && latestInfo.rawTowerId % 10 === 0) {
          try {
            await sendGameCommand(CMD_CLAIM_REWARD, {});
            await getTowerInfo();
            log("已自动领取阶段奖励");
            showTip("已自动领取阶段奖励");
          } catch (error) {
            log("领取阶段奖励失败: " + error.message, "warn");
            showTip("阶段奖励领取失败");
          }
        }

        log(
          (didWin ? "胜利" : "失败") +
            " | 当前层: " +
            (state.towerInfo ? state.towerInfo.displayFloor : "-") +
            " | 小鱼干: " +
            (state.towerInfo ? state.towerInfo.energy : "-") +
            " | 胜/败: " +
            state.winCount +
            "/" +
            state.loseCount
        );
      }

      syncAllButtons();

      if (!state.running) return;
      if (state.towerInfo && state.towerInfo.energy > 0) {
        state.loopTimer = setTimeout(function () {
          climbLoop().catch(function (error) {
            log("循环执行失败: " + error.message, "error");
            showTip("怪异塔自动爬塔出错");
            stopClimb("发生错误");
          });
        }, 400);
      } else {
        showTip("怪异塔自动爬塔结束：小鱼干耗尽");
        stopClimb("小鱼干耗尽");
      }
    } catch (error) {
      state.loseCount++;
      syncAllButtons();
      log("爬塔错误: " + error.message, "error");
      showTip("怪异塔自动爬塔失败: " + error.message);
      stopClimb("发生错误");
    }
  }

  async function startClimb() {
    if (state.running) {
      showTip("已暂停爬塔");
      stopClimb("手动暂停");
      return true;
    }

    if (!hostWindow.ws || typeof hostWindow.ws.sendAsync !== "function") {
      showTip("连接未就绪，请稍后再试");
      return false;
    }

    var towerInfo;
    try {
      towerInfo = await getTowerInfo();
    } catch (error) {
      showTip("获取怪异塔信息失败");
      log("获取怪异塔信息失败: " + error.message, "error");
      return false;
    }

    if (!towerInfo) {
      showTip("未获取到怪异塔信息");
      return false;
    }

    if (towerInfo.energy <= 0) {
      showTip("小鱼干不足，无法开始爬塔");
      return false;
    }

    state.running = true;
    hostWindow[RUNNING_FLAG] = true;
    syncAllButtons();
    showTip("开始自动爬塔");
    log("开始自动爬塔 | 当前层: " + towerInfo.displayFloor + " | 小鱼干: " + towerInfo.energy);
    climbLoop().catch(function (error) {
      log("启动循环失败: " + error.message, "error");
      showTip("怪异塔自动爬塔失败");
      stopClimb("发生错误");
    });
    return true;
  }

  function createButton() {
    try {
      if (!hostWindow.fgui || !hostWindow.fgui.UIPackage) return null;
      var created = hostWindow.fgui.UIPackage.createObject(BUTTON_PACKAGE, BUTTON_OBJECT);
      return (created && created.asButton) || created;
    } catch (error) {
      return null;
    }
  }

  function positionAboveBattleButton(ui, button) {
    var battleButton = ui && ui.m_btnBattle;
    if (!battleButton || !button) return;

    var scaleX = Number(button.scaleX) || 1;
    var scaleY = Number(button.scaleY) || 1;
    var buttonWidth = (Number(button.width) || 0) * scaleX;
    var buttonHeight = (Number(button.height) || 0) * scaleY;
    var battleWidth = Number(battleButton.width) || buttonWidth;
    var battleX = Number(battleButton.x) || 0;
    var battleY = Number(battleButton.y) || 0;

    if (typeof button.setScale === "function") {
      button.setScale(1, 1);
    } else {
      button.scaleX = 1;
      button.scaleY = 1;
    }

    var x = battleX + (battleWidth - buttonWidth) / 2;
    var y = battleY - buttonHeight - BUTTON_GAP;

    if (typeof button.setPosition === "function") {
      button.setPosition(Math.max(0, x), Math.max(0, y));
    } else {
      button.x = Math.max(0, x);
      button.y = Math.max(0, y);
    }
  }

  function disposeButton(panel) {
    try {
      var button = panel && panel[PANEL_BUTTON_KEY];
      if (!button) return;

      activeButtons.delete(button);
      if (typeof button.clearClick === "function") button.clearClick();
      if (typeof button.dispose === "function") {
        button.dispose();
      } else if (button.parent && typeof button.parent.removeChild === "function") {
        button.parent.removeChild(button);
      }

      panel[PANEL_BUTTON_KEY] = null;
    } catch (error) {}
  }

  function disposeButtonObject(button) {
    try {
      if (!button) return;
      activeButtons.delete(button);
      if (typeof button.clearClick === "function") button.clearClick();
      if (typeof button.dispose === "function") {
        button.dispose();
      } else if (button.parent && typeof button.parent.removeChild === "function") {
        button.parent.removeChild(button);
      }
    } catch (error) {}
  }

  function disposeAllButtons() {
    Array.from(activeButtons).forEach(function (button) {
      disposeButtonObject(button);
    });
    activeButtons.clear();
  }

  function createOrRefreshButton(panel) {
    try {
      if (!state.enabled) {
        disposeButton(panel);
        return;
      }
      if (!panel || !panel.ui) return;

      var button = panel[PANEL_BUTTON_KEY];
      if (!button || !button.parent) {
        button = createButton();
        if (!button) return;

        button.name = PANEL_BUTTON_KEY;
        button.touchable = true;
        button.sortingOrder = 9999;

        if (typeof button.clearClick === "function") button.clearClick();
        button.onClick(function () {
          startClimb();
        });

        panel.ui.addChild(button);
        panel[PANEL_BUTTON_KEY] = button;
        activeButtons.add(button);
      }

      syncButtonState(button);
      positionAboveBattleButton(panel.ui, button);
    } catch (error) {}
  }

  function refreshButtonSoon(panel) {
    if (!state.enabled) {
      disposeButton(panel);
      return;
    }
    createOrRefreshButton(panel);
    setTimeout(function () {
      createOrRefreshButton(panel);
    }, 0);
    setTimeout(function () {
      createOrRefreshButton(panel);
    }, 120);
  }

  function patchTowerPanel(PanelClass) {
    var proto = PanelClass.prototype;
    if (proto[PATCH_FLAG]) return;
    proto[PATCH_FLAG] = true;

    var originalOnShow = proto.onShow;
    proto.onShow = function () {
      var result = typeof originalOnShow === "function"
        ? originalOnShow.apply(this, arguments)
        : undefined;
      refreshButtonSoon(this);
      return result;
    };

    var originalOnShown = proto.onShown;
    proto.onShown = function () {
      var result = typeof originalOnShown === "function"
        ? originalOnShown.apply(this, arguments)
        : undefined;
      refreshButtonSoon(this);
      return result;
    };

    var originalOnFixShow = proto.onFixShow;
    proto.onFixShow = function () {
      var result = typeof originalOnFixShow === "function"
        ? originalOnFixShow.apply(this, arguments)
        : undefined;
      refreshButtonSoon(this);
      return result;
    };

    var originalOnHide = proto.onHide;
    proto.onHide = function () {
      disposeButton(this);
      return typeof originalOnHide === "function"
        ? originalOnHide.apply(this, arguments)
        : undefined;
    };
  }

  function waitForTowerPanel() {
    var startedAt = Date.now();
    var timer = setInterval(function () {
      try {
        if (typeof hostWindow.__require !== "function") return;

        var module = hostWindow.__require("EvoTowerMainPanel");
        var PanelClass = module && (module.EvoTowerMainPanel || module.default || module);
        if (!PanelClass || !PanelClass.prototype) return;

        patchTowerPanel(PanelClass);
        clearInterval(timer);
      } catch (error) {}

      if (Date.now() - startedAt > 60000) {
        clearInterval(timer);
      }
    }, 200);
  }

  function enableFeature() {
    state.enabled = true;
    waitForTowerPanel();
  }

  function disableFeature() {
    state.enabled = false;
    stopClimb("manual stop");
    disposeAllButtons();
  }

  hostWindow.WeirdTowerButtonCombined = {
    __initialized: true,
    start: startClimb,
    enable: enableFeature,
    disable: disableFeature,
    stop: function () {
      stopClimb("手动停止");
    },
    stop: disableFeature,
    getStatus: function () {
      return {
        enabled: state.enabled,
        running: state.running,
        winCount: state.winCount,
        loseCount: state.loseCount,
        towerInfo: state.towerInfo
      };
    }
  };

  waitForTowerPanel();
})();
