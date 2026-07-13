const fs = require('fs');
const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf8'));

// 使用 via.placeholder.com (可靠) 作为头像
const colors = ['ff5a6e','ff8a3d','1890ff','52c41a','722ed1','13c2c2','fa8c16','eb2f96'];

users.forEach((u, i) => {
  const c = colors[i % colors.length];
  // 使用 via.placeholder.com 生成纯色头像（可靠）
  u.avatar = `https://via.placeholder.com/300/${c}/ffffff?text=${encodeURIComponent(u.nickname || '?')}`;
  u.photos = [
    u.avatar,
    `https://via.placeholder.com/400/600/${c}/ffffff?text=Photo1`,
    `https://via.placeholder.com/400/600/${c}/ffffff?text=Photo2`
  ];
});

fs.writeFileSync('./data/users.json', JSON.stringify(users, null, 2), 'utf8');
console.log('已修复', users.length, '个用户的头像URL（使用via.placeholder.com）');
