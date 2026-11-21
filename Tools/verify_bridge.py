# -*- coding: utf-8 -*-
"""桥接方法一致性校验：
1) BridgeGateway 的 case 方法集
2) ScriptInjector shim 暴露的方法集
3) Web 内实际调用的 AndroidBridge/AndroidBinBridge 方法集
三者比对，输出缺失项
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GATEWAY = os.path.join(ROOT, 'CDApp', 'Core', 'BridgeGateway.swift')
INJECTOR = os.path.join(ROOT, 'CDApp', 'Core', 'ScriptInjector.swift')
WEB = os.path.join(ROOT, 'CDApp', 'Web')

gateway_text = open(GATEWAY, encoding='utf-8').read()
injector_text = open(INJECTOR, encoding='utf-8').read()

# case 标签（支持跨行多模式 case）
case_block = re.search(r'switch method \{(.*?)\n        \}', gateway_text, re.S)
gateway_methods = set()
if case_block:
    for match in re.finditer(r'case\s+((?:"[^"]+"\s*,?\s*)+):', case_block.group(1), re.S):
        for name in re.findall(r'"([^"]+)"', match.group(1)):
            gateway_methods.add(name)

# shim 内 call/js/raw/num/bool/fire 的 method 名
shim_methods = set(re.findall(r"(?:call|js|raw|num|bool|fire)\('([A-Za-z0-9_]+)'", injector_text))
# shim 中的本地别名（直接对外暴露但不转发到网关）
shim_methods |= {'saveImage', 'saveFile'}

# Web 内调用
called = {}
for dirpath, _, names in os.walk(WEB):
    for name in names:
        if not name.endswith('.js') and not name.endswith('.html'):
            continue
        path = os.path.join(dirpath, name)
        text = open(path, encoding='utf-8', errors='ignore').read()
        for method in re.findall(r'Android(?:Bin)?Bridge\.([A-Za-z0-9_]+)\s*\(', text):
            called.setdefault(method, set()).add(os.path.relpath(path, WEB))
        for method in re.findall(r'AndroidBridge\.([A-Za-z0-9_]+)', text):
            called.setdefault(method, set()).add(os.path.relpath(path, WEB))
        for method in re.findall(r'AndroidBinBridge\.([A-Za-z0-9_]+)', text):
            called.setdefault(method, set()).add(os.path.relpath(path, WEB))

print('网关 case 方法: %d' % len(gateway_methods))
print('shim 暴露方法: %d' % len(shim_methods))
print('Web 实际调用: %d' % len(called))

missing_in_shim = sorted(set(called) - shim_methods)
missing_in_gateway = sorted(shim_methods - gateway_methods)

print('\n== Web 调用但 shim 未暴露 ==')
print('  ' + ('\n  '.join('%s  (%s)' % (m, ', '.join(sorted(called[m])[:3])) for m in missing_in_shim) if missing_in_shim else '无'))

print('\n== shim 暴露但网关未实现 ==')
print('  ' + ('\n  '.join(missing_in_gateway) if missing_in_gateway else '无'))

# 兼容旧命名：saveImage/saveFile 是 shim 额外提供的别名
aliases = {'saveImage', 'saveFile'}
real_missing = [m for m in missing_in_gateway if m not in aliases]
print('\n== 结论 ==')
if not missing_in_shim and not real_missing:
    print('  一致')
else:
    print('  存在缺口')
