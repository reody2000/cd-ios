# 赤道 iOS 版（ios-CD）

`qvq.apk` 深度改造版（赤道 APK）的 iOS 对等实现。原生层用 Swift + WKWebView 重写，
Web 层（Cocos 游戏本体、16 个内置脚本、2 个云端脚本、手机号/扫码登录页）与 Android 版完全共用。

本目录自成一体：Swift 源码、Web 资源、XcodeGen 工程定义、CI 打包脚本全部在此，不依赖其他目录。

---

## 一、为什么这样实现

Android 壳的核心能力是 `@JavascriptInterface` 提供的**同步**返回（`AndroidBridge.proxyPost`、
`AndroidBinBridge.gmGetValue` 等，H5 侧直接拿返回值使用）。WKWebView 的 message handler
只能异步，无法直接复刻。

本工程采用**本地 HTTP 网关**方案：

```
WKWebView  http://127.0.0.1:34567/
   ├── GET  /*                 → Bundle 内 Web/ 静态资源
   ├── GET  /api/*             → 静态未命中时反代到游戏服务器（二维码登录等）
   └── POST /__bridge/<method> → BridgeGateway（原生能力）
```

启动时注入一段 JS shim，把 `window.AndroidBridge` / `window.AndroidBinBridge` 的方法
实现为**同步 XMLHttpRequest** 打到本地网关。这样：

- 同步语义 100% 保留，原 H5 代码（登录页等）无需修改
- 原生能力集中在一个 Swift 文件，便于维护
- 无需第三方依赖，仅用 Network.framework + URLSession

端口固定为 `34567`（被占用时依次回退 34568–34571）：**origin 稳定才能保住
localStorage 里的游戏存档与 GM 数据**，这一点不能用随机端口。

## 二、目录结构

```text
ios-CD/
├── project.yml                     XcodeGen 工程定义
├── .github/workflows/build-ios.yml GitHub Actions（macOS 出未签名 IPA）
├── CDApp/
│   ├── CDApp.swift                 入口
│   ├── AppState.swift              全局状态（端口、账号、弹窗）
│   ├── Info.plist                  ATS / 相册权限 / 文件共享
│   ├── Assets.xcassets/            应用图标（赤道）
│   ├── Core/
│   │   ├── LocalHTTPServer.swift   本地 HTTP 服务（静态资源 + 网关路由）
│   │   ├── BridgeGateway.swift     AndroidBridge / AndroidBinBridge 全部方法
│   │   ├── ProxyClient.swift       请求代理 + 域名补全（对齐 b4）
│   │   ├── AccountStore.swift      账号 bin 管理
│   │   ├── SettingsStore.swift     设置项（键名与 Android 一致）
│   │   ├── ScriptStore.swift       脚本清单与开关
│   │   └── ScriptInjector.swift    Bridge shim + 油猴环境 + 脚本注入
│   ├── Views/
│   │   ├── RootView.swift          游戏页 + 悬浮工具条 + Toast
│   │   ├── GameWebView.swift       游戏 / 登录 WKWebView
│   │   ├── AccountListView.swift   账号管理（导入/导出/删除/启动）
│   │   ├── LoginView.swift         手机号登录 / 扫码登录
│   │   └── SettingsView.swift      游戏功能 + 脚本管理 + 关于
│   └── Web/                        游戏资源（来自 06 工程 cd-game）
│       ├── index.html main.js patch.js game-defines.js ...
│       ├── assets/ src/ vendor/
│       ├── login/                  手机号 / 扫码登录页
│       └── scripts/
│           ├── builtin/            16 个内置脚本（cd_*）
│           ├── cloud/              salt_view / early_black_mask
│           └── config/             本地脚本配置
└── README.md
```

## 三、已复刻的功能

### 3.1 桥接接口

| 分组 | 方法 |
|---|---|
| 网络 | `proxyPost`、`proxyPostAsync`、`gmXmlHttpRequest` |
| GM 存储 | `gmGetValue`、`gmSetValue`、`gmDeleteValue`、`gmListValues` |
| 账号 | `getBinHex`、`getBinName`、`hasBin`、`saveBin` |
| 设置 | `getUiSpeedRate`、`getAutoReconnectDelayMillis`、`isXxxEnabled` ×7 |
| 上报 | `reportCurrentServer`、`reportGameReadyForScripts`、`reportLoginSuccessForScripts`、`reportRoleList(Error)` |
| 图片 | `saveDataUrl`、`saveFile`、`begin/append/finishSaveImage`、`chooseAvatarImage` |
| UI | `toast`、`finishAll`、`log` |

### 3.2 URL 补全（对齐 `MainActivity.b4`）

