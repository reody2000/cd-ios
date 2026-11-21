;(function () {
  'use strict'

  if (window.__cdAvatarFixInstalled) return
  window.__cdAvatarFixInstalled = true

  var MAX_TRIES = 600
  var TRY_INTERVAL = 250
  var callbacks = {}
  var tries = 0

  window.__cdAvatarNativePicked = function (id, largeBase64, smallBase64) {
    var cb = callbacks[id]
    delete callbacks[id]
    if (!cb || typeof cb.done !== 'function') return
    cb.done({
      base64s: [largeBase64 || '', smallBase64 || largeBase64 || ''],
      images: [],
      imagePath: ''
    })
  }

  window.__cdAvatarNativeCancel = function (id) {
    var cb = callbacks[id]
    delete callbacks[id]
    if (cb && typeof cb.cancel === 'function') cb.cancel()
  }

  installDialogFilter()
  var timer = setInterval(function () {
    tries++
    tryInstall()
    if (tries >= MAX_TRIES) clearInterval(timer)
  }, TRY_INTERVAL)
  tryInstall()

  function log() {
  }

  function tryInstall() {
    try {
      patchPlatformManager()
      patchWxPermission()
      patchChooseImage()
      patchPlayerInfoDialog()
    } catch (e) {}
  }

  function installDialogFilter() {
    if (window.__cdAvatarDialogObserver) return
    var blockText = [
      '当前版本过低',
      '不支持更换头像',
      '请前往下载最新',
      '更换头像功能',
      '存储权限',
      '应用权限管理',
      '请选择允许游戏使用该权限'
    ]

    function removeBlockDialog(root) {
      try {
        var all = root && root.querySelectorAll ? root.querySelectorAll('*') : []
        for (var i = 0; i < all.length; i++) {
          var text = (all[i].textContent || '').trim()
          if (!text) continue
          var hit = false
          for (var j = 0; j < blockText.length; j++) {
            if (text.indexOf(blockText[j]) >= 0) {
              hit = true
              break
            }
          }
          if (!hit) continue
          var box = all[i]
          var okButton = findButtonByText(box, ['确定', '允许', '继续'])
          if (okButton) {
            setTimeout(function (button) {
              try { button.click() } catch (e) {}
            }, 0, okButton)
          }
          for (var k = 0; k < 6 && box && box.parentElement; k++) box = box.parentElement
          if (box && box.remove) {
            box.remove()
            log('removed avatar permission dialog')
          }
        }
      } catch (e) {}
    }

    window.__cdAvatarDialogObserver = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        Array.prototype.forEach.call(mutation.addedNodes || [], function (node) {
          if (node && node.nodeType === 1) removeBlockDialog(node)
        })
      })
    })
    window.__cdAvatarDialogObserver.observe(document.documentElement || document, {
      childList: true,
      subtree: true
    })
  }

  function findButtonByText(root, texts) {
    var all = root && root.querySelectorAll ? root.querySelectorAll('*') : []
    for (var i = 0; i < all.length; i++) {
      var text = (all[i].textContent || '').trim()
      if (!text) continue
      for (var j = 0; j < texts.length; j++) {
        if (text === texts[j] || text.indexOf(texts[j]) >= 0) return all[i]
      }
    }
    return null
  }

  function patchPlatformManager() {
    if (typeof window.__require !== 'function') return
    var module = safeRequire('PlatformManager')
    var manager = module && module.PlatformManager && module.PlatformManager.instance
    if (!manager) return
    patchPlatformChooseImage(manager)
    if (manager.__cdAvatarPlatformPatched) return

    // Keep avatar selection on the web-style path so the game does not show its native storage-permission dialog first.
    try { manager.isNative = false } catch (e) {}
    try { manager.isAndroidAndNative = false } catch (e) {}
    try { manager.isAndroidAndIOSAndNative = false } catch (e) {}
    try { manager.isIos = false } catch (e) {}
    try { manager.isByteDance = false } catch (e) {}
    try { manager.isWeChat = false } catch (e) {}
    try { manager.isQQ = false } catch (e) {}
    try { manager.isH5 = true } catch (e) {}

    patchVersionMethod(manager, 'getClientVersion', '99.99.99')
    patchVersionMethod(manager, 'getVersion', '99.99.99')
    patchVersionMethod(manager, 'getAppVersion', '10.0.0')
    patchPermissionMethod(manager, 'requestPermission')
    patchPermissionMethod(manager, 'requestPermissions')
    patchPermissionMethod(manager, 'checkPermission')
    patchPermissionMethod(manager, 'checkPermissions')
    patchPermissionMethod(manager, 'requestAlbumPermission')
    patchPermissionMethod(manager, 'checkAlbumPermission')
    patchPermissionMethod(manager, 'authorize')
    patchPermissionMethod(manager, 'openSetting')
    patchPermissionMethod(manager, 'getSetting')
    manager.__cdAvatarPlatformPatched = true
    log('platform patched for web-style avatar')
  }

  function safeRequire(name) {
    try {
      return window.__require(name)
    } catch (e) {
      return null
    }
  }

  function patchVersionMethod(target, name, value) {
    if (!target || !target[name] || target[name].__cdAvatarPatched) return
    var original = target[name]
    target[name] = function (callback) {
      if (typeof callback === 'function') {
        try { callback(value) } catch (e) {}
        return
      }
      try {
        var result = original.apply(this, arguments)
        if (result && result.then) return Promise.resolve(value)
      } catch (e) {}
      return Promise.resolve(value)
    }
    target[name].__cdAvatarPatched = true
  }

  function patchPermissionMethod(target, name) {
    if (!target || typeof target[name] !== 'function' || target[name].__cdAvatarPatched) return
    target[name] = function (options) {
      var result = {
        authSetting: {
          'scope.writePhotosAlbum': true,
          'scope.album': true,
          'scope.camera': true
        },
        granted: true,
        success: true
      }
      if (options && typeof options.success === 'function') {
        try { options.success(result) } catch (e) {}
      }
      if (options && typeof options.complete === 'function') {
        try { options.complete(result) } catch (e) {}
      }
      return Promise.resolve(result)
    }
    target[name].__cdAvatarPatched = true
  }

  function patchWxPermission() {
    if (!window.wx || window.wx.__cdAvatarPermissionPatched) return
    window.wx.__cdAvatarPermissionPatched = true
    patchPermissionMethod(window.wx, 'authorize')
    patchPermissionMethod(window.wx, 'openSetting')
    patchPermissionMethod(window.wx, 'getSetting')
  }

  function patchPlatformChooseImage(manager) {
    if (!manager || manager.chooseImage && manager.chooseImage.__cdAvatarPatched) return
    manager.__cdOriginalChooseImage = manager.chooseImage
    manager.chooseImage = function () {
      return new Promise(function (resolve, reject) {
        openImagePicker(function (result) {
          if (!result) {
            reject(new Error('empty avatar result'))
            return
          }
          result.base64s = normalizeBase64List(result.base64s)
          result.images = result.images || []
          result.imagePath = result.imagePath || ''
          if (!result.base64s.length && !result.images.length && !result.imagePath) {
            reject(new Error('empty avatar payload'))
            return
          }
          resolve(result)
        }, function () {
          reject(new Error('chooseImage cancel'))
        })
      })
    }
    manager.chooseImage.__cdAvatarPatched = true

    if (!manager.readImgFile || !manager.readImgFile.__cdAvatarPatched) {
      manager.readImgFile = function () {
        return Promise.resolve('')
      }
      manager.readImgFile.__cdAvatarPatched = true
    }
  }

  function normalizeBase64List(list) {
    if (!list || !list.length) return []
    var output = []
    for (var i = 0; i < list.length; i++) {
      var value = String(list[i] || '')
      if (!value) continue
      var comma = value.indexOf(',')
      if (value.indexOf('data:image/') === 0 && comma >= 0) value = value.slice(comma + 1)
      output.push(value)
    }
    if (output.length === 1) output.push(output[0])
    return output
  }

  function patchChooseImage() {
    var agent = window.HORTOR_AGENT
    if (!agent) return

    if (!agent.chooseImage || !agent.chooseImage.__cdAvatarPatched) {
      agent.chooseImage = function (callback) {
        openImagePicker(function (result) {
          if (typeof callback === 'function') callback(result)
        }, function () {
          if (typeof callback === 'function') callback({ base64s: [], images: [], imagePath: '' })
        })
      }
      agent.chooseImage.__cdAvatarPatched = true
      agent._chooseImagePatched = true
    }

    if (!agent.chooseMedia || !agent.chooseMedia.__cdAvatarPatched) {
      agent.chooseMedia = function (options) {
        options = options || {}
        openImagePicker(function (result) {
          var payload = {
            tempFiles: [{ tempFilePath: result.imagePath || '', size: 0 }],
            type: 'image',
            base64s: result.base64s,
            images: result.images || []
          }
          if (typeof options.success === 'function') options.success(payload)
          if (typeof options.complete === 'function') options.complete(payload)
        }, function () {
          var err = { errMsg: 'chooseMedia:fail cancel' }
          if (typeof options.fail === 'function') options.fail(err)
          if (typeof options.complete === 'function') options.complete(err)
        })
      }
      agent.chooseMedia.__cdAvatarPatched = true
    }
    log('chooseImage patched')
  }

  window.__cdOpenAvatarPicker = function () {
    return openAvatarConfirmDialog()
  }

  function openAvatarConfirmDialog() {
    try {
      var platformModule = safeRequire('PlatformManager')
      var platform = platformModule && platformModule.PlatformManager && platformModule.PlatformManager.instance
      if (!platform || typeof platform.chooseImage !== 'function') return false
      platform.chooseImage([512, 98]).then(function (result) {
        showAvatarConfirm(result)
      }, function () {
        showTip('获取图片失败')
      })
      return true
    } catch (e) {
      return false
    }
  }

  function showAvatarConfirm(result) {
    try {
      var payload = {}
      var data = []
      if (result && result.base64s && result.base64s.length) {
        Array.prototype.push.apply(data, result.base64s)
      }
      if (data.length) {
        var ui = safeRequire('index-ui')
        var confirmMod = safeRequire('ChangeHeadImgConfirmDialog')
        var confirm = confirmMod && confirmMod.ChangeHeadImgConfirmDialog
        if (ui && ui.SHOW_PROXY && confirm) {
          payload[confirm.BASE_64_DATA || 'base64Data'] = data
          ui.SHOW_PROXY(confirm, payload)
          return
        }
      }
      if (result && result.images && result.images.length) {
        showAvatarConfirmByKey(result.images, 'base64Info')
        return
      }
      showTip('获取图片失败')
    } catch (e) {
      showTip('获取图片失败')
    }
  }

  function showAvatarConfirmByKey(value, key) {
    var ui = safeRequire('index-ui')
    var confirmMod = safeRequire('ChangeHeadImgConfirmDialog')
    var confirm = confirmMod && confirmMod.ChangeHeadImgConfirmDialog
    if (!ui || !ui.SHOW_PROXY || !confirm) return false
    var payload = {}
    payload[confirm.BASE_64_INFO || key] = value
    ui.SHOW_PROXY(confirm, payload)
    return true
  }

  function showTip(text) {
    try {
      var tips = safeRequire('TipsManager')
      if (tips && tips.SHOW_TIP) tips.SHOW_TIP(text)
    } catch (e) {}
  }

  function patchPlayerInfoDialog() {
    var mod = safeRequire('PlayerInfoDialog')
    var Ctor = mod && mod.PlayerInfoDialog
    if (!Ctor || !Ctor.prototype || Ctor.prototype.__cdAvatarDialogPatched) return
    Ctor.prototype.__cdAvatarDialogPatched = true
    Ctor.prototype._onClickBtnNativeImg = function () {
      if (!openAvatarConfirmDialog() && typeof this._showChangeHeadImageDialog === 'function') {
        this._showChangeHeadImageDialog()
      }
    }
    Ctor.prototype._onClickBtnNativeImg.__cdAvatarPatched = true
    log('PlayerInfoDialog avatar button patched')
  }

  function openImagePicker(done, cancel) {
    if (window.AndroidBinBridge && typeof AndroidBinBridge.chooseAvatarImage === 'function') {
      var id = 'avatar_' + Date.now() + '_' + Math.random().toString(16).slice(2)
      callbacks[id] = { done: done, cancel: cancel }
      try {
        AndroidBinBridge.chooseAvatarImage(id)
        return
      } catch (e) {
        delete callbacks[id]
      }
    }
    openHtmlImagePicker(done, cancel)
  }

  function openHtmlImagePicker(done, cancel) {
    var input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0'
    document.body.appendChild(input)

    input.onchange = function (event) {
      var file = event && event.target && event.target.files && event.target.files[0]
      cleanup()
      if (!file) {
        if (typeof cancel === 'function') cancel()
        return
      }
      var image = new Image()
      image.onload = function () {
        try {
          var large = renderImageBase64(image, 512, 512)
          var small = renderImageBase64(image, 98, 98)
          if (typeof done === 'function') {
            done({ base64s: [large, small], images: [], imagePath: '' })
          }
        } finally {
          try { URL.revokeObjectURL(image.src) } catch (e) {}
        }
      }
      image.onerror = function () {
        try { URL.revokeObjectURL(image.src) } catch (e) {}
        if (typeof cancel === 'function') cancel()
      }
      image.src = URL.createObjectURL(file)
    }

    input.click()

    function cleanup() {
      if (input && input.parentNode) input.parentNode.removeChild(input)
    }
  }

  function renderImageBase64(image, width, height) {
    var canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    var ctx = canvas.getContext('2d')
    var side = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height)
    var sx = Math.max(0, ((image.naturalWidth || image.width) - side) / 2)
    var sy = Math.max(0, ((image.naturalHeight || image.height) - side) / 2)
    ctx.drawImage(image, sx, sy, side, side, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
  }
})()
