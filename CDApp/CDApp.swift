import SwiftUI

@main
struct CDApp: App {
    @StateObject private var app = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .preferredColorScheme(.dark)
                .statusBarHidden(true)
        }
    }
}
