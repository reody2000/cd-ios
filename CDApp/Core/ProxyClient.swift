import Foundation

/// 复刻 Android 壳的 b4()/X2() 网络代理逻辑：
/// - 相对路径按前缀补全到对应游戏服务域名
/// - 仅允许 http/https
enum ProxyClient {

    struct ProxyResult {
        let status: Int
        let statusText: String
        let headers: [String: String]
        let body: Data
    }

    // MARK: URL 补全（对齐 MainActivity.b4）
    static func expand(_ raw: String) -> String? {
        guard !raw.isEmpty else { return nil }
        if raw.hasPrefix("http://") || raw.hasPrefix("https://") {
            return isValid(raw) ? raw : nil
        }
        var path = raw
        if !path.hasPrefix("/") { path = "/" + path }

        if path.hasPrefix("/api/hortor/comb-login-server/") {
            return "https://comb-platform.hortorgames.com" + String(path.dropFirst(11))
        }
        if path.hasPrefix("/api/ucenter/ucenter-app-server/") {
            return "https://ucenter-app-server.hortorgames.com" + String(path.dropFirst(12))
        }
        if path.hasPrefix("/api/xxz/login/serverlist") {
            let query: String
            if let q = path.firstIndex(of: "?") {
                query = String(path[q...])
            } else {
                query = ""
            }
            return "https://xxz-xyzw.hortorgames.com/login/serverlist" + query
        }
        return "https://xxz-xyzw.hortorgames.com" + path
    }

    static func isValid(_ url: String) -> Bool {
        guard let u = URL(string: url), let scheme = u.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }

    // MARK: 执行请求（同步，供同步 XHR 网关使用）

    static func post(url: String, headers: [String: String], body: Data, contentType: String, timeout: TimeInterval = 60) -> ProxyResult {
        guard let expanded = expand(url), let target = URL(string: expanded) else {
            return ProxyResult(status: 0, statusText: "", headers: [:], body: Data())
        }
        var request = URLRequest(url: target, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.httpBody = body
        if !contentType.isEmpty {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }
        for (k, v) in headers {
            let lower = k.lowercased()
            if lower == "content-type" || lower == "content-length" || lower == "host" { continue }
            request.setValue(v, forHTTPHeaderField: k)
        }
        request.setValue("keep-alive", forHTTPHeaderField: "Connection")

        return execute(request)
    }

    // MARK: GET 反代（供二维码登录页等相对路径 GET 使用）

    static func get(url: String, headers: [String: String], timeout: TimeInterval = 30) -> ProxyResult {
        guard let expanded = expand(url), let target = URL(string: expanded) else {
            return ProxyResult(status: 0, statusText: "", headers: [:], body: Data())
        }
        var request = URLRequest(url: target, timeoutInterval: timeout)
        request.httpMethod = "GET"
        let skip: Set<String> = ["host", "content-length", "content-type", "connection",
                                 "accept-encoding", "origin", "referer"]
        for (k, v) in headers where !skip.contains(k.lowercased()) {
            request.setValue(v, forHTTPHeaderField: k)
        }
        return execute(request)
    }

    /// 共享会话：复用连接并保持 Cookie（登录/扫码轮询需要会话连续性）
    private static let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        config.httpShouldSetCookies = true
        config.httpCookieAcceptPolicy = .always
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: config)
    }()

    static func execute(_ request: URLRequest) -> ProxyResult {
        let semaphore = DispatchSemaphore(value: 0)
        var result = ProxyResult(status: 0, statusText: "", headers: [:], body: Data())

        let task = Self.session.dataTask(with: request) { data, response, error in
            defer { semaphore.signal() }
            guard error == nil, let http = response as? HTTPURLResponse else { return }
            var headers: [String: String] = [:]
            for (k, v) in http.allHeaderFields {
                headers[String(describing: k)] = String(describing: v)
            }
            result = ProxyResult(status: http.statusCode,
                            statusText: HTTPURLResponse.localizedString(forStatusCode: http.statusCode),
                            headers: headers,
                            body: data ?? Data())
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + request.timeoutInterval + 5)
        return result
    }

    // MARK: 异步（供 gmXmlHttpRequest / proxyPostAsync）

    static func perform(_ request: URLRequest, completion: @escaping (ProxyResult) -> Void) {
        Self.session.dataTask(with: request) { data, response, error in
            if error != nil {
                completion(ProxyResult(status: 0, statusText: "", headers: [:], body: Data()))
                return
            }
            guard let http = response as? HTTPURLResponse else {
                completion(ProxyResult(status: 0, statusText: "", headers: [:], body: Data()))
                return
            }
            var headers: [String: String] = [:]
            for (k, v) in http.allHeaderFields {
                headers[String(describing: k)] = String(describing: v)
            }
            completion(ProxyResult(status: http.statusCode,
                              statusText: HTTPURLResponse.localizedString(forStatusCode: http.statusCode),
                              headers: headers,
                              body: data ?? Data()))
        }.resume()
    }
}
