import Foundation
import Combine

/// 脚本清单与开关
/// - 内置脚本（scripts/builtin，随包）：开关在设置「内置脚本」区管理
/// - 用户脚本（Documents/user-scripts）：「脚本管理」中自行导入/粘贴添加、启停、删除
/// - 已取消云端脚本
final class ScriptStore: ObservableObject {

    static let shared = ScriptStore()

    struct ScriptItem: Identifiable, Hashable {
        let id: String
        let displayName: String
        let detail: String
        let fileName: String
        let builtin: Bool
    }

    /// 基础设施脚本，始终注入
    static let envScriptId = "cd_userscript_env"
    /// 免登录补丁，默认开启（游戏登录依赖）
    static let loginPatchId = "cd_native_login_patch"

    @Published private(set) var builtinItems: [ScriptItem] = []
    @Published private(set) var userItems: [ScriptItem] = []

    private let defaults = UserDefaults.standard
    private let builtinRoot: URL
    private let userRoot: URL

    /// 脚本功能说明（对齐 06 工程 scripts/README.md）
    private static let meta: [String: (String, String)] = [
        "cd_shell_features": ("游戏增强核心", "十殿加速 / 飘字优化 / 游戏增强 / UI 倍速"),
        "cd_bottle_renew_auto": ("罐子自动领取", "上号自动刷新领取（罐子残卷）"),
        "cd_auto_mute_audio": ("全局静音", "关闭游戏内全部音效"),
        "cd_chat_entry_blocker": ("屏蔽聊天框", "隐藏聊天入口与聊天面板"),
        "cd_auto_reconnect": ("掉线重连", "网络断开后自动重连"),
        "cd_weird_tower_auto_climb": ("怪异塔自动爬塔", "自动挑战怪异塔"),
        "cd_quick_merge": ("怪异塔一键合成", "道具一键合成"),
        "cd_skip150": ("跳过前150关", "快速跳过新手 150 关"),
        "cd_hide_holy_beast_red": ("隐藏四圣红点", "去除四圣兽红点提示"),
        "cd_early_black": ("去引导黑遮罩", "启动加速，去除引导黑遮罩"),
        "cd_nightmare_countdown": ("十殿倒计时", "显示十殿挑战倒计时"),
        "cd_quench_skip_red": ("淬炼跳红", "淬炼界面跳过红点"),
        "cd_avatar_fix": ("头像修复", "修复头像显示"),
        "cd_item_report_album_save": ("装备报告存相册", "装备报告一键保存到相册"),
        "cd_native_login_patch": ("原生登录补丁", "使用本地账号数据完成登录")
    ]

    /// 默认开启的脚本（仅内置）
    private static let defaultOn: Set<String> = [loginPatchId, "cd_early_black"]

    private init() {
        builtinRoot = Bundle.main.resourceURL?.appendingPathComponent("Web/scripts/builtin")
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        userRoot = docs.appendingPathComponent("user-scripts", isDirectory: true)
        try? FileManager.default.createDirectory(at: userRoot, withIntermediateDirectories: true)
        reload()
    }

    func reload() {
        var builtin: [ScriptItem] = []
        if let files = try? FileManager.default.contentsOfDirectory(at: builtinRoot, includingPropertiesForKeys: nil) {
            for file in files where file.pathExtension.lowercased() == "js" {
                let id = file.deletingPathExtension().lastPathComponent
                if id == Self.envScriptId { continue }
                let info = Self.meta[id] ?? (id, "")
                builtin.append(ScriptItem(id: id,
                                          displayName: info.0,
                                          detail: info.1,
                                          fileName: file.lastPathComponent,
                                          builtin: true))
            }
        }
        builtinItems = builtin.sorted {
            $0.displayName.localizedStandardCompare($1.displayName) == .orderedAscending
        }

        var user: [ScriptItem] = []
        if let files = try? FileManager.default.contentsOfDirectory(at: userRoot, includingPropertiesForKeys: nil) {
            for file in files where file.pathExtension.lowercased() == "js" {
                let name = file.deletingPathExtension().lastPathComponent
                user.append(ScriptItem(id: name,
                                       displayName: name,
                                       detail: "用户脚本",
                                       fileName: file.lastPathComponent,
                                       builtin: false))
            }
        }
        userItems = user.sorted {
            $0.displayName.localizedStandardCompare($1.displayName) == .orderedAscending
        }
    }

    // MARK: 用户脚本增删

    /// 通过粘贴代码添加用户脚本，返回是否成功
    @discardableResult
    func addUserScript(code: String, name: String) -> Bool {
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return false }
        var base = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if base.lowercased().hasSuffix(".js") { base = String(base.dropLast(3)) }
        if base.isEmpty { base = "自定义脚本" }
        let safe = base.replacingOccurrences(of: "[\\\\/:*?\"<>|]", with: "_", options: .regularExpression)
        var fileName = safe + ".js"
        var counter = 1
        while FileManager.default.fileExists(atPath: userRoot.appendingPathComponent(fileName).path) {
            counter += 1
            fileName = "\(safe)-\(counter).js"
        }
        do {
            try trimmed.write(to: userRoot.appendingPathComponent(fileName), atomically: true, encoding: .utf8)
            reload()
            return true
        } catch {
            return false
        }
    }

    /// 通过导入 .js 文件添加用户脚本
    @discardableResult
    func addUserScript(fromFile url: URL) -> String? {
        guard url.pathExtension.lowercased() == "js" else { return nil }
        guard let code = try? String(contentsOf: url, encoding: .utf8), !code.isEmpty else { return nil }
        let name = url.deletingPathExtension().lastPathComponent
        return addUserScript(code: code, name: name) ? name : nil
    }

    /// 删除用户脚本（内置脚本不可删）
    func deleteUserScript(_ item: ScriptItem) {
        guard !item.builtin else { return }
        try? FileManager.default.removeItem(at: userRoot.appendingPathComponent(item.fileName))
        defaults.removeObject(forKey: key(for: item))
        reload()
    }

    // MARK: 开关
    private func key(for item: ScriptItem) -> String {
        item.builtin ? "script_enabled_\(item.id)" : "user_script_enabled_\(item.id)"
    }

    func isEnabled(_ item: ScriptItem) -> Bool {
        if let value = defaults.object(forKey: key(for: item)) as? Bool { return value }
        // 用户脚本添加后默认开启；内置脚本按默认集合
        return item.builtin ? Self.defaultOn.contains(item.id) : true
    }

    func setEnabled(_ item: ScriptItem, _ enabled: Bool) {
        defaults.set(enabled, forKey: key(for: item))
        objectWillChange.send()
    }

    // MARK: 读取脚本内容
    func scriptURL(for item: ScriptItem) -> URL {
        let root = item.builtin ? builtinRoot : userRoot
        return root.appendingPathComponent(item.fileName)
    }

    func code(for item: ScriptItem) -> String? {
        try? String(contentsOf: scriptURL(for: item), encoding: .utf8)
    }

    func envCode() -> String? {
        let url = builtinRoot.appendingPathComponent("\(Self.envScriptId).js")
        return try? String(contentsOf: url, encoding: .utf8)
    }

    /// 所有已启用脚本（内置 + 用户），注入游戏 WebView
    func enabledScripts() -> [ScriptItem] {
        (builtinItems + userItems).filter { isEnabled($0) }
    }
}
