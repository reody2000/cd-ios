import Foundation
import UIKit
import WebKit

extension Notification.Name {
    static let cdToast = Notification.Name("cd.toast")
    static let cdLoginFinished = Notification.Name("cd.login.finished")
    static let cdAccountsChanged = Notification.Name("cd.accounts.changed")
    static let cdPickAvatar = Notification.Name("cd.pick.avatar")
    static let cdGameReady = Notification.Name("cd.game.ready")
}

/// 当前活跃 WebView（异步回调落点）
final class WebViewHub {
    static let shared = WebViewHub()
    /// 游戏主 WebView（长期持有）
    weak var game: WKWebView?
    /// 当前活跃 WebView（游戏或登录页）
    weak var current: WKWebView?

    func activateGame(_ webView: WKWebView) {
        game = webView
        current = webView
    }

    func activateLogin(_ webView: WKWebView) {
        current = webView
    }

    func release(_ webView: WKWebView) {
        if current === webView { current = game }
        if game === webView { game = nil }
    }
}

/// 原生能力网关：复刻 AndroidBridge / AndroidBinBridge 全部方法。
/// 请求：POST /__bridge/<method>，body 为参数数组 JSON；
/// 响应：{"v": <返回值>} 或 {"__err": "错误信息"}。
final class BridgeGateway {

    private let defaults = UserDefaults.standard
    private let gmPrefix = "gm."
    private let imageBuffers = NSLock()
    private var pendingImages: [String: Data] = [:]

    // MARK: 入口

