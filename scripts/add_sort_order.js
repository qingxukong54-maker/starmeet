const fs = require('fs');
const path = require('path');

// 正确路径：从 scripts 目录上一级是 zeai_h5，然后进入 admin 目录
const adminJsPath = path.join(__dirname, '..', 'admin', 'admin.js');

let content = fs.readFileSync(adminJsPath, 'utf8');

// 1. 修改 renderQuickEntries() 中的表格头部，添加"排序"列
content = content.replace(
  /(<thead><tr><th style="width:60px;">图标<\/th><th>标题<\/th><th>副标题<\/th><th>跳转<\/th><th>启用<\/th><th style="width:160px;">操作<\/th><\/tr><\/thead>)/,
  '<thead><tr><th style="width:60px;">图标</th><th>标题</th><th>副标题</th><th>跳转</th><th style="width:80px;">排序</th><th>启用</th><th style="width:160px;">操作</th></tr></thead>'
);

// 2. 在 renderQuickEntries() 中，按 sortOrder 排序
content = content.replace(
  /(const list = res\.data;)/,
  'const list = (res.data || []).sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));'
);

// 3. 在 renderQuickEntries() 的表格行中添加排序显示
content = content.replace(
  /(<td>\${b\.enabled !== false \? .*?<\/td>)/,
  '<td style="text-align:center;font-weight:bold;color:var(--primary);">${b.sortOrder || 0}</td>\n              $1'
);

// 4. 修改 editQuickEntry() 函数，在模态框中添加 sortOrder 输入框
// 在 "副标题" 输入框后面添加排序输入框
const editFormAddSortOrder = `
        <div class="form-group" style="flex:0 0 100px;"><label>排序（数字越小越靠前）</label><input id="qe_sortOrder" type="number" value="${b.sortOrder || 0}" placeholder="0"></div>
      </div>`;

content = content.replace(
  /(<div class="form-group" style="flex:1;"><label>副标题<\/label><input id="qe_subtitle" value="\${esc\(b\.subtitle\)}" placeholder="如：海量本地优质会员"><\/div>\s*<\/div>)/,
  '$1' + editFormAddSortOrder
);

// 5. 修改 _saveQuickEntry() 函数，保存 sortOrder 字段
content = content.replace(
  /(const body = \{)/,
  '$1\n      sortOrder: parseInt(document.getElementById(\'qe_sortOrder\').value) || 0,'
);

fs.writeFileSync(adminJsPath, content, 'utf8');
console.log('✅ admin.js 已更新，添加了排序功能');
