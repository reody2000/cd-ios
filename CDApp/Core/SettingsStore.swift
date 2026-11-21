import Foundation
import Combine

/// 设置项，键名与 Android 壳 SharedPreferences 完全一致，
/// 使注入的脚本通过 AndroidBinBridge 读取到相同的开关状态。
final class SettingsStore: ObservableObject {

    static let shared = SettingsStore()

    private let defaults = UserDefaults.standard

    // 游戏功能开关
    @Published var gameEnhanceEnabled: Bool { didSet { defaults.set(gameEnhanceEnabled, forKey: "game_enhance_enabled") } }
    @Published var chatEntryBlockerEnabled: Bool { didSet { defaults.set(chatEntryBlockerEnabled, forKey: "chat_entry_blocker_enabled") } }
    @Published var nightmareSpeedEnabled: Bool { didSet { defaults.set(nightmareSpeedEnabled, forKey: "nightmare_speed_enabled") } }
    @Published var floatTextEnabled: Bool { didSet { defaults.set(floatTextEnabled, forKey: "float_text_enabled") } }
    @Published var quickMergeEnabled: Bool { didSet { defaults.set(quickMergeEnabled, forKey: "quick_merge_enabled") } }
    @Published var skip150Enabled: Bool { didSet { defaults.set(skip150Enabled, forKey: "skip_150_enabled") } }
    @Published var autoReconnectEnabled: Bool { didSet { defaults.set(autoReconnectEnabled, forKey: "auto_reconnect_enabled") } }
    @Published var autoReconnectDelayMinutes: Bool { didSet { defaults.set(autoReconnectDelayMinutes, forKey: "auto_reconnect_delay_minutes") } }
    @Published var autoReconnectDelayValue: Int { didSet { defaults.set(autoReconnectDelayValue, forKey: "auto_reconnect_delay_value") } }
    @Published var gameNavFixedEnabled: Bool { didSet { defaults.set(gameNavFixedEnabled, forKey: "game_nav_fixed_enabled") } }
    @Published var gameBrightnessEnabled: Bool { didSet { defaults.set(gameBrightnessEnabled, forKey: "game_brightness_enabled") } }
    @Published var uiSpeedRate: Double { didSet { defaults.set(uiSpeedRate, forKey: "ui_speed_rate") } }
    @Published var brightnessLevel: Double { didSet { defaults.set(brightnessLevel, forKey: "game_brightness_level") } }

    private init() {
        defaults.register(defaults: [
            "game_enhance_enabled": true,
            "chat_entry_blocker_enabled": false,
            "nightmare_speed_enabled": false,
            "float_text_enabled": false,
            "quick_merge_enabled": false,
            "skip_150_enabled": false,
            "auto_reconnect_enabled": false,
            "auto_reconnect_delay_minutes": false,
            "auto_reconnect_delay_value": 3,
            "game_nav_fixed_enabled": false,
            "game_brightness_enabled": true,
            "ui_speed_rate": 1.0,
            "game_brightness_level": 1.0
        ])
        gameEnhanceEnabled = defaults.bool(forKey: "game_enhance_enabled")
        chatEntryBlockerEnabled = defaults.bool(forKey: "chat_entry_blocker_enabled")
        nightmareSpeedEnabled = defaults.bool(forKey: "nightmare_speed_enabled")
        floatTextEnabled = defaults.bool(forKey: "float_text_enabled")
        quickMergeEnabled = defaults.bool(forKey: "quick_merge_enabled")
        skip150Enabled = defaults.bool(forKey: "skip_150_enabled")
        autoReconnectEnabled = defaults.bool(forKey: "auto_reconnect_enabled")
        autoReconnectDelayMinutes = defaults.bool(forKey: "auto_reconnect_delay_minutes")
        autoReconnectDelayValue = defaults.integer(forKey: "auto_reconnect_delay_value")
        gameNavFixedEnabled = defaults.bool(forKey: "game_nav_fixed_enabled")
        gameBrightnessEnabled = defaults.bool(forKey: "game_brightness_enabled")
        uiSpeedRate = defaults.double(forKey: "ui_speed_rate")
        brightnessLevel = defaults.double(forKey: "game_brightness_level")
    }

    /// 自动重连间隔（毫秒），对齐 f1.getAutoReconnectDelayMillis
    var autoReconnectDelayMillis: Int {
        let base = max(1, autoReconnectDelayValue)
        return base * (autoReconnectDelayMinutes ? 60000 : 1000)
    }

    func bool(_ key: String) -> Bool { defaults.bool(forKey: key) }
}