    func handle(method: String, body: Data) -> HTTPResponse {
        let args = (try? JSONSerialization.jsonObject(with: body)) as? [Any] ?? []

        func str(_ index: Int) -> String {
            guard index < args.count, let value = args[index] as? String else { return "" }
            return value
        }
        func any(_ index: Int) -> Any? {
            guard index < args.count else { return nil }
            let value = args[index]
            return value is NSNull ? nil : value
        }

        switch method {
        // 网络
        case "proxyPost":
            return HTTPResponse.json(["v": proxyPost(url: str(0), headersJSON: str(1), bodyBase64: str(2), contentType: str(3))])
        case "proxyPostAsync":
            // 契约对齐 Android f1.proxyPostAsync(id, url, headersJSON, bodyBase64, contentType)
            proxyPostAsync(id: str(0), url: str(1), headersJSON: str(2), bodyBase64: str(3), contentType: str(4))
            return HTTPResponse.json(["v": NSNull()])
        case "gmXmlHttpRequest":
            gmXmlHttpRequest(id: str(0), json: str(1))
            return HTTPResponse.json(["v": NSNull()])

        // GM 存储
        case "gmGetValue":
            let key = str(0)
            if let value = defaults.string(forKey: gmPrefix + key) {
                return HTTPResponse.json(["v": ["ok": true, "found": true, "value": value] as [String: Any]])
            }
            return HTTPResponse.json(["v": ["ok": true, "found": false]])
        case "gmSetValue":
            defaults.set(str(1), forKey: gmPrefix + str(0))
            return HTTPResponse.json(["v": ["ok": true]])
        case "gmDeleteValue":
            defaults.removeObject(forKey: gmPrefix + str(0))
            return HTTPResponse.json(["v": ["ok": true]])
        case "gmListValues":
            let keys = defaults.dictionaryRepresentation().keys
                .filter { $0.hasPrefix(gmPrefix) }
                .map { String($0.dropFirst(gmPrefix.count)) }
            return HTTPResponse.json(["v": ["ok": true, "values": keys] as [String: Any]])

        // 账号
        case "getBinHex":
            return HTTPResponse.json(["v": AccountStore.shared.currentHex])
        case "getBinName":
            return HTTPResponse.json(["v": AccountStore.shared.currentName ?? ""])
        case "hasBin":
            return HTTPResponse.json(["v": AccountStore.shared.currentData != nil])
        case "saveBin":
            let name = str(0)
            let data = Data(base64Encoded: str(1)) ?? Data()
            if let saved = AccountStore.shared.save(name: name, data: data) {
                AccountStore.shared.select(name: saved)
                notifyOnMain(.cdAccountsChanged)
                return HTTPResponse.json(["v": ["ok": true, "name": saved] as [String: Any]])
            }
            return HTTPResponse.json(["v": ["ok": false, "error": "save failed"] as [String: Any]])

        // 设置
        case "getUiSpeedRate":
            return HTTPResponse.json(["v": SettingsStore.shared.uiSpeedRate])
        case "getAutoReconnectDelayMillis":
            return HTTPResponse.json(["v": SettingsStore.shared.autoReconnectDelayMillis])
        case "isAutoReconnectEnabled":
            return HTTPResponse.json(["v": defaults.bool(forKey: "auto_reconnect_enabled")])
        case "isChatEntryBlockerEnabled":
            return HTTPResponse.json(["v": defaults.bool(forKey: "chat_entry_blocker_enabled")])
        case "isFloatTextEnabled":
            return HTTPResponse.json(["v": defaults.bool(forKey: "float_text_enabled")])
        case "isGameEnhanceEnabled":
            return HTTPResponse.json(["v": defaults.bool(forKey: "game_enhance_enabled")])
        case "isNightmareSpeedEnabled":
            return HTTPResponse.json(["v": defaults.bool(forKey: "nightmare_speed_enabled")])
        case "isQuickMergeEnabled":
            return HTTPResponse.json(["v": defaults.bool(forKey: "quick_merge_enabled")])
        case "isSkip150Enabled":
            return HTTPResponse.json(["v": defaults.bool(forKey: "skip_150_enabled")])

        // UI 动作
        case "toast":
            notifyOnMain(.cdToast, userInfo: ["message": str(0)])
            return HTTPResponse.json(["v": NSNull()])
        case "finishAll":
            notifyOnMain(.cdLoginFinished, userInfo: ["message": str(0)])
            return HTTPResponse.json(["v": NSNull()])
        case "log":
            NSLog("[CD][\(str(0))] \(str(1))")
            return HTTPResponse.json(["v": NSNull()])

        // 上报（原用于订阅赠送 / 状态同步，本地版空实现）
        case "reportCurrentServer", "reportGameReadyForScripts", "reportLoginSuccessForScripts",
             "reportRoleList", "reportRoleListError", "reportInfiniteLineupGift", "reportSaltViewGift":
            if method == "reportGameReadyForScripts" { notifyOnMain(.cdGameReady) }
            return HTTPResponse.json(["v": NSNull()])

        // 文件 / 图片
        case "saveDataUrl":
            return HTTPResponse.json(["v": saveDataURL(name: str(0), dataURL: str(1))])
        case "saveFile":
            return HTTPResponse.json(["v": saveDataURL(name: str(0), dataURL: str(1))])
        case "beginSaveImage":
            let token = UUID().uuidString
            imageBuffers.lock(); pendingImages[token] = Data(); imageBuffers.unlock()
            return HTTPResponse.json(["v": ["ok": true, "token": token] as [String: Any]])
        case "appendSaveImage":
            let token = str(0)
            if let chunk = Data(base64Encoded: str(1)) {
                imageBuffers.lock()
                pendingImages[token, default: Data()].append(chunk)
                imageBuffers.unlock()
            }
            return HTTPResponse.json(["v": ["ok": true]])
        case "finishSaveImage":
            let token = str(0)
            imageBuffers.lock()
            let data = pendingImages.removeValue(forKey: token)
            imageBuffers.unlock()
            if let data {
                let name = str(1).isEmpty ? "cd-image-\(Int(Date().timeIntervalSince1970)).png" : str(1)
                saveToPhotoAlbum(data: data, name: name)
                return HTTPResponse.json(["v": ["ok": true, "name": name] as [String: Any]])
            }
            return HTTPResponse.json(["v": ["ok": false, "error": "no image data"] as [String: Any]])
        case "chooseAvatarImage":
            notifyOnMain(.cdPickAvatar, userInfo: ["name": str(0)])
            return HTTPResponse.json(["v": NSNull()])

        // 微信扫码登录：原生直取二维码（WKWebView 解析 HTML 不可靠）
        case "getWeixinQR":
            return HTTPResponse.json(["v": weixinQRPayload()])

        default:
            return HTTPResponse.json(["__err": "unknown bridge method: \(method)"])
        }
    }

    // MARK: GET 反代（对齐 Android v()/j1()：未命中静态资源时转发到游戏服务器）

    func proxyGet(pathWithQuery: String, headers: [String: String]) -> HTTPResponse {
        guard ProxyClient.expand(pathWithQuery) != nil else { return .notFound() }
        let result = ProxyClient.get(url: pathWithQuery, headers: headers)
        guard result.status != 0 else { return .notFound() }

        var responseHeaders: [String: String] = [:]
        let drop: Set<String> = ["content-encoding", "content-length", "transfer-encoding",
                                 "connection", "keep-alive", "set-cookie"]
        for (k, v) in result.headers where !drop.contains(k.lowercased()) {
            responseHeaders[k] = v
        }
        return HTTPResponse(status: result.status, headers: responseHeaders, body: result.body)
    }

    // MARK: 网络代理实现