| H5 传入路径 | 实际目标 |
|---|---|
| `/api/hortor/comb-login-server/...` | `https://comb-platform.hortorgames.com/comb-login-server/...` |
| `/api/ucenter/ucenter-app-server/...` | `https://ucenter-app-server.hortorgames.com/ucenter-app-server/...` |
| `/api/xxz/login/serverlist?...` | `https://xxz-xyzw.hortorgames.com/login/serverlist?...` |
| 其他相对路径 | `https://xxz-xyzw.hortorgames.com/<path>` |
| 完整 http/https | 原样请求 |

GET 相对路径（二维码登录的 `/api/weixin/connect/...`）由本地服务器在静态资源未命中时
自动反代（对齐 Android `v()` / `j1()`），并把响应头 `Content-Encoding` /
`Content-Length` 剥除后回给 WebView。

### 3.3 脚本注入

与 Android `b0()` 相同的沙箱模板：

1. 注入 Bridge shim
2. 注入 `cd_userscript_env.js`（19 个 GM_* API）
3. 注入品牌化的 `__cdLocalScriptManager` 管理器
4. 每个启用脚本套 `prepare / finish / fail` 包装，隔离定时器与 DOM

默认开启：`cd_native_login_patch`（登录依赖）、`cd_early_black`、`early_black_mask`。
其余脚本在「设置 → 脚本管理」中开关。

### 3.4 账号

- 目录：`Documents/accounts/*.bin`（沙盒，可通过文件 App 访问）
- 文件名规范化与 Android `k4()` 一致
- 支持：文件导入、剪贴板导入（base64）、导出分享、删除、选择启动
- 启动游戏时脚本通过 `getBinHex()` 取当前账号

### 3.5 设置项（键名与 Android 完全一致）

`game_enhance_enabled`、`chat_entry_blocker_enabled`、`nightmare_speed_enabled`、
`float_text_enabled`、`quick_merge_enabled`、`skip_150_enabled`、`auto_reconnect_enabled`、
`auto_reconnect_delay_minutes`、`auto_reconnect_delay_value`、`game_nav_fixed_enabled`、
`game_brightness_enabled`、`ui_speed_rate`

## 四、GitHub Actions 打包（无 Mac 首选）

1. 将本目录（`ios-CD/`）推送到 GitHub 仓库。
2. 仓库 Actions → `build-ios` → Run workflow（或推送 `ios-*` tag）。
3. 运行结束后下载 Artifact `CDApp-unsigned-ipa`。

产物为**未签名 IPA**，因为 iOS 必须由 Apple 证书签名才能安装。

### 本地 Mac 打包

```bash
brew install xcodegen
xcodegen generate
xcodebuild -project CDApp.xcodeproj -scheme CDApp -configuration Release \
  -sdk iphoneos -derivedDataPath build build \
  CODE_SIGNING_ALLOWED=NO
# 产物：build/Build/Products/Release-iphoneos/CDApp.app
```

## 五、安装到 iPhone（Windows + Sideloadly）

1. 下载 [Sideloadly](https://sideloadly.io/)（Windows 版），iPhone 用 USB 连接电脑。
2. 把 `CDApp-unsigned.ipa` 拖入 Sideloadly，用 Apple ID 登录（免费账号即可，Sideloadly 会重签名）。
3. iPhone：设置 → 通用 → VPN 与设备管理 → 信任对应开发者证书。
4. 免费账号签名 **7 天过期**，到期后连电脑重装；付费开发者账号可签名一年。

> 也可用 AltStore、爱思助手等工具完成同样的自签安装。

## 六、已知差异（相对 Android 版）

| 项 | 说明 |
|---|---|
| 资源加密 | Android 的 `libcdassets.so`（AES-GCM 容器）未移植，iOS 直接以明文打进 Bundle |
| 虚拟域名 | Android 的 `https://cd.local` 改为 `http://127.0.0.1:<port>` |
| 图片编辑 | Android 的系统图片编辑器替换为「相册选择 + 直接保存到相册」 |
| 文件导出 | Android 写 Downloads，iOS 弹系统分享面板（可存「文件」App） |
| 亮度调节 | 受 iOS 限制，仅保留设置项与脚本参数，不做系统亮度写入 |
| 后台保活 | iOS 不允许长期后台运行，切后台会被系统挂起 |

## 七、资源更新

游戏资源来自 Android 逆向工程的品牌化版本：

```powershell
robocopy "E:\C\CD\qvq-reverse-standalone\06-工程化重组\cd-game" "E:\C\CD\ios-CD\CDApp\Web" /E /XF README.md
```

更新后重新打包即可。`index.html` 引用的 `style-mobile.1777a.css`、`favicon.8de18.ico`
已按原版命名补齐（06 工程内为去掉 hash 的文件名）。

## 八、调试

- Safari → 开发 → 模拟器/设备 → 选择 `CDApp` 的 WebView（已开启 `isInspectable`）
- 原生日志：Xcode Console 过滤 `[CD]`
- 脚本报错：页面控制台查看 `[CD user script]` 与 `window.__cdLastUserScriptError`

## 九、版本

`1.0`（对齐 Android 版 `versionName 1.0`）。
