import Foundation

/// 账号 bin 文件管理（对齐 Android 壳 accounts 目录 + k4 文件名规范化）
final class AccountStore {

    static let shared = AccountStore()

    struct Account: Identifiable, Hashable {
        let name: String
        let size: Int
        let modified: Date
        var id: String { name }
    }

    private let queue = DispatchQueue(label: "cd.account.store")
    private let fileManager = FileManager.default
    private let currentKey = "current_account_name"

    var accountsDirectory: URL {
        let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("accounts", isDirectory: true)
    }

    private init() {
        try? fileManager.createDirectory(at: accountsDirectory, withIntermediateDirectories: true)
    }

    // MARK: 文件名规范化（对齐 MainActivity.k4）
    static func normalize(_ raw: String) -> String {
        var name = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.isEmpty { name = "account-\(Int(Date().timeIntervalSince1970 * 1000))" }
        let invalid = CharacterSet(charactersIn: "\\/:*?\"<>|")
        name = name.components(separatedBy: invalid).joined(separator: "_")
        if !name.lowercased().hasSuffix(".bin") { name += ".bin" }
        return name
    }

    // MARK: 列表
    func list() -> [Account] {
        guard let items = try? fileManager.contentsOfDirectory(
            at: accountsDirectory,
            includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey]
        ) else { return [] }

        return items
            .filter { $0.pathExtension.lowercased() == "bin" }
            .compactMap { url -> Account? in
                let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
                return Account(name: url.lastPathComponent,
                               size: values?.fileSize ?? 0,
                               modified: values?.contentModificationDate ?? Date.distantPast)
            }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    // MARK: 保存 / 读取 / 删除
    @discardableResult
    func save(name rawName: String, data: Data) -> String? {
        queue.sync {
            let name = Self.normalize(rawName)
            let target = accountsDirectory.appendingPathComponent(name)
            do {
                try data.write(to: target, options: .atomic)
                return name
            } catch {
                NSLog("[CD] save account failed: \(error)")
                return nil
            }
        }
    }

    func data(for name: String) -> Data? {
        queue.sync {
            try? Data(contentsOf: accountsDirectory.appendingPathComponent(Self.normalize(name)))
        }
    }

    func delete(name: String) {
        queue.sync {
            try? fileManager.removeItem(at: accountsDirectory.appendingPathComponent(Self.normalize(name)))
            if currentName == name { currentName = nil }
        }
    }

    /// 从外部文件（文件选择器）导入
    func importFile(_ source: URL) -> String? {
        let scoped = source.startAccessingSecurityScopedResource()
        defer { if scoped { source.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: source) else { return nil }
        return save(name: source.lastPathComponent, data: data)
    }

    func url(for name: String) -> URL {
        accountsDirectory.appendingPathComponent(Self.normalize(name))
    }

    // MARK: 上次登录时间（对齐 Android 账号卡片展示）
    private let lastLoginKey = "account_last_login"

    func lastLogin(for name: String) -> Date? {
        let map = UserDefaults.standard.dictionary(forKey: lastLoginKey) as? [String: Double]
        guard let t = map?[name] else { return nil }
        return Date(timeIntervalSince1970: t)
    }

    func markLogin(name: String) {
        var map = UserDefaults.standard.dictionary(forKey: lastLoginKey) as? [String: Double] ?? [:]
        map[name] = Date().timeIntervalSince1970
        UserDefaults.standard.set(map, forKey: lastLoginKey)
    }

    // MARK: 当前账号
    var currentName: String? {
        get { UserDefaults.standard.string(forKey: currentKey) }
        set {
            if let value = newValue {
                UserDefaults.standard.set(value, forKey: currentKey)
            } else {
                UserDefaults.standard.removeObject(forKey: currentKey)
            }
        }
    }

    var currentData: Data? {
        guard let name = currentName else { return nil }
        return data(for: name)
    }

    var currentHex: String {
        guard let data = currentData else { return "" }
        return data.map { String(format: "%02x", $0) }.joined()
    }

    func hex(for name: String) -> String {
        guard let data = data(for: name) else { return "" }
        return data.map { String(format: "%02x", $0) }.joined()
    }

    func select(name: String) {
        currentName = name
    }

    var hasAccounts: Bool { !list().isEmpty }
}
