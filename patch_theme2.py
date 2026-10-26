# -*- coding: utf-8 -*-
"""v2.0.7：插件版主题改用网页版同款 8 套色卡（用户给的参考配色），
并修复 :host 默认值被全局替换成自引用的问题；色点按三色卡显示。"""

OLD_HOST = "    ':host{all:initial;--lp-accent:var(--lp-accent);--lp-accent-d:var(--lp-accent-d);--lp-accent-l:var(--lp-accent-l)}',"
NEW_HOST = "    ':host{all:initial;--lp-accent:#00BCF2;--lp-accent-d:#0093BF;--lp-accent-l:#b3e5f8;--lp-bg:#EFEFF2}',"

OLD_PANEL_BG = "    '.lp-panel{position:fixed;display:none;flex-direction:column;background:#f4f5f9;z-index:2147483647;',"
NEW_PANEL_BG = "    '.lp-panel{position:fixed;display:none;flex-direction:column;background:var(--lp-bg);z-index:2147483647;',"

OLD_THEMES = """  var THEMES = [
    { id: 'azure', name: '晴空蓝', a: '#00BCF2', d: '#0aa9d6', l: '#b3e5f8' },
    { id: 'teal', name: '薄荷青', a: '#00A99D', d: '#00796B', l: '#B2DFDB' },
    { id: 'green', name: '嫩芽绿', a: '#60A917', d: '#3F7A0B', l: '#C5E1A5' },
    { id: 'amber', name: '琥珀橙', a: '#FA6800', d: '#C94A00', l: '#FFCCBC' },
    { id: 'purple', name: '暮色紫', a: '#7B4FBE', d: '#4E1F5F', l: '#D1C4E9' },
    { id: 'rose', name: '玫红', a: '#E3008C', d: '#A00063', l: '#F8BBD0' }
  ];"""

# 与网页版 启动台.html 的 THEMES 完全一致（用户参考色卡），l = focus 用的浅色
NEW_THEMES = """  var THEMES = [
    { id: 'metro',     name: 'Metro 蓝',  a: '#00BCF2', d: '#0093BF', bg: '#EFEFF2', l: '#b3e5f8' },
    { id: 'dusk',      name: '暮色紫',    a: '#84709B', d: '#464879', bg: '#E8E9F0', l: '#D6D2E4' },
    { id: 'peach',     name: '蜜桃粉',    a: '#E8607A', d: '#A03A50', bg: '#F6EEEA', l: '#F8D3DA' },
    { id: 'lagoon',    name: '海湖蓝',    a: '#3E7D9C', d: '#2A556B', bg: '#EAF2F4', l: '#C9DEE7' },
    { id: 'sunset',    name: '落日橙',    a: '#E8720C', d: '#A34F00', bg: '#FBF3E8', l: '#FADFC1' },
    { id: 'bubblegum', name: '泡泡糖',    a: '#E75A9C', d: '#A03A6C', bg: '#FDF0F6', l: '#F9CFE0' },
    { id: 'sumi',      name: '品牌红黑',  a: '#E4002B', d: '#1C1C1E', bg: '#F2EFE9', l: '#F5C7CE' },
    { id: 'bamboo',    name: '竹米绿',    a: '#7A9464', d: '#4C623D', bg: '#F2EFE3', l: '#D8E2CC' }
  ];"""

OLD_APPLY = "    host.style.setProperty('--lp-accent-l', t.l);"
NEW_APPLY = """    host.style.setProperty('--lp-accent-l', t.l);
    host.style.setProperty('--lp-bg', t.bg);"""

OLD_DEFAULT_THEME = "    var s = { w: 400, h: 580, x: -1, y: -1, open: false, wide: false, theme: 'azure' };"
NEW_DEFAULT_THEME = "    var s = { w: 400, h: 580, x: -1, y: -1, open: false, wide: false, theme: 'metro' };"

OLD_DOT = """        '" title="' + t.name + '" style="background:' + t.a + '"></button>';"""
NEW_DOT = """        '" title="' + t.name + '（' + t.a + ' / ' + t.d + ' / ' + t.bg + '）" style="background:linear-gradient(135deg,' +
        t.a + ' 0 34%,' + t.d + ' 34% 67%,' + t.bg + ' 67% 100%)"></button>';"""

REPLACERS = [
    (OLD_HOST, NEW_HOST, 'host 默认值修复'),
    (OLD_PANEL_BG, NEW_PANEL_BG, '面板底色变量化'),
    (OLD_THEMES, NEW_THEMES, '8 套色卡'),
    (OLD_APPLY, NEW_APPLY, '应用底色'),
    (OLD_DEFAULT_THEME, NEW_DEFAULT_THEME, '默认 metro'),
    (OLD_DOT, NEW_DOT, '色点显示三色卡'),
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
    with open(path, 'wb') as f:
        f.write(data.encode('utf-8'))


if __name__ == '__main__':
    patch('启动台浮窗.user.js')
    patch('extension/content.js')
