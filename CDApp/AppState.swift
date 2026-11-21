import SwiftUI
import Combine
import UIKit
import WebKit

final class AppState: ObservableObject {

    @Published var port: UInt16 = 0
    @Published var accounts: [AccountStore.Account] = []
    @Published var currentAccount: String?
    @Published var showLogin = false
    @Published var showSettings = false
    @Published var showAccounts = false
    @Published var toastMessage: String?
    @Published var gameKey = UUID()

    private var server: LocalHTTPServer?
    private var toastWorkItem: DispatchWorkItem?

    init() {
        // 清一次 WKWebView 旧缓存：曾因 max-age 缓存命中旧版脚本（更新 App 后新逻辑不生效）
        WKWebsiteDataStore.default().removeData(
            ofTypes: [WKWebsiteDataTypeDiskCaches, WKWebsiteDataTypeMemoryCaches],
            modifiedSince: .distantPast,
            completionHandler: {}
        )
        startServer()
        refreshAccounts()
    }

    private func startServer() {
        guard let webRoot = Bundle.main.resourceURL?.appendingPathComponent("Web") else {
            NSLog("[CD] Web resource directory missing")
            return
        }
        let server = LocalHTTPServer(webRoot: webRoot, bridge: BridgeGateway())
        server.onReady = { [weak self] port in
            DispatchQueue.main.async {
                self?.port = port
                NSLog("[CD] local server ready on \(port)")
            }
        }
        server.start()
        self.server = server
    }

    func refreshAccounts() {
        accounts = AccountStore.shared.list()
        currentAccount = AccountStore.shared.currentName
        if let current = currentAccount, !accounts.contains(where: { $0.name == current }) {
            AccountStore.shared.currentName = nil
            currentAccount = nil
        }
    }

    func select(_ account: AccountStore.Account) {
        AccountStore.shared.select(name: account.name)
        currentAccount = account.name
        gameKey = UUID()
        showAccounts = false
    }

    func delete(_ account: AccountStore.Account) {
        AccountStore.shared.delete(name: account.name)
        refreshAccounts()
        if currentAccount == nil {
            gameKey = UUID()
        }
    }

    func importAccount(url: URL) {
        if let name = AccountStore.shared.importFile(url) {
            refreshAccounts()
            AccountStore.shared.select(name: name)
            currentAccount = name
            gameKey = UUID()
            showToast("已导入：\(name)")
        } else {
            showToast("导入失败")
        }
    }

    func saveAccountFromClipboard() {
        guard let text = UIPasteboard.general.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else {
            showToast("剪贴板为空")
            return
        }
        var base64 = text
        if base64.hasPrefix("data:"), let comma = base64.firstIndex(of: ",") {
            base64 = String(base64[base64.index(after: comma)...])
        }
        guard let data = Data(base64Encoded: base64), !data.isEmpty else {
            showToast("剪贴板内容不是有效的账号数据")
            return
        }
        if let name = AccountStore.shared.save(name: "account-\(Int(Date().timeIntervalSince1970))", data: data) {
            refreshAccounts()
            AccountStore.shared.select(name: name)
            currentAccount = name
            gameKey = UUID()
            showToast("已导入：\(name)")
        }
    }

    func retryGame() {
        gameKey = UUID()
    }

    func showToast(_ message: String) {
        toastWorkItem?.cancel()
        toastMessage = message
        let work = DispatchWorkItem { [weak self] in
            self?.toastMessage = nil
        }
        toastWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2, execute: work)
    }

    func handleLoginFinished(_ message: String) {
        showLogin = false
        refreshAccounts()
        if let current = currentAccount {
            AccountStore.shared.select(name: current)
            gameKey = UUID()
        }
        if !message.isEmpty { showToast(message) }
    }

    func exportURL(for account: AccountStore.Account) -> URL {
        AccountStore.shared.url(for: account.name)
    }
}
