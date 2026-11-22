import SwiftUI

/// 主界面：对齐 Android 端三 Tab 结构（账号 / 游戏 / 设置）
struct RootView: View {

    @EnvironmentObject private var app: AppState
    @State private var tab = 0

    private let accent = Color(red: 0.180, green: 0.420, blue: 0.949)

    var body: some View {
        VStack(spacing: 0) {
            tabBar
            Group {
                switch tab {
                case 0:
                    AccountManagerView(tab: $tab)
                case 1:
                    gameTab
                default:
                    SettingsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if let message = app.toastMessage {
                toastView(message)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .cdToast)) { note in
            if let message = note.userInfo?["message"] as? String, !message.isEmpty {
                app.showToast(message)
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .cdLoginFinished)) { note in
            let message = note.userInfo?["message"] as? String ?? "登录完成"
            app.handleLoginFinished(message)
        }
        .onReceive(NotificationCenter.default.publisher(for: .cdAccountsChanged)) { _ in
            app.refreshAccounts()
        }
        .onReceive(NotificationCenter.default.publisher(for: .cdPickAvatar)) { _ in
            app.showToast("请在账号管理中设置头像")
        }
        .onOpenURL { url in
            // 从「文件」App 直接分享/打开账号 bin
            app.importAccount(url: url)
        }
        .sheet(isPresented: $app.showLogin) {
            LoginView(port: app.port)
                .environmentObject(app)
        }
    }

    // MARK: 顶部 Tab（账号 / 游戏 / 设置）

    private var tabBar: some View {
        HStack(spacing: 0) {
            tabButton("账号", index: 0)
            tabButton("游戏", index: 1)
            tabButton("设置", index: 2)
        }
        .background(Color.white)
    }

    private func tabButton(_ title: String, index: Int) -> some View {
        Button {
            tab = index
        } label: {
            VStack(spacing: 7) {
                Text(title)
                    .font(.system(size: 15, weight: tab == index ? .semibold : .regular))
                    .foregroundColor(tab == index ? accent : Color(red: 0.35, green: 0.37, blue: 0.40))
                Rectangle()
                    .fill(tab == index ? accent : Color.clear)
                    .frame(height: 2.5)
            }
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity)
    }

    // MARK: 游戏 Tab

    @ViewBuilder
    private var gameTab: some View {
        if app.port == 0 {
            launchingView
        } else {
            gameContent
        }
    }

    private var gameContent: some View {
        ZStack(alignment: .topTrailing) {
            GameWebView(port: app.port)
                .id(app.gameKey)
                .ignoresSafeArea()

            Button {
                app.retryGame()
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .padding(11)
                    .background(Color.black.opacity(0.5))
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .padding(.top, 12)
            .padding(.trailing, 14)
        }
    }

    // MARK: 启动中

    private var launchingView: some View {
        VStack(spacing: 18) {
            ProgressView()
                .progressViewStyle(.circular)
                .scaleEffect(1.4)
                .tint(.white)
            Text("正在启动本地环境…")
                .font(.footnote)
                .foregroundColor(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black)
    }

    // MARK: Toast

    private func toastView(_ message: String) -> some View {
        Text(message)
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color.black.opacity(0.82))
            .clipShape(Capsule())
            .overlay(Capsule().stroke(Color.white.opacity(0.12), lineWidth: 0.5))
            .padding(.bottom, 40)
            .transition(.opacity)
            .animation(.easeInOut(duration: 0.2), value: app.toastMessage)
    }
}
