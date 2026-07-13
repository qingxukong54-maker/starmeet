// 修复 app.js 第1430行：将 `},` 改为 `};`
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'h5', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 将 "},\n\nconst Article = {" 改为 "};\n\nconst Article = {"
content = content.replace('},\n\nconst Article = {', '};\n\nconst Article = {');

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('✅ 已修复 Pages 对象结束符号');
