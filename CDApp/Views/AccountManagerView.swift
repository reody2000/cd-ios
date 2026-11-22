import SwiftUI

/// 账号管理台（对齐 Android 端「账号」Tab：标题 + 工具箱/搜索/群控/＋ + 未分组账号 + 账号卡片）
struct AccountManagerView: View {

    @EnvironmentObject private var app: AppState
    @Binding var tab: Int
    @State private var searchText = ""
    @State private var searchActive = false
    @State private var groupExpanded = true
    @State private var showImporter = false

    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.973)
    private let accent = Color(red: 0.180, green: 0.420, blue: 0.949)

    private var filtered: [AccountStore.Account] {
        guard !searchText.isEmpty else { return app.accounts }
        return app.accounts.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy/MM/dd HH:mm:ss"
        return f
    }()

    var body: some View {
        VStack(spacing: 0) {
            header
            if searchActive { searchField }
            ScrollView {
                VStack(spacing: 10) {
                    groupHeader
                    if groupExpanded {
                        if filtered.isEmpty {
                            emptyState
                        } else {
                            ForEach(filtered) { account in
                                accountCard(account)
                            }
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.bottom, 20)
            }
        }
        .background(pageBg.ignoresSafeArea())
        .sheet(isPresented: $showImporter) {
            DocumentPicker { url in app.importAccount(url: url) }
        }
    }

    // MARK: 顶部标题栏

    private var header: some View {
        HStack(spacing: 10) {
            Text("账号管理")
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(Color(red: 0.10, green: 0.11, blue: 0.13))
            Spacer()
            Menu {
                Button("微信扫码登录") { app.showLogin = true }
                Button("手机登录") { app.showLogin = true }
                Divider()
                Button("脚本管理") { tab = 2 }
                Button("游戏设置") { tab = 2 }
            } label: {
                pillLabel("工具箱", icon: "wrench.and.screwdriver")
            }
            pillButton("搜索", icon: "magnifyingglass") {
                withAnimation { searchActive.toggle() }
                if !searchActive { searchText = "" }
            }
            pillButton("群控", icon: "person.2") { app.showToast("群控请在电脑端工具箱使用") }
            Menu {
                Button("导入 BIN 文件") { showImporter = true }
                Button("从剪贴板导入") { app.saveAccountFromClipboard() }
                Divider()
                Button("微信扫码登录") { app.showLogin = true }
                Button("手机登录") { app.showLogin = true }
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(accent)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 12)
    }

    private func pillLabel(_ title: String, icon: String? = nil) -> some View {
        HStack(spacing: 4) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 11, weight: .semibold))
            }
            Text(title)
                .font(.system(size: 13, weight: .medium))
        }
        .foregroundColor(accent)
        .padding(.horizontal, 13)
        .padding(.vertical, 7)
        .background(Color(red: 0.906, green: 0.937, blue: 0.996))
        .clipShape(Capsule())
    }

    private func pillButton(_ title: String, icon: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) { pillLabel(title, icon: icon) }
            .buttonStyle(.plain)
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundColor(.secondary)
            TextField("搜索账号文件名", text: $searchText)
                .font(.system(size: 14))
            if !searchText.isEmpty {
                Button { searchText = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
    }

    // MARK: 分组

    private var groupHeader: some View {
        HStack {
            Button {
                withAnimation { groupExpanded.toggle() }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: groupExpanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(accent)
                    Text("未分组账号")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(Color(red: 0.10, green: 0.11, blue: 0.13))
                }
            }
            .buttonStyle(.plain)
            Spacer()
            Text("\(filtered.count)")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(accent)
                .frame(minWidth: 34)
                .padding(.vertical, 5)
                .background(Color(red: 0.906, green: 0.937, blue: 0.996))
                .clipShape(Capsule())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 11)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: 账号卡片

    private func accountCard(_ account: AccountStore.Account) -> some View {
        Button {
            app.select(account)
            tab = 1
        } label: {
            HStack(spacing: 12) {
                Text(String(account.name.prefix(1)).uppercased())
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(accent)
                    .frame(width: 40, height: 40)
                    .background(Color(red: 0.906, green: 0.937, blue: 0.996))
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 5) {
                    Text(account.name)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundColor(Color(red: 0.10, green: 0.11, blue: 0.13))
                        .lineLimit(1)
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.system(size: 10))
                        Text(lastLoginText(account))
                            .font(.system(size: 12))
                    }
                    .foregroundColor(Color(red: 0.55, green: 0.58, blue: 0.63))
                }
                Spacer()
                if app.currentAccount == account.name {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundColor(accent)
                } else {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(Color(red: 0.75, green: 0.78, blue: 0.82))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 13)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: Color.black.opacity(0.04), radius: 6, y: 2)
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button { app.select(account); tab = 1 } label: {
                Label("使用此账号启动游戏", systemImage: "play.fill")
            }
            Button { UIPasteboard.general.string = account.name } label: {
                Label("复制文件名", systemImage: "doc.on.doc")
            }
            Button(role: .destructive) {
                app.delete(account)
            } label: {
                Label("删除账号", systemImage: "trash")
            }
        }
    }

    private func lastLoginText(_ account: AccountStore.Account) -> String {
        if let date = AccountStore.shared.lastLogin(for: account.name) {
            return "上次登录时间: " + Self.timeFormatter.string(from: date)
        }
        return "上次登录时间: 从未登录"
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "tray")
                .font(.system(size: 40))
                .foregroundColor(Color(red: 0.75, green: 0.78, blue: 0.82))
            Text(searchActive && !searchText.isEmpty ? "没有匹配的账号" : "还没有账号，点右上角 ＋ 导入")
                .font(.system(size: 14))
                .foregroundColor(Color(red: 0.55, green: 0.58, blue: 0.63))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
}
