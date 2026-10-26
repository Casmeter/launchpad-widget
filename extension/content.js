/* 启动台浮窗 · 本地版 content script（Chrome/Edge 扩展）
 * 数据存 chrome.storage.sync（同一浏览器跨站共享，可多设备经浏览器账号同步），
 * 不依赖任何平台账号。逻辑与油猴版一致，差异仅在存储垫层。
 */
(function () {
  'use strict';

  if (window.__lpWidgetLoaded) { return; }
  window.__lpWidgetLoaded = true;

  /* ================================================================
   * 存储层：chrome.storage.sync（异步恢复 + 内存缓存同步读）
   * ================================================================ */
  var STORE_KEY = 'lp_widget_state_v1';
  var LS_KEY_SETTINGS = 'lp_widget_settings_v1';
  var memFallback = {};
  var onRestored = null;

  var store = {
    get: function () {
      return memFallback[STORE_KEY] || '';
    },
    set: function (json) {
      memFallback[STORE_KEY] = json;
      try {
        var obj = {};
        obj[STORE_KEY] = json;
        chrome.storage.sync.set(obj, function () { void chrome.runtime.lastError; });
      } catch (e) { /* 内存兜底 */ }
    },
    getSettings: function () {
      return memFallback[LS_KEY_SETTINGS] || '';
    },
    setSettings: function (json) {
      memFallback[LS_KEY_SETTINGS] = json;
      try {
        var obj = {};
        obj[LS_KEY_SETTINGS] = json;
        chrome.storage.sync.set(obj, function () { void chrome.runtime.lastError; });
      } catch (e) { /* 内存兜底 */ }
    }
  };
  try {
    chrome.storage.sync.get([STORE_KEY, LS_KEY_SETTINGS], function (res) {
      if (res && typeof res[STORE_KEY] === 'string') { memFallback[STORE_KEY] = res[STORE_KEY]; }
      if (res && typeof res[LS_KEY_SETTINGS] === 'string') { memFallback[LS_KEY_SETTINGS] = res[LS_KEY_SETTINGS]; }
      if (onRestored) { onRestored(); }
    });
  } catch (e) { /* 忽略 */

  }

  /* ================================================================
   * 数据模型与纯函数
   * ================================================================ */
  var KIND_VIDEO = 'video';

  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1); if (m.length < 2) { m = '0' + m; }
    var day = String(d.getDate()); if (day.length < 2) { day = '0' + day; }
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function shiftDate(dateStr, days) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    var m = String(d.getMonth() + 1); if (m.length < 2) { m = '0' + m; }
    var day = String(d.getDate()); if (day.length < 2) { day = '0' + day; }
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function uid() {
    return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function checkinSet(entry) {
    var s = {};
    var list = entry.checkins || [];
    for (var i = 0; i < list.length; i++) { s[list[i]] = true; }
    return s;
  }
  /* 队列状态：overdue 逾期顺延 / due 今天该启动 / upcoming 还没到点 / done 今日已打卡 / off 已停用 */
  function queueStatus(entry, today, nowMin) {
    if (!entry.enabled) { return 'off'; }
    var set = checkinSet(entry);
    if (set[today]) { return 'done'; }
    var list = (entry.checkins || []).slice().sort();
    if (list.length) {
      var last = list[list.length - 1];
      if (last >= today) { return 'done'; }
      if (last < shiftDate(today, -1)) { return 'overdue'; }
      return 'due';
    }
    if (entry.time && nowMin >= entry.time) { return 'due'; }
    return 'upcoming';
  }
  function progressOf(entry, today) {
    var set = checkinSet(entry);
    var days = [];
    var weekDone = 0;
    for (var i = 6; i >= 0; i--) {
      var d = shiftDate(today, -i);
      var done = !!set[d];
      if (done) { weekDone++; }
      days.push({ date: d, done: done });
    }
    var streak = 0;
    var cursor = today;
    if (!set[cursor]) { cursor = shiftDate(today, -1); }
    while (set[cursor]) { streak++; cursor = shiftDate(cursor, -1); }
    return { weekDone: weekDone, weekGoal: entry.goal || 0, streak: streak, days: days };
  }
  function nowMinutes() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ================================================================
   * 状态读写
   * ================================================================ */
  var state = { entries: [], memos: {}, seeded: false };

  function loadState() {
    var raw = store.get();
    if (raw) {
      try {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          if (Object.prototype.toString.call(o.entries) === '[object Array]') { state.entries = o.entries; }
          if (o.memos && typeof o.memos === 'object') { state.memos = o.memos; }
          state.seeded = !!o.seeded;
        }
      } catch (e) { /* 数据损坏则重置 */ }
    }
    state.entries.forEach(normalizeEntry);
  }
  function normalizeEntry(e) {
    if (!e || typeof e !== 'object') { return; }
    if (!e.id) { e.id = uid(); }
    if (typeof e.name !== 'string') { e.name = ''; }
    e.kind = KIND_VIDEO;
    if (typeof e.target !== 'string') { e.target = ''; }
    if (typeof e.time !== 'string' || !/^\d{2}:\d{2}$/.test(e.time)) { e.time = ''; }
    if (typeof e.goal !== 'number' || e.goal < 0) { e.goal = 0; }
    if (Object.prototype.toString.call(e.checkins) !== '[object Array]') { e.checkins = []; }
    if (typeof e.note !== 'string') { e.note = ''; }
    if (typeof e.enabled !== 'boolean') { e.enabled = true; }
    if (typeof e.order !== 'number') { e.order = 0; }
  }
  function saveState() {
    store.set(JSON.stringify({
      entries: state.entries, memos: state.memos, seeded: state.seeded
    }));
  }
  function loadSettings() {
    var s = { w: 400, h: 580, x: -1, y: -1, open: false, wide: false };
    try {
      var raw = store.getSettings();
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          if (typeof o.w === 'number') { s.w = o.w; }
          if (typeof o.h === 'number') { s.h = o.h; }
          if (typeof o.x === 'number') { s.x = o.x; }
          if (typeof o.y === 'number') { s.y = o.y; }
          if (typeof o.open === 'boolean') { s.open = o.open; }
          if (typeof o.wide === 'boolean') { s.wide = o.wide; }
        }
      }
    } catch (e) { /* 用默认 */ }
    return s;
  }
  function saveSettings() {
    store.setSettings(JSON.stringify(cfg));
  }

  /* ================================================================
   * 示例数据（首次打开自动播种，含 1 条逾期项演示顺延）
   * ================================================================ */
  function seedIfEmpty() {
    if (state.seeded || state.entries.length) { return; }
    var t = todayStr();
    state.entries = [
      { id: uid(), name: '日语口语', kind: KIND_VIDEO, target: 'https://www.bilibili.com/video/BV1Gs4y1x7Yb', time: '09:00', goal: 5, checkins: [shiftDate(t, -2), shiftDate(t, -4)], note: '每天 15 分钟，跟着视频读', enabled: true, order: 0 },
      { id: uid(), name: '健身操', kind: KIND_VIDEO, target: 'https://www.bilibili.com/video/BV1sK4y1t7Art', time: '18:30', goal: 4, checkins: [shiftDate(t, -1)], note: '', enabled: true, order: 1 },
    ];
    state.seeded = true;
    saveState();
  }

  /* ================================================================
   * 样式（Shadow DOM 隔离，Metro 扁平化）
   * ================================================================ */
  var CSS = [
    ':host{all:initial}',
    '.lp-ball{position:fixed;right:22px;bottom:22px;width:46px;height:46px;background:#00BCF2;color:#fff;',
    '  display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:2147483647;',
    '  border-radius:4px;box-shadow:0 2px 10px rgba(0,0,0,.28);font-size:22px;line-height:1;user-select:none;',
    '  transition:transform .12s ease-out;font-family:"Segoe UI","Microsoft YaHei",sans-serif}',
    '.lp-ball:hover{transform:scale(1.08)}',
    '.lp-ball:active{transform:scale(.96)}',
    '.lp-panel{position:fixed;display:none;flex-direction:column;background:#f4f5f9;z-index:2147483647;',
    '  border-radius:4px;box-shadow:0 6px 28px rgba(0,0,0,.32);overflow:hidden;',
    '  font-family:"Segoe UI","Microsoft YaHei",sans-serif;border:1px solid #0aa9d6;color:#1f2329}',
    '.lp-panel.show{display:flex}',
    '.lp-head{flex:none;height:38px;background:#00BCF2;color:#fff;display:flex;align-items:center;',
    '  padding:0 4px 0 12px;cursor:move;user-select:none;gap:6px}',
    '.lp-title{font-size:13.5px;font-weight:600;letter-spacing:.3px;white-space:nowrap;flex:1}',
    '.lp-btn{flex:none;border:0;background:transparent;color:#fff;font-size:12.5px;cursor:pointer;',
    '  padding:5px 8px;border-radius:2px;font-family:inherit;white-space:nowrap}',
    '.lp-btn:hover{background:rgba(255,255,255,.22)}',
    '.lp-body{flex:1;overflow-y:auto;padding:12px;font-size:13.5px}',
    '.lp-summary{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px;gap:8px}',
    '.lp-summary .d{font-size:12.5px;color:#69707d;font-variant-numeric:tabular-nums}',
    '.lp-summary .t{font-size:14px;font-weight:600}',
    '.lp-q{display:flex;align-items:center;gap:8px;background:#fff;border-left:5px solid #00BCF2;',
    '  padding:9px 10px;margin-bottom:7px;border-radius:2px;box-shadow:0 1px 3px rgba(16,24,40,.06)}',
    '.lp-q.overdue{border-left-color:#E51400}',
    '.lp-q.due{border-left-color:#FA6800}',
    '.lp-q.upcoming{border-left-color:#00BCF2}',
    '.lp-q.done{border-left-color:#8a919e;opacity:.72}',
    '.lp-q-main{flex:1;min-width:0}',
    '.lp-q-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.lp-q.done .lp-q-name{text-decoration:line-through}',
    '.lp-q-meta{font-size:11.5px;color:#69707d;margin-top:2px}',
    '.lp-q.overdue .lp-q-meta{color:#E51400;font-weight:600}',
    '.lp-q.due .lp-q-meta{color:#FA6800;font-weight:600}',
    '.lp-q-acts{display:flex;gap:5px;flex:none}',
    '.lp-act{border:0;border-radius:2px;padding:6px 10px;font-size:12.5px;cursor:pointer;font-family:inherit;white-space:nowrap}',
    '.lp-act.go{background:#00BCF2;color:#fff}',
    '.lp-act.go:hover{background:#00a8d6}',
    '.lp-act.go.local{background:#00B294}',
    '.lp-act.go.local:hover{background:#009a80}',
    '.lp-act.ck{background:#eef0f5;color:#1f2329}',
    '.lp-act.ck:hover{background:#e0e4ec}',
    '.lp-act.ck.on{background:#00B294;color:#fff}',
    '.lp-sect{margin:14px 0 8px;font-size:12px;font-weight:600;color:#69707d;letter-spacing:.5px}',
    '.lp-prog{display:flex;align-items:center;gap:12px;background:#fff;padding:10px 12px;border-radius:2px;box-shadow:0 1px 3px rgba(16,24,40,.06)}',
    '.lp-prog .num{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums}',
    '.lp-prog .lbl{font-size:11.5px;color:#69707d}',
    '.lp-week{display:flex;gap:3px;align-items:flex-end;height:26px;margin-left:auto}',
    '.lp-week i{display:block;width:9px;background:#dfe3ee;border-radius:1px}',
    '.lp-week i.on{background:#00BCF2}',
    '.lp-week i.today{outline:1px solid #FA6800}',
    '.lp-memo{width:100%;min-height:88px;resize:vertical;font-family:inherit;font-size:13.5px;line-height:1.6;',
    '  padding:9px 10px;border:1px solid #dfe3ee;border-radius:2px;background:#fff;color:#1f2329;box-sizing:border-box}',
    '.lp-memo:focus{outline:2px solid #b3e5f8;border-color:#00BCF2}',
    '.lp-memo-status{font-size:11.5px;color:#00B294;min-height:15px;margin-top:3px}',
    '.lp-hist{margin-top:6px}',
    '.lp-hist-item{display:flex;gap:8px;padding:7px 9px;background:#fff;border-radius:2px;margin-bottom:5px;font-size:12.5px}',
    '.lp-hist-item .dt{flex:none;width:82px;color:#69707d;font-variant-numeric:tabular-nums}',
    '.lp-hist-item .tx{flex:1;white-space:pre-wrap;word-break:break-word}',
    '.lp-tools{display:flex;flex-wrap:wrap;gap:5px;margin-top:14px}',
    '.lp-tool{border:1px solid #dfe3ee;background:#fff;color:#1f2329;border-radius:2px;padding:6px 10px;',
    '  font-size:12px;cursor:pointer;font-family:inherit}',
    '.lp-tool:hover{border-color:#00BCF2;color:#00BCF2}',
    '.lp-tool.danger:hover{border-color:#E51400;color:#E51400}',
    '.lp-empty{text-align:center;color:#69707d;font-size:13px;padding:26px 10px;background:#fff;border-radius:2px}',
    '.lp-mask{position:absolute;inset:0;background:rgba(15,18,30,.45);display:flex;align-items:center;',
    '  justify-content:center;padding:14px;z-index:10}',
    '.lp-modal{background:#fff;border-radius:4px;width:100%;max-height:100%;overflow-y:auto;padding:16px}',
    '.lp-modal h3{font-size:15px;margin:0 0 10px}',
    '.lp-field{margin-top:10px}',
    '.lp-field label{display:block;font-size:12px;color:#69707d;margin-bottom:3px}',
    '.lp-field input,.lp-field select{width:100%;font-size:14px;padding:8px 10px;border:1px solid #dfe3ee;',
    '  border-radius:2px;font-family:inherit;box-sizing:border-box;background:#fff;color:#1f2329}',
    '.lp-field input:focus,.lp-field select:focus{outline:2px solid #b3e5f8;border-color:#00BCF2}',
    '.lp-check{display:flex;align-items:center;gap:7px;margin-top:12px;font-size:13.5px}',
    '.lp-check input{width:16px;height:16px}',
    '.lp-modal-acts{display:flex;gap:6px;margin-top:16px;flex-wrap:wrap}',
    '.lp-modal-acts .sp{flex:1}',
    '.lp-mact{border:0;border-radius:2px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:inherit}',
    '.lp-mact.pri{background:#00BCF2;color:#fff}',
    '.lp-mact.sec{background:#eef0f5;color:#1f2329}',
    '.lp-mact.del{background:#fff;color:#E51400;border:1px solid #f0c8ca}',
    '.lp-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:#23272f;color:#fff;',
    '  padding:9px 15px;border-radius:3px;font-size:13px;z-index:20;white-space:nowrap;max-width:92%;',
    '  overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 14px rgba(0,0,0,.25)}',
    '.lp-toast.err{background:#b3261e}',
    '.lp-grip{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;',
    '  background:linear-gradient(135deg,transparent 50%,#00BCF2 50%)}',
    '.lp-hidden{display:none!important}'
  ].join('\n');

  /* ================================================================
   * UI 骨架
   * ================================================================ */
  var cfg = loadSettings();
  var MIN_W = 320, MIN_H = 440, WIDE_W = 760, WIDE_H = 640;

  function clampCfg() {
    cfg.w = Math.max(MIN_W, Math.min(cfg.w, Math.min(window.innerWidth - 24, 900)));
    cfg.h = Math.max(MIN_H, Math.min(cfg.h, Math.min(window.innerHeight - 24, 900)));
    if (cfg.x < 0 || cfg.x + cfg.w > window.innerWidth - 8) { cfg.x = Math.max(8, window.innerWidth - cfg.w - 24); }
    if (cfg.y < 0 || cfg.y + cfg.h > window.innerHeight - 8) { cfg.y = Math.max(8, window.innerHeight - cfg.h - 24); }
  }
  if (cfg.wide) { cfg.w = WIDE_W; cfg.h = WIDE_H; }
  clampCfg();

  var host = document.createElement('div');
  host.id = 'lp-widget-host';
  host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;';
  var shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  shadow.appendChild(styleEl);

  var ui = document.createElement('div');
  ui.innerHTML =
    '<div class="lp-ball" id="lp-ball" title="启动台（Alt+L 唤出/收起）">⚡</div>' +
    '<div class="lp-panel" id="lp-panel">' +
    '  <div class="lp-head" id="lp-head">' +
    '    <span class="lp-title">⚡ 启动台</span>' +
    '    <button class="lp-btn" id="lp-add" title="添加入口">+ 添加</button>' +
    '    <button class="lp-btn" id="lp-wide" title="宽窄切换（双击标题栏也可）">宽窄</button>' +
    '    <button class="lp-btn" id="lp-close" title="收起为悬浮球（Esc 同效）">—</button>' +
    '  </div>' +
    '  <div class="lp-body" id="lp-body"></div>' +
    '  <div class="lp-grip" id="lp-grip" title="拖拽调整大小"></div>' +
    '</div>';
  while (ui.firstChild) { shadow.appendChild(ui.firstChild); }
  (document.body || document.documentElement).appendChild(host);

  var ball = shadow.getElementById('lp-ball');
  var panel = shadow.getElementById('lp-panel');
  var head = shadow.getElementById('lp-head');
  var body = shadow.getElementById('lp-body');
  var grip = shadow.getElementById('lp-grip');

  function $(id) { return shadow.getElementById(id); }

  /* ================================================================
   * 渲染层
   * ================================================================ */
  function queueEntries() {
    var today = todayStr();
    var nm = nowMinutes();
    var out = [];
    state.entries.forEach(function (e) {
      var st = queueStatus(e, today, nm);
      if (st === 'off') { return; }
      out.push({ entry: e, status: st });
    });
    var rank = { overdue: 0, due: 1, upcoming: 2, done: 3 };
    out.sort(function (a, b) {
      if (rank[a.status] !== rank[b.status]) { return rank[a.status] - rank[b.status]; }
      return (a.entry.order || 0) - (b.entry.order || 0);
    });
    return out;
  }

  function overdueDays(entry, today) {
    var list = (entry.checkins || []).slice().sort();
    if (!list.length) { return 0; }
    var last = list[list.length - 1];
    var days = 0;
    var cursor = shiftDate(today, -1);
    while (cursor >= last && days < 999) { days++; cursor = shiftDate(cursor, -1); }
    return days;
  }

  function renderQueue() {
    var today = todayStr();
    var q = queueEntries();
    var dueCount = 0;
    q.forEach(function (x) { if (x.status === 'overdue' || x.status === 'due') { dueCount++; } });

    var html = '<div class="lp-summary"><span class="t">今天待处理 ' + dueCount + ' 项</span>' +
      '<span class="d">' + today + '</span></div>';

    if (!q.length) {
      html += '<div class="lp-empty">还没有任何入口<br>点右上角「+ 添加」创建第一个目标</div>';
      return html;
    }
    q.forEach(function (x) {
      var e = x.entry, st = x.status;
      var meta = '';
      if (st === 'overdue') { meta = '已顺延 ' + overdueDays(e, today) + ' 天 · ' + (e.time || '未设时间'); }
      else if (st === 'due') { meta = (e.time || '现在') + ' 该启动了'; }
      else if (st === 'upcoming') { meta = e.time + ' 提醒'; }
      else { meta = '已完成 · ' + (e.time || ''); }
      html += '<div class="lp-q ' + st + '" data-id="' + e.id + '">' +
        '<div class="lp-q-main">' +
        '<div class="lp-q-name">' + escHtml(e.name || '未命名') + '</div>' +
        '<div class="lp-q-meta">' + escHtml(meta) + '</div>' +
        '</div>' +
        '<div class="lp-q-acts">' +
        (st === 'done' ? '' :
          '<button class="lp-act go" data-act="launch" data-id="' + e.id + '">看视频</button>') +
        '<button class="lp-act ck' + (st === 'done' ? ' on' : '') + '" data-act="checkin" data-id="' + e.id + '">' +
        (st === 'done' ? '已打卡' : '打卡') + '</button>' +
        '<button class="lp-act ck" data-act="edit" data-id="' + e.id + '" title="编辑">✎</button>' +
        '</div></div>';
    });
    return html;
  }

  function renderProgress() {
    var today = todayStr();
    var items = state.entries.filter(function (e) { return e.enabled; });
    if (!items.length) { return ''; }
    var html = '<div class="lp-sect">本周进度</div>';
    items.slice(0, 6).forEach(function (e) {
      var p = progressOf(e, today);
      var bars = '';
      p.days.forEach(function (d) {
        var h = d.done ? 26 : 8;
        bars += '<i class="' + (d.done ? 'on' : '') + (d.date === today ? ' today' : '') + '" style="height:' + h + 'px" title="' + d.date + '"></i>';
      });
      html += '<div class="lp-prog" data-id="' + e.id + '">' +
        '<div><div class="num">' + p.weekDone + '/' + (p.weekGoal || '∞') + '</div><div class="lbl">本周打卡</div></div>' +
        '<div><div class="num">' + p.streak + '</div><div class="lbl">连续天数</div></div>' +
        '<div class="lp-week">' + bars + '</div></div>';
    });
    if (items.length > 6) {
      html += '<div class="lp-q-meta" style="margin-top:5px">还有 ' + (items.length - 6) + ' 个入口的进度未显示（停用的不统计）</div>';
    }
    return html;
  }

  function renderMemo() {
    var today = todayStr();
    var text = state.memos[today] || '';
    var html = '<div class="lp-sect">今日备忘</div>' +
      '<textarea class="lp-memo" id="lp-memo" placeholder="写点今天的想法、待记的事…（自动保存）">' + escHtml(text) + '</textarea>' +
      '<div class="lp-memo-status" id="lp-memo-status"></div>';
    var dates = Object.keys(state.memos).filter(function (d) { return d !== today && state.memos[d]; }).sort().reverse().slice(0, 5);
    if (dates.length) {
      html += '<div class="lp-hist">';
      dates.forEach(function (d) {
        html += '<div class="lp-hist-item"><span class="dt">' + d + '</span><span class="tx">' + escHtml(state.memos[d]) + '</span></div>';
      });
      html += '</div>';
    }
    return html;
  }

  function renderTools() {
    return '<div class="lp-tools">' +
      '<button class="lp-tool" data-act="export">导出备份</button>' +
      '<button class="lp-tool" data-act="import">导入恢复</button>' +
      '<button class="lp-tool" data-act="reseed">载入示例</button>' +
      '<button class="lp-tool danger" data-act="clear">清空数据</button>' +
      '</div>' +
      '<div class="lp-q-meta" style="margin-top:8px">数据只保存在本浏览器（chrome.storage.sync，可随浏览器账号同步），不上传任何平台。清缓存前请先「导出备份」。</div>';
  }

  function renderAll() {
    var html = renderQueue() + renderProgress() + renderMemo() + renderTools();
    body.innerHTML = html;
    bindBodyEvents();
    var q = queueEntries();
    var need = q.filter(function (x) { return x.status === 'due' || x.status === 'overdue'; }).length;
    if (need && !renderAll._warned) {
      renderAll._warned = true;
      toast('今天有 ' + need + ' 项待启动，加油');
    }
  }

  /* ================================================================
   * 交互
   * ================================================================ */
  var memoTimer = null;

  function bindBodyEvents() {
    var memo = $('lp-memo');
    if (memo) {
      memo.addEventListener('input', function () {
        var status = $('lp-memo-status');
        if (status) { status.textContent = '保存中…'; }
        if (memoTimer) { clearTimeout(memoTimer); }
        memoTimer = setTimeout(function () {
          state.memos[todayStr()] = memo.value;
          saveState();
          if (status) { status.textContent = '已自动保存 ' + new Date().toTimeString().slice(0, 5); }
        }, 300);
      });
    }
  }

  body.addEventListener('click', function (e) {
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
  });

  function findEntry(id) {
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].id === id) { return state.entries[i]; }
    }
    return null;
  }

  function toggleCheckin(id) {
    var e = findEntry(id);
    if (!e) { return; }
    var today = todayStr();
    var idx = e.checkins.indexOf(today);
    if (idx >= 0) { e.checkins.splice(idx, 1); toast('已取消打卡'); }
    else { e.checkins.push(today); toast('打卡成功，连续 ' + progressOf(e, today).streak + ' 天'); }
    saveState();
    renderAll();
  }

  function launchEntry(id) {
    var e = findEntry(id);
    if (!e) { return; }
    if (!e.target) { toast('还没有填视频链接，先编辑', true); openEditor(id); return; }
    {
      var a = document.createElement('a');
      a.href = e.target;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast('已打开视频链接');
    }
  }


  function openEditor(id) {
    /* v2.0.4 防弹：打开失败直接在面板上显示错误，不再静默无反应 */
    try {
      openEditorInner(id);
    } catch (err) {
      console.error('[launchpad] openEditor failed:', err);
      try { toast('编辑器打开失败: ' + ((err && err.message) || err), true); } catch (x) {}
    }
  }
  function openEditorInner(id) {
    editingId = id || null;
    var e = id ? findEntry(id) : null;
    var mask = document.createElement('div');
    mask.className = 'lp-mask';
    mask.id = 'lp-editor-mask';
    mask.innerHTML =
      '<div class="lp-modal">' +
      '<h3>' + (e ? '编辑入口' : '添加入口') + '</h3>' +
      '<div class="lp-field"><label>名称</label><input id="lp-f-name" type="text" maxlength="40" placeholder="例如：日语口语" value="' + escHtml(e ? e.name : '') + '"></div>' +
      '<div class="lp-field"><label>类型</label><select id="lp-f-kind">' +
      '<option value="video" selected>视频（填链接）</option>' +
      '</select></div>' +
      '<div class="lp-field"><label id="lp-f-target-label">视频链接</label>' +
      '<input id="lp-f-target" type="text" placeholder="https://..." value="' + escHtml(e ? e.target : '') + '"></div>' +
      '<div class="lp-field"><label>提醒时间（每天）</label><input id="lp-f-time" type="time" value="' + escHtml(e ? e.time : '') + '"></div>' +
      '<div class="lp-field"><label>每周目标天数</label><input id="lp-f-goal" type="number" min="0" max="7" value="' + (e ? e.goal : 5) + '"></div>' +
      '<div class="lp-field"><label>备注</label><input id="lp-f-note" type="text" maxlength="80" placeholder="选填" value="' + escHtml(e ? e.note : '') + '"></div>' +
      '<label class="lp-check"><input id="lp-f-enabled" type="checkbox"' + (!e || e.enabled ? ' checked' : '') + '>启用这个入口</label>' +
      '<div class="lp-modal-acts">' +
      (e ? '<button class="lp-mact del" id="lp-f-delete">删除</button>' : '') +
      '<span class="sp"></span>' +
      '<button class="lp-mact sec" id="lp-f-cancel">取消</button>' +
      '<button class="lp-mact pri" id="lp-f-save">保存</button>' +
      '</div></div>';
    panel.appendChild(mask);
    $('lp-f-cancel').addEventListener('click', closeEditor);
    mask.addEventListener('click', function (ev) { if (ev.target === mask) { closeEditor(); } });
    $('lp-f-save').addEventListener('click', saveEditor);
    if (e) { $('lp-f-delete').addEventListener('click', deleteEntry); }
    $('lp-f-name').focus();
  }

  function closeEditor() {
    var mask = $('lp-editor-mask');
    if (mask) { mask.parentNode.removeChild(mask); }
    editingId = null;
  }

  function saveEditor() {
    var name = $('lp-f-name').value.trim();
    if (!name) { toast('名称不能为空', true); $('lp-f-name').focus(); return; }
    var kind = KIND_VIDEO;
    var target = $('lp-f-target').value.trim();
    var time = $('lp-f-time').value || '';
    var goal = parseInt($('lp-f-goal').value, 10);
    if (isNaN(goal) || goal < 0) { goal = 0; }
    if (goal > 7) { goal = 7; }
    var note = $('lp-f-note').value.trim();
    var enabled = $('lp-f-enabled').checked;

    if (editingId) {
      var e = findEntry(editingId);
      if (e) {
        e.name = name; e.kind = kind; e.target = target; e.time = time;
        e.goal = goal; e.note = note; e.enabled = enabled;
        toast('已保存');
      }
    } else {
      state.entries.push({
        id: uid(), name: name, kind: kind, target: target, time: time,
        goal: goal, checkins: [], note: note, enabled: enabled, order: state.entries.length
      });
      state.seeded = true;
      toast('已添加「' + name + '」');
    }
    saveState();
    closeEditor();
    renderAll();
  }

  function deleteEntry() {
    if (!editingId) { return; }
    var e = findEntry(editingId);
    var name = e ? e.name : '';
    if (!window.confirm('确定删除「' + name + '」？打卡记录也会一起删掉。')) { return; }
    state.entries = state.entries.filter(function (x) { return x.id !== editingId; });
    saveState();
    closeEditor();
    renderAll();
    toast('已删除');
  }

  /* ---------- 导入 / 导出 / 示例 / 清空 ---------- */
  function exportJSON() {
    var data = {
      app: 'launchpad-local', version: 1, exportedAt: new Date().toISOString(),
      entries: state.entries, memos: state.memos
    };
    try {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '启动台备份-' + todayStr() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      toast('备份已下载');
    } catch (err) {
      toast('导出失败：' + err.message, true);
    }
  }

  function importJSON() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) { document.body.removeChild(inp); return; }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          applyImport(data);
        } catch (err) {
          toast('导入失败：文件不是有效 JSON', true);
        }
        document.body.removeChild(inp);
      };
      reader.readAsText(f);
    });
    inp.click();
  }

  /* 兼容两种格式：本地版导出 {entries,memos}；旧 WorkBuddy 看板导出 {rows:[{名称,类型,链接或路径,...}]} */
  function applyImport(data) {
    var added = 0;
    if (data && Object.prototype.toString.call(data.entries) === '[object Array]') {
      data.entries.forEach(function (raw) {
        var e = {};
        e.id = raw.id || uid();
        e.name = raw.name || raw['名称'] || '';
        e.kind = KIND_VIDEO;
        e.target = raw.target || raw['链接或路径'] || '';
        e.time = raw.time || raw['提醒时间'] || '';
        e.goal = typeof raw.goal === 'number' ? raw.goal : (parseInt(raw['每周目标天数'], 10) || 0);
        e.note = raw.note || raw['备注'] || '';
        e.enabled = raw.enabled !== undefined ? !!raw.enabled : (raw['启用'] !== false);
        if (typeof raw.checkins === 'string') { e.checkins = raw.checkins ? raw.checkins.split(',') : []; }
        else if (Object.prototype.toString.call(raw.checkins) === '[object Array]') { e.checkins = raw.checkins.slice(); }
        else { e.checkins = []; }
        e.order = typeof raw.order === 'number' ? raw.order : (parseInt(raw['排序'], 10) || 0);
        normalizeEntry(e);
        var exist = findEntry(e.id);
        if (exist) {
          for (var k in e) { if (Object.prototype.hasOwnProperty.call(e, k)) { exist[k] = e[k]; } }
        } else {
          state.entries.push(e);
        }
        added++;
      });
      if (data.memos && typeof data.memos === 'object') {
        for (var d in data.memos) {
          if (typeof data.memos[d] === 'string' && data.memos[d]) { state.memos[d] = data.memos[d]; }
        }
      }
    } else if (data && Object.prototype.toString.call(data.rows) === '[object Array]') {
      data.rows.forEach(function (row) {
        if (row['类型'] === '备忘') { return; }
        var e = {
          id: uid(),
          name: row['名称'] || '',
          kind: KIND_VIDEO,
          target: row['链接或路径'] || '',
          time: row['提醒时间'] || '',
          goal: parseInt(row['每周目标天数'], 10) || 0,
          note: row['备注'] || '',
          enabled: row['启用'] !== false,
          checkins: row['打卡记录'] ? String(row['打卡记录']).split(',') : [],
          order: parseInt(row['排序'], 10) || 0
        };
        normalizeEntry(e);
        state.entries.push(e);
        added++;
      });
    } else {
      toast('导入失败：找不到 entries 或 rows 字段', true);
      return;
    }
    state.seeded = true;
    saveState();
    renderAll();
    toast('已导入 ' + added + ' 条入口');
  }

  function reseed() {
    if (!window.confirm('载入示例数据？只在你当前数据为空时播种，已有数据不受影响。')) { return; }
    if (state.entries.length) { toast('已有数据，未播种示例'); return; }
    state.seeded = false;
    seedIfEmpty();
    renderAll();
    toast('示例数据已载入');
  }

  function clearAll() {
    if (!window.confirm('确定清空全部数据？入口、打卡、备忘都会删除，且不可恢复。建议先「导出备份」。')) { return; }
    if (!window.confirm('再确认一次：真的清空？')) { return; }
    state.entries = [];
    state.memos = {};
    state.seeded = true;
    saveState();
    renderAll();
    toast('已清空');
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg, isErr) {
    var old = $('lp-toast');
    if (old) { old.parentNode.removeChild(old); }
    if (toastTimer) { clearTimeout(toastTimer); }
    var el = document.createElement('div');
    el.className = 'lp-toast' + (isErr ? ' err' : '');
    el.id = 'lp-toast';
    el.textContent = msg;
    panel.appendChild(el);
    toastTimer = setTimeout(function () {
      if (el.parentNode) { el.parentNode.removeChild(el); }
    }, 2600);
  }

  /* v2.0.4 诊断：未捕获错误直接显示在面板上（不再静默失败，便于远程定位） */
  window.addEventListener('error', function (e) {
    try { toast('脚本错误: ' + ((e && e.message) || '未知'), true); } catch (x) {}
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    try { toast('脚本错误: ' + ((r && r.message) ? r.message : String(r)), true); } catch (x) {}
  });

  /* ================================================================
   * 面板框架（拖拽/缩放/宽窄/快捷键）
   * ================================================================ */
  function applyChrome() {
    clampCfg();
    panel.style.left = cfg.x + 'px';
    panel.style.top = cfg.y + 'px';
    panel.style.width = cfg.w + 'px';
    panel.style.height = cfg.h + 'px';
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
    saveSettings();
    applyChrome();
  }
  function toggle() { setOpen(!cfg.open); }

  ball.addEventListener('click', function () { setOpen(true); });
  $('lp-close').addEventListener('click', function () { setOpen(false); });
  $('lp-add').addEventListener('click', function () { openEditor(null); });

  function toggleWide() {
    cfg.wide = !cfg.wide;
    cfg.w = cfg.wide ? WIDE_W : 400;
    cfg.h = cfg.wide ? WIDE_H : 580;
    saveSettings();
    applyChrome();
  }
  $('lp-wide').addEventListener('click', toggleWide);
  head.addEventListener('dblclick', function (e) {
    if (e.target && e.target.tagName === 'BUTTON') { return; }
    toggleWide();
  });

  head.addEventListener('pointerdown', function (e) {
    if (e.target && e.target.tagName === 'BUTTON') { return; }
    var sx = e.clientX, sy = e.clientY, ox = cfg.x, oy = cfg.y;
    head.setPointerCapture(e.pointerId);
    function move(ev) {
      cfg.x = Math.max(0, Math.min(ox + ev.clientX - sx, window.innerWidth - 80));
      cfg.y = Math.max(0, Math.min(oy + ev.clientY - sy, window.innerHeight - 48));
      panel.style.left = cfg.x + 'px';
      panel.style.top = cfg.y + 'px';
    }
    function up() {
      head.removeEventListener('pointermove', move);
      head.removeEventListener('pointerup', up);
      head.removeEventListener('pointercancel', up);
      saveSettings();
    }
    head.addEventListener('pointermove', move);
    head.addEventListener('pointerup', up);
    head.addEventListener('pointercancel', up);
    e.preventDefault();
  });

  grip.addEventListener('pointerdown', function (e) {
    var sx = e.clientX, sy = e.clientY, ow = cfg.w, oh = cfg.h;
    grip.setPointerCapture(e.pointerId);
    function move(ev) {
      cfg.w = Math.max(MIN_W, Math.min(ow + ev.clientX - sx, Math.min(window.innerWidth - 24, 900)));
      cfg.h = Math.max(MIN_H, Math.min(oh + ev.clientY - sy, Math.min(window.innerHeight - 24, 900)));
      panel.style.width = cfg.w + 'px';
      panel.style.height = cfg.h + 'px';
    }
    function up() {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      saveSettings();
    }
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('keydown', function (e) {
    if (e.altKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'Escape') {
      if ($('lp-editor-mask')) { closeEditor(); }
      else if (cfg.open) { setOpen(false); }
    }
  });

  window.addEventListener('resize', function () {
    clampCfg();
    panel.style.left = cfg.x + 'px';
    panel.style.top = cfg.y + 'px';
    panel.style.width = cfg.w + 'px';
    panel.style.height = cfg.h + 'px';
  });

  /* ================================================================
   * 启动（storage.sync 异步恢复后重渲染一次，保证跨设备数据到位）
   * ================================================================ */
  loadState();
  seedIfEmpty();
  applyChrome();
  renderAll();
  onRestored = function () {
    var before = JSON.stringify(state);
    loadState();
    if (JSON.stringify(state) !== before) {
      renderAll();
    }
  };
})();
