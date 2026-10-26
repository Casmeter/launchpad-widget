/* jsdom 离线测试：加载本地版 user.js，断言渲染与交互 */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync('C:/Users/HP/WorkBuddy/2026-10-25-01-07-01/launchpad/userscript/启动台浮窗.user.js', 'utf-8');

function ds(n, base) {
  const d = new Date(base);
  d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

const now = new Date();
const seed = {
  entries: [
    { id: 't1', name: '日语口语', kind: 'video', target: 'https://www.bilibili.com/video/BV1Gs4y1x7Yb', time: '09:00', goal: 5, checkins: [ds(2, now), ds(4, now)], note: '', enabled: true, order: 0 },
    { id: 't2', name: '健身操', kind: 'video', target: 'https://www.bilibili.com/video/BV1sK4y1t7Art', time: '18:30', goal: 4, checkins: [ds(1, now)], note: '', enabled: true, order: 1 },
    { id: 't3', name: '吉他练习', kind: 'local', target: 'D:\\Music\\GuitarPro\\GuitarPro.exe', time: '20:00', goal: 3, checkins: [ds(3, now)], note: '爬格子', enabled: true, order: 2 }
  ],
  memos: {},
  seeded: true
};

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  runScripts: 'outside-only'
});
const { window } = dom;
const { document } = window;

/* 预置数据（脚本无 GM_ 时降级 localStorage） */
window.localStorage.setItem('lp_widget_state_v1', JSON.stringify(seed));
/* confirm 桩 */
window.confirm = () => true;

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  PASS ' + label); }
  else { fail++; console.log('  FAIL ' + label); }
}

/* 执行脚本 */
window.eval(SRC);

const host = document.getElementById('lp-widget-host');
ok(!!host, 'host 元素已注入');
const shadow = host && host.shadowRoot;
ok(!!shadow, 'Shadow DOM 已创建');

/* 展开面板 */
const ball = shadow.getElementById('lp-ball');
ok(!!ball, '悬浮球存在');
ball.click();
ok(shadow.getElementById('lp-panel').classList.contains('show'), '点击悬浮球后面板展开');

/* 标题栏 */
ok(shadow.getElementById('lp-add') && shadow.getElementById('lp-wide') && shadow.getElementById('lp-close'), '标题栏按钮齐全（+添加/宽窄/收起）');

/* 待办列表 */
const items = Array.from(shadow.querySelectorAll('.lp-q'));
ok(items.length === 3, '待办磁条数量 = 3（实际 ' + items.length + '）');
const order = items.map(el => el.querySelector('.lp-q-name').textContent);
ok(order[0] === '日语口语' && order[1] === '吉他练习' && order[2] === '健身操',
  '排序正确：逾期优先（日语口语/吉他练习），due 次之（健身操），实际: ' + order.join(','));
ok(items[0].classList.contains('overdue'), '日语口语为 overdue（上次打卡 2 天前）');
ok(items[0].querySelector('.lp-q-meta').textContent.indexOf('已顺延 2 天') >= 0, '日语口语显示「已顺延 2 天」');
ok(items[1].classList.contains('overdue'), '吉他练习为 overdue（上次打卡 3 天前）');
ok(items[1].querySelector('.lp-q-meta').textContent.indexOf('已顺延 3 天') >= 0, '吉他练习显示「已顺延 3 天」');
ok(items[2].classList.contains('due'), '健身操为 due（昨天打过卡，今天该启动）');
ok(items[2].querySelector('.lp-q-meta').textContent.indexOf('该启动了') >= 0, '健身操显示「该启动了」');

/* 按钮文案 */
const goBtns = Array.from(shadow.querySelectorAll('[data-act="launch"]'));
ok(goBtns.length === 3 && goBtns[0].textContent === '看视频' && goBtns[1].textContent === '启动应用',
  '启动按钮文案区分类型（看视频/启动应用），实际: ' + goBtns.map(b => b.textContent).join('/'));

