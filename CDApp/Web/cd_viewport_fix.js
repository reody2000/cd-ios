(function () {
  var resizeListeners = [];
  var lastKey = "";

  function number(value, fallback) {
    value = Number(value);
    return isFinite(value) && value > 0 ? value : fallback;
  }

  function readViewport() {
    var doc = document.documentElement || {};
    var body = document.body || {};
    var nativeViewport = window.__cdNativeViewport || {};
    var width =
      number(nativeViewport.width, 0) ||
      number(window.innerWidth, 0) ||
      number(doc.clientWidth, 0) ||
      number(body.clientWidth, 375);
    var height =
      number(nativeViewport.height, 0) ||
      number(window.innerHeight, 0) ||
      number(doc.clientHeight, 0) ||
      number(body.clientHeight, 667);
    var pixelRatio = number(window.devicePixelRatio, 1);
    width = Math.round(width);
    height = Math.round(height);
    return {
      pixelRatio: pixelRatio,
      screenWidth: width,
      screenHeight: height,
      windowWidth: width,
      windowHeight: height,
      statusBarHeight: 0,
      safeArea: {
        left: 0,
        right: width,
        top: 0,
        bottom: height,
        width: width,
        height: height
      },
      brand: "Android",
      model: "Android WebView",
      platform: "android",
      system: "Android",
      language: navigator.language || "zh_CN",
      version: "0",
      SDKVersion: "0"
    };
  }

  function cloneInfo() {
    var info = readViewport();
    info.safeArea = Object.assign({}, info.safeArea);
    return info;
  }

  function call(fn, arg) {
    try {
      if (typeof fn === "function") {
        fn(arg);
      }
    } catch (e) {}
  }

  var inputScrollGuardActive = false;
  var nativeScrollTo = typeof window.scrollTo === "function" ? window.scrollTo.bind(window) : null;
  var nativeScrollBy = typeof window.scrollBy === "function" ? window.scrollBy.bind(window) : null;

  function isEditableElement(el) {
    try {
      if (!el) {
        return false;
      }
      var tag = String(el.tagName || "").toUpperCase();
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable === true;
    } catch (e) {
      return false;
    }
  }

  function resetRootScroll() {
    try {
      var doc = document.documentElement;
      var body = document.body;
      if (doc) {
        doc.scrollLeft = 0;
        doc.scrollTop = 0;
      }
      if (body) {
        body.scrollLeft = 0;
        body.scrollTop = 0;
      }
      if (nativeScrollTo) {
        nativeScrollTo(0, 0);
      }
    } catch (e) {}
  }

  function scheduleRootScrollReset() {
    resetRootScroll();
    setTimeout(resetRootScroll, 0);
    setTimeout(resetRootScroll, 60);
    setTimeout(resetRootScroll, 180);
    setTimeout(resetRootScroll, 420);
    setTimeout(resetRootScroll, 900);
  }

  function installInputScrollGuard() {
    try {
      if (window.__cdInputScrollGuardInstalled) {
        return;
      }
      window.__cdInputScrollGuardInstalled = true;

      if (window.Element && Element.prototype && typeof Element.prototype.scrollIntoView === "function") {
        var nativeScrollIntoView = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function () {
          if (inputScrollGuardActive && (isEditableElement(this) || isEditableElement(document.activeElement))) {
            scheduleRootScrollReset();
            return;
          }
          return nativeScrollIntoView.apply(this, arguments);
        };
      }

      if (nativeScrollTo) {
        window.scrollTo = function () {
          if (inputScrollGuardActive || isEditableElement(document.activeElement)) {
            scheduleRootScrollReset();
            return;
          }
          return nativeScrollTo.apply(window, arguments);
        };
      }

      if (nativeScrollBy) {
        window.scrollBy = function () {
          if (inputScrollGuardActive || isEditableElement(document.activeElement)) {
            scheduleRootScrollReset();
            return;
          }
          return nativeScrollBy.apply(window, arguments);
        };
      }

      document.addEventListener(
        "focusin",
        function (event) {
          if (isEditableElement(event && event.target)) {
            inputScrollGuardActive = true;
            scheduleRootScrollReset();
          }
        },
        true
      );
      document.addEventListener(
        "focusout",
        function (event) {
          if (isEditableElement(event && event.target)) {
            inputScrollGuardActive = false;
            scheduleRootScrollReset();
          }
        },
        true
      );
      window.addEventListener(
        "scroll",
        function () {
          if (inputScrollGuardActive || isEditableElement(document.activeElement)) {
            scheduleRootScrollReset();
          }
        },
        true
      );
      if (window.visualViewport) {
        window.visualViewport.addEventListener(
          "resize",
          function () {
            if (inputScrollGuardActive || isEditableElement(document.activeElement)) {
              scheduleRootScrollReset();
            }
          },
          true
        );
        window.visualViewport.addEventListener(
          "scroll",
          function () {
            if (inputScrollGuardActive || isEditableElement(document.activeElement)) {
              scheduleRootScrollReset();
            }
          },
          true
        );
      }
    } catch (e) {}
  }

  function syncDomSize(width, height) {
    try {
      if (!width || !height) {
        return;
      }
      var doc = document.documentElement;
      var body = document.body;
      var frame = window.cc && cc.game && cc.game.frame;
      var container = window.cc && cc.game && cc.game.container;
      var canvas = document.getElementById("GameCanvas") || (window.cc && cc.game && cc.game.canvas);
      if (doc) {
        doc.style.width = Math.round(width) + "px";
        doc.style.height = Math.round(height) + "px";
        doc.style.overflow = "hidden";
      }
      if (body) {
        body.style.width = Math.round(width) + "px";
        body.style.height = Math.round(height) + "px";
        body.style.margin = "0";
        body.style.overflow = "hidden";
      }
      if (frame && frame.style) {
        frame.style.width = Math.round(width) + "px";
        frame.style.height = Math.round(height) + "px";
        frame.style.overflow = "hidden";
      }
      if (container && container.style) {
        container.style.width = Math.round(width) + "px";
        container.style.height = Math.round(height) + "px";
        container.style.margin = "0px";
        container.style.padding = "0px";
      }
      if (canvas && canvas.style) {
        canvas.style.width = Math.round(width) + "px";
        canvas.style.height = Math.round(height) + "px";
      }
    } catch (e) {}
  }

  function refreshCocos(size) {
    try {
      var cc = window.cc;
      if (!cc || !cc.view) {
        return;
      }

      var doc = document.documentElement || {};
      var nativeViewport = size || window.__cdNativeViewport || {};
      var softResize = !!nativeViewport.soft;
      var width =
        number(nativeViewport.width, 0) || number(window.innerWidth, 0) || number(doc.clientWidth, 0);
      var height =
        number(nativeViewport.height, 0) || number(window.innerHeight, 0) || number(doc.clientHeight, 0);
      var canvas = document.getElementById("GameCanvas") || (cc.game && cc.game.canvas);

      syncDomSize(width, height);
      width = Math.round(width);
      height = Math.round(height);
      if (softResize) {
        if (typeof cc.view._resizeEvent === "function") {
          cc.view._resizeEvent(true);
        }
      } else if (typeof cc.view.setFrameSize === "function" && width && height) {
        var frameSize =
          typeof cc.view.getFrameSize === "function" ? cc.view.getFrameSize() : cc.view._frameSize;
        if (!frameSize || Math.round(frameSize.width) !== width || Math.round(frameSize.height) !== height) {
          cc.view.setFrameSize(width, height);
        }
        if (typeof cc.view._resizeEvent === "function") {
          cc.view._resizeEvent(true);
        }
      } else if (typeof cc.view._resizeEvent === "function") {
        cc.view._resizeEvent(true);
      } else if (typeof cc.view.resizeWithBrowserSize === "function") {
        cc.view.resizeWithBrowserSize(true);
      }

      syncDomSize(width, height);
      if (canvas && width && height) {
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
      }

      if (
        typeof cc.view.getDesignResolutionSize === "function" &&
        typeof cc.view.setDesignResolutionSize === "function"
      ) {
        var designSize = cc.view.getDesignResolutionSize();
        var policy =
          typeof cc.view.getResolutionPolicy === "function"
            ? cc.view.getResolutionPolicy()
            : cc.view._resolutionPolicy;
        if (designSize && designSize.width > 0 && designSize.height > 0) {
          cc.view.setDesignResolutionSize(designSize.width, designSize.height, policy);
          if (typeof cc.view._resizeEvent === "function") {
            cc.view._resizeEvent(true);
          }
        }
      }

      if (
        window.fgui &&
        fgui.GRoot &&
        fgui.GRoot.inst &&
        typeof fgui.GRoot.inst.setSize === "function" &&
        typeof cc.view.getVisibleSize === "function"
      ) {
        var visibleSize = cc.view.getVisibleSize();
        if (visibleSize && visibleSize.width > 0 && visibleSize.height > 0) {
          fgui.GRoot.inst.setSize(visibleSize.width, visibleSize.height);
        }
      }
    } catch (e) {}
  }

  function notifyResize(force, size) {
    if (size && number(size.width, 0) && number(size.height, 0)) {
      window.__cdNativeViewport = {
        width: Math.round(number(size.width, 0)),
        height: Math.round(number(size.height, 0))
      };
    }
    var info = cloneInfo();
    var key = info.windowWidth + "x" + info.windowHeight + "@" + info.pixelRatio;

    if (force || key !== lastKey) {
      lastKey = key;
      for (var i = 0; i < resizeListeners.length; i++) {
        call(resizeListeners[i], {
          size: {
            windowWidth: info.windowWidth,
            windowHeight: info.windowHeight
          }
        });
      }
    }

    refreshCocos(size);
    setTimeout(function () { refreshCocos(size); }, 60);
    setTimeout(function () { refreshCocos(size); }, 250);
    setTimeout(function () { refreshCocos(size); }, 700);
  }

  window.wx = window.wx || {};
  wx.getSystemInfoSync = cloneInfo;
  wx.getWindowInfo = cloneInfo;
  wx.getSystemInfo = function (options) {
    var info = cloneInfo();
    call(options && options.success, info);
    call(options && options.complete, info);
  };
  wx.onWindowResize = function (listener) {
    if (typeof listener === "function" && resizeListeners.indexOf(listener) < 0) {
      resizeListeners.push(listener);
    }
  };
  wx.offWindowResize = function (listener) {
    if (!listener) {
      resizeListeners.length = 0;
      return;
    }
    var index = resizeListeners.indexOf(listener);
    if (index >= 0) {
      resizeListeners.splice(index, 1);
    }
  };

  window.__cdFixGameViewport = function (size) {
    notifyResize(true, size);
  };

  window.__cdClearNativeViewport = function () {
    try {
      delete window.__cdNativeViewport;
      lastKey = "";
      notifyResize(true);
      setTimeout(function () { notifyResize(true); }, 80);
      setTimeout(function () { notifyResize(true); }, 260);
    } catch (e) {}
  };

  window.addEventListener(
    "resize",
    function () {
      setTimeout(notifyResize, 0);
      setTimeout(notifyResize, 120);
    },
    true
  );
  window.addEventListener(
    "orientationchange",
    function () {
      setTimeout(notifyResize, 0);
      setTimeout(notifyResize, 300);
    },
    true
  );
  document.addEventListener(
    "visibilitychange",
    function () {
      if (!document.hidden) {
        setTimeout(function () {
          notifyResize(true);
        }, 80);
      }
    },
    true
  );

  setTimeout(function () {
    notifyResize(true);
  }, 0);
  setTimeout(function () {
    notifyResize(true);
  }, 500);
  setTimeout(function () {
    notifyResize(true);
  }, 1500);
  installInputScrollGuard();
})();
