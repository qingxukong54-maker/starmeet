// 修复 app.js：删除错误代码，在 App 对象内添加 renderBottomBar()
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'h5', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. 删除错误插入的代码（Pages 结束后、Article 开始前）
const badCode = /\n  \/\/ 动态生成底部导航栏[\s\S]*?const Article = \{/;
content = content.replace(badCode, '\nconst Article = {');
console.log('✅ 已删除错误插入的代码');

// 2. 在 App 对象内的 loadSiteConfig() 后添加 renderBottomBar() 方法
//    找到 loadSiteConfig() 的结束位置，在其后插入
const insertPos = content.indexOf('  },\n\n  switchPage');
if (insertPos > 0) {
  const renderFunc = `\n  // 动态生成底部导航栏（从站点配置读取）\n  async renderBottomBar() {\n    try {\n      const res = await this.api('/api/site-config');\n      const c = res.code === 0 ? res.data : {};\n      const navConfig = (c.navConfig || []).filter(n => n.enabled !== false);\n      if (navConfig.length === 0) return;\n      const bar = document.querySelector('.bottombar');\n      if (!bar) return;\n      bar.innerHTML = navConfig.map(n => \`\n        <div class="nav-item\${this.currentPage === n.page ? ' active' : ''}" onclick="App.switchPage('\${n.page}')">\n          <div class="nav-icon">\${n.icon}</div>\n          <div class="nav-label">\${n.title}</div>\n        </div>\`).join('');\n    } catch(e) { console.error('渲染导航栏失败', e); }\n  },\n`;
  content = content.slice(0, insertPos + 4) + renderFunc + content.slice(insertPos + 4);
  console.log('✅ 已在 App 对象内添加 renderBottomBar() 方法');
} else {
  console.log('❌ 未找到插入位置');
}

// 3. 在 App.init() 末尾调用 renderBottomBar()
content = content.replace(
  /(this\.switchPage\('home'\);\s*\})/,
  "$1\n    this.renderBottomBar();"
);
console.log('✅ 已在 App.init() 中添加 renderBottomBar() 调用');

// 4. 在 switchPage() 中更新导航栏高亮
content = content.replace(
  /(this\.currentPage = page;\s*\n)/,
  "$1    this.renderBottomBar();\n"
);
console.log('✅ 已在 switchPage() 中添加 renderBottomBar() 调用');

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('✅ app.js 修复完成');
