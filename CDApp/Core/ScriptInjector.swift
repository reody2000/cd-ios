import Foundation
import WebKit

/// 生成注入到 WKWebView 的脚本：
/// 1) Bridge 同步 shim（还原 Android @JavascriptInterface 的同步语义）
/// 2) 油猴运行环境 cd_userscript_env.js
/// 3) 脚本管理器（品牌化 __cdLocalScriptManager）
/// 4) 各启用脚本（沙箱包装，与 Android b0 模板一致）
enum ScriptInjector {

    /// 脚本归属标记键（对齐 Android 注入器的 rk 机制）
    private static let injectedKey = "__cdInjectedScripts"

    // MARK: Bridge shim
    static func bridgeShim(port: UInt16) -> WKUserScript {
        let js = """
        (function(){
          var base = 'http://127.0.0.1:\(port)/__bridge/';
          function call(method, args) {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', base + method, false);
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(args || []));
            var text = xhr.responseText || '{}';
            var env;
            try { env = JSON.parse(text); } catch (e) { throw new Error('bridge response invalid: ' + method); }
            if (env && env.__err) throw new Error(env.__err);
            return env ? env.v : null;
          }
          function js(method, args) { var v = call(method, args); return JSON.stringify(v == null ? {} : v); }
          function raw(method, args) { var v = call(method, args); return v == null ? '' : v; }
          function num(method, args) { var v = call(method, args); return Number(v) || 0; }
          function bool(method, args) { return !!call(method, args); }
          function fire(method, args) { try { call(method, args); } catch (e) {} }

          window.AndroidBridge = window.AndroidBridge || {
            proxyPost: function(url, headers, bodyB64, contentType) { return js('proxyPost', [url, headers, bodyB64, contentType]); },
            saveBin: function(name, b64) { return js('saveBin', [name, b64]); },
            finishAll: function(msg) { fire('finishAll', [msg]); },
            toast: function(msg) { fire('toast', [msg]); },
            log: function(tag, msg) { fire('log', [tag, msg]); }
          };

          window.AndroidBinBridge = window.AndroidBinBridge || {
            proxyPost: function(url, headers, bodyB64, contentType) { return js('proxyPost', [url, headers, bodyB64, contentType]); },
            proxyPostAsync: function(url, headers, bodyB64, contentType, callback) { fire('proxyPostAsync', [url, headers, bodyB64, contentType, callback]); },
            gmGetValue: function(key) { return js('gmGetValue', [key]); },
            gmSetValue: function(key, value) { return js('gmSetValue', [key, value]); },
            gmDeleteValue: function(key) { return js('gmDeleteValue', [key]); },
            gmListValues: function() { return js('gmListValues', []); },
            gmXmlHttpRequest: function(id, json) { fire('gmXmlHttpRequest', [id, json]); },
            getBinHex: function() { return raw('getBinHex', []); },
            getBinName: function() { return raw('getBinName', []); },
            hasBin: function() { return bool('hasBin', []); },
            getUiSpeedRate: function() { return num('getUiSpeedRate', []); },
            getAutoReconnectDelayMillis: function() { return num('getAutoReconnectDelayMillis', []); },
            isAutoReconnectEnabled: function() { return bool('isAutoReconnectEnabled', []); },
            isChatEntryBlockerEnabled: function() { return bool('isChatEntryBlockerEnabled', []); },
            isFloatTextEnabled: function() { return bool('isFloatTextEnabled', []); },
            isGameEnhanceEnabled: function() { return bool('isGameEnhanceEnabled', []); },
            isNightmareSpeedEnabled: function() { return bool('isNightmareSpeedEnabled', []); },
            isQuickMergeEnabled: function() { return bool('isQuickMergeEnabled', []); },
            isSkip150Enabled: function() { return bool('isSkip150Enabled', []); },
            reportCurrentServer: function(server) { fire('reportCurrentServer', [server]); },
            reportGameReadyForScripts: function() { fire('reportGameReadyForScripts', []); },
            reportLoginSuccessForScripts: function() { fire('reportLoginSuccessForScripts', []); },
            reportRoleList: function(json) { fire('reportRoleList', [json]); },
            reportRoleListError: function(msg) { fire('reportRoleListError', [msg]); },
            reportInfiniteLineupGift: function(a, b) { fire('reportInfiniteLineupGift', [a, b]); },
            reportSaltViewGift: function(a, b) { fire('reportSaltViewGift', [a, b]); },
            saveDataUrl: function(name, dataUrl) { return js('saveDataUrl', [name, dataUrl]); },
            saveImage: function(name, dataUrl) { return js('saveDataUrl', [name, dataUrl]); },
            saveFile: function(name, dataUrl, mime) { return js('saveFile', [name, dataUrl, mime]); },
            chooseAvatarImage: function(name) { fire('chooseAvatarImage', [name]); },
            beginSaveImage: function() { return js('beginSaveImage', []); },
            appendSaveImage: function(token, b64) { return js('appendSaveImage', [token, b64]); },
            finishSaveImage: function(token, name) { return js('finishSaveImage', [token, name]); }
          };
        })();
        """
        return WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    // MARK: 脚本管理器（对齐 Android b0 的 prelude，品牌化为 cd）
    private static let managerPrelude = """
    (function(){if(window.__cdLocalScriptManager){return;}var m={running:{},currentId:null};
    function tag(n,id){try{if(!n||n.nodeType!==1||!id){return;}if(!n.getAttribute('data-cd-script-owner')){n.setAttribute('data-cd-script-owner',id);}}catch(e){}}
    function tagRecords(records,id){try{for(var i=0;i<(records||[]).length;i++){var nodes=records[i].addedNodes||[];for(var j=0;j<nodes.length;j++){var n=nodes[j];tag(n,id);if(n&&n.querySelectorAll){var c=n.querySelectorAll('*');for(var k=0;k<c.length;k++){tag(c[k],id);}}}}}catch(e){}}
    var baseStyle=window.GM_addStyle,baseElement=window.GM_addElement;
    if(typeof baseStyle==='function'){window.GM_addStyle=function(){var el=baseStyle.apply(this,arguments);tag(el,m.currentId);return el;};}
    if(typeof baseElement==='function'){window.GM_addElement=function(){var el=baseElement.apply(this,arguments);tag(el,m.currentId);return el;};}
    m.prepare=function(id,name,version){if(!id||m.running[id]){return null;}var nst=window.setTimeout.bind(window),nsi=window.setInterval.bind(window),nct=window.clearTimeout.bind(window),nci=window.clearInterval.bind(window);var timers={timeouts:[],intervals:[]},observer=null;
    function remove(a,v){var p=a.indexOf(v);if(p>=0){a.splice(p,1);}}
    function st(fn,delay){var args=Array.prototype.slice.call(arguments,2),tid=nst(function(){remove(timers.timeouts,tid);if(typeof fn==='function'){fn.apply(window,args);}else{nst(String(fn),0);}},delay);timers.timeouts.push(tid);return tid;}
    function si(fn,delay){var args=Array.prototype.slice.call(arguments,2),iid=nsi(function(){if(typeof fn==='function'){fn.apply(window,args);}else{nst(String(fn),0);}},delay);timers.intervals.push(iid);return iid;}
    function ct(v){remove(timers.timeouts,v);nct(v);}
    function ci(v){remove(timers.intervals,v);nci(v);}
    try{observer=new MutationObserver(function(records){tagRecords(records,id);});observer.observe(document.documentElement||document.body,{childList:true,subtree:true});}catch(e){}
    m.currentId=id;tag(document.currentScript,id);
    try{window.GM_info={scriptHandler:'Tampermonkey',version:'5.3.3',injectInto:'page',downloadMode:'native',isIncognito:false,script:{name:name||'script.js',id:id,uuid:id,version:version||'1.0.0',namespace:'cd-local',description:'',author:'',matches:['<all_urls>'],includes:[],excludes:[],resources:{},grant:['GM_xmlhttpRequest','GM_download','GM_openInTab','GM_addStyle','GM_addElement','unsafeWindow']}};}catch(e){}
    m.running[id]={timers:timers,observer:observer,nst:nst,nct:nct,nci:nci,finishTimer:null};
    return {setTimeout:st,setInterval:si,clearTimeout:ct,clearInterval:ci};};
    m.finish=function(id){var info=m.running[id];if(!info){return;}try{if(info.observer){tagRecords(info.observer.takeRecords(),id);}}catch(e){}info.finishTimer=info.nst(function(){try{if(info.observer){tagRecords(info.observer.takeRecords(),id);info.observer.disconnect();}}catch(e){}if(m.currentId===id){m.currentId=null;}},3000);};
    m.fail=function(id,error){try{window.__cdLastUserScriptError={id:id,error:String(error&&error.stack||error),time:Date.now()};console.error('[CD user script]',id,error);}catch(e){}m.stop(id);};
    m.stop=function(id){var info=m.running[id];if(info){var t=info.timers||{};var a=t.timeouts||[],b=t.intervals||[];for(var i=0;i<a.length;i++){try{info.nct(a[i]);}catch(e){}}for(var j=0;j<b.length;j++){try{info.nci(b[j]);}catch(e){}}try{if(info.finishTimer){info.nct(info.finishTimer);}if(info.observer){info.observer.disconnect();}}catch(e){}}try{var nodes=document.querySelectorAll('[data-cd-script-owner]');for(var k=nodes.length-1;k>=0;k--){if(nodes[k].getAttribute('data-cd-script-owner')===id&&nodes[k].parentNode){nodes[k].parentNode.removeChild(nodes[k]);}}}catch(e){}try{window.dispatchEvent(new CustomEvent('GM_SCRIPT_STOP',{detail:{scriptId:id}}));}catch(e){}delete m.running[id];if(m.currentId===id){m.currentId=null;}};
    window.__cdLocalScriptManager=m;})();
    """

    // MARK: 组装完整注入脚本
    static func gameUserScripts(port: UInt16) -> [WKUserScript] {
        var scripts: [WKUserScript] = [bridgeShim(port: port)]

        let store = ScriptStore.shared
        if let env = store.envCode() {
            scripts.append(WKUserScript(source: env, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        scripts.append(WKUserScript(source: managerPrelude, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        for item in store.enabledScripts() {
            guard let code = store.code(for: item) else { continue }
            scripts.append(WKUserScript(source: wrap(id: item.id, name: item.displayName, code: code),
                                        injectionTime: .atDocumentStart,
                                        forMainFrameOnly: true))
        }
        return scripts
    }

    static func loginUserScripts(port: UInt16) -> [WKUserScript] {
        [bridgeShim(port: port)]
    }

    private static func wrap(id: String, name: String, code: String) -> String {
        let quotedId = jsQuote(id)
        let quotedName = jsQuote(name)
        let quotedVersion = jsQuote("1.0.0")
        let quotedKey = jsQuote(injectedKey)
        return """
        (function(){var id=\(quotedId),rk=\(quotedKey);window[rk]=window[rk]||{};if(window[rk][id]){return;}var ctx=window.__cdLocalScriptManager.prepare(id,\(quotedName),\(quotedVersion));if(!ctx){window[rk][id]=true;return;}try{(function(setTimeout,setInterval,clearTimeout,clearInterval,GM_xmlhttpRequest,GM_download,GM_openInTab,GM_addStyle,GM_addElement,GM_getValue,GM_setValue,GM_deleteValue,GM_listValues,GM_registerMenuCommand,GM_unregisterMenuCommand,GM_notification,GM_setClipboard,unsafeWindow,GM_info,GM){'use strict';
        \(code)
        })(ctx.setTimeout,ctx.setInterval,ctx.clearTimeout,ctx.clearInterval,window.GM_xmlhttpRequest,window.GM_download,window.GM_openInTab,window.GM_addStyle,window.GM_addElement,window.GM_getValue,window.GM_setValue,window.GM_deleteValue,window.GM_listValues,window.GM_registerMenuCommand,window.GM_unregisterMenuCommand,window.GM_notification,window.GM_setClipboard,window.unsafeWindow,window.GM_info,window.GM);window.__cdLocalScriptManager.finish(id);window[rk][id]=true;}catch(e){window[rk][id]=false;window.__cdLocalScriptManager.fail(id,e);}})();
        """
    }

    private static func jsQuote(_ value: String) -> String {
        let data = (try? JSONSerialization.data(withJSONObject: [value], options: [])) ?? Data("[\"\"]".utf8)
        let text = String(data: data, encoding: .utf8) ?? "[\"\"]"
        return String(text.dropFirst().dropLast())
    }
}
