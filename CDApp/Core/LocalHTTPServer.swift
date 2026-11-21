import Foundation
import Network

// MARK: - HTTP 基础类型

struct HTTPRequest {
    let method: String
    let path: String
    let query: String
    let headers: [String: String]
    let body: Data

    var pathWithoutQuery: String { path }
}

struct HTTPResponse {
    var status: Int = 200
    var headers: [String: String] = [:]
    var body: Data = Data()

    static func json(_ object: Any) -> HTTPResponse {
        let data = (try? JSONSerialization.data(withJSONObject: object, options: [])) ?? Data("{}".utf8)
        return HTTPResponse(status: 200,
                            headers: ["Content-Type": "application/json; charset=utf-8"],
                            body: data)
    }

    static func text(_ text: String, status: Int = 200) -> HTTPResponse {
        HTTPResponse(status: status,
                     headers: ["Content-Type": "text/plain; charset=utf-8"],
                     body: Data(text.utf8))
    }

    static func notFound() -> HTTPResponse {
        HTTPResponse(status: 404,
                     headers: ["Content-Type": "text/plain; charset=utf-8"],
                     body: Data("not found".utf8))
    }
}

// MARK: - 本地 HTTP 服务器

/// 绑定 127.0.0.1 的极简 HTTP/1.1 服务器：
/// 1) GET 静态资源 → Web 目录
/// 2) POST /__bridge/<method> → 原生能力网关（见 BridgeGateway）
final class LocalHTTPServer {

    private let webRoot: URL
    private let bridge: BridgeGateway
    private let queue = DispatchQueue(label: "cd.local.http", qos: .userInitiated, attributes: .concurrent)
    private var listener: NWListener?

    /// 固定端口：保证 localStorage / IndexedDB 的 origin 稳定
    private static let candidatePorts: [UInt16] = [34567, 34568, 34569, 34570, 34571]

    private(set) var port: UInt16 = 0

    /// 服务器就绪回调（port 已确定）
    var onReady: ((UInt16) -> Void)?

    init(webRoot: URL, bridge: BridgeGateway) {
        self.webRoot = webRoot
        self.bridge = bridge
    }

    func start() {
        tryStart(index: 0)
    }

    private func tryStart(index: Int) {
        guard index < Self.candidatePorts.count else {
            NSLog("[CD] HTTP server start failed: all ports in use")
            return
        }
        let rawPort = Self.candidatePorts[index]
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            guard let endpointPort = NWEndpoint.Port(rawValue: rawPort) else {
                tryStart(index: index + 1)
                return
            }
            params.requiredLocalEndpoint = NWEndpoint.hostPort(host: .ipv4(.loopback), port: endpointPort)

            let listener = try NWListener(using: params)
            self.listener = listener
            listener.newConnectionHandler = { [weak self] connection in
                self?.accept(connection)
            }
            listener.stateUpdateHandler = { [weak self, weak listener] state in
                switch state {
                case .ready:
                    self?.port = rawPort
                    self?.onReady?(rawPort)
                case .failed:
                    listener?.cancel()
                    self?.listener = nil
                    self?.tryStart(index: index + 1)
                default:
                    break
                }
            }
            listener.start(queue: queue)
        } catch {
            NSLog("[CD] HTTP server start failed on \(rawPort): \(error)")
            tryStart(index: index + 1)
        }
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    // MARK: 连接处理

