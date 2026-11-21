//傻逼，还在看

;(function () {
  var KEY = 'QuenchSkipRedHook';
  var VER = 'v31';
  if (window[KEY] && window[KEY].version === VER) return;

  var COLOR_ORANGE = 5;
  var COLOR_RED = 6;
  var QUENCH_EFFECT_SPEED_SCALE = 6;
  var QUENCH_CYCLE_DELAY_MS = 380;
  var TARGET_STORE_KEY = 'quench_target_attr_v1';
  var DEFAULTS = {
    skipRed: false
  };
  window[KEY] = {
    version: VER,
    patched: false,
    lastError: '',
    defaultSkipRed: DEFAULTS.skipRed,
    lastTargetHitKey: '',
    target: loadTarget()
  };

  function loadTarget() {
    try {
      var saved = JSON.parse(localStorage.getItem(TARGET_STORE_KEY) || 'null');
      if (saved && saved.attrId != null) {
        saved.attrId = Number(saved.attrId);
        saved.hasMin = saved.hasMin === true || (saved.min !== '' && saved.min != null && isFinite(Number(saved.min)));
        saved.min = saved.hasMin ? Number(saved.min) : null;
        saved.name = String(saved.name || '');
        return saved;
      }
    } catch (e) {}
    return null;
  }

  function hasTarget() {
    var target = window[KEY] && window[KEY].target;
    return !!(target && target.attrId != null);
  }

  function req(name) {
    try {
      if (typeof window.__require === 'function') return window.__require(name);
    } catch (e) {}
    try {
      if (typeof window.require === 'function') return window.require(name);
    } catch (e2) {}
    return null;
  }

  function reqAny(names) {
    var r, i, mod;
    try { r = window.__require || window.require; } catch (e) {}
    if (typeof r !== 'function') return null;
    for (i = 0; i < names.length; i++) {
      try {
        mod = r(names[i]);
        if (mod) return mod;
      } catch (e2) {}
    }
    return null;
  }

  function getConfigs() {
    return reqAny(['Configs', 'launcher/config/Configs', '../../../../launcher/config/Configs']);
  }

  function getModuleManager() {
    return reqAny(['ModuleManager', '../modules/ModuleManager', '../../modules/ModuleManager']);
  }

  function getEquipModule() {
    var mm = getModuleManager();
    var cfg = getConfigs();
    var moduleType = cfg && cfg.ModuleType && cfg.ModuleType.EQUIP;
    if (!mm || moduleType == null) return null;
    try {
      if (typeof mm.GET_MODULE === 'function') return mm.GET_MODULE(moduleType);
    } catch (e) {}
    try {
      if (mm.ModuleManager && mm.ModuleManager.instance && typeof mm.ModuleManager.instance.getModule === 'function') {
        return mm.ModuleManager.instance.getModule(moduleType);
      }
    } catch (e2) {}
    return null;
  }

  function getDataIndex() {
    return reqAny([
      'data-index',
      'generated/data-index',
      'extras/orange/generated/data-index',
      '../../../extras/orange/generated/data-index',
      '../../../../extras/orange/generated/data-index'
    ]);
  }

  function getLanguageExt() {
    return reqAny([
      'LanguageExt',
      'extensions/LanguageExt',
      'extras/config/extensions/LanguageExt',
      '../../../extras/config/extensions/LanguageExt',
      '../../../../extras/config/extensions/LanguageExt'
    ]);
  }

  function log(msg) {
  }

  function warn(msg, err) {
    window[KEY].lastError = msg + (err ? ': ' + (err.message || err) : '');
  }

  function getChild(ui, name) {
    try {
      return ui && typeof ui.getChild === 'function' ? ui.getChild(name) : null;
    } catch (e) {
      return null;
    }
  }

  function setSelected(toggle, selected) {
    try {
      if (toggle && toggle.selected != null) toggle.selected = !!selected;
    } catch (e) {}
    try {
      if (toggle && toggle.m_checkBox) toggle.m_checkBox.selected = !!selected;
    } catch (e2) {}
    try {
      var checkBox = getChild(toggle, 'checkBox');
      if (checkBox) checkBox.selected = !!selected;
    } catch (e3) {}
    try {
      if (toggle && toggle.__checkMark) toggle.__checkMark.text = selected ? '√' : '';
    } catch (e4) {}
  }

  function readSelected(toggle) {
    var checkBox;
    try {
      if (toggle && toggle.m_checkBox && typeof toggle.m_checkBox.selected === 'boolean') return toggle.m_checkBox.selected;
    } catch (e) {}
    try {
      checkBox = getChild(toggle, 'checkBox');
      if (checkBox && typeof checkBox.selected === 'boolean') return checkBox.selected;
    } catch (e2) {}
    try {
      if (toggle && typeof toggle.selected === 'boolean') return toggle.selected;
    } catch (e3) {}
    return null;
  }

  function syncSkipRedState(inst) {
    var selected = readSelected(inst && inst.ui && inst.ui.m_skipRedToggle);
    if (selected !== null) inst._isSkipRed = !!selected;
    return !!(inst && inst._isSkipRed);
  }

  function syncToggleVisible(inst) {
    var ui = inst && inst.ui;
    var toggle = ui && ui.m_skipRedToggle;
    if (!ui) return;
    try {
      if (toggle) toggle.visible = !!inst._isOpenAuto;
    } catch (e) {}
  }

  function setText(obj, text) {
    if (!obj) return false;
    try {
      obj.text = text;
      return true;
    } catch (e) {}
    try {
      obj.title = text;
      return true;
    } catch (e2) {}
    return false;
  }

  function setDeepText(obj, text) {
    if (!obj) return false;
    var changed = setText(obj, text);
    var fields = [
      'm_title',
      'm_txtTitle',
      'm_txtName',
      'm_name',
      'm_label',
      'm_text',
      'm_txt'
    ];
    for (var i = 0; i < fields.length; i++) {
      changed = setText(obj[fields[i]], text) || changed;
    }
    try {
      if (typeof obj.getChild === 'function') {
        for (var n = 0; n < obj.numChildren; n++) {
          var child = obj.getChildAt(n);
          changed = setText(child, text) || changed;
        }
      }
    } catch (e) {}
    return changed;
  }

  function setNativeToggleText(toggle, text) {
    if (!toggle) return;
    setDeepText(toggle, text);
    try {
      if (toggle._titleObject) {
        toggle._titleObject.visible = true;
        toggle._titleObject.text = text;
      }
    } catch (e) {}
    try {
      var title = getChild(toggle, 'title');
      if (title) {
        title.visible = true;
        title.text = text;
      }
    } catch (e2) {}
    try {
      if (typeof toggle.getTextField === 'function') {
        var tf = toggle.getTextField();
        if (tf) {
          tf.visible = true;
          tf.text = text;
        }
      }
    } catch (e3) {}
  }

  function getAttrConf(attrId) {
    var cfg = getConfigs();
    var data = getDataIndex();
    try {
      if (cfg && cfg.QuenchAttrConf && typeof cfg.QuenchAttrConf.getById === 'function') {
        return cfg.QuenchAttrConf.getById(Number(attrId));
      }
    } catch (e0) {}
    try {
      return data && data.QuenchAttrConf && data.QuenchAttrConf.getById(Number(attrId));
    } catch (e) {}
    return null;
  }

  function getAttrName(attrId) {
    var conf = getAttrConf(attrId);
    var key = conf && conf.attrName;
    var lang = getLanguageExt();
    try {
      if (lang && typeof lang.GET_CONTENT === 'function') return lang.GET_CONTENT(key || '') || String(key || attrId);
    } catch (e) {}
    try {
      if (window.GET_CONTENT) return window.GET_CONTENT(key || '') || String(key || attrId);
    } catch (e2) {}
    return String(key || attrId);
  }

  function getQuenchValue(quench) {
    var conf = getAttrConf(quench && quench.attrId);
    var maxValue = conf && Number(conf.maxValue);
    var changeRatio = conf && Number(conf.changeRatio);
    var attrNum = Number(quench && quench.attrNum);
    if (!isFinite(attrNum)) attrNum = 0;
    if (!isFinite(maxValue) || maxValue <= 0) return attrNum;
    if (Number(quench && quench.colorId) >= COLOR_RED && isFinite(changeRatio) && changeRatio > 0) {
      return Number((attrNum * maxValue * changeRatio).toFixed(1));
    }
    return Number((attrNum * maxValue).toFixed(1));
  }

  function getTargetText() {
    var target = window[KEY].target;
    if (!target || target.attrId == null) return '指定属性';
    return target.hasMin ? ((target.name || getAttrName(target.attrId)) + '>=' + target.min) : (target.name || getAttrName(target.attrId));
  }

  function copyToggleVisual(src, parent, name) {
    if (!src || !parent || !window.fgui || !fgui.UIPackage) return null;
    var obj = null;
    try {
      if (src.resourceURL) obj = fgui.UIPackage.createObjectFromURL(src.resourceURL);
    } catch (e) {}
    if (!obj) {
      try {
        if (src.packageItem && src.packageItem.owner && src.packageItem.name) {
          obj = src.packageItem.owner.createObject(src.packageItem.name);
        }
      } catch (e2) {}
    }
    if (!obj) return null;

    obj.name = name || 'skipRedToggle';
    try {
      obj.setSize(src.width, src.height);
    } catch (e3) {}
    try {
      parent.addChild(obj);
    } catch (e4) {
      return null;
    }
    return obj;
  }

  function refreshTargetButton(inst) {
    var ui = inst && inst.ui;
    var btn = ui && ui.m_targetAttrButton;
    if (!btn) return;
    try { btn.visible = false; } catch (e2) {}
    try { btn.touchable = false; } catch (e3) {}
  }

  function syncTargetSkipToggles(inst) {
    var ui = inst && inst.ui;
    if (!ui || !hasTarget()) return;
    try { setSelected(ui.m_skipOrangeToggle, true); } catch (e) {}
    try {
      if (ui.m_skipRedToggle) {
        setSelected(ui.m_skipRedToggle, true);
      }
    } catch (e2) {}
  }

  function positionToggles(ui, redToggle) {
    var auto = ui && ui.m_autoQuenchToggle;
    var orange = ui && ui.m_skipOrangeToggle;
    if (!auto || !orange || !redToggle) return;

    setNativeToggleText(auto, '自动淬炼');
    setNativeToggleText(orange, '跳过橙色');
    setNativeToggleText(redToggle, '跳过红色');

    var toggles = [auto, orange, redToggle];
    var y = Number(auto.y);
    if (!isFinite(y)) y = Number(orange.y) || 0;
    var panelW = Number(ui.width) || 0;
    var left = 18;
    var right = panelW ? panelW - 18 : 420;
    var usable = Math.max(330, right - left);
    var gap = 4;
    var widths = toggles.map(function (item) {
      return Math.max(104, Number(item.width) || 112);
    });
    var total = widths[0] + widths[1] + widths[2] + gap * 2;
    if (total > usable) {
      gap = 2;
      var each = Math.floor((usable - gap * 2) / 3);
      widths = [each, each, each];
      total = each * 3 + gap * 2;
    }
    var start = panelW ? left + Math.max(0, (usable - total) / 2) : Math.max(0, Number(auto.x) || 0);

    for (var i = 0, x = start; i < toggles.length; i++) {
      var item = toggles[i];
      try {
        item.setSize(widths[i], item.height);
        item.setPosition(x, y);
      } catch (e2) {
        try {
          item.x = x;
          item.y = y;
        } catch (e3) {}
      }
      try {
        item.touchable = true;
      } catch (e4) {}
      x += widths[i] + gap;
    }
  }

  function refreshToggleLayout(inst) {
    var ui = inst && inst.ui;
    if (!ui || !ui.m_skipRedToggle) return;
    try {
      positionToggles(ui, ui.m_skipRedToggle);
    } catch (e) {
      warn('layout failed', e);
    }
  }

  function suppressQuenchEffects(inst) {
    if (!inst) return;
    var items = inst._items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var effect = item && item.m_spineEffect;
      if (!effect) continue;
      try {
        effect.alpha = 0;
      } catch (e) {}
      try {
        if (effect.node) effect.node.opacity = 0;
      } catch (e2) {}
      try {
        if (effect.content && effect.content.node) effect.content.node.opacity = 0;
      } catch (e3) {}
      try {
        if (effect.content) {
          effect.content.alpha = 0;
          effect.content.timeScale = QUENCH_EFFECT_SPEED_SCALE;
          if (typeof effect.content.setCompleteListener === 'function') {
            effect.content.setCompleteListener(void 0);
          }
        }
      } catch (e4) {}
    }
    if (inst._isInQuenchAnim) scheduleSpeedCycle(inst);
  }

  function finishQuenchEffects(inst) {
    if (!inst) return;
    var items = inst._items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var effect = item && item.m_spineEffect;
      if (!effect) continue;
      try {
        effect.visible = false;
      } catch (e) {}
      try {
        effect.playing = false;
      } catch (e2) {}
      try {
        effect.animationName = void 0;
      } catch (e3) {}
      try {
        if (effect.content && typeof effect.content.setCompleteListener === 'function') {
          effect.content.setCompleteListener(void 0);
        }
      } catch (e4) {}
    }
  }

  function clearSpeedCycle(inst) {
    if (!inst) return;
    inst.__quenchSpeedToken = (inst.__quenchSpeedToken || 0) + 1;
    if (inst.__quenchSpeedTimer) {
      clearTimeout(inst.__quenchSpeedTimer);
      inst.__quenchSpeedTimer = 0;
    }
  }

  function clearSkippedConfirm(inst) {
    if (!inst) return;
    inst.__quenchConfirmToken = (inst.__quenchConfirmToken || 0) + 1;
    inst.__quenchSilentConfirming = false;
  }

  function findTargetHit(inst) {
    var target = window[KEY].target;
    var info = inst && inst._equipInfo;
    var hit = null;
    if (!target || target.attrId == null || !info || !info.quenches || typeof info.quenches.forEach !== 'function') return null;
    info.quenches.forEach(function (quench, slot) {
      var value;
      if (hit || Number(quench && quench.attrId) !== Number(target.attrId)) return;
      value = getQuenchValue(quench);
      if (!target.hasMin || value >= Number(target.min || 0)) {
        hit = { slot: slot, value: value, quench: quench };
      }
    });
    return hit;
  }

  function getQuenchSignature(inst) {
    var info = inst && inst._equipInfo;
    var parts = [];
    if (!info || !info.quenches || typeof info.quenches.forEach !== 'function') return '';
    try {
      info.quenches.forEach(function (quench, slot) {
        parts.push([
          slot,
          quench && quench.attrId,
          quench && quench.colorId,
          quench && quench.attrNum
        ].join(':'));
      });
    } catch (e) {}
    return parts.sort().join('|');
  }

  function isTargetCheckActive(inst, beforeSignature) {
    var afterSignature;
    if (!inst || !inst.isShow) return false;
    if (!inst.__targetCheckPending) return false;
    afterSignature = getQuenchSignature(inst);
    if (beforeSignature && afterSignature && beforeSignature === afterSignature) return false;
    return true;
  }

  function getTargetHitKey(inst, hit) {
    var info = inst && inst._equipInfo;
    var target = window[KEY].target;
    if (!hit || !target) return '';
    return [
      info && info.heroId,
      info && info.part,
      info && info.curQuenchId,
      Number(target.attrId),
      target.hasMin ? Number(target.min) : '',
      hit.slot,
      hit.value
    ].join('|');
  }

  function stopQuench(inst) {
    clearSkippedConfirm(inst);
    clearSpeedCycle(inst);
    try {
      if (typeof inst._clearQuenchAnims === 'function') inst._clearQuenchAnims();
      else {
        inst._isInQuenchAnim = false;
        inst._isInQuench = false;
        inst._quenchTimes = 0;
      }
    } catch (e) {}
  }

  function checkTargetAndStop(inst, beforeSignature) {
    var hit, hitKey;
    if (!isTargetCheckActive(inst, beforeSignature)) return false;
    hit = findTargetHit(inst);
    if (!hit) return false;
    hitKey = getTargetHitKey(inst, hit);
    if (hitKey && window[KEY].lastTargetHitKey === hitKey) return true;
    window[KEY].lastTargetHitKey = hitKey;
    try {
      if (inst._locks && typeof inst._locks.add === 'function') inst._locks.add(hit.slot);
      if (typeof inst._refreshLockBtn === 'function') inst._refreshLockBtn();
      if (typeof inst._refreshItems === 'function') inst._refreshItems();
    } catch (e) {}
    stopQuench(inst);
    try {
      if (inst._isOpenAuto) inst._isOpenAuto = false;
      setSelected(inst.ui && inst.ui.m_autoQuenchToggle, false);
    } catch (e) {}
    try { inst.__targetCheckPending = false; } catch (e2) {}
    log('target hit ' + getTargetText() + ' value=' + hit.value);
    return true;
  }

  function hasSkippedConfirmQuench(inst) {
    var info = inst && inst._equipInfo;
    var found = false;
    if (!info || !info.quenches || typeof info.quenches.forEach !== 'function') return false;
    syncSkipRedState(inst);
    info.quenches.forEach(function (quench, slot) {
      var color = quench && quench.colorId;
      if (!inst._locks.has(slot) && color >= COLOR_RED && (inst._isSkipRed || hasTarget())) {
        found = true;
      }
    });
    if (found) log('red confirm detected');
    return found;
  }

  function sendSkippedConfirm(inst) {
    var equip = getEquipModule();
    var info = inst && inst._equipInfo;
    var showVersion = inst && inst._showVersion;
    var heroId = info && info.heroId;
    var part = info && info.part;
    var quenchId = info && info.curQuenchId;
    var confirmToken = inst && inst.__quenchConfirmToken || 0;
    if (!equip || !info || typeof equip.sendConfirm !== 'function') return Promise.resolve(false);
    log('silent red confirm send');
    return Promise.resolve(equip.sendConfirm(heroId, part, info.quenches || new Map(), quenchId)).then(function (ok) {
      var cur;
      if (!ok) return false;
      if ((inst.__quenchConfirmToken || 0) !== confirmToken) return false;
      if (!inst.isShow || inst._showVersion !== showVersion) return false;
      cur = inst._equipInfo;
      if (!cur || cur.heroId !== heroId || cur.part !== part || cur.curQuenchId !== quenchId) return false;
      try {
        if (typeof inst._clearQuenchAnims === 'function') inst._clearQuenchAnims();
        if (inst._isOpenAuto) inst._quenchTimes = inst.AUTO_QUENCH_TIMES || inst._quenchTimes || 1000;
        if (typeof inst._refreshItems === 'function') inst._refreshItems();
        inst._seed = info && info.seed || 0;
        if (typeof inst._doEquipQuench === 'function') inst._doEquipQuench();
      } catch (e) {}
      log('silent red confirm ok');
      return true;
    });
  }

  function scheduleSpeedCycle(inst) {
    if (!inst || !inst.isShow) return;
    clearSpeedCycle(inst);
    var token = inst.__quenchSpeedToken;
    inst.__quenchSpeedTimer = setTimeout(function () {
      inst.__quenchSpeedTimer = 0;
      try {
        if (!inst.isShow || inst.__quenchSpeedToken !== token) return;
        finishQuenchEffects(inst);
        inst._isInQuenchAnim = false;
        if (!inst._isInQuench && !inst._isInFliping && inst._quenchTimes > 0 && typeof inst._updateQuench === 'function') {
          inst._updateQuench();
        }
      } catch (e) {
        warn('speed cycle failed', e);
      }
    }, QUENCH_CYCLE_DELAY_MS);
  }

  function ensureSkipRedToggle(inst) {
    var ui = inst && inst.ui;
    if (!ui || !ui.m_skipOrangeToggle) return null;
    if (ui.m_skipRedToggle) return ui.m_skipRedToggle;

    var existing = getChild(ui, 'skipRedToggle');
    var redToggle = existing || copyToggleVisual(ui.m_skipOrangeToggle, ui, 'skipRedToggle');
    if (!redToggle) return null;

    ui.m_skipRedToggle = redToggle;
    setNativeToggleText(redToggle, '跳过红色');
    positionToggles(ui, redToggle);
    setSelected(redToggle, !!inst._isSkipRed);
    syncToggleVisible(inst);
    redToggle.clearClick && redToggle.clearClick();
    redToggle.onClick && redToggle.onClick(inst._onClickSkipRed, inst);
    return redToggle;
  }

  function patchDialog(Mod) {
    var Ctor = Mod && Mod.QuenchStageUpDialog;
    if (!Ctor || !Ctor.prototype) return false;
    if (Ctor.prototype.__skipRedPatchVersion === VER) return true;

    var proto = Ctor.prototype;
    var oldOnShow = proto.onShow;
    var oldOnFixShow = proto.onFixShow;
    var oldOnHide = proto.onHide;
    var oldChangeAuto = proto._changeAutoState;
    var oldReset = proto._resetTogToDefault;
    var oldCheck = proto._checkQuenchConfirm;
    var oldDoEquipQuench = proto._doEquipQuench;
    var oldUpdateQuench = proto._updateQuench;

    proto._onClickSkipRed = function () {
      var selected = readSelected(this.ui && this.ui.m_skipRedToggle);
      this._isSkipRed = selected === null ? !this._isSkipRed : !!selected;
      setSelected(this.ui && this.ui.m_skipRedToggle, this._isSkipRed);
      clearSkippedConfirm(this);
      clearSpeedCycle(this);
      this._clearQuenchAnims && this._clearQuenchAnims();
    };

    proto._onClickAutoQuench = function () {
      clearSkippedConfirm(this);
      clearSpeedCycle(this);
      return this._changeAutoState && this._changeAutoState();
    };

    proto._onClickSkipOrange = function () {
      clearSkippedConfirm(this);
      clearSpeedCycle(this);
      this._clearQuenchAnims && this._clearQuenchAnims();
      if (this._changeOrangeConfrimState) return this._changeOrangeConfrimState();
      this._isSkipOrange = !this._isSkipOrange;
      setSelected(this.ui && this.ui.m_skipOrangeToggle, this._isSkipOrange);
    };

    proto._syncSkipRedToggle = function () {
      try {
        this._isSkipRed = !!this._isSkipRed;
        ensureSkipRedToggle(this);
        refreshToggleLayout(this);
        refreshTargetButton(this);
        setSelected(this.ui && this.ui.m_skipRedToggle, this._isSkipRed);
        syncTargetSkipToggles(this);
        syncToggleVisible(this);
      } catch (e) {
        warn('sync failed', e);
      }
    };

    proto.onShow = function () {
      if (this._isSkipRed == null) this._isSkipRed = DEFAULTS.skipRed;
      var ret = oldOnShow && oldOnShow.apply(this, arguments);
      this._syncSkipRedToggle();
      return ret;
    };

    proto.onFixShow = function () {
      if (this._isSkipRed == null) this._isSkipRed = DEFAULTS.skipRed;
      var ret = oldOnFixShow && oldOnFixShow.apply(this, arguments);
      this._syncSkipRedToggle();
      return ret;
    };

    proto._changeAutoState = function () {
      var ret = oldChangeAuto && oldChangeAuto.apply(this, arguments);
      this._isSkipRed = false;
      window[KEY].lastTargetHitKey = '';
      clearSkippedConfirm(this);
      clearSpeedCycle(this);
      refreshToggleLayout(this);
      refreshTargetButton(this);
      setSelected(this.ui && this.ui.m_skipRedToggle, this._isSkipRed);
      syncToggleVisible(this);
      return ret;
    };

    proto._resetTogToDefault = function () {
      var ret = oldReset && oldReset.apply(this, arguments);
      this._isSkipRed = false;
      refreshToggleLayout(this);
      refreshTargetButton(this);
      setSelected(this.ui && this.ui.m_skipRedToggle, this._isSkipRed);
      syncToggleVisible(this);
      clearSkippedConfirm(this);
      clearSpeedCycle(this);
      return ret;
    };

    proto._checkQuenchConfirm = function () {
      var info = this._equipInfo;
      if (this.__quenchSilentConfirming) return false;
      if (hasTarget()) return false;
      syncSkipRedState(this);
      if (!info || !info.quenches || typeof info.quenches.forEach !== 'function') {
        return oldCheck ? oldCheck.apply(this, arguments) : false;
      }
      var need = false;
      this._needConfrimQuenches.length = 0;
      info.quenches.forEach(function (quench, slot) {
        var color = quench && quench.colorId;
        var shouldConfirm = color >= COLOR_RED ? !this._isSkipRed : color >= COLOR_ORANGE && !this._isSkipOrange;
        if (shouldConfirm && !this._locks.has(slot)) {
          need = true;
          this._needConfrimQuenches.push(quench);
        }
      }, this);
      return need;
    };

    proto._updateQuench = function () {
      var inst = this;
      if (inst.__quenchSilentConfirming) return;
      if (!inst._isInQuenchAnim && !inst._isInQuench && inst._quenchTimes > 0 && hasSkippedConfirmQuench(inst)) {
        inst.__quenchSilentConfirming = true;
        sendSkippedConfirm(inst).then(function (ok) {
          inst.__quenchSilentConfirming = false;
          if (!ok) warn('silent red confirm returned false');
        }, function (err) {
          inst.__quenchSilentConfirming = false;
          warn('silent confirm failed', err);
        });
        return;
      }
      return oldUpdateQuench && oldUpdateQuench.apply(this, arguments);
    };

    proto._doEquipQuench = function () {
      var inst = this;
      var beforeSignature = getQuenchSignature(inst);
      var targetMode = hasTarget();
      var oldSkipOrange = inst._isSkipOrange;
      window[KEY].lastTargetHitKey = '';
      inst.__targetCheckPending = false;
      inst.__targetCheckInDoEquip = true;
      if (targetMode) inst._isSkipOrange = true;
      var ret = oldDoEquipQuench && oldDoEquipQuench.apply(this, arguments);
      var finish = function (value) {
        inst.__targetCheckInDoEquip = false;
        if (targetMode) inst._isSkipOrange = oldSkipOrange;
        inst.__targetCheckPending = true;
        suppressQuenchEffects(inst);
        checkTargetAndStop(inst, beforeSignature);
        inst.__targetCheckPending = false;
        refreshTargetButton(inst);
        return value;
      };
      if (ret && typeof ret.then === 'function') {
        return ret.then(finish, function (err) {
          inst.__targetCheckInDoEquip = false;
          if (targetMode) inst._isSkipOrange = oldSkipOrange;
          inst.__targetCheckPending = false;
          suppressQuenchEffects(inst);
          throw err;
        });
      }
      return finish(ret);
    };

    proto.onHide = function () {
      var ui = this.ui;
      try {
        if (ui && ui.m_skipRedToggle && ui.m_skipRedToggle.clearClick) ui.m_skipRedToggle.clearClick();
      } catch (e) {}
      this.__targetCheckPending = false;
      this.__targetCheckInDoEquip = false;
      clearSkippedConfirm(this);
      clearSpeedCycle(this);
      return oldOnHide && oldOnHide.apply(this, arguments);
    };

    proto.__skipRedPatched = true;
    proto.__skipRedPatchVersion = VER;
    window[KEY].patched = true;
    log('QuenchStageUpDialog patched ' + VER);
    return true;
  }

  function tryPatch(attempt) {
    attempt = attempt || 0;
    var Mod = req('QuenchStageUpDialog');
    if (patchDialog(Mod)) return;
    if (attempt < 160) {
      setTimeout(function () {
        tryPatch(attempt + 1);
      }, 250);
    } else {
      warn('QuenchStageUpDialog not found');
    }
  }

  setTimeout(tryPatch, 500);
})();
