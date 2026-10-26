# -*- coding: utf-8 -*-
"""v2.0.6：插件版加「小小的主题色切换」——主色抽成 CSS 变量 + 头部色点按钮 + 6 色小色板。
userscript 与 extension/content.js 同步。"""
import json

COLOR_MAP = [('#00BCF2', 'var(--lp-accent)'), ('#0aa9d6', 'var(--lp-accent-d)'), ('#b3e5f8', 'var(--lp-accent-l)')]

OLD_HOST = "    ':host{all:initial}',"
NEW_HOST = "    ':host{all:initial;--lp-accent:#00BCF2;--lp-accent-d:#0aa9d6;--lp-accent-l:#b3e5f8}',"

OLD_HIDDEN = "    '.lp-hidden{display:none!important}'"
NEW_HIDDEN = """    '.lp-hidden{display:none!important}',
    /* 主题色小色板 */
    '.lp-theme-pop{position:absolute;top:40px;right:6px;background:#fff;border:1px solid var(--lp-accent-d);',
    '  border-radius:3px;padding:6px;display:flex;gap:6px;z-index:30;box-shadow:0 4px 14px rgba(0,0,0,.22)}',
    '.lp-dot{flex:none;width:20px;height:20px;border-radius:2px;border:0;cursor:pointer;padding:0}',
    '.lp-dot.on{outline:2px solid #23272f;outline-offset:1px}'"""

OLD_THEME_BTN = """    '    <button class="lp-btn" id="lp-add" title="添加入口">+ 添加</button>' +"""
NEW_THEME_BTN = """    '    <button class="lp-btn" id="lp-theme" title="主题色">◐</button>' +
    '    <button class="lp-btn" id="lp-add" title="添加入口">+ 添加</button>' +"""

OLD_SETTINGS_DEFAULT = "    var s = { w: 400, h: 580, x: -1, y: -1, open: false, wide: false };"
NEW_SETTINGS_DEFAULT = "    var s = { w: 400, h: 580, x: -1, y: -1, open: false, wide: false, theme: 'azure' };"

OLD_SETTINGS_READ = "          if (typeof o.wide === 'boolean') { s.wide = o.wide; }"
NEW_SETTINGS_READ = """          if (typeof o.wide === 'boolean') { s.wide = o.wide; }
          if (typeof o.theme === 'string') { s.theme = o.theme; }"""

OLD_WIDE_BIND = "  $('lp-wide').addEventListener('click', toggleWide);"
NEW_WIDE_BIND = """  $('lp-wide').addEventListener('click', toggleWide);

  /* ---- 主题色（v2.0.6）：头部色点按钮 → 6 色小色板，选择后持久化 ---- */
  var THEMES = [
    { id: 'azure', name: '晴空蓝', a: '#00BCF2', d: '#0aa9d6', l: '#b3e5f8' },
    { id: 'teal', name: '薄荷青', a: '#00A99D', d: '#00796B', l: '#B2DFDB' },
    { id: 'green', name: '嫩芽绿', a: '#60A917', d: '#3F7A0B', l: '#C5E1A5' },
    { id: 'amber', name: '琥珀橙', a: '#FA6800', d: '#C94A00', l: '#FFCCBC' },
    { id: 'purple', name: '暮色紫', a: '#7B4FBE', d: '#4E1F5F', l: '#D1C4E9' },
    { id: 'rose', name: '玫红', a: '#E3008C', d: '#A00063', l: '#F8BBD0' }
  ];
  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) { if (THEMES[i].id === id) { return THEMES[i]; } }
    return THEMES[0];
  }
  function applyTheme(id) {
    var t = themeById(id || cfg.theme);
    cfg.theme = t.id;
    host.style.setProperty('--lp-accent', t.a);
    host.style.setProperty('--lp-accent-d', t.d);
    host.style.setProperty('--lp-accent-l', t.l);
    var btn = $('lp-theme');
    if (btn) { btn.title = '主题色（当前：' + t.name + '）'; }
    return t;
  }
  function closeThemePop() {
    var pop = $('lp-theme-pop');
    if (pop && pop.parentNode) { pop.parentNode.removeChild(pop); }
  }
  function toggleThemePop() {
    var old = $('lp-theme-pop');
    if (old) { closeThemePop(); return; }
    var pop = document.createElement('div');
    pop.className = 'lp-theme-pop';
    pop.id = 'lp-theme-pop';
    var html = '';
    for (var i = 0; i < THEMES.length; i++) {
      var t = THEMES[i];
      html += '<button class="lp-dot' + (t.id === cfg.theme ? ' on' : '') + '" data-tid="' + t.id +
        '" title="' + t.name + '" style="background:' + t.a + '"></button>';
    }
    pop.innerHTML = html;
    pop.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('.lp-dot') : null;
      if (!b) { return; }
      var t = applyTheme(b.getAttribute('data-tid'));
      saveSettings();
      closeThemePop();
      toast('主题：' + t.name);
    });
    panel.appendChild(pop);
  }
  $('lp-theme').addEventListener('click', toggleThemePop);"""

OLD_DELEGATE_START = """  body.addEventListener('click', function (e) {
    try {
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;"""
NEW_DELEGATE_START = """  body.addEventListener('click', function (e) {
    try {
      /* 主题色板：点到别处自动收起 */
      var popNow = $('lp-theme-pop');
      if (popNow && !(e.target.closest && e.target.closest('.lp-theme-pop, #lp-theme'))) { closeThemePop(); }
      var btn = e.target.closest ? e.target.closest('[data-act]') : null;"""

OLD_BOOT = """  loadState();
  seedIfEmpty();
  applyChrome();
  renderAll();"""
NEW_BOOT = """  loadState();
  seedIfEmpty();
  applyTheme(cfg.theme);
  applyChrome();
  renderAll();"""

REPLACERS = [
    (OLD_HOST, NEW_HOST, 'host 变量'),
    (OLD_HIDDEN, NEW_HIDDEN, '色板样式'),
    (OLD_THEME_BTN, NEW_THEME_BTN, '主题按钮'),
    (OLD_SETTINGS_DEFAULT, NEW_SETTINGS_DEFAULT, '设置默认 theme'),
    (OLD_SETTINGS_READ, NEW_SETTINGS_READ, '读取 theme'),
    (OLD_WIDE_BIND, NEW_WIDE_BIND, '主题逻辑'),
    (OLD_DELEGATE_START, NEW_DELEGATE_START, '色板自动收起'),
    (OLD_BOOT, NEW_BOOT, '启动应用主题'),
]


def patch(path):
    with open(path, 'rb') as f:
        data = f.read().decode('utf-8')
    for old, new, name in REPLACERS:
        n = data.count(old)
        if n != 1:
            print('SKIP %s @ %s (count=%d)' % (name, path, n))
            continue
        data = data.replace(old, new)
        print('ok   %s @ %s' % (name, path))
    for hexv, varv in COLOR_MAP:
        print('     %s -> %s (%d 处)' % (hexv, varv, data.count(hexv)))
        data = data.replace(hexv, varv)
    with open(path, 'wb') as f:
        f.write(data.encode('utf-8'))


if __name__ == '__main__':
    patch('启动台浮窗.user.js')
    patch('extension/content.js')
    mf = 'extension/manifest.json'
    m = json.loads(open(mf, 'rb').read().decode('utf-8'))
    m['version'] = '2.0.6'
    open(mf, 'wb').write(json.dumps(m, ensure_ascii=False, indent=2).encode('utf-8'))
    print('manifest -> 2.0.6')
