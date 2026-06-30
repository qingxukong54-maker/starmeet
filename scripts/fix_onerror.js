const fs = require('fs');
let c = fs.readFileSync('h5/app.js', 'utf8');

// 把所有 onerror 中的不可靠 URL 替换成可靠的 via.placeholder.com
const oldPattern = /onerror="this\.src='https?:\/\/[^']*'/g;
const newOnerror = 'onerror="this.onerror=null;this.src=\'https://via.placeholder.com/300/ff5a6e/ffffff?text=?\'';

const matches = c.match(oldPattern) || [];
console.log('找到', matches.length, '处 onerror');

c = c.replace(oldPattern, newOnerror);

fs.writeFileSync('h5/app.js', c, 'utf8');
console.log('已修复所有 onerror 处理');
