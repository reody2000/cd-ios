(function () {
  "use strict";

  var INSTALL_FLAG = "__xyzwNightmareCountdownInstalled";
  var OVERLAY_ID = "nightmare-countdown-overlay";
  var STYLE_ID = "nightmare-countdown-style";
  var API_NAME = "NightmareCountdown";
  var VERSION = 1;

  var TIP_TEMPLATE = "\u960e\u7f57\u6b63\u5728\u64e6\u62ed\u6b66\u5668 {0}s";
  var TIP_PREFIX = "\u960e\u7f57\u6b63\u5728\u64e6\u62ed\u6b66\u5668";
  var MAX_COUNTDOWN_SECONDS = 15;

  if (window[INSTALL_FLAG] && window[INSTALL_FLAG].version >= VERSION) return;
  window[INSTALL_FLAG] = { version: VERSION };

  var state = {
    lastSeconds: 0,
    maxSeconds: 0,
    fallbackUntil: 0,
    timer: null
  };

  exposeApi();
  startTicker();

  function exposeApi() {
    window[API_NAME] = {
      state: state,
      tick: tick,
      hide: hideOverlay,
      show: function (seconds) {
        startCountdown(seconds);
      },
      remaining: getRemainingSeconds
    };
  }

  function startTicker() {
    if (state.timer) return;
    state.timer = setInterval(tick, 250);
    setTimeout(tick, 0);
  }

  function tick() {
    patchTipsManager();

    var seconds = getRemainingSeconds();
    if (!(seconds > 0)) seconds = getFallbackSeconds();

    if (seconds > 0) {
      showOverlay(seconds);
    } else {
      hideOverlay();
    }
  }

  function getRemainingSeconds() {
    var roomInfo = getNightmareRoomInfo();
    if (!roomInfo || !roomInfo.fightLimitTime) return 0;
    if (!isNightmarePanelVisible()) return 0;

    var limitTime = Number(roomInfo.fightLimitTime) || 0;
    var remaining = Math.ceil(limitTime - getServerTimeSeconds());

    if (!isFinite(remaining) || remaining <= 0 || remaining > MAX_COUNTDOWN_SECONDS) return 0;
    return remaining;
  }

  function getFallbackSeconds() {
    var seconds = Math.ceil((state.fallbackUntil - Date.now()) / 1000);
    return seconds > 0 ? seconds : 0;
  }

  function getServerTimeSeconds() {
    var dateUtilModule = safeRequire("DateUtil");
    var dateUtil = dateUtilModule && (dateUtilModule.default || dateUtilModule);
    var serverTime = Number(dateUtil && dateUtil.serverTime);

    if (serverTime > 1000000000000) return serverTime / 1000;
    if (serverTime > 1000000000) return serverTime;
    return Date.now() / 1000;
  }

  function getNightmareRoomInfo() {
    var panel = getNightmarePanel();
    if (panel && panel.module && panel.module.roomData) {
      return panel.module.roomData.roomInfo;
    }

    var moduleManager = safeRequire("ModuleManager");
    var configs = safeRequire("Configs");
    try {
      if (moduleManager && configs && configs.ModuleType && typeof moduleManager.GET_MODULE === "function") {
        var module = moduleManager.GET_MODULE(configs.ModuleType.NIGHTMARE);
        return module && module.roomData && module.roomData.roomInfo;
      }
    } catch (e) {}

    return null;
  }

  function isNightmarePanelVisible() {
    var panel = getNightmarePanel();
    return !!(panel && panel.isShow);
  }

  function getNightmarePanel() {
    var indexUi = safeRequire("index-ui");
    var panelModule = safeRequire("NightmareBattlePanel");
    var PanelClass = panelModule && (panelModule.NightmareBattlePanel || panelModule.default || panelModule);

    try {
      if (indexUi && typeof indexUi.GET_PROXY === "function" && PanelClass) {
        return indexUi.GET_PROXY(PanelClass);
      }
    } catch (e) {}

    return null;
  }

  function patchTipsManager() {
    var tips = safeRequire("TipsManager");
    if (!tips || tips.__nightmareCountdownPatched) return;
    if (typeof tips.SHOW_TIP !== "function") return;

    var originalShowTip = tips.SHOW_TIP;
    tips.SHOW_TIP = function (message) {
      captureNightmareTip(message);
      return originalShowTip.apply(this, arguments);
    };
    tips.__nightmareCountdownPatched = true;
  }

  function captureNightmareTip(message) {
    var text = String(message || "");
    if (text.indexOf(TIP_PREFIX) < 0) return;

    var match = text.match(/(\d+)\s*s/i);
    if (!match) return;

    startCountdown(parseInt(match[1], 10));
  }

  function startCountdown(seconds) {
    seconds = Math.max(0, Math.ceil(Number(seconds) || 0));
    if (seconds <= 0 || seconds > MAX_COUNTDOWN_SECONDS) return;

    state.fallbackUntil = Date.now() + seconds * 1000;
    showOverlay(seconds);
  }

  function showOverlay(seconds) {
    var overlay = ensureOverlay();
    if (!overlay) return;

    if (seconds > state.maxSeconds || seconds > state.lastSeconds + 3 || state.maxSeconds <= 0) {
      state.maxSeconds = seconds;
    }
    state.lastSeconds = seconds;

    var title = document.getElementById(OVERLAY_ID + "-title");
    if (title) title.textContent = formatTip(seconds);

    overlay.style.display = "block";
  }

  function hideOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    state.lastSeconds = 0;
    state.maxSeconds = 0;
    overlay.style.display = "none";

    var title = document.getElementById(OVERLAY_ID + "-title");
    if (title) title.textContent = "";
  }

  function ensureOverlay() {
    if (typeof document === "undefined" || !document.body) return null;
    ensureStyle();

    var overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.display = "none";

    var title = document.createElement("div");
    title.id = OVERLAY_ID + "-title";
    title.className = "nightmare-countdown-title";

    var line = document.createElement("div");
    line.className = "nightmare-countdown-line";

    var num = document.createElement("span");
    num.id = OVERLAY_ID + "-num";
    num.className = "nightmare-countdown-num";

    var suffix = document.createElement("span");
    suffix.id = OVERLAY_ID + "-suffix";
    suffix.className = "nightmare-countdown-suffix";

    var track = document.createElement("div");
    track.className = "nightmare-countdown-track";

    var bar = document.createElement("div");
    bar.id = OVERLAY_ID + "-bar";
    bar.className = "nightmare-countdown-bar";

    line.appendChild(num);
    line.appendChild(suffix);
    track.appendChild(bar);
    overlay.appendChild(title);
    overlay.appendChild(line);
    overlay.appendChild(track);
    document.body.appendChild(overlay);

    return overlay;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#" + OVERLAY_ID + "{",
      "position:fixed;",
      "left:50%;",
      "top:43%;",
      "transform:translate(-50%,-50%);",
      "z-index:2147483647;",
      "min-width:180px;",
      "max-width:86vw;",
      "box-sizing:border-box;",
      "padding:8px 16px;",
      "border:0;",
      "border-radius:10px;",
      "background:rgba(0,0,0,.58);",
      "box-shadow:0 4px 14px rgba(0,0,0,.22);",
      "color:#fff;",
      "font:14px/1.35 Arial,'Microsoft YaHei',sans-serif;",
      "text-align:center;",
      "pointer-events:none;",
      "user-select:none;",
      "}",
      "#" + OVERLAY_ID + " .nightmare-countdown-title{",
      "font-weight:700;",
      "letter-spacing:0;",
      "white-space:nowrap;",
      "text-shadow:0 1px 1px rgba(0,0,0,.35);",
      "}",
      "#" + OVERLAY_ID + " .nightmare-countdown-line{",
      "display:none;",
      "margin-top:2px;",
      "align-items:flex-end;",
      "justify-content:center;",
      "gap:3px;",
      "}",
      "#" + OVERLAY_ID + " .nightmare-countdown-num{",
      "font-size:32px;",
      "line-height:1;",
      "font-weight:800;",
      "color:#ffd36a;",
      "font-variant-numeric:tabular-nums;",
      "}",
      "#" + OVERLAY_ID + " .nightmare-countdown-suffix{",
      "font-size:14px;",
      "line-height:18px;",
      "color:rgba(255,255,255,.78);",
      "}",
      "#" + OVERLAY_ID + " .nightmare-countdown-track{",
      "display:none;",
      "height:4px;",
      "margin-top:7px;",
      "overflow:hidden;",
      "border-radius:4px;",
      "background:rgba(255,255,255,.18);",
      "}",
      "#" + OVERLAY_ID + " .nightmare-countdown-bar{",
      "height:100%;",
      "width:0%;",
      "border-radius:4px;",
      "background:#ffd36a;",
      "transition:width .2s linear;",
      "}"
    ].join("");

    document.head.appendChild(style);
  }

  function safeRequire(moduleName) {
    try {
      if (typeof window.__require !== "function") return null;
      return window.__require(moduleName);
    } catch (e) {}
    return null;
  }

  function formatTip(seconds) {
    return TIP_TEMPLATE.replace("{0}", String(Math.max(0, Math.ceil(Number(seconds) || 0))));
  }
})();
