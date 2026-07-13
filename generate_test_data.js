const fs = require('fs');
const path = require('path');

// 读取用户数据
const usersFile = path.join(__dirname, 'data/users.json');
const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));

// 选择前3个用户作为测试数据作者
const authors = users.slice(0, 3).map(u => ({
  id: u.id,
  userId: u.userId,
  nickname: u.nickname,
  avatar: u.avatar,
  gender: u.gender
}));

console.log('Selected authors:', authors.map(a => a.nickname).join(', '));

// 测试图片URL（使用picsum.photos服务）
const testImages = [
  'https://picsum.photos/id/10/400/600',
  'https://picsum.photos/id/20/400/600',
  'https://picsum.photos/id/30/400/600',
  'https://picsum.photos/id/40/400/600',
  'https://picsum.photos/id/50/400/600',
  'https://picsum.photos/id/60/400/600',
  'https://picsum.photos/id/70/400/600',
  'https://picsum.photos/id/80/400/600',
  'https://picsum.photos/id/90/400/600'
];

// 测试视频URL（使用一个公开的测试视频）
const testVideo = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

// 生成测试文本内容
const testTexts = [
  '今天天气真好，心情也特别愉快！',
  '分享一张美图给大家看看～',
  '周末和朋友出去玩，拍了很多照片',
  '今天尝试了一家新餐厅，味道很不错',
  '生活中的小确幸，记录下来',
  '旅行日记：美丽的风景让人心旷神怡',
  '今天的运动打卡，坚持就是胜利！',
  '读书笔记：这本书真的很有启发',
  '家常菜分享，自己做的更有味道',
  '周末宅家的一天，也很充实',
  '分享一段视频，记录美好时刻'
];

// 生成测试数据
const testPosts = [];
const now = new Date();

// 1. 纯文本
testPosts.push({
  id: 'post_' + Date.now() + '_1',
  userId: authors[0].id,
  authorId: authors[0].id,
  authorName: authors[0].nickname,
  authorAvatar: authors[0].avatar,
  content: testTexts[0],
  images: [],
  video: '',
  likes: 5,
  comments: 3,
  createdAt: new Date(now - 1000 * 60 * 30).toISOString(), // 30分钟前
  updatedAt: new Date(now - 1000 * 60 * 30).toISOString()
});

// 2. 文本+1张图
testPosts.push({
  id: 'post_' + Date.now() + '_2',
  userId: authors[1].id,
  authorId: authors[1].id,
  authorName: authors[1].nickname,
  authorAvatar: authors[1].avatar,
  content: testTexts[1],
  images: [testImages[0]],
  video: '',
  likes: 12,
  comments: 5,
  createdAt: new Date(now - 1000 * 60 * 60).toISOString(), // 1小时前
  updatedAt: new Date(now - 1000 * 60 * 60).toISOString()
});

// 3. 文本+2张图
testPosts.push({
  id: 'post_' + Date.now() + '_3',
  userId: authors[2].id,
  authorId: authors[2].id,
  authorName: authors[2].nickname,
  authorAvatar: authors[2].avatar,
  content: testTexts[2],
  images: [testImages[0], testImages[1]],
  video: '',
  likes: 8,
  comments: 2,
  createdAt: new Date(now - 1000 * 60 * 60 * 2).toISOString(), // 2小时前
  updatedAt: new Date(now - 1000 * 60 * 60 * 2).toISOString()
});

// 4. 文本+3张图
testPosts.push({
  id: 'post_' + Date.now() + '_4',
  userId: authors[0].id,
  authorId: authors[0].id,
  authorName: authors[0].nickname,
  authorAvatar: authors[0].avatar,
  content: testTexts[3],
  images: [testImages[0], testImages[1], testImages[2]],
  video: '',
  likes: 15,
  comments: 7,
  createdAt: new Date(now - 1000 * 60 * 60 * 3).toISOString(), // 3小时前
  updatedAt: new Date(now - 1000 * 60 * 60 * 3).toISOString()
});

// 5. 文本+4张图
testPosts.push({
  id: 'post_' + Date.now() + '_5',
  userId: authors[1].id,
  authorId: authors[1].id,
  authorName: authors[1].nickname,
  authorAvatar: authors[1].avatar,
  content: testTexts[4],
  images: [testImages[0], testImages[1], testImages[2], testImages[3]],
  video: '',
  likes: 20,
  comments: 9,
  createdAt: new Date(now - 1000 * 60 * 60 * 4).toISOString(), // 4小时前
  updatedAt: new Date(now - 1000 * 60 * 60 * 4).toISOString()
});