    private func accept(_ connection: NWConnection) {
        connection.start(queue: queue)
        receive(connection, buffer: Data())
    }

    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 256 * 1024) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            var accumulated = buffer
            if let data, !data.isEmpty { accumulated.append(data) }

            if let request = Self.parse(accumulated) {
                let response = self.route(request)
                self.send(connection, response)
                return
            }
            if isComplete || error != nil || accumulated.count > 64 * 1024 * 1024 {
                connection.cancel()
                return
            }
            self.receive(connection, buffer: accumulated)
        }
    }

    private func send(_ connection: NWConnection, _ response: HTTPResponse) {
        var headers = response.headers
        headers["Content-Length"] = String(response.body.count)
        headers["Connection"] = "close"
        headers["Access-Control-Allow-Origin"] = "*"

        var head = "HTTP/1.1 \(response.status) \(Self.reason(response.status))\r\n"
        for (k, v) in headers {
            head += "\(k): \(v)\r\n"
        }
        head += "\r\n"

        var payload = Data(head.utf8)
        payload.append(response.body)

        connection.send(content: payload, completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    // MARK: 请求解析

    private static func parse(_ buffer: Data) -> HTTPRequest? {
        let separator = Data("\r\n\r\n".utf8)
        guard let headerRange = buffer.range(of: separator) else { return nil }

        let headerData = buffer.subdata(in: buffer.startIndex..<headerRange.lowerBound)
        guard let headerText = String(data: headerData, encoding: .utf8) else { return nil }

        var lines = headerText.components(separatedBy: "\r\n")
        guard !lines.isEmpty else { return nil }

        let requestLine = lines.removeFirst().split(separator: " ", omittingEmptySubsequences: true)
        guard requestLine.count >= 2 else { return nil }
        let method = String(requestLine[0]).uppercased()
        let rawTarget = String(requestLine[1])

        var path = rawTarget
        var query = ""
        if let qIndex = rawTarget.firstIndex(of: "?") {
            path = String(rawTarget[..<qIndex])
            query = String(rawTarget[rawTarget.index(after: qIndex)...])
        }
        if let decoded = path.removingPercentEncoding { path = decoded }

        var headers: [String: String] = [:]
        for line in lines where !line.isEmpty {
            guard let colon = line.firstIndex(of: ":") else { continue }
            let key = String(line[..<colon]).trimmingCharacters(in: .whitespaces).lowercased()
            let value = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            headers[key] = value
        }

        let contentLength = Int(headers["content-length"] ?? "0") ?? 0
        let bodyStart = headerRange.upperBound
        let available = buffer.count - buffer.distance(from: buffer.startIndex, to: bodyStart)
        if available < contentLength { return nil }

        let body = buffer.subdata(in: bodyStart..<buffer.endIndex)
        return HTTPRequest(method: method, path: path, query: query, headers: headers, body: body)
    }

    // MARK: 路由

    private func route(_ request: HTTPRequest) -> HTTPResponse {
        if request.path.hasPrefix("/__bridge/") {
            let name = String(request.path.dropFirst("/__bridge/".count))
            return bridge.handle(method: name, body: request.body)
        }
        if request.method == "GET" || request.method == "HEAD" {
            let response = serveStatic(path: request.path, headOnly: request.method == "HEAD")
            if response.status != 404 { return response }
            // 对齐 Android v()/j1()：静态资源未命中且是 API 路径时，反代到游戏服务器
            if request.path.hasPrefix("/api/") {
                let target = request.query.isEmpty ? request.path : "\(request.path)?\(request.query)"
                return bridge.proxyGet(pathWithQuery: target, headers: request.headers)
            }
            return response
        }
        return HTTPResponse.notFound()
    }

    private func serveStatic(path: String, headOnly: Bool) -> HTTPResponse {
        var relative = path
        if relative == "/" || relative.isEmpty { relative = "/index.html" }
        if relative.hasPrefix("/") { relative.removeFirst() }

        // 目录穿越防护
        guard !relative.contains("..") else { return HTTPResponse.notFound() }

        let fileURL = webRoot.appendingPathComponent(relative)
        let normalizedRoot = webRoot.standardizedFileURL.path
        guard fileURL.standardizedFileURL.path.hasPrefix(normalizedRoot) else {
            return HTTPResponse.notFound()
        }
        guard let data = try? Data(contentsOf: fileURL) else {
            return HTTPResponse.notFound()
        }

        var headers: [String: String] = [
            "Content-Type": Self.mimeType(for: fileURL.pathExtension),
            "Cache-Control": "public, max-age=3600"
        ]
        if relative.hasSuffix(".html") || relative.hasSuffix(".json") {
            headers["Cache-Control"] = "no-cache"
        }
        return HTTPResponse(status: 200,
                            headers: headers,
                            body: headOnly ? Data() : data)
    }

    // MARK: 工具

    private static func reason(_ status: Int) -> String {
        switch status {
        case 200: return "OK"
        case 204: return "No Content"
        case 400: return "Bad Request"
        case 404: return "Not Found"
        case 500: return "Internal Server Error"
        default: return "OK"
        }
    }

    private static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json; charset=utf-8"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "webp": return "image/webp"
        case "svg": return "image/svg+xml"
        case "ico": return "image/x-icon"
        case "mp3": return "audio/mpeg"
        case "ogg": return "audio/ogg"
        case "wav": return "audio/wav"
        case "mp4": return "video/mp4"
        case "ttf": return "font/ttf"
        case "woff": return "font/woff"
        case "woff2": return "font/woff2"
        case "wasm": return "application/wasm"
        case "bin", "cconb": return "application/octet-stream"
        case "plist": return "text/xml; charset=utf-8"
        default: return "application/octet-stream"
        }
    }
}
