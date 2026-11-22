import SwiftUI

/// 设置页：游戏功能 + 内置脚本开关（游戏功能下方）+ 网络 + 显示与性能 + 脚本管理（用户脚本）+ 关于
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
                    builtinScriptRows
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
                            Text("\(scripts.userItems.filter { scripts.isEnabled($0) }.count)/\(scripts.userItems.count)")
                                .font(.system(size: 13))
                                .foregroundColor(.secondary)
                        }
                    }
                } header: {
                    Text("脚本")
                } footer: {
                    Text("管理你自己添加的脚本，支持导入 .js 文件或粘贴代码；脚本运行于油猴兼容沙箱")
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

    // MARK: 内置脚本开关（位于游戏功能下方）

    private var builtinScriptRows: some View {
        ForEach(scripts.builtinItems) { item in
            Toggle(isOn: Binding(
                get: { scripts.isEnabled(item) },
                set: { scripts.setEnabled(item, $0) }
            )) {
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
}

/// 脚本管理：只管理用户自己添加的脚本（导入 .js / 粘贴代码 / 启停 / 删除）
struct ScriptListView: View {

    @ObservedObject private var store = ScriptStore.shared
    @State private var showImporter = false
    @State private var showAddSheet = false

    var body: some View {
        List {
            if store.userItems.isEmpty {
                emptyState
            } else {
                Section {
                    ForEach(store.userItems) { item in
                        scriptRow(item)
                    }
                } footer: {
                    Text("停用或删除后重新加载游戏生效")
                        .font(.caption2)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("脚本管理")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button {
                        showImporter = true
                    } label: {
                        Label("导入 .js 文件", systemImage: "doc.badge.plus")
                    }
                    Button {
                        showAddSheet = true
                    } label: {
                        Label("粘贴代码添加", systemImage: "doc.text")
                    }
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showImporter) {
            DocumentPicker { url in
                if store.addUserScript(fromFile: url) != nil {
                    toast("脚本已添加")
                } else {
                    toast("添加失败：仅支持 .js 脚本文件")
                }
            }
        }
        .sheet(isPresented: $showAddSheet) {
            AddScriptView { name, code in
                if store.addUserScript(code: code, name: name) {
                    toast("脚本已添加")
                } else {
                    toast("添加失败：脚本内容为空")
                }
            }
        }
    }

    private func scriptRow(_ item: ScriptStore.ScriptItem) -> some View {
        Toggle(isOn: Binding(
            get: { store.isEnabled(item) },
            set: { store.setEnabled(item, $0) }
        )) {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.displayName)
                    .font(.system(size: 14, weight: .medium))
                Text(item.detail)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }
        }
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                store.deleteUserScript(item)
            } label: {
                Label("删除", systemImage: "trash")
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Image(systemName: "doc.badge.plus")
                .font(.system(size: 36))
                .foregroundColor(.secondary)
            Text("还没有添加脚本")
                .font(.system(size: 14, weight: .medium))
            Text("点右上角 ＋ 导入 .js 文件或粘贴代码")
                .font(.system(size: 12))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 50)
        .listRowBackground(Color.clear)
    }

    private func toast(_ message: String) {
        NotificationCenter.default.post(name: .cdToast, object: nil, userInfo: ["message": message])
    }
}

/// 粘贴代码添加脚本
private struct AddScriptView: View {

    let onSave: (String, String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var code = ""

    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("脚本名称", text: $name)
                } header: {
                    Text("名称")
                }
                Section {
                    TextEditor(text: $code)
                        .font(.system(size: 12, design: .monospaced))
                        .frame(minHeight: 220)
                } header: {
                    Text("脚本代码（JavaScript）")
                }
            }
            .navigationTitle("添加脚本")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        onSave(name, code)
                        dismiss()
                    }
                    .disabled(code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
        .navigationViewStyle(.stack)
    }
}
