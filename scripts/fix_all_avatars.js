const fs = require('fs');
const users = JSON.parse(fs.readFileSync('./data/users.json', 'utf8'));

// 使用 picsum.photos (可靠) 或本地默认头像
const photoIds = [10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36];

users.forEach((u, i) => {
  const pid = photoIds[i] || (10 + i);
  // 修改头像为 picsum.photos（更稳定）
  u.avatar = `https://picsum.photos/id/${pid}/300/300`;
  // 修改 photos 数组
  u.photos = [
    u.avatar,
    `https://picsum.photos/id/${pid+100}/400/600`,
    `https://picsum.photos/id/${pid+200}/400/600`
  ];
});

fs.writeFileSync('./data/users.json', JSON.stringify(users, null, 2), 'utf8');
console.log('已修复', users.length, '个用户的头像URL');
