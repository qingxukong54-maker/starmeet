// 修复用户头像：使用有效的在线图片URL
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const usersFile = path.join(rootDir, 'data', 'users.json');
const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));

// 使用 pravatar 服务（靠谱的头像服务）
const AVATAR_BASE = 'https://i.pravatar.cc/300?img=';

users.forEach((u, idx) => {
  // 每个用户使用不同的图片编号（1-70 是 pravatar 支持的编号）
  const imgId = (idx % 70) + 1;
  u.avatar = `${AVATAR_BASE}${imgId}`;
  
  // 照片也使用在线图片
  u.photos = [
    `${AVATAR_BASE}${imgId}`,
    `https://picsum.photos/id/${((idx + 10) % 100)}/400/600`,
    `https://picsum.photos/id/${((idx + 20) % 100)}/400/600`
  ];
});

fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
console.log(`已更新 ${users.length} 个用户的头像和照片为在线图片URL`);
