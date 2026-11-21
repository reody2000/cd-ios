import Foundation
import Combine

/// 脚本清单与开关（内置 scripts/builtin + 云端 scripts/cloud）
final class ScriptStore: ObservableObject {

    static let shared = ScriptStore()

    struct ScriptItem: Identifiable, Hashable {
        let id: String
        let displayName: String
        let detail: String
        let fileName: String
        let group: String
        var builtin: Bool { group == "内置" }
    }

    /// 基础设施脚本，始终注入
    static let envScriptId = "cd_userscript_env"
    /// 免登录补丁，默认开启（游戏登录依赖）
    static let loginPatchId = "cd_native_login_patch"

    @Published private(set) var items: [ScriptItem] = []

    private let defaults = UserDefaults.standard
    private let webRoot: URL

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
        "cd_native_login_patch": ("原生登录补丁", "使用本地账号数据完成登录"),
        "salt_view": ("盐田视角", "百分比视野调节，游戏内悬浮开关"),
        "early_black_mask": ("去引导黑遮罩（云端）", "启动加速")
    ]

    /// 默认开启的脚本
    private static let defaultOn: Set<String> = [loginPatchId, "cd_early_black", "early_black_mask"]

    private init() {
        let base = Bundle.main.resourceURL?.appendingPathComponent("Web/scripts")
        webRoot = base ?? URL(fileURLWithPath: NSTemporaryDirectory())
        reload()
    }

    func reload() {
        var result: [ScriptItem] = []
        let groups: [(String, String)] = [("builtin", "内置"), ("cloud", "云端")]

        for (folder, label) in groups {
            let dir = webRoot.appendingPathComponent(folder)
            guard let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { continue }
            for file in files where file.pathExtension.lowercased() == "js" {
                let id = file.deletingPathExtension().lastPathComponent
                if id == Self.envScriptId { continue }
                let info = Self.meta[id] ?? (id, "")
                result.append(ScriptItem(id: id,
                                         displayName: info.0,
                                         detail: info.1,
                                         fileName: file.lastPathComponent,
                                         group: label))
            }
        }
        items = result.sorted { lhs, rhs in
            if lhs.group != rhs.group { return lhs.group == "内置" }
            return lhs.displayName.localizedStandardCompare(rhs.displayName) == .orderedAscending
        }
    }

    // MARK: 开关
    func key(for id: String) -> String { "script_enabled_\(id)" }

    func isEnabled(_ id: String) -> Bool {
        if let value = defaults.object(forKey: key(for: id)) as? Bool { return value }
        return Self.defaultOn.contains(id)
    }

    @discardableResult
    func setEnabled(_ id: String, _ enabled: Bool) -> Bool {
        defaults.set(enabled, forKey: key(for: id))
        objectWillChange.send()
        return isEnabled(id)
    }

    func setEnabled(_ id: String, toggledFrom current: Bool) {
        defaults.set(!current, forKey: key(for: id))
        objectWillChange.send()
    }

    // MARK: 读取脚本内容
    func scriptURL(for item: ScriptItem) -> URL {
        let folder = item.builtin ? "builtin" : "cloud"
        return webRoot.appendingPathComponent(folder).appendingPathComponent(item.fileName)
    }

    func code(for item: ScriptItem) -> String? {
        try? String(contentsOf: scriptURL(for: item), encoding: .utf8)
    }

    func envCode() -> String? {
        let url = webRoot.appendingPathComponent("builtin/\(Self.envScriptId).js")
        return try? String(contentsOf: url, encoding: .utf8)
    }

    func enabledScripts() -> [ScriptItem] {
        items.filter { isEnabled($0.id) }
    }
}
