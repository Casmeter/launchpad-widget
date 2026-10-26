/* 诊断：点 ✎ 编辑按钮能否打开弹层 + 编辑已有入口全流程 */
const fs = require('fs');
const { JSDOM } = require('jsdom');
const SRC = fs.readFileSync(__dirname + '/../启动台浮窗.user.js', 'utf-8');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only'
});
const { window } = dom;
const { document } = window;
window.confirm = () => true;

const errors = [];
window.addEventListener('error', (e) => errors.push('window.error: ' + e.message));

const now = new Date();
const seed = {
  entries: [
    { id: 't1', name: '日语口语', kind: 'video', target: 'https://www.bilibili.com/video/BV1Gs4y1x7Yb', time: '09:00', goal: 5, checkins: [], note: '', enabled: true, order: 0 },
    { id: 't2', name: '健身操', kind: 'video', target: 'https://www.bilibili.com/video/BV1sK4y1t7Art', time: '18:30', goal: 4, checkins: [], note: '', enabled: true, order: 1 },
    { id: 't3', name: '旧本地应用', kind: 'local', target: 'D:\\x\\y.exe', time: '', goal: 0, checkins: [], note: '', enabled: true, order: 2 }
  ],
  memos: {}, seeded: true
};
window.localStorage.setItem('lp_widget_state_v1', JSON.stringify(seed));

window.eval(SRC);
const shadow = document.getElementById('lp-widget-host').shadowRoot;
shadow.getElementById('lp-ball').click();

const editBtns = shadow.querySelectorAll('[data-act="edit"]');
console.log('编辑按钮数量:', editBtns.length);
if (editBtns.length) {
  editBtns[0].click();
  console.log('点击 ✎ 后弹层存在:', !!shadow.getElementById('lp-editor-mask'));
  const name = shadow.getElementById('lp-f-name');
  const kind = shadow.getElementById('lp-f-kind');
  const target = shadow.getElementById('lp-f-target');
  console.log('名称框:', !!name, '类型框:', !!kind, kind && kind.value);
  if (name) {
    name.value = '日语口语·改';
    shadow.getElementById('lp-f-save').click();
    const saved = JSON.parse(window.localStorage.getItem('lp_widget_state_v1'));
    const e1 = saved.entries.find((x) => x.id === 't1');
    console.log('保存后名称:', e1.name, '| kind:', e1.kind);
    console.log('弹层已关闭:', !shadow.getElementById('lp-editor-mask'));
  }
  /* 再点一条旧 local 数据的编辑（迁移路径） */
  const btns2 = shadow.querySelectorAll('[data-act="edit"]');
  if (btns2.length > 2) {
    btns2[2].click();
    console.log('旧 local 记录编辑弹层:', !!shadow.getElementById('lp-editor-mask'),
      '| 类型框值:', shadow.getElementById('lp-f-kind') && shadow.getElementById('lp-f-kind').value);
  }
}
console.log('错误:', errors.length ? errors : '(无)');
