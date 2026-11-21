import SwiftUI
import UniformTypeIdentifiers

struct AccountListView: View {

    /// true：App 启动时无账号，全屏引导；false：游戏内弹出的账号面板
    let standalone: Bool

    @EnvironmentObject private var app: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var showImporter = false
    @State private var shareURL: URL?
    @State private var showShare = false
    @State private var showLoginSheet = false
    @State private var showSettingsSheet = false
    @State private var pendingDelete: AccountStore.Account?

    var body: some View {
        NavigationView {
            ZStack {
                Color(red: 0.06, green: 0.07, blue: 0.09).ignoresSafeArea()

                if app.accounts.isEmpty {
                    emptyView
                } else {
                    accountList
                }
            }
            .navigationTitle("账号管理")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    if !standalone {
                        Button("关闭") { dismiss() }
                            .foregroundColor(.white)
                    } else {
                        Button {
                            showSettingsSheet = true
                        } label: {
                            Image(systemName: "slider.horizontal.3")
                        }
                        .foregroundColor(.white)
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Menu {
                        Button { showImporter = true } label: {
                            Label("从文件导入 .bin", systemImage: "doc.badge.plus")
                        }
                        Button { app.saveAccountFromClipboard() } label: {
                            Label("从剪贴板导入", systemImage: "doc.on.clipboard")
                        }
                        Divider()
                        Button { showLoginSheet = true } label: {
                            Label("手机号登录", systemImage: "iphone")
                        }
                        Button { showLoginSheet = true } label: {
                            Label("扫码登录", systemImage: "qrcode.viewfinder")
                        }
                        Divider()
                        Button { showSettingsSheet = true } label: {
                            Label("设置", systemImage: "slider.horizontal.3")
                        }
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundColor(.white)
                    }
                }
            }
        }
        .navigationViewStyle(.stack)
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.item], allowsMultipleSelection: false) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first { app.importAccount(url: url) }
            case .failure(let error):
                app.showToast("导入失败：\(error.localizedDescription)")
            }
        }
        .sheet(isPresented: $showShare) {
            if let url = shareURL {
                ActivityView(items: [url])
            }
        }
        .sheet(isPresented: $showLoginSheet) {
            LoginView(port: app.port)
                .environmentObject(app)
        }
        .sheet(isPresented: $showSettingsSheet) {
            SettingsView()
        }
        .confirmationDialog("删除账号", isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        ), presenting: pendingDelete) { account in
            Button("删除 \(account.name)", role: .destructive) {
                app.delete(account)
                pendingDelete = nil
            }
            Button("取消", role: .cancel) { pendingDelete = nil }
        }
    }

    // MARK: 列表

    private var accountList: some View {
        List {
            Section {
                ForEach(app.accounts) { account in
                    accountRow(account)
                        .listRowBackground(Color(red: 0.11, green: 0.12, blue: 0.15))
                }
            } header: {
                Text("共 \(app.accounts.count) 个账号")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
            }

            Section {
                Button { showImporter = true } label: {
                    Label("从文件导入 .bin", systemImage: "doc.badge.plus")
                }
                .foregroundColor(.white)
                Button { app.saveAccountFromClipboard() } label: {
                    Label("从剪贴板导入", systemImage: "doc.on.clipboard")
                }
                .foregroundColor(.white)
                Button { showLoginSheet = true } label: {
                    Label("登录新账号（手机 / 扫码）", systemImage: "person.badge.key")
                }
                .foregroundColor(.white)
            } header: {
                Text("添加账号")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.5))
            }
            .listRowBackground(Color(red: 0.11, green: 0.12, blue: 0.15))
        }
        .listStyle(.insetGrouped)
    }

    private func accountRow(_ account: AccountStore.Account) -> some View {
        HStack(spacing: 12) {
            Image(systemName: app.currentAccount == account.name ? "checkmark.circle.fill" : "circle")
                .foregroundColor(app.currentAccount == account.name ? .green : .white.opacity(0.25))
                .font(.system(size: 18))

            VStack(alignment: .leading, spacing: 3) {
                Text(account.name)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                Text("\(formatSize(account.size)) · \(formatDate(account.modified))")
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.45))
            }

            Spacer()

            Menu {
                Button { app.select(account) } label: {
                    Label("启动游戏", systemImage: "play.fill")
                }
                Button { shareURL = app.exportURL(for: account); showShare = true } label: {
                    Label("导出", systemImage: "square.and.arrow.up")
                }
                Button(role: .destructive) { pendingDelete = account } label: {
                    Label("删除", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundColor(.white.opacity(0.6))
                    .font(.system(size: 18))
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { app.select(account) }
        .padding(.vertical, 4)
    }

    // MARK: 空态

    private var emptyView: some View {
        VStack(spacing: 18) {
            Image(systemName: "person.crop.circle.badge.questionmark")
                .font(.system(size: 52))
                .foregroundColor(.white.opacity(0.35))
            Text("还没有账号")
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.white)
            Text("导入账号文件，或使用手机号 / 扫码登录")
                .font(.system(size: 13))
                .foregroundColor(.white.opacity(0.5))

            VStack(spacing: 10) {
                Button { showImporter = true } label: {
                    Label("导入账号文件", systemImage: "doc.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryButtonStyle())

                Button { showLoginSheet = true } label: {
                    Label("登录新账号", systemImage: "person.badge.key")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryButtonStyle())

                Button { showSettingsSheet = true } label: {
                    Label("设置", systemImage: "slider.horizontal.3")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryButtonStyle())
            }
            .padding(.horizontal, 34)
            .padding(.top, 4)
        }
    }

    private func formatSize(_ bytes: Int) -> String {
        if bytes >= 1024 * 1024 { return String(format: "%.1f MB", Double(bytes) / 1048576) }
        if bytes >= 1024 { return String(format: "%.0f KB", Double(bytes) / 1024) }
        return "\(bytes) B"
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM-dd HH:mm"
        return formatter.string(from: date)
    }
}

// MARK: - 按钮样式

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(.black)
            .padding(.vertical, 12)
            .background(Color.white.opacity(configuration.isPressed ? 0.75 : 1.0))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(.white)
            .padding(.vertical, 12)
            .background(Color.white.opacity(configuration.isPressed ? 0.16 : 0.09))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color.white.opacity(0.12), lineWidth: 0.5))
    }
}

// MARK: - 分享面板

struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
