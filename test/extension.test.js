/* 扩展版 content.js 测试：chrome.storage 桩 */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const SRC = fs.readFileSync('C:/Users/HP/WorkBuddy/2026-10-25-01-07-01/launchpad/userscript/extension/content.js', 'utf-8');
function ds(n, base) {
  const d = new Date(base); d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
const now = new Date();
const seed = {
  entries: [
    { id: 't1', name: '日语口语', kind: 'video', target: 'https://bilibili.com/x', time: '09:00', goal: 5, checkins: [ds(2, now)], note: '', enabled: true, order: 0 },
    { id: 't2', name: '健身操', kind: 'video', target: 'https://bilibili.com/y', time: '18:30', goal: 4, checkins: [ds(1, now)], note: '', enabled: true, order: 1 }
  ],
  memos: {}, seeded: true
};
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
const { document } = window;
/* chrome.storage.sync 桩 */
const backing = { lp_widget_state_v1: JSON.stringify(seed) };
window.chrome = {
  storage: { sync: {
    get: (keys, cb) => { const out = {}; (Array.isArray(keys) ? keys : [keys]).forEach(k => { if (backing[k] !== undefined) out[k] = backing[k]; }); cb(out); },
    set: (obj, cb) => { Object.assign(backing, obj); if (cb) cb(); }
  } },
  runtime: { lastError: null }
};
window.confirm = () => true;
let pass = 0, fail = 0;
function ok(cond, label) { if (cond) { pass++; console.log('  PASS ' + label); } else { fail++; console.log('  FAIL ' + label); } }
window.eval(SRC);
const host = document.getElementById('lp-widget-host');
const shadow = host.shadowRoot;
shadow.getElementById('lp-ball').click();
const items = Array.from(shadow.querySelectorAll('.lp-q'));
ok(items.length === 2, '扩展版渲染 2 条待办（实际 ' + items.length + '）');
ok(items[0].classList.contains('overdue') && items[1].classList.contains('due'), '状态正确：日语 overdue / 健身 due');
/* 打卡写 chrome.storage */
items[1].querySelector('[data-act="checkin"]').click();
const saved = JSON.parse(backing.lp_widget_state_v1);
ok(saved.entries.find(e => e.id === 't2').checkins.indexOf(ds(0, now)) >= 0, '打卡写入 chrome.storage.sync');
setTimeout(() => { console.log(`\n扩展版结果: ${pass} 通过, ${fail} 失败`); process.exit(fail ? 1 : 0); }, 400);