    private func proxyPost(url: String, headersJSON: String, bodyBase64: String, contentType: String) -> [String: Any] {
        guard ProxyClient.expand(url) != nil else {
            return ["status": 0, "error": "bad url", "bodyBase64": ""]
        }
        let headers = parseHeaders(headersJSON)
        let body = Data(base64Encoded: bodyBase64) ?? Data()
        let result = ProxyClient.post(url: url, headers: headers, body: body, contentType: contentType)
        if result.status == 0 {
            return ["status": 0, "error": "proxy failed", "bodyBase64": ""]
        }
        return [
            "status": result.status,
            "statusText": result.statusText,
            "headers": result.headers,
            "bodyBase64": result.body.base64EncodedString()
        ]
    }

    private func proxyPostAsync(id: String, url: String, headersJSON: String, bodyBase64: String, contentType: String) {
        guard ProxyClient.expand(url) != nil else {
            evalRoleProxyResponse(id: id, payload: ["status": 0, "error": "bad url", "bodyBase64": ""])
            return
        }
        let headers = parseHeaders(headersJSON)
        let body = Data(base64Encoded: bodyBase64) ?? Data()
        DispatchQueue.global().async {
            let result = ProxyClient.post(url: url, headers: headers, body: body, contentType: contentType)
            let payload: [String: Any]
            if result.status == 0 {
                payload = ["status": 0, "error": "proxy failed", "bodyBase64": ""]
            } else {
                payload = [
                    "status": result.status,
                    "statusText": result.statusText,
                    "headers": result.headers,
                    "bodyBase64": result.body.base64EncodedString()
                ]
            }
            self.evalRoleProxyResponse(id: id, payload: payload)
        }
    }

    /// 对齐 Android b0：try{window.__cdRoleProxyResponse&&window.__cdRoleProxyResponse(id,json);}catch(e){}
    private func evalRoleProxyResponse(id: String, payload: [String: Any]) {
        evalOnWebView("try{window.__cdRoleProxyResponse&&window.__cdRoleProxyResponse(\(Self.jsString(id)),\(Self.jsonString(payload)));}catch(e){}")
    }

    // MARK: 原始请求反代（游戏 XHR 同源转发 /__abs/ 与 /api/ POST）

    func proxyRaw(pathOrURL: String, method: String, headers: [String: String], body: Data) -> HTTPResponse {
        guard let expanded = ProxyClient.expand(pathOrURL),
              let url = URL(string: expanded),
              let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https",
              let host = url.host?.lowercased(),
              host.hasSuffix("hortorgames.com") || host.hasSuffix("qq.com") else {
            return .notFound()
        }
        let result = ProxyClient.raw(url: pathOrURL, method: method, headers: headers, body: body)
        guard result.status != 0 else { return .notFound() }

        var responseHeaders: [String: String] = [:]
        let drop: Set<String> = ["content-encoding", "content-length", "transfer-encoding",
                                 "connection", "keep-alive", "set-cookie"]
        for (k, v) in result.headers where !drop.contains(k.lowercased()) {
            responseHeaders[k] = v
        }
        return HTTPResponse(status: result.status, headers: responseHeaders, body: result.body)
    }

    private func gmXmlHttpRequest(id: String, json: String) {
        guard let data = json.data(using: .utf8),
              let options = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            evalOnWebView("window.__cdGMXmlHttpResponse && window.__cdGMXmlHttpResponse(\(Self.jsString(id)),{ok:false,status:0,error:'bad request'});")
            return
        }
        let method = (options["method"] as? String ?? "GET").uppercased()
        let urlString = options["url"] as? String ?? ""
        guard let expanded = ProxyClient.expand(urlString), let url = URL(string: expanded) else {
            evalOnWebView("window.__cdGMXmlHttpResponse && window.__cdGMXmlHttpResponse(\(Self.jsString(id)),{ok:false,status:0,error:'bad url'});")
            return
        }

        var request = URLRequest(url: url, timeoutInterval: TimeInterval(options["timeout"] as? Int ?? 0) > 0
                                 ? TimeInterval(options["timeout"] as? Int ?? 30) / 1000.0
                                 : 30)
        request.httpMethod = method
        if let headers = options["headers"] as? [String: Any] {
            let envSkip: Set<String> = ["user-agent", "origin", "referer", "accept-encoding",
                                        "host", "content-length", "connection"]
            for (k, v) in headers where !envSkip.contains(k.lowercased()) {
                if let text = v as? String { request.setValue(text, forHTTPHeaderField: k) }
            }
        }
        // 对齐 Android af()/X2()：GM 请求同样带标准代理头
        ProxyClient.applyDefaults(&request, host: url.host)
        if let dataString = options["data"] as? String {
            let base64 = options["dataBase64"] as? Bool ?? false
            request.httpBody = base64 ? Data(base64Encoded: dataString) : Data(dataString.utf8)
        }

