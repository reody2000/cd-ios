import SwiftUI
import WebKit
import UniformTypeIdentifiers

/// 游戏主 WebView：加载本地网关的 index.html，并注入脚本环境
struct GameWebView: UIViewRepresentable {

    let port: UInt16

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        config.defaultWebpagePreferences.allowsContentJavaScript = true

        for script in ScriptInjector.gameUserScripts(port: port) {
            config.userContentController.addUserScript(script)
        }
        config.userContentController.add(context.coordinator, name: "cdBridge")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.backgroundColor = .black
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }

        WebViewHub.shared.activateGame(webView)
        if let url = URL(string: "http://127.0.0.1:\(port)/index.html") {
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        WebViewHub.shared.activateGame(webView)
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "cdBridge")
        WebViewHub.shared.release(webView)
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {}

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            NotificationCenter.default.post(name: .cdGameReady, object: nil)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            NSLog("[CD] game load failed: \(error)")
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled { return }
            NotificationCenter.default.post(name: .cdToast,
                                            userInfo: ["message": "游戏加载失败：\(nsError.localizedDescription)"])
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            NSLog("[CD] game provisional load failed: \(error)")
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled { return }
            NotificationCenter.default.post(name: .cdToast,
                                            userInfo: ["message": "游戏页面加载失败：\(nsError.localizedDescription)"])
        }

        /// 处理 target=_blank / window.open
        func webView(_ webView: WKWebView,
                     createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url, navigationAction.targetFrame == nil {
                UIApplication.shared.open(url)
            }
            return nil
        }

        // MARK: <input type="file">（游戏内导入账号 BIN，对齐 Android onShowFileChooser）

        private var openPanelDelegate: OpenPanelDelegate?

        @available(iOS 18.4, *)
        func webView(_ webView: WKWebView,
                     runOpenPanelWith parameters: WKOpenPanelParameters,
                     initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping ([URL]?) -> Void) {
            let delegate = OpenPanelDelegate(completionHandler: completionHandler)
            openPanelDelegate = delegate
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
            picker.allowsMultipleSelection = parameters.allowsMultipleSelection
            picker.delegate = delegate
            var responder: UIResponder? = webView
            while let current = responder {
                if let vc = current as? UIViewController {
                    vc.present(picker, animated: true)
                    break
                }
                responder = current.next
            }
        }

        final class OpenPanelDelegate: NSObject, UIDocumentPickerDelegate {
            private var handler: (([URL]?) -> Void)?
            init(completionHandler: @escaping ([URL]?) -> Void) { handler = completionHandler }

            func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
                handler?(urls)
                handler = nil
            }

            func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
                handler?(nil)
                handler = nil
            }
        }
    }
}

/// 登录页 WebView（手机号 / 二维码），只注入 Bridge shim
struct LoginWebView: UIViewRepresentable {

    let port: UInt16
    let page: String

    func makeCoordinator() -> GameWebView.Coordinator { GameWebView.Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        for script in ScriptInjector.loginUserScripts(port: port) {
            config.userContentController.addUserScript(script)
        }

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .black
        if #available(iOS 16.4, *) {
            webView.isInspectable = true
        }

        WebViewHub.shared.activateLogin(webView)
        if let url = URL(string: "http://127.0.0.1:\(port)/login/\(page)") {
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        WebViewHub.shared.activateLogin(webView)
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: GameWebView.Coordinator) {
        WebViewHub.shared.release(webView)
    }
}
