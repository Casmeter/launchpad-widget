# 启动台浮窗 · WorkBuddy 任务看板

把 WorkBuddy 启动台变成一个**浏览器里的小窗口**：打开任何 WorkBuddy 页面，右下角有一个 ⚡ 悬浮球，点开就是启动台小窗——今日待办、一键启动、打卡，数据和你的看板实时同步。

提供两种形态，功能完全一致：

| 形态 | 适合谁 | 安装成本 |
|---|---|---|
| **油猴脚本**（`启动台浮窗.user.js`） | 大多数人，跨浏览器通用 | 装个脚本管理器，点一下安装链接 |
| **Chrome/Edge 扩展**（`extension/`） | 不想装管理器、想像 Video Together 那样「下载后自主安装」 | 下载文件夹 → 开发者模式加载已解压扩展 |

Metro 扁平化风格（Azure 蓝 #00BCF2），与看板本体一致。

---

## 一、功能

- **悬浮球 / 小窗**：右下角 ⚡ 点击展开；拖标题栏移动，拖右下角把手缩放
- **宽窄双形态**：「宽窄」按钮或双击标题栏切换——窄窗是精简待办列表（启动/打卡），宽窗是完整看板
- **完整看板**：一键在新标签页打开
- **快捷键**：`Alt+L` 唤出/收起，`Esc` 收起
- **状态记忆**：位置、大小、宽窄、展开状态自动保存，下次打开原样恢复
- **数据同步**：小窗内就是你的发布页，复用浏览器登录态，打卡/启动与看板完全同步

## 二、安装

### 方式 A：油猴脚本（推荐）

1. 先装一个脚本管理器（任选其一）：
   - [Tampermonkey](https://www.tampermonkey.net/)（Chrome / Edge / Firefox）
   - [Violentmonkey](https://violentmonkey.github.io/)（开源，Edge/Chrome/Firefox）
2. 点安装链接（把 `<你的用户名>` 和 `<仓库名>` 换成实际值）：

   ```
   https://raw.githubusercontent.com/<你的用户名>/<仓库名>/main/启动台浮窗.user.js
   ```

   Tampermonkey 会弹出安装页，点「安装」。
3. 打开 https://workbuddy.link/ 任意页面，右下角出现 ⚡ 即可用。

### 方式 B：浏览器扩展（Video Together 式安装）

1. 下载本仓库的 `extension` 文件夹（或整个仓库 zip，解压）
2. Edge：地址栏输入 `edge://extensions` → 打开左下角「开发人员模式」→ 点「加载解压的扩展」→ 选择 `extension` 文件夹
   Chrome：`chrome://extensions` → 右上角「开发者模式」→ 「加载已解压的扩展程序」
3. 打开 WorkBuddy 页面即生效

> 扩展未签名、仅本机加载，不影响安全设置；只申请了 `storage` 一个权限（用来记住小窗位置）。

## 三、使用

| 操作 | 效果 |
|---|---|
| 点右下角 ⚡ | 展开小窗 |
| 拖蓝色标题栏 | 移动小窗 |
| 拖右下角小三角 | 调整大小 |
| 双击标题栏 / 点「宽窄」 | 精简列表 ↔ 完整看板 |
| `Alt+L` | 唤出 / 收起 |
| `Esc` | 收起为悬浮球 |
| 「完整看板」 | 新标签页打开发布页 |

## 四、改成你自己的看板

两个文件顶部都有这一行：

```js
var PAGE_URL = 'https://workbuddy.link/p/F9nd8qHxsaobCHhkWVhE0E'; /* 启动台发布页 */
```

换成你自己的发布页地址即可，其余不用动。

## 五、发布到 GitHub / GreasyFork

### GitHub（脚本的「官网」）

```bash
git init -b main
git add -A
git commit -m "启动台浮窗 v1.0"
gh repo create launchpad-widget --public --source=. --push
```

之后安装链接就是 `https://raw.githubusercontent.com/<用户名>/launchpad-widget/main/启动台浮窗.user.js`，任何人装上脚本管理器后点这个链接就能装。

### GreasyFork（油猴脚本社区）

1. 打开 https://greasyfork.org/ 登录
2. 右上角用户菜单 →「发布脚本」→ 选「从 URL」粘贴上面的 raw 链接，或直接粘贴 `启动台浮窗.user.js` 全文
3. 国内访问 GreasyFork 慢的话可发 **ScriptCAT**（https://scriptcat.org/），流程相同

## 六、已知限制（重要）

1. **只在 WorkBuddy 域名下激活**（`workbuddy.link` / `workbuddy.cn`）。这不是偷懒——看板数据在你的资料库里，需要登录态；脚本注入到 WorkBuddy 页面时才能天然带上登录 cookie。在完全无关的网站上打开小窗，会因浏览器第三方 Cookie 策略看不到登录态。
2. **首次打开要登录一次**：小窗里显示登录页就在里面登录（与浏览器主登录态互通）。
3. 小窗是浏览器内的浮层，不能像 exe 浮窗那样置顶到其他程序之上；要系统级置顶浮窗请用 `启动台浮窗.exe`（C# 壳，见上一级目录）。

## 七、文件说明

```
启动台浮窗.user.js      油猴脚本（Tampermonkey / Violentmonkey）
extension/
  manifest.json          MV3 扩展清单
  content.js             扩展内容脚本（逻辑与油猴版一致）
README.md               本文件
```

## 八、和另外两种形态怎么选

- **浏览器标签/PWA**：最轻，开浏览器就在（适合每天固定用浏览器）
- **本仓库脚本/扩展**：在 WorkBuddy 任何页面随时唤出小窗，不打断当前浏览（适合边查资料边打卡）
- **启动台浮窗.exe**：系统级置顶浮窗，开机自启，脱离浏览器（适合要「钉在桌面上」）
