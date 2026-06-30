// 修改 h5/app.js，添加动态生成底部导航栏功能
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'h5', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. 在 Article 对象之前插入 App.renderBottomBar 函数
const insertFunc = `\n  // 动态生成底部导航栏\n  async renderBottomBar() {\n    try {\n      const res = await fetch('/api/site-config');\n      const data = await res.json();\n      const navConfig = (data.code === 0 && data.data && data.data.navConfig) || [\n        { icon: '🏠', title: '首页', page: 'home', enabled: true },\n        { icon: '💖', title: '找缘分', page: 'match', enabled: true },\n        { icon: '🎉', title: '活动', page: 'activity', enabled: true },\n        { icon: '📖', title: '学堂', page: 'school', enabled: true },\n        { icon: '👤', title: '我的', page: 'mine', enabled: true }\n      ];\n      const enabledNav = navConfig.filter(n => n.enabled !== false);\n      const bar = document.querySelector('.bottombar');\n      if (!bar) return;\n      bar.innerHTML = enabledNav.map(n => \`\n        <div class="nav-item\${App._currentPage === n.page ? ' active' : ''}" onclick="App.switchPage('\${n.page}')">\n          <div class="nav-icon">\${n.icon}</div>\n          <div class="nav-label">\${n.title}</div>\n        </div>\`).join('');\n    } catch(e) {\n      console.error('渲染导航栏失败', e);\n    }\n  },\n  _currentPage: 'home',\n`;

const target = '};\nconst Article = {';
if (content.includes(target)) {
  content = content.replace(target, `},\n${insertFunc}\nconst Article = {`);
  console.log('✅ 已添加 renderBottomBar() 函数');
} else {
  console.log('❌ 未找到插入位置');
}

// 2. 在 App.init() 末尾调用 renderBottomBar()
const initCall = 'App.init();';
const initCallNew = `App.init();\n// 动态生成底部导航栏\nApp.renderBottomBar();`;
if (content.includes(initCall)) {
  content = content.replace(initCall, initCallNew);
  console.log('✅ 已在 App.init() 后调用 renderBottomBar()');
} else {
  console.log('❌ 未找到 App.init() 调用');
}

// 3. 修改 switchPage() 更新 _currentPage 并重新渲染导航栏
const switchPageFunc = 'async switchPage(page) {';
const switchPageFuncNew = `async switchPage(page) {\n    this._currentPage = page;\n    this.renderBottomBar();`;
if (content.includes(switchPageFunc)) {
  content = content.replace(switchPageFunc, switchPageFuncNew);
  console.log('✅ 已修改 switchPage() 更新导航栏');
} else {
  console.log('❌ 未找到 switchPage() 函数');
}

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('✅ app.js 修改完成');