        let responseType = (options["responseType"] as? String ?? "").lowercased()
        ProxyClient.perform(request) { result in
            if result.status == 0 {
                self.evalOnWebView("window.__cdGMXmlHttpResponse && window.__cdGMXmlHttpResponse(\(Self.jsString(id)),{ok:false,status:0,error:'request failed'});")
                return
            }
            var payload: [String: Any] = [
                "ok": true,
                "status": result.status,
                "statusText": result.statusText,
                "headers": result.headers,
                "finalUrl": url.absoluteString
            ]
            if responseType == "arraybuffer" || responseType == "blob" {
                payload["responseBase64"] = result.body.base64EncodedString()
                payload["responseText"] = ""
            } else {
                var text = String(data: result.body, encoding: .utf8) ?? ""
                if text.isEmpty, let latin = String(data: result.body, encoding: .isoLatin1) { text = latin }
                payload["responseText"] = text
            }
            let json = Self.jsonString(payload)
            self.evalOnWebView("window.__cdGMXmlHttpResponse && window.__cdGMXmlHttpResponse(\(Self.jsString(id)),\(Self.jsString(json)));")
        }
    }

    // MARK: 图片保存

    /// 请求微信二维码页面并提取 uuid，返回给 H5 直接渲染
    private func weixinQRPayload() -> [String: Any] {
        let api = "/api/weixin/connect/app/qrconnect"
            + "?appid=wxfb0d5667e5cb1c44"
            + "&bundleid=com.hortor.games.xyzw"
            + "&scope=snsapi_base,snsapi_userinfo,snsapi_friend,snsapi_message"
            + "&state=weixin"
        let result = ProxyClient.get(url: api, headers: [:])
        guard result.status == 200 else {
            return ["ok": false, "status": result.status]
        }
        let html = String(data: result.body, encoding: .utf8)
            ?? String(data: result.body, encoding: .isoLatin1)
            ?? ""
        let patterns = [
            #"uuid\s*[:=]\s*"([A-Za-z0-9_-]{8,})""#,
            #"/connect/qrcode/([A-Za-z0-9_-]{8,})"#,
        ]
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { continue }
            let full = NSRange(html.startIndex..<html.endIndex, in: html)
            guard let match = regex.firstMatch(in: html, range: full), match.numberOfRanges > 1,
                  let range = Range(match.range(at: 1), in: html) else { continue }
            let uuid = String(html[range])
            return ["ok": true,
                    "uuid": uuid,
                    "qrUrl": "https://open.weixin.qq.com/connect/qrcode/\(uuid)"]
        }
        return ["ok": false,
                "htmlLength": result.body.count,
                "head": String(html.prefix(160))]
    }

    private func saveDataURL(name: String, dataURL: String) -> [String: Any] {
        var base64 = dataURL
        if let comma = dataURL.firstIndex(of: ","), dataURL.hasPrefix("data:") {
            base64 = String(dataURL[dataURL.index(after: comma)...])
        }
        guard let data = Data(base64Encoded: base64), !data.isEmpty else {
            return ["ok": false, "error": "invalid data url"]
        }
        let fileName = name.isEmpty ? "cd-\(Int(Date().timeIntervalSince1970)).png" : name
        saveToPhotoAlbum(data: data, name: fileName)
        return ["ok": true, "name": fileName]
    }

    private func saveToPhotoAlbum(data: Data, name: String) {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let exports = docs.appendingPathComponent("exports", isDirectory: true)
        try? FileManager.default.createDirectory(at: exports, withIntermediateDirectories: true)
        let url = exports.appendingPathComponent(name)
        try? data.write(to: url)

        guard let image = UIImage(data: data) else { return }
        DispatchQueue.main.async {
            UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
            NotificationCenter.default.post(name: .cdToast, object: nil, userInfo: ["message": "已保存：\(name)"])
        }
    }

    // MARK: 工具

    private func parseHeaders(_ json: String) -> [String: String] {
        guard let data = json.data(using: .utf8),
              let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return [:] }
        var headers: [String: String] = [:]
        for (k, v) in object {
            if let text = v as? String { headers[k] = text }
            else if let value = v as? NSNumber { headers[k] = value.stringValue }
        }
        return headers
    }

    private func notifyOnMain(_ name: Notification.Name, userInfo: [AnyHashable: Any]? = nil) {
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: name, object: nil, userInfo: userInfo)
        }
    }

    private func evalOnWebView(_ js: String) {
        DispatchQueue.main.async {
            WebViewHub.shared.current?.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    private static func jsonString(_ object: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: []),
              let text = String(data: data, encoding: .utf8) else { return "{}" }
        return text
    }

    private static func jsString(_ value: String) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: [value], options: [])) ?? Data("[\"\"]".utf8)
        let text = String(data: data, encoding: .utf8) ?? "[\"\"]"
        return String(text.dropFirst().dropLast())
    }
}
