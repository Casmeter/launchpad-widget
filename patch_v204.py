# -*- coding: utf-8 -*-
"""v2.0.4 诊断加固补丁（userscript + extension 同步）：
1. 点击委托 handler 包 try/catch，出错 toast 显示
2. openEditor 改 wrapper + inner，打开失败 toast 显示
3. 全局 error/unhandledrejection 显示到面板
4. 版本号 bump（user.js 2.0.3→2.0.4，manifest 2.0.2→2.0.4）"""
import json

OLD_HANDLER = """  body.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!btn) { return; }
    var act = btn.getAttribute('data-act');
    var id = btn.getAttribute('data-id');
    if (act === 'launch') { launchEntry(id); }
    else if (act === 'checkin') { toggleCheckin(id); }
    else if (act === 'edit') { openEditor(id); }
    else if (act === 'export') { exportJSON(); }
    else if (act === 'import') { importJSON(); }
    else if (act === 'reseed') { reseed(); }
    else if (act === 'clear') { clearAll(); }
  });"""

NEW_HANDLER = """  body.addEventListener('click', function (e) {
    try {
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn) { return; }
      var act = btn.getAttribute('data-act');
      var id = btn.getAttribute('data-id');
      if (act === 'launch') { launchEntry(id); }
      else if (act === 'checkin') { toggleCheckin(id); }
      else if (act === 'edit') { openEditor(id); }
      else if (act === 'export') { exportJSON(); }
      else if (act === 'import') { importJSON(); }
      else if (act === 'reseed') { reseed(); }
      else if (act === 'clear') { clearAll(); }
    } catch (err) {
      console.error('[launchpad] action failed:', err);
      try { toast('操作失败: ' + ((err && err.message) || err), true); } catch (x) {}
    }
  });"""

OLD_OPEN = "  function openEditor(id) {\n"
NEW_OPEN = """  function openEditor(id) {
    /* v2.0.4 防弹：打开失败直接在面板上显示错误，不再静默无反应 */
    try {
      openEditorInner(id);
    } catch (err) {
      console.error('[launchpad] openEditor failed:', err);
      try { toast('编辑器打开失败: ' + ((err && err.message) || err), true); } catch (x) {}
    }
  }
  function openEditorInner(id) {
"""

OLD_ANCHOR = """  /* ================================================================
   * 面板框架（拖拽/缩放/宽窄/快捷键）"""

GLOBAL_ERR = """  /* v2.0.4 诊断：未捕获错误直接显示在面板上（不再静默失败，便于远程定位） */
  window.addEventListener('error', function (e) {
    try { toast('脚本错误: ' + ((e && e.message) || '未知'), true); } catch (x) {}
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    try { toast('脚本错误: ' + ((r && r.message) ? r.message : String(r)), true); } catch (x) {}
  });

  /* ================================================================
   * 面板框架（拖拽/缩放/宽窄/快捷键）"""


def patch(path, is_userjs):
    with open(path, 'rb') as f:
        data = f.read().decode('utf-8')
    for old, new, name in [
        (OLD_HANDLER, NEW_HANDLER, '委托防弹'),
        (OLD_OPEN, NEW_OPEN, 'openEditor防弹'),
        (OLD_ANCHOR, GLOBAL_ERR, '全局错误显示'),
    ]:
        n = data.count(old)
        if n != 1:
            print('SKIP %s @ %s (count=%d)' % (name, path, n))
            continue
        data = data.replace(old, new)
        print('ok   %s @ %s' % (name, path))
    if is_userjs:
        old_v = '// @version      2.0.3'
        assert data.count(old_v) == 1
        data = data.replace(old_v, '// @version      2.0.4')
    with open(path, 'wb') as f:
        f.write(data.encode('utf-8'))


if __name__ == '__main__':
    patch('启动台浮窗.user.js', True)
    patch('extension/content.js', False)
    mf = 'extension/manifest.json'
    with open(mf, 'rb') as f:
        m = json.loads(f.read().decode('utf-8'))
    m['version'] = '2.0.4'
    with open(mf, 'wb') as f:
        f.write(json.dumps(m, ensure_ascii=False, indent=2).encode('utf-8'))
    print('manifest version -> 2.0.4')
