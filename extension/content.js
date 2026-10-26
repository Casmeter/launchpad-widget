/* 启动台浮窗 · Chrome/Edge 扩展 content script
 * 与油猴版同款逻辑，差异仅在 API 垫层：
 *   GM_getValue / GM_setValue -> chrome.storage.sync
 *   GM_openInTab            -> window.open
 *   GM_registerMenuCommand  -> 不支持，用快捷键 Alt+L 代替
 */
(function () {
  'use strict';

  if (window.__lpWidgetLoaded) { return; }
  window.__lpWidgetLoaded = true;

  /* ============ API 垫层 ============ */
  var GM = {
    _mem: {},
    get: function (key, def) {
      var v = this._mem[key];
      return v === undefined || v === null ? def : v;
    },
    set: function (key, val) {
      this._mem[key] = val;
      try {
        var obj = {};
        obj[key] = val;
        chrome.storage.sync.set(obj, function () {
          void chrome.runtime.lastError;
        });
      } catch (e) { /* 忽略存储失败 */ }
    },
    openInTab: function (url) { window.open(url, '_blank'); }
  };
  try {
    chrome.storage.sync.get('cfg', function (res) {
      if (res && typeof res.cfg === 'string') { GM._mem.cfg = res.cfg; }
    });
  } catch (e) { /* 忽略 */ }

  /* ============ 配置 ============ */
  var PAGE_URL = 'https://workbuddy.link/p/F9nd8qHxsaobCHhkWVhE0E'; /* 启动台发布页 */
  var DEFAULTS = { x: -1, y: -1, w: 400, h: 580, open: false, wide: false };
  var WIDE = { w: 760, h: 640 };
  var MIN_W = 320, MIN_H = 440;

  function loadCfg() {
    var cfg = { x: DEFAULTS.x, y: DEFAULTS.y, w: DEFAULTS.w, h: DEFAULTS.h, open: DEFAULTS.open, wide: DEFAULTS.wide };
    try {
      var raw = GM.get('cfg', '');
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          if (typeof o.x === 'number') { cfg.x = o.x; }
          if (typeof o.y === 'number') { cfg.y = o.y; }
          if (typeof o.w === 'number' && o.w >= MIN_W) { cfg.w = o.w; }
          if (typeof o.h === 'number' && o.h >= MIN_H) { cfg.h = o.h; }
          if (typeof o.open === 'boolean') { cfg.open = o.open; }
          if (typeof o.wide === 'boolean') { cfg.wide = o.wide; }
        }
      }
    } catch (e) { /* 配置损坏则用默认值 */ }
    return cfg;
  }
  function saveCfg() { GM.set('cfg', JSON.stringify(cfg)); }
  var cfg = loadCfg();

  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }
  function clampPos() {
    cfg.w = Math.max(MIN_W, Math.min(cfg.w, Math.min(vw() - 24, 900)));
    cfg.h = Math.max(MIN_H, Math.min(cfg.h, Math.min(vh() - 24, 900)));
    if (cfg.x < 0 || cfg.x + cfg.w > vw() - 8) { cfg.x = Math.max(8, vw() - cfg.w - 24); }
    if (cfg.y < 0 || cfg.y + cfg.h > vh() - 8) { cfg.y = Math.max(8, vh() - cfg.h - 24); }
  }
  clampPos();

  /* ============ 样式（Shadow DOM 隔离，Metro 扁平化） ============ */
  var CSS = [
    ':host{all:initial}',
    '.lp-ball{position:fixed;right:22px;bottom:22px;width:46px;height:46px;background:#00BCF2;color:#fff;',
    '  display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2147483647;',
    '  border-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,.28);font-size:22px;line-height:1;user-select:none;',
    '  transition:transform .12s ease-out;font-family:"Segoe UI","Microsoft YaHei",sans-serif}',
    '.lp-ball:hover{transform:scale(1.08)}',
    '.lp-ball:active{transform:scale(.96)}',
    '.lp-panel{position:fixed;display:none;flex-direction:column;background:#fff;z-index:2147483647;',
    '  border-radius:4px;box-shadow:0 6px 28px rgba(0,0,0,.32);overflow:hidden;',
    '  font-family:"Segoe UI","Microsoft YaHei",sans-serif;border:1px solid #0aa9d6}',
    '.lp-panel.show{display:flex}',
    '.lp-head{flex:none;height:38px;background:#00BCF2;color:#fff;display:flex;align-items:center;',
    '  padding:0 4px 0 12px;cursor:move;user-select:none;gap:8px}',
    '.lp-title{font-size:13.5px;font-weight:600;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}',
    '.lp-btn{flex:none;border:0;background:transparent;color:#fff;font-size:12.5px;cursor:pointer;',
    '  padding:5px 8px;border-radius:2px;font-family:inherit;white-space:nowrap}',
    '.lp-btn:hover{background:rgba(255,255,255,.22)}',
    '.lp-body{flex:1;position:relative;background:#f4f5f9}',
    '.lp-frame{width:100%;height:100%;border:0;display:block;background:#f4f5f9}',
    '.lp-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;',
    '  gap:10px;color:#69707d;font-size:13px;background:#f4f5f9}',
    '.lp-spin{width:26px;height:26px;border:3px solid #d6dae6;border-top-color:#00BCF2;border-radius:50%;',
    '  animation:lp-rot .8s linear infinite}',
    '@keyframes lp-rot{to{transform:rotate(360deg)}}',
    '.lp-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;',
    '  background:linear-gradient(135deg,transparent 50%,#00BCF2 50%)}',
    '.lp-hidden{display:none!important}'
  ].join('\n');

  var HTML =
    '<div class="lp-ball" id="lp-ball" title="启动台（Alt+L 唤出/收起）">⚡</div>' +
    '<div class="lp-panel" id="lp-panel">' +
    '  <div class="lp-head" id="lp-head">' +
    '    <span class="lp-title">⚡ 启动台</span>' +
    '    <button class="lp-btn" id="lp-full" title="在新标签页打开完整看板">完整看板</button>' +
    '    <button class="lp-btn" id="lp-wide" title="宽窄切换（双击标题栏也可）">宽窄</button>' +
    '    <button class="lp-btn" id="lp-close" title="收起为悬浮球（Esc 同效）">—</button>' +
    '  </div>' +
    '  <div class="lp-body">' +
    '    <iframe class="lp-frame" id="lp-frame" src="' + PAGE_URL + '" allow="clipboard-write"></iframe>' +
    '    <div class="lp-loading" id="lp-loading"><div class="lp-spin"></div><div>正在加载启动台…</div></div>' +
    '    <div class="lp-grip" id="lp-grip" title="拖拽调整大小"></div>' +
    '  </div>' +
    '</div>';

  /* ============ 构建 UI ============ */
  var host = document.createElement('div');
  host.id = 'lp-widget-host';
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  shadow.appendChild(styleEl);
  var ui = document.createElement('div');
  ui.innerHTML = HTML;
  while (ui.firstChild) { shadow.appendChild(ui.firstChild); }
  (document.body || document.documentElement).appendChild(host);

  var ball = shadow.getElementById('lp-ball');
  var panel = shadow.getElementById('lp-panel');
  var head = shadow.getElementById('lp-head');
  var frame = shadow.getElementById('lp-frame');
  var loading = shadow.getElementById('lp-loading');
  var grip = shadow.getElementById('lp-grip');

  frame.addEventListener('load', function () {
    loading.classList.add('lp-hidden');
  });
  /* 5 秒兜底：壳页加载慢也先显示，避免转圈卡死小窗 */
  setTimeout(function () { loading.classList.add('lp-hidden'); }, 5000);

  function applyChrome() {
    clampPos();
    panel.style.left = cfg.x + 'px';
    panel.style.top = cfg.y + 'px';
    panel.style.width = cfg.w + 'px';
    panel.style.height = cfg.h + 'px';
    ball.style.right = '22px';
    ball.style.bottom = '22px';
    if (cfg.open) {
      panel.classList.add('show');
      ball.classList.add('lp-hidden');
    } else {
      panel.classList.remove('show');
      ball.classList.remove('lp-hidden');
    }
  }

  function setOpen(open) {
    cfg.open = !!open;
    saveCfg();
    applyChrome();
  }
  function toggle() { setOpen(!cfg.open); }

  ball.addEventListener('click', function () { setOpen(true); });
  shadow.getElementById('lp-close').addEventListener('click', function () { setOpen(false); });
  shadow.getElementById('lp-full').addEventListener('click', function () {
    GM.openInTab(PAGE_URL);
  });
  function toggleWide() {
    cfg.wide = !cfg.wide;
    if (cfg.wide) { cfg.w = WIDE.w; cfg.h = WIDE.h; } else { cfg.w = DEFAULTS.w; cfg.h = DEFAULTS.h; }
    saveCfg();
    applyChrome();
  }
  shadow.getElementById('lp-wide').addEventListener('click', toggleWide);
  if (cfg.wide) { cfg.w = WIDE.w; cfg.h = WIDE.h; }
  head.addEventListener('dblclick', function (e) {
    if (e.target && e.target.tagName === 'BUTTON') { return; }
    toggleWide();
  });

  /* ============ 拖拽移动 ============ */
  head.addEventListener('pointerdown', function (e) {
    if (e.target && e.target.tagName === 'BUTTON') { return; }
    var sx = e.clientX, sy = e.clientY, ox = cfg.x, oy = cfg.y;
    head.setPointerCapture(e.pointerId);
    function move(ev) {
      cfg.x = Math.max(0, Math.min(ox + ev.clientX - sx, vw() - 80));
      cfg.y = Math.max(0, Math.min(oy + ev.clientY - sy, vh() - 48));
      panel.style.left = cfg.x + 'px';
      panel.style.top = cfg.y + 'px';
    }
    function up() {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
      head.removeEventListener('pointercancel', up);
      saveCfg();
    }
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', up);
    e.preventDefault();
  });

  /* ============ 拖拽缩放 ============ */
  grip.addEventListener('pointerdown', function (e) {
    var sx = e.clientX, sy = e.clientY, ow = cfg.w, oh = cfg.h;
    grip.setPointerCapture(e.pointerId);
    function move(ev) {
      cfg.w = Math.max(MIN_W, Math.min(ow + ev.clientX - sx, Math.min(vw() - 24, 900)));
      cfg.h = Math.max(MIN_H, Math.min(oh + ev.clientY - sy, Math.min(vh() - 24, 900)));
      panel.style.width = cfg.w + 'px';
      panel.style.height = cfg.h + 'px';
    }
    function up() {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      saveCfg();
    }
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
    e.preventDefault();
    e.stopPropagation();
  });

  /* ============ 快捷键 ============ */
  document.addEventListener('keydown', function (e) {
    if (e.altKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'Escape' && cfg.open) {
      setOpen(false);
    }
  });

  /* ============ 窗口缩放时保持在视口内 ============ */
  window.addEventListener('resize', function () {
    clampPos();
    panel.style.left = cfg.x + 'px';
    panel.style.top = cfg.y + 'px';
    panel.style.width = cfg.w + 'px';
    panel.style.height = cfg.h + 'px';
  });

  applyChrome();
})();
