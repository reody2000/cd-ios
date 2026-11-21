
(function () {
  'use strict';

  const w = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const STORAGE_KEY = 'xy_salt_field_view_v1';
  const PATCH_MARK = '__xySaltFieldViewPatched';
  const PANEL_ID = 'xy-salt-field-view-panel';
  const TOGGLE_ID = 'xy-salt-field-view-toggle';
  const FORCE_BUTTON_VISIBLE = true;
  const DEFAULT_STATE = {
    enabled: true,
    percent: 80,
    min: 45,
    max: 120,
    step: 5,
  };

  const state = loadState();
  let applyTimer = 0;
  let patchTimer = 0;
  let scaleFeedbackDepth = 0;
  let saltViewSceneShown = false;
  let saltViewSceneTouched = false;
  let dragState = null;
  let movedWhileDragging = false;
  let suppressNextClick = false;

  function clamp(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.min(max, Math.max(min, num));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {
        ...DEFAULT_STATE,
        ...saved,
        enabled: saved.enabled !== false,
        percent: clamp(saved.percent ?? DEFAULT_STATE.percent, DEFAULT_STATE.min, DEFAULT_STATE.max),
      };
    } catch (error) {
      return { ...DEFAULT_STATE };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          enabled: state.enabled,
          percent: state.percent,
        }),
      );
    } catch (error) {
      // Storage can be blocked in some embedded browsers; the page-level patch still works.
    }
  }

  function clampUiPosition(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(Math.max(0, rect.left), Math.max(0, window.innerWidth - rect.width));
    const top = Math.min(Math.max(0, rect.top), Math.max(0, window.innerHeight - rect.height));
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.right = 'auto';
  }

  function startDrag(el, event) {
    if (!el || (event.button !== undefined && event.button !== 0)) return;
    if (event.target && event.target.closest && event.target.closest('[data-no-drag="1"]')) return;
    const rect = el.getBoundingClientRect();
    movedWhileDragging = false;
    dragState = {
      el: el,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
    };
    el.style.left = rect.left + 'px';
    el.style.top = rect.top + 'px';
    el.style.right = 'auto';
    if (typeof el.setPointerCapture === 'function' && event.pointerId !== undefined) {
      try {
        el.setPointerCapture(event.pointerId);
      } catch (error) {}
    }
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  }

  function onDrag(event) {
    if (!dragState || !dragState.el) return;
    if (dragState.pointerId !== undefined && event.pointerId !== undefined && event.pointerId !== dragState.pointerId) return;
    const el = dragState.el;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedWhileDragging = true;
    let nextLeft = dragState.left + dx;
    let nextTop = dragState.top + dy;
    nextLeft = Math.min(Math.max(0, nextLeft), Math.max(0, window.innerWidth - rect.width));
    nextTop = Math.min(Math.max(0, nextTop), Math.max(0, window.innerHeight - rect.height));
    el.style.left = nextLeft + 'px';
    el.style.top = nextTop + 'px';
    el.style.right = 'auto';
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  }

  function stopDrag(event) {
    if (!dragState) return;
    if (event && dragState.pointerId !== undefined && event.pointerId !== undefined && event.pointerId !== dragState.pointerId) return;
    if (dragState.el && typeof dragState.el.releasePointerCapture === 'function' && dragState.pointerId !== undefined) {
      try {
        dragState.el.releasePointerCapture(dragState.pointerId);
      } catch (error) {}
    }
    if (movedWhileDragging) {
      suppressNextClick = true;
      setTimeout(() => { suppressNextClick = false; }, 0);
    }
    dragState = null;
    movedWhileDragging = false;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }
  }

  function openPanel() {
    const panel = document.getElementById(PANEL_ID);
    const toggle = document.getElementById(TOGGLE_ID);
    if (!panel) return;
    if (!FORCE_BUTTON_VISIBLE && (!isSaltViewSceneActive() || isClubPanelOpen())) return;
    panel.style.display = 'block';
    if (toggle) toggle.style.display = 'none';
  }

  function closePanel() {
    const panel = document.getElementById(PANEL_ID);
    const toggle = document.getElementById(TOGGLE_ID);
    if (panel) panel.style.display = 'none';
    if (toggle && (FORCE_BUTTON_VISIBLE || (isSaltViewSceneActive() && !isClubPanelOpen()))) toggle.style.display = 'flex';
  }

  function updateControlVisible(active) {
    const panel = document.getElementById(PANEL_ID);
    const toggle = document.getElementById(TOGGLE_ID);
    if (!panel || !toggle) return;
    if (FORCE_BUTTON_VISIBLE) {
      toggle.style.display = panel.style.display === 'block' ? 'none' : 'flex';
      return;
    }
    if (!active || isClubPanelOpen()) {
      panel.style.display = 'none';
      toggle.style.display = 'none';
      stopDrag();
      return;
    }
    toggle.style.display = panel.style.display === 'block' ? 'none' : 'flex';
  }

  function currentFactor() {
    return state.enabled ? clamp(state.percent, state.min, state.max) / 100 : 1;
  }

  function getModule(moduleName) {
    try {
      return w.__require ? w.__require(moduleName) : null;
    } catch (error) {
      return null;
    }
  }

  function getModuleExport(moduleName, exportName) {
    const mod = getModule(moduleName);
    if (!mod) return null;
    return mod[exportName] || mod.default || mod;
  }

  function setStatus(status) {
    try {
      w.__cdSaltViewStatus = status;
      w.__cdSaltViewStatusAt = Date.now();
    } catch (error) {}
  }

  function isExactInstance(instance, Ctor) {
    return !!instance && !!Ctor && Object.getPrototypeOf(instance) === Ctor.prototype;
  }

  function isKnownInstance(instance, Ctor) {
    if (!instance || !Ctor || !Ctor.prototype) return false;
    if (isExactInstance(instance, Ctor)) return true;
    try {
      if (instance instanceof Ctor) return true;
    } catch (error) {}

    try {
      let proto = Object.getPrototypeOf(instance);
      while (proto) {
        if (proto === Ctor.prototype) return true;
        proto = Object.getPrototypeOf(proto);
      }
    } catch (error) {}
    return false;
  }

  function getCtorName(instance) {
    try {
      return String((instance && instance.constructor && instance.constructor.name) || '');
    } catch (error) {
      return '';
    }
  }

  function isLikelyMapScene(scene) {
    if (!scene || !scene.ui || !scene.ui.m_map || typeof scene._updateScale !== 'function') return false;
    const name = getCtorName(scene);
    if (name.indexOf('MapScene') >= 0) return true;
    if (typeof scene._fixScope === 'function' || typeof scene._onMapMove === 'function' || typeof scene._updateMap === 'function') return true;
    const map = scene.ui.m_map;
    return !!(map && ('mapScale' in map || typeof map.setScale === 'function' || typeof map._setScale === 'function'));
  }

  function isMapSceneInstance(scene, Ctor) {
    return isKnownInstance(scene, Ctor) || isLikelyMapScene(scene);
  }

  function patchSourceMap() {
    const Ctor = getModuleExport('SourceMap', 'SourceMap');
    if (!Ctor || !Ctor.prototype || Ctor.prototype[PATCH_MARK]) return false;

    const proto = Ctor.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'mapScale');
    const originalGet = desc && desc.get;
    const originalSet = desc && desc.set;
    const originalValue = desc && Object.prototype.hasOwnProperty.call(desc, 'value') ? desc.value : undefined;

    function readBaseScale(instance) {
      if (Number.isFinite(instance.__xySaltFieldNativeScale)) {
        return instance.__xySaltFieldNativeScale;
      }

      let base = originalValue;
      if (originalGet) {
        try {
          base = originalGet.call(instance);
        } catch (error) {
          base = 1;
        }
      }

      base = Number(base);
      return Number.isFinite(base) && base > 0 ? base : 1;
    }

    Object.defineProperty(proto, 'mapScale', {
      configurable: true,
      enumerable: desc ? desc.enumerable : false,
      get() {
        const base = readBaseScale(this);
        if (!isKnownInstance(this, Ctor)) return base;
        return clamp(base * currentFactor(), 0.2, 2.5);
      },
      set(value) {
        const num = Number(value);
        if (Number.isFinite(num) && num > 0) {
          this.__xySaltFieldNativeScale = isKnownInstance(this, Ctor) && state.enabled && scaleFeedbackDepth > 0
            ? num / currentFactor()
            : num;
        }

        if (originalSet) {
          try {
            originalSet.call(this, this.__xySaltFieldNativeScale || value);
          } catch (error) {
            // Keep the injected scale active even if the original setter is a no-op or rejects.
          }
        }
      },
    });

    Object.defineProperty(proto, PATCH_MARK, {
      configurable: false,
      enumerable: false,
      value: true,
    });

    return true;
  }

  function patchSourceMapInstance(map) {
    if (!map) return false;
    const owner = Object.prototype.hasOwnProperty.call(map, 'mapScale') ? map : Object.getPrototypeOf(map);
    if (!owner || owner[PATCH_MARK]) return false;

    const desc = Object.getOwnPropertyDescriptor(owner, 'mapScale');
    if (!desc || (!desc.get && !Object.prototype.hasOwnProperty.call(desc, 'value'))) return false;

    const originalGet = desc.get;
    const originalSet = desc.set;
    const originalValue = Object.prototype.hasOwnProperty.call(desc, 'value') ? desc.value : undefined;

    function readBaseScale(instance) {
      if (Number.isFinite(instance.__xySaltFieldNativeScale)) {
        return instance.__xySaltFieldNativeScale;
      }

      let base = originalValue;
      if (originalGet) {
        try {
          base = originalGet.call(instance);
        } catch (error) {
          base = 1;
        }
      } else if (instance !== owner && Object.prototype.hasOwnProperty.call(instance, '__xySaltFieldNativeScale')) {
        base = instance.__xySaltFieldNativeScale;
      }

      base = Number(base);
      return Number.isFinite(base) && base > 0 ? base : 1;
    }

    try {
      Object.defineProperty(owner, 'mapScale', {
        configurable: true,
        enumerable: desc.enumerable,
        get() {
          return clamp(readBaseScale(this) * currentFactor(), 0.2, 2.5);
        },
        set(value) {
          const num = Number(value);
          if (Number.isFinite(num) && num > 0) {
            this.__xySaltFieldNativeScale = state.enabled && scaleFeedbackDepth > 0
              ? num / currentFactor()
              : num;
          }

          if (originalSet) {
            try {
              originalSet.call(this, this.__xySaltFieldNativeScale || value);
            } catch (error) {}
          }
        },
      });

      Object.defineProperty(owner, PATCH_MARK, {
        configurable: false,
        enumerable: false,
        value: true,
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  function patchMapScene() {
    const Ctor = getModuleExport('MapScene', 'MapScene');
    if (!Ctor || !Ctor.prototype || Ctor.prototype[PATCH_MARK]) return false;

    const proto = Ctor.prototype;
    const originalUpdateScale = proto._updateScale;
    if (typeof originalUpdateScale === 'function') {
      proto._updateScale = function patchedUpdateScale() {
        if (!state.enabled || !isMapSceneInstance(this, Ctor)) {
          return originalUpdateScale.apply(this, arguments);
        }

        scaleFeedbackDepth += 1;
        try {
          return originalUpdateScale.call(this, 0);
        } finally {
          scaleFeedbackDepth -= 1;
        }
      };
    }

    ['onShow', 'onShown'].forEach((name) => {
      const original = proto[name];
      if (typeof original !== 'function') return;

      proto[name] = function patchedMapSceneShow() {
        const result = original.apply(this, arguments);
        if (isMapSceneInstance(this, Ctor)) {
          saltViewSceneShown = true;
          saltViewSceneTouched = true;
          scheduleApply();
        }
        return result;
      };
    });

    ['onHide', 'onHidden', 'onClose', 'onClosed', 'onRemove', 'onDestroy'].forEach((name) => {
      const original = proto[name];
      if (typeof original !== 'function') return;

      proto[name] = function patchedMapSceneHide() {
        const result = original.apply(this, arguments);
        if (isMapSceneInstance(this, Ctor)) {
          saltViewSceneShown = false;
          saltViewSceneTouched = true;
          updateControlVisible(false);
        }
        return result;
      };
    });

    Object.defineProperty(proto, PATCH_MARK, {
      configurable: false,
      enumerable: false,
      value: true,
    });

    return true;
  }

  function tryPatchAll() {
    let count = 0;
    count += patchSourceMap() ? 1 : 0;
    count += patchMapScene() ? 1 : 0;

    if (count > 0) {
      try {
        w.__cdSaltViewPatchedCount = Number(w.__cdSaltViewPatchedCount || 0) + count;
      } catch (error) {}
      setStatus('patched');
      scheduleApply();
      console.log('[盐场视距] 普通盐场地图补丁已加载，当前比例：' + state.percent + '%');
    }

    return count;
  }

  function isUsableMapScene(scene) {
    const Ctor = getModuleExport('MapScene', 'MapScene');
    return !!(isMapSceneInstance(scene, Ctor) && scene.ui && scene.ui.m_map && typeof scene._updateScale === 'function');
  }

  function findVisibleMapScene() {
    const cc = w.cc;
    if (!cc || !cc.director || typeof cc.director.getScene !== 'function') return null;

    let found = null;
    try {
      walkNode(cc.director.getScene(), (node) => {
        if (found || !isNodeVisible(node)) return;
        const components = node._components || [];
        for (let index = 0; index < components.length; index += 1) {
          if (isUsableMapScene(components[index])) {
            found = components[index];
            return;
          }
        }
      });
    } catch (error) {}
    return found;
  }

  function findMapSceneByUiManager() {
    const Ctor = getModuleExport('MapScene', 'MapScene');
    const uiModule = getModule('index-ui');
    if (!Ctor || !uiModule || typeof uiModule.GET_PROXY !== 'function') return null;
    try {
      const scene = uiModule.GET_PROXY(Ctor);
      return isUsableMapScene(scene) ? scene : null;
    } catch (error) {
      return null;
    }
  }

  function isSaltViewSceneActive() {
    if (findVisibleMapScene()) return true;
    if (saltViewSceneShown && findMapSceneByUiManager()) return true;
    if (!saltViewSceneTouched && findMapSceneByUiManager()) return true;
    return false;
  }

  function isNodeVisible(node) {
    if (!node) return false;
    if (node.active === false || node.activeInHierarchy === false) return false;
    if (node.opacity === 0) return false;
    return true;
  }

  function hasClubKeyword(text) {
    const name = String(text || '').toLowerCase();
    return name.indexOf('club') >= 0 ||
      name.indexOf('guild') >= 0 ||
      name.indexOf('union') >= 0 ||
      name.indexOf('俱乐部') >= 0 ||
      name.indexOf('公会') >= 0 ||
      name.indexOf('社团') >= 0 ||
      name.indexOf('联盟') >= 0;
  }

  function hasPanelKeyword(text) {
    const name = String(text || '').toLowerCase();
    return name.indexOf('panel') >= 0 ||
      name.indexOf('view') >= 0 ||
      name.indexOf('window') >= 0 ||
      name.indexOf('dialog') >= 0 ||
      name.indexOf('layer') >= 0 ||
      name.indexOf('page') >= 0 ||
      name.indexOf('界面') >= 0 ||
      name.indexOf('面板') >= 0 ||
      name.indexOf('弹窗') >= 0;
  }

  function isLikelyClubPanelNode(node) {
    if (!node || !hasClubKeyword(node.name)) return false;
    if (hasPanelKeyword(node.name)) return true;
    return Number(node.width) > 160 && Number(node.height) > 160;
  }

  function isLikelyClubPanelComponent(component) {
    if (!component) return false;
    const ctorName = component.constructor && component.constructor.name;
    return (hasClubKeyword(ctorName) && hasPanelKeyword(ctorName)) ||
      (hasClubKeyword(component.name) && hasPanelKeyword(component.name));
  }

  function isClubPanelOpen() {
    const cc = w.cc;
    if (!cc || !cc.director || typeof cc.director.getScene !== 'function') return false;

    let found = false;
    try {
      walkNode(cc.director.getScene(), (node) => {
        if (found || !isNodeVisible(node)) return;
        if (isLikelyClubPanelNode(node)) {
          found = true;
          return;
        }
        const components = node._components || [];
        for (let index = 0; index < components.length; index += 1) {
          if (isLikelyClubPanelComponent(components[index])) {
            found = true;
            return;
          }
        }
      });
    } catch (error) {}
    return found;
  }

  function applyMapScene(scene) {
    if (!isUsableMapScene(scene)) return false;

    try {
      patchSourceMapInstance(scene.ui && scene.ui.m_map);
      scene._updateScale(0);
      if (typeof scene._fixScope === 'function') scene._fixScope();
      if (typeof scene._onMapMove === 'function') scene._onMapMove(true, true);
      if (typeof scene._updateMap === 'function') scene._updateMap();
      return true;
    } catch (error) {
      return false;
    }
  }

  function applyViaUiManager() {
    const Ctor = getModuleExport('MapScene', 'MapScene');
    const uiModule = getModule('index-ui');
    if (!Ctor || !uiModule || typeof uiModule.GET_PROXY !== 'function') return false;

    try {
      return applyMapScene(uiModule.GET_PROXY(Ctor));
    } catch (error) {
      return false;
    }
  }

  function walkNode(node, visit) {
    if (!node) return;
    visit(node);

    const children = node.children || node._children || [];
    for (let index = 0; index < children.length; index += 1) {
      walkNode(children[index], visit);
    }
  }

  function applyViaSceneScan() {
    const cc = w.cc;
    if (!cc || !cc.director || typeof cc.director.getScene !== 'function') return false;

    let applied = false;
    const scene = cc.director.getScene();
    walkNode(scene, (node) => {
      const components = node._components || [];
      for (let index = 0; index < components.length; index += 1) {
        if (applyMapScene(components[index])) {
          applied = true;
        }
      }
    });
    return applied;
  }

  function applyToVisibleSaltMap() {
    tryPatchAll();
    const active = isSaltViewSceneActive();
    updateControlVisible(active);
    if (!active) {
      setStatus('mounted_idle');
      return false;
    }
    const applied = !!(applyViaUiManager() || applyViaSceneScan());
    setStatus(applied ? 'active' : 'active_no_apply');
    return applied;
  }

  function scheduleApply() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(applyToVisibleSaltMap, 80);
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) {
      const existingToggle = document.getElementById(TOGGLE_ID);
      if (FORCE_BUTTON_VISIBLE && existingToggle) {
        existingToggle.style.display = 'flex';
        existingToggle.style.visibility = 'visible';
        existingToggle.style.opacity = '1';
      }
      return;
    }

    const toggle = document.createElement('div');
    toggle.id = TOGGLE_ID;
    toggle.textContent = '视距';
    toggle.style.cssText = [
      'position:fixed',
      'left:18px',
      'top:128px',
      'z-index:2147483646',
      'width:72px',
      'height:36px',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'box-sizing:border-box',
      'border:1px solid rgba(255,211,124,0.45)',
      'border-radius:10px',
      'background:rgba(34,26,22,0.9)',
      'color:#ffd77a',
      'font:700 14px Microsoft YaHei,system-ui,sans-serif',
      'box-shadow:0 2px 6px rgba(0,0,0,0.35)',
      'cursor:move',
      'user-select:none',
      'letter-spacing:1px',
    ].join(';');
    toggle.addEventListener('pointerdown', (event) => startDrag(toggle, event), true);
    toggle.addEventListener('mousedown', (event) => startDrag(toggle, event), true);
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      if (suppressNextClick) return;
      openPanel();
    }, true);

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = [
      'position:fixed',
      'left:calc(50vw - 92px)',
      'top:96px',
      'z-index:2147483647',
      'width:184px',
      'display:none',
      'box-sizing:border-box',
      'padding:8px',
      'color:#f6ead6',
      'background:rgba(34,26,22,0.9)',
      'border:1px solid rgba(255,211,124,0.45)',
      'border-radius:8px',
      'box-shadow:0 6px 18px rgba(0,0,0,0.35)',
      'font:12px/1.3 Arial,Microsoft YaHei,sans-serif',
      'user-select:none',
      'touch-action:none',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'height:28px;display:flex;align-items:center;justify-content:space-between;cursor:move;margin-bottom:6px';
    header.addEventListener('pointerdown', (event) => startDrag(panel, event), true);
    header.addEventListener('mousedown', (event) => startDrag(panel, event), true);

    const title = document.createElement('div');
    title.textContent = '盐场视距';
    title.style.cssText = 'color:#ffd77a;font-weight:700';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('data-no-drag', '1');
    closeBtn.style.cssText = [
      'width:24px',
      'height:24px',
      'padding:0',
      'border:0',
      'background:transparent',
      'color:#f6ead6',
      'font:700 18px Arial,sans-serif',
      'cursor:pointer',
    ].join(';');
    closeBtn.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }, true);
    closeBtn.addEventListener('mousedown', (event) => {
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    }, true);
    closeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      closePanel();
    }, true);

    header.appendChild(title);
    header.appendChild(closeBtn);

    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'xysfv-row xysfv-enabled';
    enabledLabel.innerHTML = '<input type="checkbox" data-role="enabled">启用';
    enabledLabel.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px';

    const row = document.createElement('div');
    row.className = 'xysfv-row';
    row.innerHTML = [
      '<button type="button" data-role="minus">-</button>',
      '<input type="range" data-role="range">',
      '<button type="button" data-role="plus">+</button>',
    ].join('');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px';

    const bottom = document.createElement('div');
    bottom.className = 'xysfv-row xysfv-bottom';
    bottom.innerHTML = [
      '<span data-role="value"></span>',
      '<button type="button" data-role="reset">原始</button>',
    ].join('');
    bottom.style.cssText = 'display:flex;align-items:center;gap:6px;justify-content:space-between;margin-top:6px';

    panel.appendChild(header);
    panel.appendChild(enabledLabel);
    panel.appendChild(row);
    panel.appendChild(bottom);

    const style = document.createElement('style');
    style.textContent = `
#${PANEL_ID} input[type="range"] {
  width: 104px;
  margin: 0;
}
#${PANEL_ID} input[type="checkbox"] {
  margin: 0;
}
#${PANEL_ID} button {
  min-width: 28px;
  height: 24px;
  padding: 0 7px;
  color: #fff4d0;
  background: #7c4a2c;
  border: 1px solid rgba(255, 218, 134, 0.5);
  border-radius: 5px;
  font: inherit;
}
#${PANEL_ID} button:active {
  transform: translateY(1px);
}
`;

    document.documentElement.appendChild(style);
    document.documentElement.appendChild(toggle);
    document.documentElement.appendChild(panel);

    const enabled = panel.querySelector('[data-role="enabled"]');
    const range = panel.querySelector('[data-role="range"]');
    const value = panel.querySelector('[data-role="value"]');
    const minus = panel.querySelector('[data-role="minus"]');
    const plus = panel.querySelector('[data-role="plus"]');
    const reset = panel.querySelector('[data-role="reset"]');

    range.min = String(state.min);
    range.max = String(state.max);
    range.step = String(state.step);

    function render() {
      enabled.checked = state.enabled;
      range.value = String(state.percent);
      value.textContent = state.percent + '%';
    }

    function setPercent(next) {
      state.percent = clamp(next, state.min, state.max);
      saveState();
      render();
      scheduleApply();
    }

    enabled.addEventListener('change', () => {
      state.enabled = enabled.checked;
      saveState();
      render();
      scheduleApply();
    });

    range.addEventListener('input', () => setPercent(range.value));
    minus.addEventListener('click', () => setPercent(state.percent - state.step));
    plus.addEventListener('click', () => setPercent(state.percent + state.step));
    reset.addEventListener('click', () => setPercent(100));

    ['mousedown', 'mouseup', 'mousemove', 'click', 'touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointermove', 'pointerup'].forEach((name) => {
      panel.addEventListener(
        name,
        (event) => {
          event.stopPropagation();
        },
        { passive: true },
      );
    });

    render();
  }

  function boot() {
    setStatus('booting');
    createPanel();
    w.__XY_SALT_FIELD_VIEW__ = {
      state,
      apply: applyToVisibleSaltMap,
      patch: tryPatchAll,
    };
    tryPatchAll();
    scheduleApply();

    clearInterval(patchTimer);
    patchTimer = setInterval(() => {
      applyToVisibleSaltMap();
    }, 300);

    window.addEventListener('pointermove', onDrag, true);
    window.addEventListener('pointerup', stopDrag, true);
    window.addEventListener('pointercancel', stopDrag, true);
    window.addEventListener('mousemove', onDrag, true);
    window.addEventListener('mouseup', stopDrag, true);
    window.addEventListener('blur', stopDrag, true);
    window.addEventListener('click', () => {
      setTimeout(applyToVisibleSaltMap, 0);
    }, true);
    window.addEventListener('resize', () => {
      clampUiPosition(document.getElementById(TOGGLE_ID));
      clampUiPosition(document.getElementById(PANEL_ID));
    }, true);

    setStatus('mounted');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
