// 修复所有用户头像为可靠的 placeholder 服务
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const usersFile = path.join(DATA_DIR, 'users.json');

const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));

const colors = ['ff5a6e', 'ff8a3d', '1890ff', '52c41a', '722ed1', '13c2c2', 'fa8c16', 'eb2f96'];

users.forEach((u, i) => {
  const color = colors[i % colors.length];
  const gender = u.gender === '女' ? 'F' : 'M';
  const text = u.nickname ? u.nickname.slice(0, 1) : gender;
  
  // 使用 via.placeholder.com - 可靠的外链服务
  const avatar = `https://via.placeholder.com/300/${color}/ffffff?text=${encodeURIComponent(text)}`;
  
  u.avatar = avatar;
  if (u.photos && u.photos.length > 0) {
    u.photos[0] = avatar;
  }
});

fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
console.log(`✅ 已更新 ${users.length} 个用户的头像`);
