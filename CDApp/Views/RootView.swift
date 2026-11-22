import SwiftUI

/// 主界面：对齐 Android 端三 Tab 结构（账号 / 游戏 / 设置）
/// 导航优化：分段式导航（图标 + 动画胶囊指示器），Tab 切换保持游戏 WebView 不销毁
struct RootView: View {

    @EnvironmentObject private var app: AppState
    @State private var tab = 0
    @Namespace private var navAnim

    private let accent = Color(red: 0.180, green: 0.420, blue: 0.949)
    private let pageBg = Color(red: 0.949, green: 0.957, blue: 0.973)

    var body: some View {
        VStack(spacing: 0) {
            navBar
            ZStack {
                // 三个页面常驻挂载：切换 Tab 仅切换可见性，
                // 避免游戏 WebView 被销毁导致对局/连接中断
                AccountManagerView(tab: $tab)
                    .opacity(tab == 0 ? 1 : 0)
                    .allowsHitTesting(tab == 0)
                gameTab
                    .opacity(tab == 1 ? 1 : 0)
                    .allowsHitTesting(tab == 1)
                SettingsView()
                    .opacity(tab == 2 ? 1 : 0)
                    .allowsHitTesting(tab == 2)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            if let message = app.toastMessage {
                toastView(message)
            }
        }
        .background(pageBg.ignoresSafeArea())
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

    // MARK: 分段式导航（账号 / 游戏 / 设置）

    private var navBar: some View {
        HStack(spacing: 4) {
            navItem("账号", icon: "person.2", selectedIcon: "person.2.fill", index: 0)
            navItem("游戏", icon: "gamecontroller", selectedIcon: "gamecontroller.fill", index: 1)
            navItem("设置", icon: "gearshape", selectedIcon: "gearshape.fill", index: 2)
        }
        .padding(4)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .shadow(color: Color.black.opacity(0.07), radius: 12, y: 4)
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 10)
    }

    private func navItem(_ title: String, icon: String, selectedIcon: String, index: Int) -> some View {
        let selected = tab == index
        return Button {
            guard !selected else { return }
            withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) {
                tab = index
            }
        } label: {
            HStack(spacing: 6) {
                Image(systemName: selected ? selectedIcon : icon)
                    .font(.system(size: 15, weight: .semibold))
                Text(title)
                    .font(.system(size: 14, weight: selected ? .semibold : .medium))
            }
            .foregroundColor(selected ? .white : Color(red: 0.42, green: 0.45, blue: 0.50))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 9)
            .background(
                ZStack {
                    if selected {
                        Capsule()
                            .fill(accent)
                            .matchedGeometryEffect(id: "navPill", in: navAnim)
                    }
                }
            )
        }
        .buttonStyle(.plain)
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
        .transition(.opacity)
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
