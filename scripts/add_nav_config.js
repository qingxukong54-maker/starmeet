// 修复 admin.js 中 renderSiteConfig，在保存按钮前添加底部导航栏配置
const fs = require('fs');
const path = require('path');

const adminJsPath = path.join(__dirname, '..', 'admin', 'admin.js');
let content = fs.readFileSync(adminJsPath, 'utf8');

// 1. 在首页副标题输入框后、保存按钮前插入导航栏配置HTML
const insertHtml = `\n        <hr style="margin:20px 0;border:none;border-top:1px solid var(--border);">\n        <h4 style="margin:16px 0 8px;">底部导航栏配置</h4>\n        <div id="navConfigArea"></div>\n        <button class="btn btn-primary" onclick="Admin.renderNavConfig()" style="margin-bottom:12px;">编辑底部导航栏</button>\n`;

// 在首页副标题输入框后插入
const target1 = '<div class="form-row">\n          <button class="primary-btn" onclick="Admin.saveSiteConfig()">保存配置</button>';
if (content.includes(target1)) {
  content = content.replace(target1, insertHtml + '        <div class="form-row">\n          <button class="primary-btn" onclick="Admin.saveSiteConfig()">保存配置</button>');
  console.log('✅ 已添加导航栏配置入口');
} else {
  console.log('❌ 未找到保存按钮位置');
}

// 2. 在 saveSiteConfig() 中保存 navConfig（从 this._navConfig 读取）
const saveFunc = `async saveSiteConfig() {\n    const body = {\n      logoType: document.getElementById('sc_logoType').value,\n      logoEmoji: document.getElementById('sc_logoEmoji').value,\n      logoImage: document.getElementById('sc_logoImage').value,\n      siteSlogan: document.getElementById('sc_siteSlogan').value\n    };`;
const saveFuncNew = `async saveSiteConfig() {\n    const body = {\n      logoType: document.getElementById('sc_logoType').value,\n      logoEmoji: document.getElementById('sc_logoEmoji').value,\n      logoImage: document.getElementById('sc_logoImage').value,\n      siteSlogan: document.getElementById('sc_siteSlogan').value,\n      navConfig: this._navConfig || undefined\n    };`;
if (content.includes(saveFunc)) {
  content = content.replace(saveFunc, saveFuncNew);
  console.log('✅ 已修改 saveSiteConfig() 保存 navConfig');
} else {
  console.log('❌ 未找到 saveSiteConfig() 函数');
}

// 3. 在 previewSite() 后添加 renderNavConfig() 和 saveNavConfig() 函数
const insertFuncs = `\n  // ===== 底部导航栏配置 =====\n  async renderNavConfig() {\n    const res = await this.api('/api/site-config');\n    if (res.code !== 0) return;\n    const nav = res.data.navConfig || [\n      { icon: '🏠', title: '首页', page: 'home', enabled: true },\n      { icon: '💖', title: '找缘分', page: 'match', enabled: true },\n      { icon: '🎉', title: '活动', page: 'activity', enabled: true },\n      { icon: '📖', title: '学堂', page: 'school', enabled: true },\n      { icon: '👤', title: '我的', page: 'mine', enabled: true }\n    ];\n    this._navConfig = nav;\n    const pageMap = { home: '首页', match: '找缘分', activity: '活动', school: '学堂', mine: '我的' };\n    let html = \`<div class="modal-mask" onclick="Admin._closeModal()"></div>\n      <div class="modal">\n        <div class="modal-header">底部导航栏配置<span class="modal-close" onclick="Admin._closeModal()">×</span></div>\n        <div class="modal-body">\n          <p style="color:var(--text-2);margin-bottom:12px;">配置底部导航栏：图标（emoji）、文案、跳转页面、启用。<b>建议 4-5 个</b>。</p>\n          <table>\n            <thead><tr><th>图标</th><th>文案</th><th>跳转页面</th><th>启用</th><th>操作</th></tr></thead>\n          <tbody id="nc_tbody">\`;\n    nav.forEach((n, i) => {\n      html += \`<tr id="nc_row_\${i}">\n        <td><input id="nc_icon_\${i}" value="\${n.icon || '💖'}" style="width:50px;font-size:18px;text-align:center;"></td>\n        <td><input id="nc_title_\${i}" value="\${n.title || ''}" placeholder="文案"></td>\n        <td>\n          <select id="nc_page_\${i}">\n            <option value="home" \${n.page==='home'?'selected':''}>首页</option>\n            <option value="match" \${n.page==='match'?'selected':''}>找缘分</option>\n            <option value="activity" \${n.page==='activity'?'selected':''}>活动</option>\n            <option value="school" \${n.page==='school'?'selected':''}>学堂</option>\n            <option value="mine" \${n.page==='mine'?'selected':''}>我的</option>\n          </select>\n        </td>\n        <td><button id="nc_enabled_\${i}" class="btn \${n.enabled!==false?'btn-primary':''}" onclick="Admin._toggleNavEnabled(\${i})">\${n.enabled!==false?'已启用':'已禁用'}</button></td>\n        <td><button class="btn btn-danger" onclick="Admin._removeNavItem(\${i})">删除</button></td>\n      </tr>\`;\n    });\n    html += \`</tbody></table>\n          <button class="btn btn-primary" onclick="Admin._addNavItem()">+ 添加导航项</button>\n        </div>\n        <div class="modal-footer">\n          <button class="btn" onclick="Admin._closeModal()">取消</button>\n          <button class="btn btn-primary" onclick="Admin.saveNavConfig()">保存</button>\n        </div>\n      </div>\`;\n    document.getElementById('modalContainer').innerHTML = html;\n  },\n  _addNavItem() {\n    (this._navConfig = this._navConfig || []).push({ icon: '💖', title: '新导航', page: 'home', enabled: true });\n    this.renderNavConfig();\n  },\n  _removeNavItem(i) {\n    this._navConfig.splice(i, 1);\n    this.renderNavConfig();\n  },\n  _toggleNavEnabled(i) {\n    this._navConfig[i].enabled = !(this._navConfig[i].enabled !== false);\n    this.renderNavConfig();\n  },\n  async saveNavConfig() {\n    const list = (this._navConfig || []).map((n, i) => ({\n      icon: (document.getElementById('nc_icon_' + i) || {}).value || '💖',\n      title: (document.getElementById('nc_title_' + i) || {}).value || '导航',\n      page: (document.getElementById('nc_page_' + i) || {}).value || 'home',\n      enabled: n.enabled\n    }));\n    this._navConfig = list;\n    this.toast('已暂存，点击"保存配置"后生效');\n    this._closeModal();\n  },\n`;

// 在 previewSite() 后插入
const target2 = '  },\n\n  // ===== 联系我们设置 =====';
if (content.includes(target2)) {
  content = content.replace(target2, '  },\n\n' + insertFuncs + '\n  // ===== 联系我们设置 =====');
  console.log('✅ 已添加 renderNavConfig() 等函数');
} else {
  console.log('❌ 未找到插入位置');
}

fs.writeFileSync(adminJsPath, content, 'utf8');
console.log('✅ admin.js 修改完成');
