(function () {
  "use strict";

  if (window.__cdHideHolyBeastRedInstalled) {
    if (window.__cdHideHolyBeastRed && typeof window.__cdHideHolyBeastRed.apply === "function") {
      window.__cdHideHolyBeastRed.apply();
    }
    return;
  }
  window.__cdHideHolyBeastRedInstalled = true;

  function requireModule(name) {
    try {
      if (typeof window.__require !== "function") {
        return null;
      }
      return window.__require(name);
    } catch (err) {
      return null;
    }
  }

  function patchMethod(proto, methodName, replacement) {
    if (!proto || typeof proto[methodName] !== "function") {
      return false;
    }
    var flag = "__cdHideHolyBeastRed_" + methodName;
    if (proto[methodName][flag]) {
      return true;
    }
    replacement[flag] = true;
    replacement.__cdOriginal = proto[methodName];
    proto[methodName] = replacement;
    return true;
  }

  function getHeroModuleProto() {
    var heroModule = requireModule("HeroModule");
    return heroModule && heroModule.HeroModule && heroModule.HeroModule.prototype;
  }

  function patchHeroModule() {
    var proto = getHeroModuleProto();
    var changed = false;

    changed = patchMethod(proto, "judgeHolyBeastSkinRed", function () {
      return false;
    }) || changed;

    changed = patchMethod(proto, "judgeAllSkillCanAwake", function () {
      return false;
    }) || changed;

    changed = patchMethod(proto, "judgeTrainHero", function (hero) {
      if (typeof this.judgeUpgradeStar === "function") {
        return this.judgeUpgradeStar(hero);
      }
      return false;
    }) || changed;

    return changed;
  }

  function patchHeroListPanel() {
    var mod = requireModule("HeroListPanel");
    var proto = mod && mod.HeroListPanel && mod.HeroListPanel.prototype;
    return patchMethod(proto, "_refreshHeroTrainItem", function (item, hero) {
      if (!hero || hero.createByClient) {
        return;
      }
      var moduleManager = requireModule("ModuleManager");
      var configs = requireModule("Configs");
      var uiHelper = requireModule("UIHelper");
      var heroTrainDialog = requireModule("HeroTrainDialog");
      var ui = requireModule("index-ui");
      if (!moduleManager || !configs || !uiHelper || !heroTrainDialog || !ui || !item || !item.m_heroItem) {
        return;
      }
      var heroModule = moduleManager.GET_MODULE(configs.ModuleType.HERO);
      var row = item.m_heroItem;
      var slot = row.m_slot;
      uiHelper.UIHelper.showHeroIcon(slot, hero);
      row.m_nameColor.setSelectedPage("" + hero.color);
      row.m_name.text = hero.realName;
      row.m_power.text = Number.abridge(hero.power);
      slot.m_redPoint.m_isRed.selectedPage = "" + !!(heroModule && heroModule.judgeUpgradeStar && heroModule.judgeUpgradeStar(hero));
      slot.clearClick();
      slot.onClick(function () {
        var data = {};
        data[heroTrainDialog.HeroTrainDialog.OP_HERO_ID] = hero.heroId;
        data[heroTrainDialog.HeroTrainDialog.OP_TAP_INDEX] = 0;
        ui.SHOW_PROXY(heroTrainDialog.HeroTrainDialog, data);
      });
      if (typeof this._refreshHeroLevelUp === "function") {
        this._refreshHeroLevelUp(row, hero);
      }
    });
  }

  function patchHeroAllPanel() {
    var mod = requireModule("HeroAllPanel");
    var proto = mod && mod.HeroAllPanel && mod.HeroAllPanel.prototype;
    return patchMethod(proto, "_showHeroCell", function (index, cell) {
      var moduleManager = requireModule("ModuleManager");
      var configs = requireModule("Configs");
      var uiHelper = requireModule("UIHelper");
      var languageExt = requireModule("LanguageExt");
      var serverData = requireModule("ServerData");
      var heroTrainDialog = requireModule("HeroTrainDialog");
      var ui = requireModule("index-ui");
      if (!moduleManager || !configs || !uiHelper || !cell) {
        return;
      }

      var heroModule = moduleManager.GET_MODULE(configs.ModuleType.HERO);
      var hero = heroModule && heroModule.heroesByFilter && heroModule.heroesByFilter[index];
      if (!hero) {
        return;
      }

      var iconColor = 0;
      cell.clearClick();
      cell.m_count.text = "";
      cell.m_slot.m_hero.m_inBattle.selectedPage = "false";
      cell.m_isFrag.selectedPage = "" + hero.createByClient;
      cell.m_slot.m_item.m_canCompose.selectedPage = "false";
      cell.m_slot.m_hero.m_showRedQuench.selectedPage = "false";
      cell.m_slot.m_hero.m_redPoint.m_isRed.selectedPage = "false";

      if (hero.createByClient) {
        iconColor = uiHelper.UIHelper.showCommonIcon(cell.m_slot, configs.ResourceType.ITEM, hero.heroId, 0);
        cell.m_name.text = hero.nickName + (languageExt && languageExt.GET_CONTENT ? languageExt.GET_CONTENT("C3_HERO_CONST17") : "");
        var count = serverData && serverData.ROLE && serverData.ROLE.getItemQuantity
          ? serverData.ROLE.getItemQuantity(hero.heroFragmentId)
          : 0;
        var enough = count >= hero.heroFragmentNumber;
        cell.m_count.text = Number.abridge(count) + "/" + Number.abridge(hero.heroFragmentNumber);
        cell.m_fragEnough.selectedPage = "" + enough;
        cell.m_slot.m_item.m_canCompose.selectedPage = "" + enough;
      } else {
        iconColor = uiHelper.UIHelper.showCommonIcon(cell.m_slot, configs.ResourceType.HERO, hero.heroId, 0);
        cell.m_slot.m_hero.m_inBattle.selectedPage = "" + !!(heroModule && heroModule.heroTeamSet && heroModule.heroTeamSet.has(hero.heroId));
        cell.m_name.text = hero.realSkinName;
        cell.onClick(function () {
          if (!heroTrainDialog || !ui) {
            return;
          }
          var data = {};
          data[heroTrainDialog.HeroTrainDialog.OP_HERO_ID] = hero.heroId;
          data[heroTrainDialog.HeroTrainDialog.OP_TAP_INDEX] = 0;
          ui.SHOW_PROXY(heroTrainDialog.HeroTrainDialog, data);
        });
        cell.m_slot.m_hero.m_redPoint.m_isRed.selectedPage = "" + !!(heroModule && heroModule.judgeUpgradeStar && heroModule.judgeUpgradeStar(hero));
        uiHelper.UIHelper.showRedQuench(cell.m_slot.m_hero, hero);
      }

      cell.m_name.color = uiHelper.UIHelper.getItemColor(iconColor);
    });
  }

  function applyPatches() {
    var count = 0;
    if (patchHeroModule()) count++;
    if (patchHeroListPanel()) count++;
    if (patchHeroAllPanel()) count++;
    return count > 0;
  }

  function waitForGame() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (typeof window.__require === "function" && applyPatches()) {
        clearInterval(timer);
        return;
      }
      if (tries >= 200) {
        clearInterval(timer);
      }
    }, 500);
  }

  window.__cdHideHolyBeastRed = {
    apply: applyPatches,
    wait: waitForGame
  };

  if (!applyPatches()) {
    waitForGame();
  }
})();
