# -*- coding: utf-8 -*-
"""修正 Swift 异质字典字面量类型推断问题（需显式标注 [String: Any]）"""
import io

PATH = r'e:\C\CD\ios-CD\CDApp\Core\BridgeGateway.swift'
text = io.open(PATH, encoding='utf-8').read()

replacements = [
    ('private func proxyPost(url: String, headersJSON: String, bodyBase64: String, contentType: String) -> Any {',
     'private func proxyPost(url: String, headersJSON: String, bodyBase64: String, contentType: String) -> [String: Any] {'),
    ('["v": ["ok": true, "found": true, "value": value]]',
     '["v": ["ok": true, "found": true, "value": value] as [String: Any]]'),
    ('["v": ["ok": true, "values": keys]]',
     '["v": ["ok": true, "values": keys] as [String: Any]]'),
    ('["v": ["ok": true, "name": saved]]',
     '["v": ["ok": true, "name": saved] as [String: Any]]'),
    ('["v": ["ok": false, "error": "save failed"]]',
     '["v": ["ok": false, "error": "save failed"] as [String: Any]]'),
    ('["v": ["ok": true, "token": token]]',
     '["v": ["ok": true, "token": token] as [String: Any]]'),
    ('["v": ["ok": true, "name": name]]',
     '["v": ["ok": true, "name": name] as [String: Any]]'),
    ('["v": ["ok": false, "error": "no image data"]]',
     '["v": ["ok": false, "error": "no image data"] as [String: Any]]'),
]

for old, new in replacements:
    if old not in text:
        print('[未命中] ' + old[:70])
        continue
    text = text.replace(old, new)
    print('[已修正] ' + old[:70])

io.open(PATH, 'w', encoding='utf-8', newline='').write(text)
print('\n写入完成')