// 6. 文本+5张图
testPosts.push({
  id: 'post_' + Date.now() + '_6',
  userId: authors[2].id,
  authorId: authors[2].id,
  authorName: authors[2].nickname,
  authorAvatar: authors[2].avatar,
  content: testTexts[5],
  images: [testImages[0], testImages[1], testImages[2], testImages[3], testImages[4]],
  video: '',
  likes: 25,
  comments: 11,
  createdAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(), // 5小时前
  updatedAt: new Date(now - 1000 * 60 * 60 * 5).toISOString()
});

// 7. 文本+6张图
testPosts.push({
  id: 'post_' + Date.now() + '_7',
  userId: authors[0].id,
  authorId: authors[0].id,
  authorName: authors[0].nickname,
  authorAvatar: authors[0].avatar,
  content: testTexts[6],
  images: [testImages[0], testImages[1], testImages[2], testImages[3], testImages[4], testImages[5]],
  video: '',
  likes: 30,
  comments: 15,
  createdAt: new Date(now - 1000 * 60 * 60 * 6).toISOString(), // 6小时前
  updatedAt: new Date(now - 1000 * 60 * 60 * 6).toISOString()
});

// 8. 文本+7张图
testPosts.push({
  id: 'post_' + Date.now() + '_8',
  userId: authors[1].id,
  authorId: authors[1].id,
  authorName: authors[1].nickname,
  authorAvatar: authors[1].avatar,
  content: testTexts[7],
  images: [testImages[0], testImages[1], testImages[2], testImages[3], testImages[4], testImages[5], testImages[6]],
  video: '',
  likes: 35,
  comments: 18,
  createdAt: new Date(now - 1000 * 60 * 60 * 7).toISOString(), // 7小时前
  updatedAt: new Date(now - 1000 * 60 * 60 * 7).toISOString()
});

// 9. 文本+8张图
testPosts.push({
  id: 'post_' + Date.now() + '_9',
  userId: authors[2].id,
  authorId: authors[2].id,
  authorName: authors[2].nickname,
  authorAvatar: authors[2].avatar,
  content: testTexts[8],
  images: [testImages[0], testImages[1], testImages[2], testImages[3], testImages[4], testImages[5], testImages[6], testImages[7]],
  video: '',
  likes: 40,
  comments: 20,
  createdAt: new Date(now - 1000 * 60 * 60 * 8).toISOString(), // 8小时前
  updatedAt: new Date(now - 1000 * 60 * 60 * 8).toISOString()
});

// 10. 文本+9张图
testPosts.push({
  id: 'post_' + Date.now() + '_10',
  userId: authors[0].id,
  authorId: authors[0].id,
  authorName: authors[0].nickname,
  authorAvatar: authors[0].avatar,
  content: testTexts[9],
  images: [testImages[0], testImages[1], testImages[2], testImages[3], testImages[4], testImages[5], testImages[6], testImages[7], testImages[8]],
  video: '',
  likes: 45,
  comments: 22,
  createdAt: new Date(now - 1000 * 60 * 60 * 9).toISOString(), // 9小时前
  updatedAt: new Date(now - 1000 * 60 * 60 * 9).toISOString()
});

// 11. 文本+1个视频
testPosts.push({
  id: 'post_' + Date.now() + '_11',
  userId: authors[1].id,
  authorId: authors[1].id,
  authorName: authors[1].nickname,
  authorAvatar: authors[1].avatar,
  content: testTexts[10],
  images: [],
  video: testVideo,
  likes: 50,
  comments: 25,
  createdAt: new Date(now - 1000 * 60 * 60 * 10).toISOString(), // 10小时前
  updatedAt: new Date(now - 1000 * 60 * 60 * 10).toISOString()
});

// 写入圈子数据文件
const postsFile = path.join(__dirname, 'data/circle_posts.json');
fs.writeFileSync(postsFile, JSON.stringify(testPosts, null, 2), 'utf8');

console.log('\n✅ 测试数据生成成功！');
console.log(`共生成 ${testPosts.length} 条圈子测试数据：`);
console.log('- 纯文本：1条');
console.log('- 文本+1张图：1条');
console.log('- 文本+2张图：1条');
console.log('- 文本+3张图：1条');
console.log('- 文本+4张图：1条');
console.log('- 文本+5张图：1条');
console.log('- 文本+6张图：1条');
console.log('- 文本+7张图：1条');
console.log('- 文本+8张图：1条');
console.log('- 文本+9张图：1条');
console.log('- 文本+1个视频：1条');
console.log('\n数据文件：', postsFile);
