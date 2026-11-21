import SwiftUI

/// 设置页：游戏功能开关（键名与 Android 壳一致）+ 脚本管理 + 关于
struct SettingsView: View {

    @ObservedObject private var settings = SettingsStore.shared
    @ObservedObject private var scripts = ScriptStore.shared
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            Form {
                Section {
                    Toggle("游戏增强", isOn: $settings.gameEnhanceEnabled)
                    Toggle("屏蔽聊天框", isOn: $settings.chatEntryBlockerEnabled)
                    Toggle("十殿夜晚倍速", isOn: $settings.nightmareSpeedEnabled)
                    Toggle("飘字优化", isOn: $settings.floatTextEnabled)
                    Toggle("怪异塔一键合成", isOn: $settings.quickMergeEnabled)
                    Toggle("跳过前 150 关", isOn: $settings.skip150Enabled)
                    Toggle("固定游戏导航", isOn: $settings.gameNavFixedEnabled)
                } header: {
                    Text("游戏功能")
                } footer: {
                    Text("修改后重新加载游戏生效")
                        .font(.caption2)
                }

                Section {
                    Toggle("掉线自动重连", isOn: $settings.autoReconnectEnabled)
                    if settings.autoReconnectEnabled {
                        Toggle("按分钟计时", isOn: $settings.autoReconnectDelayMinutes)
                        Stepper("间隔：\(settings.autoReconnectDelayValue) \(settings.autoReconnectDelayMinutes ? "分钟" : "秒")",
                                value: $settings.autoReconnectDelayValue,
                                in: 1...600)
                    }
                } header: {
                    Text("网络")
                }

                Section {
                    Toggle("启动加速（去黑遮罩）", isOn: $settings.gameBrightnessEnabled)
                    HStack {
                        Text("游戏亮度")
                        Slider(value: $settings.brightnessLevel, in: 0.3...1.6)
                    }
                    HStack {
                        Text("UI 倍速")
                        Slider(value: $settings.uiSpeedRate, in: 1...20, step: 1)
                        Text("\(Int(settings.uiSpeedRate))x")
                            .font(.system(size: 13, design: .monospaced))
                            .foregroundColor(.secondary)
                            .frame(width: 38, alignment: .trailing)
                    }
                } header: {
                    Text("显示与性能")
                }

                Section {
                    NavigationLink {
                        ScriptListView()
                    } label: {
                        HStack {
                            Text("脚本管理")
                            Spacer()
                            Text("\(scripts.items.filter { scripts.isEnabled($0.id) }.count)/\(scripts.items.count)")
                                .font(.system(size: 13))
                                .foregroundColor(.secondary)
                        }
                    }
                } header: {
                    Text("脚本")
                } footer: {
                    Text("脚本由原生壳注入游戏 WebView，运行于油猴兼容沙箱")
                        .font(.caption2)
                }

                Section {
                    HStack {
                        Text("版本")
                        Spacer()
                        Text("1.0")
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Text("运行环境")
                        Spacer()
                        Text("WKWebView 本地资源")
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Text("关于")
                }
            }
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("完成") { dismiss() }
                }
            }
        }
        .navigationViewStyle(.stack)
        .preferredColorScheme(.dark)
    }
}

/// 脚本管理：分组开关
struct ScriptListView: View {

    @ObservedObject private var store = ScriptStore.shared
    @State private var refreshToken = UUID()

    var body: some View {
        List {
            ForEach(["内置", "云端"], id: \.self) { group in
                let items = store.items.filter { $0.group == group }
                if !items.isEmpty {
                    Section {
                        ForEach(items) { item in
                            scriptRow(item)
                        }
                    } header: {
                        Text(group)
                    }
                }
            }
        }
        .id(refreshToken)
        .listStyle(.insetGrouped)
        .navigationTitle("脚本管理")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func scriptRow(_ item: ScriptStore.ScriptItem) -> some View {
        let binding = Binding<Bool>(
            get: { store.isEnabled(item.id) },
            set: { newValue in
                store.setEnabled(item.id, newValue)
                refreshToken = UUID()
            }
        )
        return Toggle(isOn: binding) {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.displayName)
                    .font(.system(size: 14, weight: .medium))
                if !item.detail.isEmpty {
                    Text(item.detail)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                if item.id == ScriptStore.loginPatchId {
                    Text("登录依赖，建议保持开启")
                        .font(.system(size: 10))
                        .foregroundColor(.orange)
                }
            }
        }
    }
}
