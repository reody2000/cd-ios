(function () {
  'use strict';

  if (window.__cdShellFeaturesLoaded) {
    if (typeof window.__cdSyncShellSettings === 'function') {
      window.__cdSyncShellSettings();
    }
    return;
  }
  window.__cdShellFeaturesLoaded = true;

  function log() {}

  function waitForGameModule(moduleName, callback) {
    var done = false;
    var tries = 0;
    function check() {
      if (done || typeof window.__require !== 'function') return false;
      try {
        var mod = window.__require(moduleName);
        if (mod && (typeof mod !== 'object' || Object.keys(mod).length > 0 || mod[moduleName])) {
          done = true;
          callback(mod);
          return true;
        }
      } catch (e) {}
      return false;
    }
    if (check()) return;
    var timer = setInterval(function () {
      tries++;
      if (check() || tries > 120) clearInterval(timer);
    }, 500);
  }

  function copyText(text) {
    var value = String(text == null ? '' : text);
    if (!value) return false;
    try {
      var input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', 'readonly');
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      input.style.top = '-9999px';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      return true;
    } catch (e) {}
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value);
        return true;
      }
    } catch (e) {}
    return false;
  }

  function showTip(text) {
    try {
      var tipsManager = window.__require('TipsManager');
      if (tipsManager && tipsManager.SHOW_TIP) tipsManager.SHOW_TIP(text);
    } catch (e) {}
  }

  function setVisible(control, visible) {
    if (!control) return;
    try {
      if (control._node) control._node.active = visible;
      else if (control.node) control.node.active = visible;
      else if (typeof control.visible !== 'undefined') control.visible = visible;
    } catch (e) {}
  }

  function bindClick(control, handler) {
    if (!control) return false;
    try {
      if (control.clearClick) control.clearClick();
      if (control.onClick) {
        control.onClick(handler);
        return true;
      }
      if (control.node && control.node.on) {
        control.node.off && control.node.off('click');
        control.node.on('click', handler);
        return true;
      }
    } catch (e) {}
    return false;
  }

  function showRoleInfo(roleId) {
    if (!roleId) return;
    try {
      var rankModule = window.__require('RankModule');
      if (rankModule && rankModule.SHOW_ROLE_INFO) {
        rankModule.SHOW_ROLE_INFO(roleId);
      }
    } catch (e) {}
  }

  function readEnabled(name) {
    try {
      if (name === 'nightmare') return !!AndroidBinBridge.isNightmareSpeedEnabled();
      if (name === 'floatText') return !!AndroidBinBridge.isFloatTextEnabled();
      if (name === 'gameEnhance') return !AndroidBinBridge.isGameEnhanceEnabled || !!AndroidBinBridge.isGameEnhanceEnabled();
    } catch (e) {}
    if (name === 'gameEnhance') {
      return !window.__cdShellSettings || window.__cdShellSettings.gameEnhance === true;
    }
    return false;
  }

  function readSpeedRate() {
    try {
      var speed = Number(AndroidBinBridge.getUiSpeedRate && AndroidBinBridge.getUiSpeedRate());
      if (!isFinite(speed) || speed < 1) return 1;
      if (speed > 20) return 20;
      return speed;
    } catch (e) {
      return 1;
    }
  }

  window.__cdShellSettings = window.__cdShellSettings || {};
  window.__cdSyncShellSettings = function () {
    window.__cdShellSettings.uiSpeedRate = readSpeedRate();
    window.__cdShellSettings.nightmareSpeed = readEnabled('nightmare');
    window.__nightmareSpeedEnabled = !!window.__cdShellSettings.nightmareSpeed;
    window.__cdShellSettings.floatText = readEnabled('floatText');
    window.__cdShellSettings.gameEnhance = readEnabled('gameEnhance');
    if (typeof window.__cdApplyUiSpeed === 'function') {
      window.__cdApplyUiSpeed();
    }
    if (typeof window.__cdApplyNightmareSpeed === 'function') {
      window.__cdApplyNightmareSpeed();
    }
    if (typeof window.__cdApplyFloatText === 'function') {
      window.__cdApplyFloatText();
    }
    return window.__cdShellSettings;
  };

  function getUiSpeedRate() {
    var speed = Number(window.__cdShellSettings && window.__cdShellSettings.uiSpeedRate) || 1;
    if (speed < 1) return 1;
    if (speed > 20) return 20;
    return speed;
  }

  function applyGameSpeed() {
    var speed = getUiSpeedRate();
    window.__currentSpeed = speed;
    try {
      if (window.cc && window.cc.director && window.cc.director.getScheduler && window.cc.director.getScheduler()) {
        window.cc.director.getScheduler().setTimeScale(speed);
      }
    } catch (e) {}
    try {
      if (typeof window.__require === 'function') {
        var core = window.__require([13]);
        if (core && core.setGameSpeed) {
          core.setGameSpeed(speed);
        }
      }
    } catch (e) {}
    window.__speedMultiplier = speed;
  }

  function installUiSpeed() {
    window.__cdApplyUiSpeed = applyGameSpeed;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      applyGameSpeed();
      if ((window.cc && window.cc.director && window.cc.director.getScheduler && window.cc.director.getScheduler()) || tries >= 50) {
        clearInterval(timer);
      }
    }, 300);
    applyGameSpeed();
  }

  function isNightmareEnabled() {
    if (window.__cdShellSettings && typeof window.__cdShellSettings.nightmareSpeed !== 'undefined') {
      return !!window.__cdShellSettings.nightmareSpeed;
    }
    return window.__nightmareSpeedEnabled === true;
  }

  function isFloatTextEnabled() {
    return !!(window.__cdShellSettings && window.__cdShellSettings.floatText);
  }

  function isGameEnhanceEnabled() {
    return !!(window.__cdShellSettings && window.__cdShellSettings.gameEnhance === true);
  }

  function installNightmareSpeed() {
    if (window.__cdNightmareInstallerStarted) return;
    window.__cdNightmareInstallerStarted = true;

    var configPatched = false;
    var nightmareConfig = null;

    function cacheOriginalBattleSpeed(item) {
      if (!item || typeof item !== 'object') return;
      if (!Object.prototype.hasOwnProperty.call(item, '__cdOriginalBattleSpeed')) {
        try {
          Object.defineProperty(item, '__cdOriginalBattleSpeed', {
            value: item.BattleSpeed,
            configurable: true
          });
        } catch (e) {
          item.__cdOriginalBattleSpeed = item.BattleSpeed;
        }
      }
    }

    function applyNightmareMapSpeed() {
      if (!nightmareConfig || !nightmareConfig.map) return;
      var enabled = isNightmareEnabled();
      try {
        var each = nightmareConfig.map;
        var visit = function (item) {
          if (!item || typeof item !== 'object') return;
          cacheOriginalBattleSpeed(item);
          item.BattleSpeed = enabled ? 100 : item.__cdOriginalBattleSpeed;
        };
        if (typeof each.forEach === 'function') {
          each.forEach(visit);
        } else {
          Object.keys(each).forEach(function (key) {
            visit(each[key]);
          });
        }
      } catch (e) {}
    }

    function patchNightmareSpeed() {
      try {
        if (typeof window.__require !== 'function') {
          return false;
        }

        var configs = window.__require('Configs');
        if (!configs || !configs.NightMare || !configs.NightMare.getById) {
          return false;
        }

        nightmareConfig = configs.NightMare;
        applyNightmareMapSpeed();

        if (configPatched) return true;

        if (configs.NightMare.getById.__cdNightmareSpeedPatched) {
          configPatched = true;
          return true;
        }

        var originalGetById = configs.NightMare.getById.bind(configs.NightMare);
        configs.NightMare.getById = function (id) {
          var nightmare = originalGetById(id);
          if (Number(id) === 1 && isNightmareEnabled() && nightmare) {
            var next = {};
            var key;
            for (key in nightmare) {
              next[key] = nightmare[key];
            }
            next.BattleSpeed = 100;
            return next;
          }
          return nightmare;
        };
        configs.NightMare.getById.__cdNightmareSpeedPatched = true;
        configs.NightMare.getById.__cdOriginal = originalGetById;

        configPatched = true;
        log('[CD] 十殿加速补丁已安装');
        return true;
      } catch (e) {
        return false;
      }
    }

    window.__cdApplyNightmareSpeed = function () {
      window.__nightmareSpeedEnabled = isNightmareEnabled();
      applyNightmareMapSpeed();
      patchNightmareSpeed();
    };
    window.__applyNightmareSpeed = window.__cdApplyNightmareSpeed;

    var fastTries = 0;
    var fastTimer = setInterval(function () {
      fastTries++;
      patchNightmareSpeed();
      if (fastTries > 120) clearInterval(fastTimer);
    }, 500);
    setTimeout(function () {
      var lateTries = 0;
      var lateTimer = setInterval(function () {
        lateTries++;
        patchNightmareSpeed();
        if (lateTries > 120) clearInterval(lateTimer);
      }, 1000);
    }, 2000);
    setInterval(function () {
      patchNightmareSpeed();
    }, 5000);
    patchNightmareSpeed();
  }

  var floatInstalled = false;
  var floatOriginalGetter = null;
  var floatOriginalSetter = null;

  function formatBattleNumber(raw) {
    if (!raw) return { formatted: raw, unit: '' };
    var match = String(raw).match(/^([+-]?)(\d+)$/);
    if (!match) return { formatted: raw, unit: '' };
    var sign = match[1];
    var num = parseInt(match[2], 10);
    if (num < 10000) return { formatted: raw, unit: '' };
    var val;
    var unit;
    if (num >= 1000000000000) {
      val = num / 1000000000000;
      unit = '兆';
    } else if (num >= 100000000) {
      val = num / 100000000;
      unit = '亿';
    } else {
      val = num / 10000;
      unit = '万';
    }
    var intLen = Math.floor(val).toString().length;
    var decimals = Math.max(0, 4 - intLen);
    return { formatted: sign + val.toFixed(decimals) + unit, unit: unit };
  }

  var floatTypeNames = {
    FlyBleed: '流血',
    FlyPoison: '中毒',
    FlyBurn: '灼烧',
    FlyCrit: '',
    FlyBlock: '格挡',
    FlyTreatment: '恢复',
    FlyTerrifying: '恐惧',
    FlyTongxin: '同心',
    FlyHelp: '协力',
    FlyXieLi: '协力',
    FlyTeam: '协力',
    FlyLink: '协力',
    FlyTieXue: '铁血',
    FlyQingNang: '青囊',
    FlyRende: '仁德',
    FlyXuanJi: '璇玑',
    FlyJianDan: '剑胆',
    FlyDamage: ''
  };

  function getStatusByPackageName(packageItemName) {
    if (!packageItemName) return '';
    for (var key in floatTypeNames) {
      if (packageItemName.indexOf(key) >= 0) return floatTypeNames[key];
    }
    return '';
  }

  function findFlyEffectPackageItem(node) {
    var current = node;
    for (var i = 0; i < 15 && current; i++) {
      var name = current.name || '';
      var pkgName = '';
      if (current.packageItem && current.packageItem.name) pkgName = current.packageItem.name;
      if (current.$gobj && current.$gobj.packageItem && current.$gobj.packageItem.name) pkgName = current.$gobj.packageItem.name;
      if (current.node && current.node.packageItem && current.node.packageItem.name) pkgName = current.node.packageItem.name;
      if (pkgName) return pkgName;
      if (name.indexOf('Fly') === 0 || name.indexOf('UI_Fly') === 0) return name;
      current = current.parent || (current.node && current.node.parent) || null;
    }
    return '';
  }

  function installFloatTextHook() {
    if (floatInstalled) return true;
    try {
      var cc = window.cc;
      if (!cc || !cc.Label) return false;
      var labelProto = cc.Label.prototype;
      var descriptor = Object.getOwnPropertyDescriptor(labelProto, 'string');
      if (!descriptor || !descriptor.set) return false;
      floatOriginalGetter = descriptor.get;
      floatOriginalSetter = descriptor.set;

      Object.defineProperty(labelProto, 'string', {
        get: floatOriginalGetter,
        set: function (value) {
          if (!isFloatTextEnabled()) {
            return floatOriginalSetter.call(this, value);
          }

          var str = String(value == null ? '' : value);
          var isSpecialDamage = false;
          if (/^s[+-]?\d+(?:\.\d+)?$/.test(str)) {
            str = str.substring(1);
            value = str;
            isSpecialDamage = true;
          }

          if (!/^[+-]?\d+(?:\.\d+)?$/.test(str)) {
            return floatOriginalSetter.call(this, value);
          }

          var match = str.match(/^([^\d]*)(-?\d+(?:\.\d+)?)([^\d]*)$/);
          if (!match || !match[2]) {
            return floatOriginalSetter.call(this, value);
          }

          var prefix = match[1];
          var numStr = match[2];
          var suffix = match[3];
          if (suffix.indexOf('万') >= 0 || suffix.indexOf('亿') >= 0 || suffix.indexOf('兆') >= 0) {
            return floatOriginalSetter.call(this, value);
          }

          var pureNum = parseFloat(numStr.replace(/^[+-]/, ''));

          var anchorX = this.node ? this.node.anchorX : -1;
          var isBattleFloat = anchorX === 0.5 || isSpecialDamage;
          if (!isBattleFloat) {
            return floatOriginalSetter.call(this, value);
          }

          if (this.node && !prefix && !isSpecialDamage) {
            var gObj = this.node.$gobj;
            if (gObj && gObj.parent && gObj.parent.packageItem) {
              var parentPkg = gObj.parent.packageItem.name || '';
              if (parentPkg.indexOf('Fly') !== 0) {
                return floatOriginalSetter.call(this, value);
              }
            }
          }

          var packageName = findFlyEffectPackageItem(this.node);
          var statusName = getStatusByPackageName(packageName);
          var result = formatBattleNumber(numStr.replace(/^[+-]/, ''));
          var finalVal;
          if (statusName) finalVal = statusName + result.formatted + suffix;
          else if (isSpecialDamage) finalVal = '暴击' + result.formatted + suffix;
          else if (numStr.indexOf('-') === 0) finalVal = '-' + result.formatted + suffix;
          else if (numStr.indexOf('+') === 0) finalVal = '+' + result.formatted + suffix;
          else finalVal = result.formatted + suffix;

          var color = null;
          if (statusName === '流血') {
            color = { r: 246, g: 56, b: 32 };
          } else if (statusName === '中毒') {
            color = { r: 180, g: 64, b: 248 };
          } else if (statusName === '灼烧') {
            color = { r: 254, g: 117, b: 37 };
          } else if (statusName === '格挡') {
            color = { r: 234, g: 203, b: 42 };
          } else if (statusName === '协力') {
            color = { r: 255, g: 172, b: 0 };
          } else if (statusName === '铁血') {
            color = { r: 229, g: 154, b: 4 };
          } else if (statusName === '同心') {
            color = { r: 234, g: 158, b: 3 };
          } else if (statusName === '恢复') {
            color = { r: 80, g: 255, b: 80 };
          } else if (isSpecialDamage) {
            color = { r: 255, g: 149, b: 36 };
          } else if (numStr.indexOf('-') === 0) {
            color = { r: 255, g: 80, b: 80 };
          } else if (prefix.indexOf('+') === 0) {
            color = { r: 80, g: 255, b: 80 };
          } else {
            color = { r: 243, g: 232, b: 167 };
          }

          if (color && this.node) {
            this.node.color = { r: color.r, g: color.g, b: color.b, a: 255 };
          }

          if (this.node) {
            var label = this.node.getComponent && this.node.getComponent(cc.Label);
            if (label) {
              label.fontSize = 30;
              label.lineHeight = 36;
              label.useSystemFont = true;
              if (label._assembler && label._assembler._getFontDesc) {
                var origGetFontDesc = label._assembler._getFontDesc.bind(label._assembler);
                label._assembler._getFontDesc = function () {
                  var desc = origGetFontDesc();
                  if (desc && desc.indexOf('bold') < 0) {
                    desc = 'bold ' + desc;
                  }
                  return desc;
                };
              }
            }
            var shadow = this.node.getComponent && this.node.getComponent(cc.LabelShadow);
            if (!shadow && this.node.addComponent) shadow = this.node.addComponent(cc.LabelShadow);
            if (shadow) {
              shadow.color = { r: 0, g: 0, b: 0, a: 255 };
              shadow.offset = { x: 2, y: -3 };
              shadow.blur = 3;
            }
            var outline = this.node.getComponent && this.node.getComponent(cc.LabelOutline);
            if (!outline && this.node.addComponent) outline = this.node.addComponent(cc.LabelOutline);
            if (outline) {
              outline.color = { r: 0, g: 0, b: 0, a: 255 };
              outline.width = 2;
            }
          }

          var result = floatOriginalSetter.call(this, finalVal);
          if (this.node) {
            if (this.node._forceUpdateRenderData) this.node._forceUpdateRenderData();
            if (this.node.setVertsDirty) this.node.setVertsDirty();
          }
          return result;
        },
        configurable: true
      });
      floatInstalled = true;
      log('[CD] 飘字优化 Hook 已安装');
      return true;
    } catch (e) {
      return false;
    }
  }

  function installFloatText() {
    window.__cdApplyFloatText = function () {
      if (isFloatTextEnabled()) installFloatTextHook();
    };

    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if ((isFloatTextEnabled() && installFloatTextHook()) || tries > 80) clearInterval(timer);
    }, 500);
    window.__cdApplyFloatText();
  }

  function installHeroAttributeEnhance() {
    waitForGameModule('HeroAttributeToolTip', function (mod) {
      var HeroTipClass = mod && mod.HeroAttributeToolTip;
      if (!HeroTipClass || !HeroTipClass.prototype || !HeroTipClass.prototype.onShow || HeroTipClass.prototype.onShow.__cdHeroAttrPatched) return;

      var originalOnShow = HeroTipClass.prototype.onShow;
      var attrPatched = false;
      HeroTipClass.prototype.onShow = function () {
        try {
          if (!attrPatched) {
            var configs = window.__require('Configs');
            var attrs = configs && configs.ConstantConf && configs.ConstantConf.config && configs.ConstantConf.config.specialBattleAttribute;
            if (attrs && attrs.length === 16) {
              attrs.push(65, 66, 67, 68, 69, 70, 79, 80, 226, 227, 228, 229, 230, 231);
            }
            attrPatched = true;
          }
          var attr = this.ui && this.ui.m_advanceAttr;
          if (attr && attr.setSize) attr.setSize(attr._width || attr.width, 438);
          var bg = this.ui && this.ui._children && this.ui._children[0];
          if (bg && bg.setSize) bg.setSize(bg._width || bg.width, 720);
        } catch (e) {}
        return originalOnShow.apply(this, arguments);
      };
      HeroTipClass.prototype.onShow.__cdHeroAttrPatched = true;
      log('[CD] 英雄属性面板增强已启用');
    });
  }

  function installPlayerInfoDialogEnhance() {
    waitForGameModule('PlayerInfoDialog', function (mod) {
      var PlayerInfoDialogClass = mod && mod.PlayerInfoDialog;
      if (!PlayerInfoDialogClass || !PlayerInfoDialogClass.prototype) return;

      if (!PlayerInfoDialogClass.prototype._onClickBtnNativeImg || !PlayerInfoDialogClass.prototype._onClickBtnNativeImg.__cdNativeHeadPatched) {
        var nativeHead = function () {
          if (typeof window.__cdOpenAvatarPicker === 'function' && window.__cdOpenAvatarPicker()) return;
          if (this._showChangeHeadImageDialog) this._showChangeHeadImageDialog();
        };
        nativeHead.__cdNativeHeadPatched = true;
        PlayerInfoDialogClass.prototype._onClickBtnNativeImg = nativeHead;
      }

      if (!PlayerInfoDialogClass.prototype.onShow || PlayerInfoDialogClass.prototype.onShow.__cdPlayerInfoPatched) return;
      var originalOnShow = PlayerInfoDialogClass.prototype.onShow;
      PlayerInfoDialogClass.prototype.onShow = function () {
        var roleInfo = null;
        var isSelf = false;
        try {
          var consts = window.__require('consts');
          var serverData = window.__require('ServerData');
          roleInfo = this.model && this.model.get && this.model.get(consts.ModelConst.ROLE_INFO);
          isSelf = !!(roleInfo && serverData && serverData.ROLE && roleInfo.roleId === serverData.ROLE.roleId);
        } catch (e) {}

        var result = originalOnShow.apply(this, arguments);

        if (roleInfo && !isSelf) {
          var dialog = this;
          setTimeout(function () {
            try {
              setVisible(dialog.ui && dialog.ui.m_serverName, true);
              setVisible(dialog.ui && dialog.ui.m_playerid, true);
              setVisible(dialog.ui && dialog.ui.m_btnCopyID, true);
              var serverParent = dialog.ui && dialog.ui.m_serverName && dialog.ui.m_serverName.parent;
              if (serverParent && serverParent.getChild) setVisible(serverParent.getChild('n101'), true);

              bindClick(dialog.ui && dialog.ui.m_btnCopyID, function () {
                try {
                  var languageExt = window.__require('LanguageExt');
                  var platformManager = window.__require('PlatformManager');
                  var serverName = languageExt && languageExt.GET_SERVER_NAME
                    ? languageExt.GET_SERVER_NAME(parseInt(roleInfo.serverName, 10), false)
                    : roleInfo.serverName;
                  var value = serverName + '+' + roleInfo.roleId;
                  if (platformManager && platformManager.PlatformManager && platformManager.PlatformManager.instance) {
                    platformManager.PlatformManager.instance.setClipboardData({
                      data: value,
                      success: function () { showTip('复制成功'); }
                    });
                  } else if (copyText(value)) {
                    showTip('复制成功');
                  }
                } catch (e) {
                  if (copyText(roleInfo.roleId)) showTip('复制成功');
                }
              });
            } catch (e) {}
          }, 100);
        }
        return result;
      };
      PlayerInfoDialogClass.prototype.onShow.__cdPlayerInfoPatched = true;
      log('[CD] 玩家信息弹窗增强已启用');
    });
  }

  function installArenaRecordEnhance() {
    waitForGameModule('ArenaRecordDialog', function (mod) {
      var ArenaRecordDialogClass = mod && mod.ArenaRecordDialog;
      if (!ArenaRecordDialogClass || !ArenaRecordDialogClass.prototype || !ArenaRecordDialogClass.prototype._refreshSingleListItem || ArenaRecordDialogClass.prototype._refreshSingleListItem.__cdArenaPatched) return;

      var originalRefreshItem = ArenaRecordDialogClass.prototype._refreshSingleListItem;
      ArenaRecordDialogClass.prototype._refreshSingleListItem = function (index, item) {
        var result = originalRefreshItem.apply(this, arguments);
        try {
          var recordData = this.recordList && this.recordList[index];
          var roleId = recordData && (recordData.oppositeId || recordData.roleId || recordData.uid);
          if (roleId && item && item.m_headIcon) {
            bindClick(item.m_headIcon, function () { showRoleInfo(roleId); });
          }
        } catch (e) {}
        return result;
      };
      ArenaRecordDialogClass.prototype._refreshSingleListItem.__cdArenaPatched = true;
      log('[CD] 竞技场战报增强已启用');
    });
  }

  function installFriendSearchEnhance() {
    waitForGameModule('FriendSearchDialog', function (mod) {
      var FriendSearchDialogClass = mod && mod.FriendSearchDialog;
      if (!FriendSearchDialogClass || !FriendSearchDialogClass.prototype || !FriendSearchDialogClass.prototype._refreshUI || FriendSearchDialogClass.prototype._refreshUI.__cdFriendSearchPatched) return;

      function pickFriendRoleId(friendInfo) {
        if (!friendInfo) return null;
        return friendInfo.roleId || friendInfo.RoleId || friendInfo.roleID || friendInfo.id || friendInfo.uid || friendInfo.playerId || friendInfo.playerID || null;
      }

      function pickFriendHeadIcon(dialog) {
        var ui = dialog && dialog.ui;
        var friend = ui && ui.m_friend;
        if (friend && friend.m_headIcon) return friend.m_headIcon;
        if (ui && ui.m_headIcon) return ui.m_headIcon;
        var children = friend && friend._children;
        if (children) {
          for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (!child) continue;
            if (child.m_headIcon) return child.m_headIcon;
            if (child.name === 'm_headIcon' || child.name === 'headIcon' || child.name === 'head') return child;
          }
          for (var j = 0; j < children.length; j++) {
            var item = children[j];
            if (item && (item.onClick || item.clearClick || (item.node && item.node.on))) return item;
          }
        }
        return null;
      }

      function bindFriendSearchHead(dialog) {
        try {
          var friendInfo = dialog && dialog._curFriendInfo;
          var roleId = pickFriendRoleId(friendInfo);
          var headIcon = pickFriendHeadIcon(dialog);
          if (roleId && headIcon) {
            bindClick(headIcon, function () { showRoleInfo(roleId); });
            return true;
          }
        } catch (e) {}
        return false;
      }

      var originalRefreshUI = FriendSearchDialogClass.prototype._refreshUI;
      FriendSearchDialogClass.prototype._refreshUI = function () {
        var result = originalRefreshUI.apply(this, arguments);
        var dialog = this;
        bindFriendSearchHead(dialog);
        setTimeout(function () { bindFriendSearchHead(dialog); }, 80);
        setTimeout(function () { bindFriendSearchHead(dialog); }, 250);
        return result;
      };
      FriendSearchDialogClass.prototype._refreshUI.__cdFriendSearchPatched = true;
      log('[CD] 好友搜索增强已启用');
    });
  }

  function installMailDetailEnhance() {
    waitForGameModule('LegacyMailDetailDialog', function (mod) {
      var LegacyMailDetailDialogClass = mod && mod.LegacyMailDetailDialog;
      if (!LegacyMailDetailDialogClass || !LegacyMailDetailDialogClass.prototype || !LegacyMailDetailDialogClass.prototype.onShow || LegacyMailDetailDialogClass.prototype.onShow.__cdMailPatched) return;

      var originalOnShow = LegacyMailDetailDialogClass.prototype.onShow;
      LegacyMailDetailDialogClass.prototype.onShow = function () {
        var result = originalOnShow.apply(this, arguments);
        try {
          var friend = this.ui && this.ui.m_friend;
          var children = friend && friend._children;
          var headIcon = children && children[1];
          var playerIdLabel = children && children[2];
          if (headIcon && playerIdLabel) {
            bindClick(headIcon, function () {
              var idText = String(playerIdLabel.text || '').replace('玩家ID：', '').replace('玩家ID:', '').trim();
              if (copyText(idText)) showTip('复制成功');
            });
          }
        } catch (e) {}
        return result;
      };
      LegacyMailDetailDialogClass.prototype.onShow.__cdMailPatched = true;
      log('[CD] 邮件详情增强已启用');
    });
  }

  function installSkipBoxAnimation() {
    waitForGameModule('BoxPanel', function (mod) {
      var BoxPanelClass = mod && mod.BoxPanel;
      if (!BoxPanelClass || !BoxPanelClass.prototype || !BoxPanelClass.prototype._onOpenBox || BoxPanelClass.prototype._onOpenBox.__cdSkipBoxPatched) return;

      window.__cdSkipBoxAnimation = !!window.__cdSkipBoxAnimation;
      var originalOnOpenBox = BoxPanelClass.prototype._onOpenBox;
      var originalOnShow = BoxPanelClass.prototype.onShow;
      var originalOnHide = BoxPanelClass.prototype.onHide;

      BoxPanelClass.prototype._onOpenBox = async function () {
        if (!window.__cdSkipBoxAnimation) {
          return originalOnOpenBox.apply(this, arguments);
        }

        try {
          var boxList = this.boxList || [];
          var currentIndex = Number(this._currentIndex);
          if (currentIndex < 0 || currentIndex >= boxList.length) {
            return originalOnOpenBox.apply(this, arguments);
          }

          var boxItem = boxList[currentIndex];
          var itemId = boxItem && boxItem.id;
          var quantity = window.ROLE && window.ROLE.getItemQuantity ? window.ROLE.getItemQuantity(itemId) : 0;
          if (!itemId || quantity === 0) {
            return originalOnOpenBox.apply(this, arguments);
          }

          if (this._removeCoinAnim) this._removeCoinAnim();

          var configs = window.__require('Configs');
          var moduleManager = window.__require('ModuleManager');
          var languageExt = window.__require('LanguageExt');
          var tipsManager = window.__require('TipsManager');
          var boxModule = moduleManager && moduleManager.GET_MODULE && moduleManager.GET_MODULE(configs.ModuleType.BOX);
          if (!boxModule || !boxModule.getOpenBoxNum || !boxModule.sendOpenBox) {
            return originalOnOpenBox.apply(this, arguments);
          }

          var openNum = boxModule.getOpenBoxNum(boxItem, quantity);
          var rewards = await boxModule.sendOpenBox(itemId, openNum);
          if (rewards) {
            if (boxModule.syncBoxPoint) boxModule.syncBoxPoint();
            var itemConfig = configs.ItemConf && configs.ItemConf.getById ? configs.ItemConf.getById(itemId) : null;
            var itemName = itemConfig && languageExt && languageExt.GET_CONTENT ? languageExt.GET_CONTENT(itemConfig.name) : '宝箱';
            if (tipsManager && tipsManager.SHOW_TIP) tipsManager.SHOW_TIP('成功开启 ' + openNum + ' 个' + itemName);
          }

          if (this._refresh) this._refresh();
          return rewards;
        } catch (e) {
          return originalOnOpenBox.apply(this, arguments);
        }
      };
      BoxPanelClass.prototype._onOpenBox.__cdSkipBoxPatched = true;

      if (originalOnShow && !originalOnShow.__cdSkipBoxShowPatched) {
        BoxPanelClass.prototype.onShow = function () {
          var result = originalOnShow.apply(this, arguments);
          if (this.__cdSkipAnimCheckBox) return result;

          try {
            var helpButton = this.ui && this.ui.m_quesHelp;
            var packageApi = window.fgui && window.fgui.UIPackage;
            if (!helpButton || !packageApi || !packageApi.createObject || !this.ui || !this.ui.addChild) return result;

            var checkBox = packageApi.createObject('ui_common', 'BtnCheckBox');
            checkBox.setPosition(helpButton.x + helpButton.width + 10, helpButton.y);
            checkBox.selected = !!window.__cdSkipBoxAnimation;
            if (checkBox.onClick) {
              checkBox.onClick(function () {
                window.__cdSkipBoxAnimation = !!checkBox.selected;
                showTip(checkBox.selected ? '已开启跳过动画' : '已关闭跳过动画');
              });
            }

            var textArea = packageApi.createObject('ui_common', 'TextArea');
            textArea.text = '跳过动画';
            textArea.touchable = false;
            textArea.setPosition(helpButton.x + helpButton.width + 60, helpButton.y + 10);

            this.ui.addChild(checkBox);
            this.ui.addChild(textArea);
            this.__cdSkipAnimCheckBox = checkBox;
            this.__cdSkipAnimText = textArea;
          } catch (e) {}
          return result;
        };
        BoxPanelClass.prototype.onShow.__cdSkipBoxShowPatched = true;
      }

      if (originalOnHide && !originalOnHide.__cdSkipBoxHidePatched) {
        BoxPanelClass.prototype.onHide = function () {
          try {
            if (this.__cdSkipAnimCheckBox) {
              this.__cdSkipAnimCheckBox.dispose();
              this.__cdSkipAnimCheckBox = null;
            }
            if (this.__cdSkipAnimText) {
              this.__cdSkipAnimText.dispose();
              this.__cdSkipAnimText = null;
            }
          } catch (e) {}
          return originalOnHide.apply(this, arguments);
        };
        BoxPanelClass.prototype.onHide.__cdSkipBoxHidePatched = true;
      }

      log('[CD] 跳过宝箱动画已启用');
    });
  }

  function installDefaultEnhancements() {
    if (!isGameEnhanceEnabled()) return;
    if (window.__cdDefaultEnhancementsStarted) return;
    window.__cdDefaultEnhancementsStarted = true;
    installHeroAttributeEnhance();
    installPlayerInfoDialogEnhance();
    installArenaRecordEnhance();
    installFriendSearchEnhance();
    installMailDetailEnhance();
    installSkipBoxAnimation();
  }

  window.__cdInstallDefaultEnhancements = installDefaultEnhancements;
  window.__cdSyncShellSettings();
  installUiSpeed();
  if (isNightmareEnabled()) installNightmareSpeed();
  if (isFloatTextEnabled()) installFloatText();
  installDefaultEnhancements();
})();
