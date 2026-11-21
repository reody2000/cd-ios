import SwiftUI

struct RootView: View {

    @EnvironmentObject private var app: AppState

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.ignoresSafeArea()

            if app.port == 0 {
                launchingView
            } else {
                // 与 Android 版一致：启动直接进游戏（未登录/无账号时由游戏内流程引导）
                gameView
            }

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
        .sheet(isPresented: $app.showSettings) {
            SettingsView()
        }
        .sheet(isPresented: $app.showAccounts) {
            AccountListView(standalone: false)
                .environmentObject(app)
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
    }

    // MARK: 游戏

    private var gameView: some View {
        ZStack(alignment: .bottom) {
            GameWebView(port: app.port)
                .id(app.gameKey)
                .ignoresSafeArea()

            HStack(spacing: 10) {
                floatingButton("账号", "person.2.fill") { app.showAccounts = true }
                floatingButton("登录", "qrcode") { app.showLogin = true }
                floatingButton("设置", "slider.horizontal.3") { app.showSettings = true }
                floatingButton("重载", "arrow.clockwise") { app.retryGame() }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(
                Capsule().fill(Color.black.opacity(0.55))
                    .overlay(Capsule().stroke(Color.white.opacity(0.12), lineWidth: 0.5))
            )
            .padding(.bottom, 10)
            .opacity(0.92)
        }
    }

    private func floatingButton(_ title: String, _ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: icon).font(.system(size: 12, weight: .semibold))
                Text(title).font(.system(size: 12, weight: .semibold))
            }
            .foregroundColor(.white)
            .padding(.horizontal, 11)
            .padding(.vertical, 7)
            .background(Color.white.opacity(0.10))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
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
            .padding(.bottom, 90)
            .transition(.opacity)
            .animation(.easeInOut(duration: 0.2), value: app.toastMessage)
    }
}
