;(function () {
  'use strict'

  var PATCH_FLAG = '__xyzwItemReportAlbumSavePatchV1'
  var API_NAME = '__xyzwItemReportAlbumSavePatch'
  var FILE_PREFIX = 'xianyu-report-'
  var FILE_EXT = '.png'
  var MAX_TRIES = 240
  var TRY_INTERVAL = 250
  var NATIVE_DIRECT_LIMIT = 700 * 1024
  var NATIVE_CHUNK_SIZE = 64 * 1024

  if (window[PATCH_FLAG]) return
  window[PATCH_FLAG] = true

  var state = {
    installed: false,
    attempts: 0,
    lastError: '',
    lastSavedAt: 0
  }

  window[API_NAME] = {
    status: function () {
      return {
        installed: state.installed,
        attempts: state.attempts,
        lastError: state.lastError,
        lastSavedAt: state.lastSavedAt
      }
    },
    patchNow: tryPatch
  }

  var timer = setInterval(function () {
    if (tryPatch() || ++state.attempts >= MAX_TRIES) {
      clearInterval(timer)
    }
  }, TRY_INTERVAL)

  tryPatch()

  function tryPatch() {
    try {
      if (typeof window.__require !== 'function') return false

      var screenModule = safeRequire('ScreenHelper')
      var helper = screenModule && (screenModule.ScreenHelper || screenModule.default || screenModule)
      if (!helper || helper.__xyzwAlbumSavePatched) return !!(helper && helper.__xyzwAlbumSavePatched)

      helper.__xyzwAlbumSavePatched = true
      helper.__xyzwOriginalSaveImageToAlbum = helper.saveImageToAlbum
      helper.__xyzwOriginalSaveImageUrlToAlbum = helper.saveImageUrlToAlbum
      helper.__xyzwOriginalSaveImageToH5 = helper._saveImageToH5
      helper.__xyzwOriginalSaveImageToWeb = helper._saveImageToWeb

      helper.saveImageUrlToAlbum = function (imagePath) {
        if (!imagePath) return Promise.reject(new Error('empty imagePath'))
        return saveImagePath(imagePath)
      }

      helper._saveImageToH5 = function (texture) {
        return saveTexture(texture)
      }

      helper._saveImageToWeb = function (texture) {
        return saveTexture(texture)
      }

      helper.saveImageToAlbum = function (texture) {
        if (typeof texture === 'string') return saveImagePath(texture)
        var imagePath = texture && (texture.imagePath || texture.filePath || texture.url)
        if (imagePath) return saveImagePath(imagePath)
        return saveTexture(texture)
      }

      patchPlatformSaveImage()
      state.installed = true
      return true
    } catch (e) {
      state.lastError = e && (e.stack || e.message) || String(e)
      return false
    }
  }

  function safeRequire(name) {
    try {
      return window.__require(name)
    } catch (e) {
      return null
    }
  }

  function getPlatformManager() {
    var module = safeRequire('PlatformManager')
    return module && module.PlatformManager && module.PlatformManager.instance
  }

  function patchPlatformSaveImage() {
    var platform = getPlatformManager()
    if (!platform || platform.__xyzwSaveImagePatched) return

    var original = platform.saveImage
    platform.__xyzwSaveImagePatched = true
    platform.__xyzwOriginalSaveImage = original
    platform.saveImage = function (options) {
      var imagePath = options && (options.imagePath || options.filePath || options.url)
      if (imagePath) return saveImagePath(imagePath)
      if (typeof original === 'function') return original.apply(this, arguments)
      return Promise.reject(new Error('empty imagePath'))
    }
  }

  function saveTexture(texture) {
    return new Promise(function (resolve, reject) {
      try {
        var canvas = renderTextureToCanvas(texture)
        if (!canvas) throw new Error('render texture is empty')

        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            if (!blob) {
              reject(new Error('canvas.toBlob returned empty blob'))
              return
            }
            saveBlob(blob, buildFileName()).then(resolve).catch(reject)
          }, 'image/png', 1)
          return
        }

        saveImagePath(canvas.toDataURL('image/png')).then(resolve).catch(reject)
      } catch (e) {
        state.lastError = e && (e.stack || e.message) || String(e)
        showTip('\u56fe\u7247\u751f\u6210\u5931\u8d25')
        reject(e)
      }
    })
  }

  function renderTextureToCanvas(texture) {
    if (!texture || typeof texture.readPixels !== 'function') return null

    var width = texture.width || texture._width || (texture._texture && texture._texture.width) || 0
    var height = texture.height || texture._height || (texture._texture && texture._texture.height) || 0
    width = Math.floor(width)
    height = Math.floor(height)
    if (width <= 0 || height <= 0) return null

    var pixels = texture.readPixels()
    if (!pixels || pixels.length < width * height * 4) return null

    var canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    var ctx = canvas.getContext('2d')
    var imageData = ctx.createImageData(width, height)
    // WebGL readPixels starts at the bottom row; Canvas ImageData starts at the top.
    var rowBytes = width * 4
    var source = pixels.subarray ? pixels.subarray(0, width * height * 4) : pixels
    for (var y = 0; y < height; y++) {
      var sourceRow = (height - 1 - y) * rowBytes
      var targetRow = y * rowBytes
      for (var x = 0; x < rowBytes; x++) {
        imageData.data[targetRow + x] = source[sourceRow + x]
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return canvas
  }

  function saveImagePath(imagePath) {
    if (typeof imagePath !== 'string' || !imagePath) {
      return Promise.reject(new Error('invalid imagePath'))
    }

    if (canUseNativeBridge()) {
      if (isDataUrl(imagePath)) {
        return saveDataUrlByNativeBridge(imagePath, buildFileName())
      }
      if (isBlobUrl(imagePath)) {
        return fetch(imagePath)
          .then(function (res) { return res.blob() })
          .then(function (blob) { return saveBlob(blob, buildFileName()) })
      }
      if (/^https?:\/\//i.test(imagePath)) {
        return fetch(imagePath, { mode: 'cors', credentials: 'omit' })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status)
            return res.blob()
          })
          .then(function (blob) { return saveBlob(blob, buildFileName()) })
          .catch(function () {
            return triggerDownload(imagePath, buildFileName())
          })
      }
      if (/^(file|content):\/\//i.test(imagePath) || /^[A-Za-z]:[\\/]/.test(imagePath) || imagePath.charAt(0) === '/') {
        return saveDataUrlByNativeBridge(imagePath, buildFileName())
      }
    }

    var platform = getPlatformManager()
    if (
      platform &&
      platform.isAndroidAndIOSAndNative &&
      typeof platform.__xyzwOriginalSaveImage === 'function'
    ) {
      return platform.__xyzwOriginalSaveImage.call(platform, { imagePath: imagePath })
        .then(function (res) {
          markSaved()
          return res
        })
    }

    if (canUseWxSave()) {
      if (isDataUrl(imagePath)) return saveDataUrlByWx(imagePath)
      return saveByWx(imagePath)
    }

    if (isDataUrl(imagePath)) {
      return saveBlob(dataUrlToBlob(imagePath), buildFileName())
    }

    if (isBlobUrl(imagePath)) {
      return triggerDownload(imagePath, buildFileName())
    }

    if (/^https?:\/\//i.test(imagePath)) {
      return fetch(imagePath, { mode: 'cors', credentials: 'omit' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status)
          return res.blob()
        })
        .then(function (blob) {
          return saveBlob(blob, buildFileName())
        })
        .catch(function () {
          return triggerDownload(imagePath, buildFileName())
        })
    }

    return triggerDownload(imagePath, buildFileName())
  }

  function canUseWxSave() {
    return typeof window.wx !== 'undefined' && typeof window.wx.saveImageToPhotosAlbum === 'function'
  }

  function saveDataUrlByWx(dataUrl) {
    return new Promise(function (resolve, reject) {
      try {
        var fs = wx.getFileSystemManager && wx.getFileSystemManager()
        var env = wx.env && wx.env.USER_DATA_PATH
        if (!fs || !env) {
          saveBlob(dataUrlToBlob(dataUrl), buildFileName()).then(resolve).catch(reject)
          return
        }

        var parsed = parseDataUrl(dataUrl)
        var filePath = env + '/' + FILE_PREFIX + Date.now() + FILE_EXT
        fs.writeFile({
          filePath: filePath,
          data: parsed.base64,
          encoding: 'base64',
          success: function () {
            saveByWx(filePath).then(resolve).catch(reject)
          },
          fail: reject
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  function saveByWx(filePath) {
    return new Promise(function (resolve, reject) {
      var doSave = function () {
        wx.saveImageToPhotosAlbum({
          filePath: filePath,
          success: function (res) {
            markSaved()
            resolve(res)
          },
          fail: function (err) {
            state.lastError = err && (err.errMsg || err.message) || String(err)
            showTip('\u4fdd\u5b58\u5230\u76f8\u518c\u5931\u8d25')
            reject(err)
          }
        })
      }

      var openSettingThenSave = function () {
        if (typeof wx.openSetting !== 'function') {
          reject(new Error('photo album auth denied'))
          return
        }
        wx.openSetting({
          success: function (res) {
            if (res.authSetting && res.authSetting['scope.writePhotosAlbum']) doSave()
            else reject(new Error('photo album auth denied'))
          },
          fail: reject
        })
      }

      if (typeof wx.getSetting !== 'function') {
        doSave()
        return
      }

      wx.getSetting({
        success: function (res) {
          var auth = res.authSetting || {}
          if (auth['scope.writePhotosAlbum'] === false) {
            openSettingThenSave()
          } else if (auth['scope.writePhotosAlbum'] === true || typeof wx.authorize !== 'function') {
            doSave()
          } else {
            wx.authorize({
              scope: 'scope.writePhotosAlbum',
              success: doSave,
              fail: openSettingThenSave
            })
          }
        },
        fail: doSave
      })
    })
  }

  function saveBlob(blob, fileName) {
    if (!blob) return Promise.reject(new Error('empty blob'))

    if (canUseNativeBridge()) {
      return blobToDataUrl(blob).then(function (dataUrl) {
        return saveDataUrlByNativeBridge(dataUrl, fileName)
      })
    }

    var url = URL.createObjectURL(blob)
    return triggerDownload(url, fileName).then(function (res) {
      setTimeout(function () {
        URL.revokeObjectURL(url)
      }, 30000)
      return res
    }, function (err) {
      setTimeout(function () {
        URL.revokeObjectURL(url)
      }, 30000)
      throw err
    })
  }

  function triggerDownload(url, fileName) {
    return new Promise(function (resolve, reject) {
      try {
        if (canUseNativeBridge() && isDataUrl(url)) {
          saveDataUrlByNativeBridge(url, fileName).then(resolve).catch(reject)
          return
        }
        var a = document.createElement('a')
        a.href = url
        a.download = fileName || buildFileName()
        a.rel = 'noopener'
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(function () {
          if (a.parentNode) a.parentNode.removeChild(a)
        }, 0)
        markSaved()
        resolve({ path: url })
      } catch (e) {
        state.lastError = e && (e.stack || e.message) || String(e)
        showImageFallback(url)
        reject(e)
      }
    })
  }

  function canUseNativeBridge() {
    return typeof window.AndroidBinBridge !== 'undefined' &&
      typeof window.AndroidBinBridge.saveImage === 'function'
  }

  function saveDataUrlByNativeBridge(dataUrl, fileName) {
    return new Promise(function (resolve, reject) {
      try {
        var name = fileName || buildFileName()
        var resultText
        if (!isDataUrl(dataUrl)) {
          resultText = window.AndroidBinBridge.saveImage(name, dataUrl)
        } else if (dataUrl.length > NATIVE_DIRECT_LIMIT &&
          typeof window.AndroidBinBridge.beginSaveImage === 'function' &&
          typeof window.AndroidBinBridge.appendSaveImage === 'function' &&
          typeof window.AndroidBinBridge.finishSaveImage === 'function') {
          var saveId = window.AndroidBinBridge.beginSaveImage()
          if (!saveId) throw new Error('native chunk session failed')
          for (var i = 0; i < dataUrl.length; i += NATIVE_CHUNK_SIZE) {
            var ok = window.AndroidBinBridge.appendSaveImage(saveId, dataUrl.slice(i, i + NATIVE_CHUNK_SIZE))
            if (!ok) throw new Error('native chunk append failed')
          }
          resultText = window.AndroidBinBridge.finishSaveImage(saveId, name)
        } else {
          resultText = window.AndroidBinBridge.saveImage(name, dataUrl)
        }
        var result = {}
        try {
          result = JSON.parse(resultText || '{}')
        } catch (e) {
          result = { ok: !!resultText, path: resultText || '' }
        }
        if (result && result.ok !== false) {
          markSaved()
          resolve(result)
          return
        }
        reject(new Error((result && result.error) || 'native save failed'))
      } catch (e) {
        state.lastError = e && (e.stack || e.message) || String(e)
        reject(e)
      }
    })
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      try {
        var reader = new FileReader()
        reader.onload = function () {
          resolve(String(reader.result || ''))
        }
        reader.onerror = function () {
          reject(reader.error || new Error('read blob failed'))
        }
        reader.readAsDataURL(blob)
      } catch (e) {
        reject(e)
      }
    })
  }

  function markSaved() {
    state.lastSavedAt = Date.now()
    showTip('\u56fe\u7247\u5df2\u751f\u6210\uff0c\u8bf7\u5728\u4e0b\u8f7d/\u76f8\u518c\u4e2d\u67e5\u770b')
  }

  function showImageFallback(url) {
    try {
      var wrap = document.createElement('div')
      wrap.style.cssText = [
        'position:fixed',
        'z-index:2147483647',
        'left:0',
        'right:0',
        'top:0',
        'bottom:0',
        'background:rgba(0,0,0,.72)',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'padding:16px'
      ].join(';')
      var img = document.createElement('img')
      img.src = url
      img.style.cssText = 'max-width:100%;max-height:100%;background:#fff'
      wrap.appendChild(img)
      wrap.addEventListener('click', function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap)
      })
      document.body.appendChild(wrap)
    } catch (e) {}
  }

  function isDataUrl(value) {
    return /^data:image\//i.test(value)
  }

  function isBlobUrl(value) {
    return /^blob:/i.test(value)
  }

  function parseDataUrl(dataUrl) {
    var parts = dataUrl.split(',')
    var meta = parts[0] || ''
    return {
      mime: (meta.match(/^data:([^;]+)/i) || [])[1] || 'image/png',
      base64: parts.slice(1).join(',')
    }
  }

  function dataUrlToBlob(dataUrl) {
    var parsed = parseDataUrl(dataUrl)
    var binary = window.atob(parsed.base64)
    var len = binary.length
    var bytes = new Uint8Array(len)
    for (var i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: parsed.mime })
  }

  function buildFileName() {
    var date = new Date()
    var pad = function (n) {
      return n < 10 ? '0' + n : String(n)
    }
    return FILE_PREFIX +
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) + '-' +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds()) +
      FILE_EXT
  }

  function showTip(text) {
    try {
      var tips = safeRequire('TipsManager')
      if (tips && typeof tips.SHOW_TIP === 'function') {
        tips.SHOW_TIP(text)
        return
      }
    } catch (e) {}
  }
})()
