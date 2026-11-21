# -*- coding: utf-8 -*-
"""ios-CD 静态校验：
1) Swift：去掉字符串/注释后检查中文标点（全角逗号等会直接导致编译失败）
2) Swift：括号平衡
3) plist / xcassets / project.yml 结构合法性
4) HTML 资源引用是否都存在
5) 关键脚本与配置是否就位
"""
import os
import re
import sys
import json
import plistlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, 'CDApp')
WEB = os.path.join(APP, 'Web')

# 允许出现在字符串里的中文标点，但代码区不允许
BAD_PUNCT = '，。；：（）！？、“”‘’【】《》'

problems = []
notes = []


def strip_swift_line(line):
    """移除字符串字面量与注释，返回仅代码部分"""
    out = []
    i = 0
    in_str = False
    triple = False
    in_char = False
    while i < len(line):
        if not in_str and not in_char:
            if line.startswith('"""', i):
                triple = True
                in_str = True
                i += 3
                continue
            if line[i] == '"':
                in_str = True
                triple = False
                i += 1
                continue
            if line.startswith('//', i):
                break
            if line[i] == "'":
                in_char = True
                i += 1
                continue
            out.append(line[i])
            i += 1
            continue
        if in_char:
            if line[i] == "'":
                in_char = False
            i += 1
            continue
        # 字符串内
        if triple and line.startswith('"""', i):
            in_str = False
            triple = False
            i += 3
            continue
        if not triple:
            if line[i] == '\\':
                i += 2
                continue
            if line[i] == '"':
                in_str = False
                i += 1
                continue
        i += 1
    return ''.join(out)


def check_swift():
    files = []
    for dirpath, _, names in os.walk(APP):
        if 'Web' in dirpath.split(os.sep):
            continue
        for name in names:
            if name.endswith('.swift'):
                files.append(os.path.join(dirpath, name))
    for path in files:
        rel = os.path.relpath(path, ROOT)
        text = open(path, encoding='utf-8').read()
        code_lines = [strip_swift_line(line) for line in text.split('\n')]
        code = '\n'.join(code_lines)
        for no, line in enumerate(code_lines, 1):
            for ch in BAD_PUNCT:
                if ch in line:
                    problems.append('[中文标点] %s:%d  %s' % (rel, no, line.strip()[:70]))
        for pair in [('{', '}'), ('(', ')'), ('[', ']')]:
            if code.count(pair[0]) != code.count(pair[1]):
                problems.append('[括号不平衡] %s  %s=%d %s=%d' % (
                    rel, pair[0], code.count(pair[0]), pair[1], code.count(pair[1])))
        notes.append('Swift 文件 %d 个已检查（%s）' % (len(files), rel))


def check_plist():
    path = os.path.join(APP, 'Info.plist')
    try:
        with open(path, 'rb') as f:
            data = plistlib.load(f)
        for key in ['CFBundleDisplayName', 'CFBundleIdentifier', 'NSAppTransportSecurity']:
            if key not in data:
                problems.append('[plist] 缺少 %s' % key)
        if data.get('CFBundleDisplayName') != '赤道':
            problems.append('[plist] 显示名不是 赤道')
        notes.append('Info.plist 解析通过')
    except Exception as exc:
        problems.append('[plist] 解析失败: %s' % exc)