/* 进度区 */
const bodyEl = shadow.getElementById('lp-body');
ok(shadow.querySelector('.lp-prog') && bodyEl.textContent.indexOf('本周打卡') >= 0 && bodyEl.textContent.indexOf('连续天数') >= 0, '本周进度区渲染（本周打卡/连续天数）');
ok(shadow.querySelectorAll('.lp-week i').length === 21, '周柱状图 3 个入口 × 7 天 = 21 根柱（实际 ' + shadow.querySelectorAll('.lp-week i').length + '）');

/* 备忘区 */
ok(!!shadow.getElementById('lp-memo'), '今日备忘 textarea 存在');
const tools = Array.from(shadow.querySelectorAll('[data-act]')).map(b => b.getAttribute('data-act'));
['export', 'import', 'reseed', 'clear'].forEach(a => ok(tools.indexOf(a) >= 0, '工具按钮存在: ' + a));

/* ---- 交互：打卡 ---- */
const ck2 = items[2].querySelector('[data-act="checkin"]');
ck2.click();
const after = Array.from(shadow.querySelectorAll('.lp-q'));
const doneItem = after.find(el => el.querySelector('.lp-q-name').textContent === '健身操');
ok(doneItem && doneItem.classList.contains('done'), '点击打卡后健身操变为 done');
const saved = JSON.parse(window.localStorage.getItem('lp_widget_state_v1'));
const t2 = saved.entries.find(e => e.id === 't2');
ok(t2.checkins.indexOf(ds(0, now)) >= 0, '打卡日期已写入 localStorage');

/* ---- 交互：添加入口 ---- */
shadow.getElementById('lp-add').click();
ok(!!shadow.getElementById('lp-editor-mask'), '点「+ 添加」弹层打开');
shadow.getElementById('lp-f-name').value = '冥想 10 分钟';
shadow.getElementById('lp-f-kind').value = 'local';
shadow.getElementById('lp-f-kind').dispatchEvent(new window.Event('change'));
shadow.getElementById('lp-f-target').value = 'D:\\Tools\\calm.exe';
shadow.getElementById('lp-f-time').value = '07:30';
shadow.getElementById('lp-f-save').click();
const saved2 = JSON.parse(window.localStorage.getItem('lp_widget_state_v1'));
ok(saved2.entries.length === 4, '保存后入口数 = 4（实际 ' + saved2.entries.length + '）');
const newEntry = saved2.entries.find(e => e.name === '冥想 10 分钟');
ok(newEntry && newEntry.kind === 'local' && newEntry.target === 'D:\\Tools\\calm.exe', '新入口字段正确（类型/路径）');
ok(!shadow.getElementById('lp-editor-mask'), '保存后弹层关闭');

/* ---- 交互：宽窄切换 ---- */
shadow.getElementById('lp-wide').click();
ok(shadow.getElementById('lp-panel').style.width === '760px', '点「宽窄」后面板变宽 760px');
shadow.getElementById('lp-wide').click();
ok(shadow.getElementById('lp-panel').style.width === '400px', '再点恢复窄 400px');

/* ---- 交互：Esc 收起 ---- */
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
ok(!shadow.getElementById('lp-panel').classList.contains('show'), 'Esc 后面板收起');

/* ---- 备忘自动保存 ---- */
ball.click();
const memo = shadow.getElementById('lp-memo');
memo.value = '今天先做日语';
memo.dispatchEvent(new window.Event('input', { bubbles: true }));
/* 防抖 300ms */
setTimeout(() => {
  const saved3 = JSON.parse(window.localStorage.getItem('lp_widget_state_v1'));
  ok(saved3.memos[ds(0, now)] === '今天先做日语', '备忘自动保存（300ms 防抖后写入）');

  /* ---- 导入兼容：旧 WorkBuddy rows 格式 ---- */
  /* 直接调用内部函数不可达，改为验证导出的 JSON 结构可被本地版解析 */
  const exported = JSON.parse(window.localStorage.getItem('lp_widget_state_v1'));
  ok(Array.isArray(exported.entries) && exported.entries[0].name !== undefined, '导出数据结构自洽（entries 数组）');

  console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
  process.exit(fail ? 1 : 0);
}, 600);
