const fs = require('fs');
let c = fs.readFileSync('zeai_server.js', 'utf8');

// 在 /api/users GET 接口中添加 status 过滤
const pos = c.indexOf("  if (pathname === '/api/users' && method === 'GET') {");
if (pos < 0) { console.log('未找到接口'); process.exit(1); }

const listPos = c.indexOf('let list = usersDB.all();', pos);
if (listPos < 0) { console.log('未找到list'); process.exit(1); }

const nl = c.indexOf('\n', listPos);
const filterCode = '\n  // 只显示已审核通过的用户' +
  '\n  list = list.filter(u => u.status !== \'pending\' && u.status !== \'rejected\');\n';

c = c.slice(0, nl + 1) + filterCode + c.slice(nl + 1);
fs.writeFileSync('zeai_server.js', c, 'utf8');
console.log('过滤未审核用户成功');
