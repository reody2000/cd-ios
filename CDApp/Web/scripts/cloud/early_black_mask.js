;(function () {
  var FLAG = '__xyzwRemoveGuideMaskInstalled'
  if (window[FLAG] && window[FLAG].version >= 7) return
  window[FLAG] = { version: 7 }

  var PATCH_FLAG = '__xyzwNoBlackMaskPatchedV7'
  var POSTPROCESS_FLAG = '__xyzwLauncherPostprocessPatchedV7'
  var lastGuideLayer = null
  var lazyTimer = null
  var lazyTicks = 0
  var postprocessTimer = null
  var postprocessTicks = 0

  function safeCall(fn) {
    try { return fn() } catch (e) {}
  }

  function hideTarget(obj, keepVisible) {
    if (!obj) return
    safeCall(function () { if (!keepVisible && 'visible' in obj) obj.visible = false })
    safeCall(function () { if ('alpha' in obj) obj.alpha = 0 })
    safeCall(function () { if ('fillAlpha' in obj) obj.fillAlpha = 0 })
    safeCall(function () { if ('opacity' in obj) obj.opacity = 0 })
    safeCall(function () {
      if (typeof cc !== 'undefined' && cc.color && 'color' in obj) {
        obj.color = cc.color(0, 0, 0, 0)
      }
    })
    safeCall(function () {
      if (obj.node) {
        obj.node.opacity = 0
        if (!keepVisible && 'active' in obj.node) obj.node.active = false
      }
    })
  }

  function stripGuideMask(layer) {
    if (!layer) return false
    lastGuideLayer = layer

    hideTarget(layer.m_bg)
    hideTarget(layer.m_bgmask)

    if (layer.m_mask) {
      hideTarget(layer.m_mask, true)
      hideTarget(layer.m_mask.m_bg)
      hideTarget(layer.m_mask.m_hole)
    }

    return true
  }

  function findGuideLayerByFguiRoot() {
    return safeCall(function () {
      if (typeof fgui === 'undefined' || !fgui.GRoot || !fgui.GRoot.inst) return null
      var queue = []
      var root = fgui.GRoot.inst
      var count = root.numChildren || 0
      for (var i = 0; i < count; i++) queue.push(root.getChildAt(i))

      while (queue.length) {
        var item = queue.shift()
        if (!item) continue
        if (
          item.name === 'GuideLayer' ||
          (item.m_bgmask && item.m_mask && item.m_touchhole && item.m_btnIgnore)
        ) {
          return item
        }
        var childCount = item.numChildren || 0
        for (var j = 0; j < childCount; j++) queue.push(item.getChildAt(j))
      }
      return null
    })
  }

  function getGuideLayerPassive() {
    return lastGuideLayer || findGuideLayerByFguiRoot()
  }

  function stripSoon(layer) {
    stripGuideMask(layer || getGuideLayerPassive())

    safeCall(function () {
      if (typeof requestAnimationFrame !== 'function') return
      requestAnimationFrame(function () { stripGuideMask(layer || getGuideLayerPassive()) })
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { stripGuideMask(layer || getGuideLayerPassive()) })
      })
    })

    var ticks = 0
    var timer = setInterval(function () {
      stripGuideMask(layer || getGuideLayerPassive())
      if (++ticks >= 16) clearInterval(timer)
    }, 50)
  }

  function runSceneReadySweep() {
    stripSoon()
    sweepLauncherPostprocess()
    tryPatchLoadedGuideModules()
    startLazySweep()
    startPostprocessSweep()
  }

  function startLazySweep() {
    if (lazyTimer) return
    lazyTicks = 0
    lazyTimer = setInterval(function () {
      stripGuideMask(getGuideLayerPassive())
      if (++lazyTicks >= 240) {
        clearInterval(lazyTimer)
        lazyTimer = null
      }
    }, 250)
  }

  function isLauncherPostprocessNode(node) {
    if (!node || node.name !== 'postprocess') return false
    return true
  }

  function removeLauncherPostprocessNode(node) {
    if (!isLauncherPostprocessNode(node)) return false

    safeCall(function () {
      if (
        typeof cc !== 'undefined' &&
        cc.game &&
        cc.game.removePersistRootNode &&
        (!cc.game.isPersistRootNode || cc.game.isPersistRootNode(node))
      ) {
        cc.game.removePersistRootNode(node)
      }
    })

    safeCall(function () {
      node.opacity = 0
      node.active = false
    })
    safeCall(function () {
      if (node.parent && node.removeFromParent) node.removeFromParent(false)
    })

    return true
  }

  function walkNodeTree(root, visitor) {
    if (!root) return
    var queue = [root]
    while (queue.length) {
      var item = queue.shift()
      if (!item) continue
      if (visitor(item) === false) continue
      var children = item.children || []
      for (var i = 0; i < children.length; i++) queue.push(children[i])
    }
  }

  function sweepLauncherPostprocess() {
    var removed = false

    safeCall(function () {
      if (typeof cc === 'undefined' || !cc.game) return
      var roots = cc.game._persistRootNodes
      if (!roots) return
      for (var key in roots) {
        if (Object.prototype.hasOwnProperty.call(roots, key)) {
          removed = removeLauncherPostprocessNode(roots[key]) || removed
        }
      }
    })

    safeCall(function () {
      if (typeof cc === 'undefined' || !cc.director || !cc.director.getScene) return
      walkNodeTree(cc.director.getScene(), function (node) {
        removed = removeLauncherPostprocessNode(node) || removed
        return true
      })
    })

    return removed
  }

  function startPostprocessSweep() {
    if (postprocessTimer) return
    postprocessTicks = 0
    postprocessTimer = setInterval(function () {
      sweepLauncherPostprocess()
      if (++postprocessTicks >= 240) {
        clearInterval(postprocessTimer)
        postprocessTimer = null
      }
    }, 250)
  }

  function hookLauncherPostprocessPersist() {
    var attempts = 0
    var timer = setInterval(function () {
      attempts++
      if (typeof cc === 'undefined' || !cc.game || !cc.game.addPersistRootNode) {
        if (attempts > 300) clearInterval(timer)
        return
      }

      clearInterval(timer)
      var old = cc.game.addPersistRootNode
      if (old[POSTPROCESS_FLAG]) {
        sweepLauncherPostprocess()
        return
      }

      cc.game.addPersistRootNode = function (node) {
        if (isLauncherPostprocessNode(node)) {
          removeLauncherPostprocessNode(node)
          return
        }
        return old.apply(this, arguments)
      }
      cc.game.addPersistRootNode[POSTPROCESS_FLAG] = true
      sweepLauncherPostprocess()
      startPostprocessSweep()
    }, 50)
  }

  function wrapMethod(proto, method, after) {
    if (!proto || proto[PATCH_FLAG + '_' + method]) return false
    var old = proto[method]
    if (typeof old !== 'function') return false

    proto[method] = function () {
      var ret = old.apply(this, arguments)
      after.call(this, ret)
      return ret
    }
    proto[PATCH_FLAG + '_' + method] = true
    return true
  }

  function tryPatchLoadedGuideModules() {
    var req = window.__require
    if (typeof req !== 'function') return false

    var patched = false

    safeCall(function () {
      var guideAction = req('GuideAction')
      ;[
        'BaseGuideAction',
        'DialogGuideAction',
        'KnockButtonGuideAction',
        'KnockBattleGuideAction',
        'BreakPointGuideAction',
        'RecordGuideAction',
      ].forEach(function (name) {
        var proto = guideAction && guideAction[name] && guideAction[name].prototype
        if (!proto) return
        patched = wrapMethod(proto, 'startAction', function () {
          stripSoon(this.guideLayer)
        }) || patched
        patched = wrapMethod(proto, 'overAction', function () {
          stripSoon(this.guideLayer)
        }) || patched
        patched = wrapMethod(proto, 'update', function () {
          stripGuideMask(this.guideLayer)
        }) || patched
      })
    })

    safeCall(function () {
      var guideModule = req('GuideModule')
      var proto = guideModule && guideModule.GuideModule && guideModule.GuideModule.prototype
      if (!proto) return
      ;['_resetUI', 'triggerCurAction', '_initFirstGuideAction', 'update'].forEach(function (method) {
        patched = wrapMethod(proto, method, function () {
          stripSoon(this._curGuideAction && this._curGuideAction.guideLayer)
        }) || patched
      })
    })

    if (patched) stripSoon()
    return patched
  }

  function onMapOrGuideReady(obj, pkgName, resName) {
    if (resName === 'GuideLayer' || (obj && obj.m_bgmask && obj.m_mask && obj.m_touchhole)) {
      lastGuideLayer = obj
      stripSoon(obj)
      tryPatchLoadedGuideModules()
      startLazySweep()
      return
    }

    if (resName === 'Map' || (obj && obj.name === 'Map')) {
      setTimeout(function () {
        stripSoon()
        startLazySweep()
      }, 0)
    }
  }

  function hookFguiCreateObject() {
    var attempts = 0
    var timer = setInterval(function () {
      attempts++
      if (typeof fgui === 'undefined' || !fgui.UIPackage || !fgui.UIPackage.createObject) {
        if (attempts > 300) clearInterval(timer)
        return
      }

      clearInterval(timer)
      var old = fgui.UIPackage.createObject
      if (old[PATCH_FLAG]) return

      fgui.UIPackage.createObject = function (pkgName, resName) {
        var obj = old.apply(this, arguments)
        onMapOrGuideReady(obj, pkgName, resName)
        return obj
      }
      fgui.UIPackage.createObject[PATCH_FLAG] = true
    }, 100)
  }

  hookLauncherPostprocessPersist()
  hookFguiCreateObject()
  startPostprocessSweep()
  window.__xyzwRemoveGuideMaskOnSceneReady = runSceneReadySweep

  console.log('[RemoveGuideMask] installed v7 scene-ready + launcher-postprocess')
})()