def check_assets():
    for path in [
        os.path.join(APP, 'Assets.xcassets', 'Contents.json'),
        os.path.join(APP, 'Assets.xcassets', 'AppIcon.appiconset', 'Contents.json'),
    ]:
        try:
            json.load(open(path, encoding='utf-8'))
        except Exception as exc:
            problems.append('[xcassets] %s 无效: %s' % (os.path.basename(path), exc))
    icon = os.path.join(APP, 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon1024.png')
    if not os.path.exists(icon):
        problems.append('[图标] 缺少 AppIcon1024.png')
    else:
        notes.append('应用图标就位 (%.0f KB)' % (os.path.getsize(icon) / 1024))


def check_yaml():
    path = os.path.join(ROOT, 'project.yml')
    text = open(path, encoding='utf-8').read()
    try:
        import yaml  # type: ignore
        cfg = yaml.safe_load(text)
        target = cfg.get('targets', {}).get('CDApp')
        if not target:
            problems.append('[project.yml] 缺少 CDApp target')
        else:
            settings = target.get('settings', {}).get('base', {})
            if settings.get('INFOPLIST_FILE') != 'CDApp/Info.plist':
                problems.append('[project.yml] INFOPLIST_FILE 配置异常')
            if not cfg.get('schemes', {}).get('CDApp'):
                problems.append('[project.yml] 缺少 CDApp scheme')
        notes.append('project.yml 解析通过')
    except ImportError:
        notes.append('project.yml 未做 YAML 解析（未安装 PyYAML），仅做关键字检查')
        for key in ['name: CDApp', 'CDApp:', 'type: folder', 'INFOPLIST_FILE: CDApp/Info.plist']:
            if key not in text:
                problems.append('[project.yml] 缺少 %s' % key)
    except Exception as exc:
        problems.append('[project.yml] 解析失败: %s' % exc)


def check_web():
    required = [
        'index.html', 'main.js', 'patch.js', 'game-defines.js', 'cocos2d-js-min.js',
        'style-mobile.1777a.css', 'favicon.8de18.ico', 'cd_viewport_fix.js',
        'vendor/game-crypto.js',
        'login/phone_login.html', 'login/qrcode.html',
        'scripts/builtin/cd_userscript_env.js',
        'scripts/builtin/cd_native_login_patch.js',
        'scripts/builtin/cd_shell_features.js',
        'scripts/cloud/salt_view.js', 'scripts/cloud/early_black_mask.js',
        'scripts/config/cloud-scripts-local.json',
    ]
    for rel in required:
        path = os.path.join(WEB, rel.replace('/', os.sep))
        if not os.path.exists(path):
            problems.append('[资源缺失] Web/%s' % rel)

    # HTML 引用检查
    for page in ['index.html', 'login/phone_login.html', 'login/qrcode.html']:
        path = os.path.join(WEB, page.replace('/', os.sep))
        if not os.path.exists(path):
            continue
        html = open(path, encoding='utf-8', errors='ignore').read()
        base = os.path.dirname(path)
        refs = re.findall(r'(?:src|href)="([^"#?]+)"', html)
        for ref in refs:
            if ref.startswith(('http://', 'https://', 'data:', 'javascript:', '//')):
                continue
            target = os.path.normpath(os.path.join(base, ref))
            if not os.path.exists(target):
                problems.append('[HTML 引用缺失] %s -> %s' % (page, ref))

    # 脚本数量
    builtin = os.path.join(WEB, 'scripts', 'builtin')
    if os.path.isdir(builtin):
        count = len([n for n in os.listdir(builtin) if n.endswith('.js')])
        notes.append('内置脚本 %d 个' % count)
        if count < 16:
            problems.append('[脚本] 内置脚本数量不足（%d < 16）' % count)


def check_ci():
    path = os.path.join(ROOT, '.github', 'workflows', 'build-ios.yml')
    if not os.path.exists(path):
        problems.append('[CI] 缺少 build-ios.yml')
        return
    text = open(path, encoding='utf-8').read()
    for key in ['runs-on: macos-', 'xcodegen generate', 'xcodebuild', 'CODE_SIGNING_ALLOWED=NO', 'upload-artifact']:
        if key not in text:
            problems.append('[CI] 缺少步骤: %s' % key)
    notes.append('GitHub Actions workflow 就位')


def main():
    check_swift()
    check_plist()
    check_assets()
    check_yaml()
    check_web()
    check_ci()

    print('== 说明 ==')
    for note in notes:
        print('  ' + note)
    print('\n== 问题 (%d) ==' % len(problems))
    for item in problems:
        print('  ' + item)
    if not problems:
        print('  无')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
