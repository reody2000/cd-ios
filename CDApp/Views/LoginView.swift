import SwiftUI

/// 登录页：手机号验证码登录 / 微信扫码登录
/// 直接复用 APK 内的 H5 登录页，通过本地网关的 AndroidBridge.proxyPost 完成请求
struct LoginView: View {

    let port: UInt16

    @EnvironmentObject private var app: AppState
    @Environment(\.dismiss) private var dismiss

    @State private var mode = 0

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                Picker("登录方式", selection: $mode) {
                    Text("手机号登录").tag(0)
                    Text("扫码登录").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Color(red: 0.09, green: 0.10, blue: 0.13))

                if mode == 0 {
                    LoginWebView(port: port, page: "phone_login.html")
                        .id("phone")
                } else {
                    LoginWebView(port: port, page: "qrcode.html")
                        .id("qrcode")
                }
            }
            .background(Color.black.ignoresSafeArea())
            .navigationTitle("登录")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("关闭") { dismiss() }
                        .foregroundColor(.white)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        app.refreshAccounts()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .foregroundColor(.white)
                }
            }
        }
        .navigationViewStyle(.stack)
        .preferredColorScheme(.dark)
    }
}
