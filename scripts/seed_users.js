// 一键补齐所有用户的真实化资料 + 真实头像 URL
// 头像走 picsum.photos 真实人像（不会失效）
// 用法：node scripts/seed_users.js
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data', 'users.json');
const users = JSON.parse(fs.readFileSync(DATA, 'utf8'));

// 城市池（覆盖一二三线）
const cities = ['北京', '上海', '广州', '深圳', '杭州', '南京', '苏州', '武汉', '成都', '重庆', '西安', '长沙', '青岛', '济南', '厦门', '福州', '宁波', '合肥', '昆明', '大连', '天津'];
const cities_f = ['上海', '杭州', '北京', '广州', '深圳', '成都', '重庆', '厦门', '福州', '苏州', '南京', '武汉', '长沙', '西安', '青岛'];
const cities_m = ['北京', '上海', '深圳', '广州', '杭州', '南京', '武汉', '成都', '重庆', '西安', '长沙', '青岛', '厦门', '福州', '苏州'];

const educations = ['高中', '中专', '大专', '本科', '硕士', '博士'];
const edu_f = ['大专', '本科', '本科', '本科', '硕士', '硕士', '博士'];
const edu_m = ['本科', '本科', '本科', '硕士', '硕士', '博士', '高中', '大专'];

const schools_f = ['福建师范大学', '福州大学', '厦门大学', '集美大学', '华东师范', '上海外国语', '浙江大学', '苏州大学', '南京师范', '武汉大学', '中山大学', '四川大学', '山东大学', '湖南大学', '华中师范', '吉林大学', '大连理工'];
const schools_m = ['清华大学', '北京大学', '复旦大学', '上海交大', '浙江大学', '南京大学', '厦门大学', '武汉大学', '中山大学', '四川大学', '山东大学', '湖南大学', '华中科技', '同济大学', '东南大学', '北京理工', '哈工大'];

const majors_f = ['汉语言文学', '英语', '学前教育', '护理学', '会计学', '财务管理', '市场营销', '国际经济与贸易', '电子商务', '心理学', '法学', '行政管理', '新闻学', '广告学', '设计学', '临床医学', '药学', '口腔医学'];
const majors_m = ['计算机科学', '软件工程', '电子信息', '通信工程', '机械工程', '土木工程', '建筑学', '电气工程', '自动化', '金融学', '经济学', '法学', '市场营销', '工商管理', '物流管理', '会计学', '临床医学', '车辆工程'];

const jobs_f = ['幼教', '小学老师', '初中老师', '高中老师', '大学老师', '护士', '医生', '会计', '出纳', '人事专员', '行政助理', '文案策划', '设计师', '美工', '运营专员', '客服', '销售', '置业顾问', '银行柜员', '翻译'];
const jobs_m = ['软件工程师', '产品经理', '运营', '市场推广', '销售经理', '客户经理', '机械工程师', '建筑设计师', '电气工程师', '公务员', '医生', '律师', '高校教师', '银行客户经理', '证券分析师', '基金经理', '投资经理', '财务总监', 'HR经理', '总裁助理'];

const companies = ['阿里巴巴', '腾讯', '字节跳动', '美团', '京东', '百度', '网易', '小米', '华为', '中兴', '平安集团', '招商银行', '工商银行', '中国移动', '国家电网', '中石油', '中石化', '建设银行', '中国银行', '中国电信', '碧桂园', '万科', '保利', '融创', '新浪', '搜狐', '360', '滴滴', '快手', 'B站'];

const incomes = ['3-5万', '5-8万', '8-15万', '15-20万', '20-30万', '30-50万', '50万以上'];
const income_f_pool = ['3-5万', '5-8万', '5-8万', '8-15万', '8-15万', '8-15万', '15-20万'];
const income_m_pool = ['8-15万', '8-15万', '15-20万', '15-20万', '20-30万', '20-30万', '30-50万', '50万以上'];

const houses = ['有（已购）', '有（按揭中）', '无（与父母同住）', '无（租房）', '无'];
const cars = ['有', '无'];
const smoke = ['不吸', '偶尔', '已戒'];
const drink = ['不喝', '偶尔', '经常'];
const cooking = ['擅长', '一般', '不会'];
const hobbies_f = ['看书、追剧', '瑜伽、跑步', '烘焙、做甜点', '旅游、摄影', '画画、手工', '听音乐、看展', '游泳、健身', '看电影、撸猫', '插花、茶艺'];
const hobbies_m = ['健身、跑步', '篮球、足球', '看书、看纪录片', '旅游、摄影', '打游戏、追剧', '钓鱼、登山', '骑行、游泳', '音乐、吉他', '美食、烹饪'];
const marital = ['未婚', '未婚', '未婚', '未婚', '离异无孩', '丧偶'];
const hasChild = ['无', '无', '无', '有（与前配偶）'];
const wantChild = ['要', '要', '看情况', '不要'];
const bios_f = [
  '温柔善良的小姐姐一枚，热爱生活，喜欢小动物，希望遇到一个三观一致的他，一起慢慢变老。',
  '在福州做幼教工作，平时喜欢烘焙、追剧，周末会出去走走。期待遇见温柔、靠谱的你。',
  '性格开朗，笑容常挂嘴边。喜欢看书、瑜伽、烘焙。希望未来的他是有责任感、上进心的人。',
  '医生一枚，工作稳定。希望另一半也是稳定行业，温柔善良，互相理解，能一起奋斗。',
  '坐标厦门，会计工作。喜欢旅游、摄影、看展。希望遇到一个能一起看世界的人。',
  '985硕士，老师。喜欢读书、音乐、做饭。希望找到有趣的灵魂，三观一致，聊得来。',
  '英语老师+翻译，性格温和。平时喜欢撸猫、追剧、看电影。期待遇见同样爱生活的你。',
  '设计师一枚，坐标杭州。喜欢艺术展、独立电影、手工。希望遇到同样有审美、有趣的人。',
  '广告策划，脑洞大。喜欢剧本杀、密室、livehouse。希望遇到有好奇心、爱玩的人。',
  '运营喵，养了两只猫。喜欢咖啡、摄影、vlog。希望未来的他能理解我的忙碌，一起成长。'
];
const bios_m = [
  '坐标福州，互联网产品经理。喜欢健身、看纪录片、旅游。期待遇到温柔善良、三观一致的她。',
  '985 硕士，工程师。性格稳重、上进。喜欢篮球、跑步、看书。希望未来的她温柔、善良、独立。',
  '医生，坐标上海。工作稳定，希望找一个能相互理解、一起生活的女生。',
  '公务员，坐标杭州。喜欢读书、健身、旅游。希望遇到温柔善良、有自己想法的女生。',
  '金融行业，坐标深圳。喜欢滑雪、潜水、看话剧。希望未来的她温柔、独立、爱生活。',
  '高校教师，坐标厦门。喜欢科研、音乐、烹饪。希望找到一个温柔贤惠的她。',
  '律师，坐标北京。喜欢读书、看展、撸猫。希望遇到温柔、有自己事业的女生。',
  '架构师，坐标上海。爱跑步、看科幻、做饭。希望遇到同样有事业心、懂生活的她。',
  '创业者，坐标深圳。喜欢咖啡、看书、户外。希望遇到能一起成长、互相成就的她。',
  '基金经理，坐标广州。喜欢旅行、音乐、健身。希望找到一个温柔大气、三观正的女生。'
];

// picsum.photos 真实人像：用 seed 锁定，确保同用户多次刷新头像稳定
function avatarUrl(seed, idx = 0) {
  // 用 randomuser.me 的真人头像（公开 free 头像 API），更接近真实人像
  // fallback: picsum
  return `https://i.pravatar.cc/400?img=${(seed * 7 + idx) % 70 + 1}`;
}
function photoUrl(seed, idx) {
  return `https://picsum.photos/seed/zeai${seed}x${idx}/400/600`;
}

// 随机
function pick(arr, seed) { return arr[seed % arr.length]; }
function randInt(min, max, seed) { return min + (seed * 9301 + 49297) % (max - min + 1); }

let count = 0;
users.forEach((u, i) => {
  // 已有 form 不为空 + 头像真实的，保留不动（避免覆盖）
  const hasRealAvatar = u.avatar && !u.avatar.startsWith('data:image/svg+xml');
  const hasFullForm = u.form && Object.keys(u.form).length >= 20;
  if (hasRealAvatar && hasFullForm) return;

  const seed = (parseInt(u.userId) || i + 1);
  const isF = u.gender === '女';

  // 昵称/性别：保留原值
  // 头像：用 i.pravatar.cc 真人头像
  const av = avatarUrl(seed, 0);
  u.avatar = av;
  // 3 张照片
  u.photos = [av, photoUrl(seed, 1), photoUrl(seed, 2), photoUrl(seed, 3)].slice(0, 4);

  // 年龄：保留
  const age = u.age || (isF ? randInt(22, 32, seed) : randInt(25, 38, seed));
  u.age = age;

  // 微信号：wechat 字段（中英文+数字，6-20 字符）
  u.wechat = 'wx_' + (isF ? 'mm' : 'gg') + '_' + (1000 + (seed * 17) % 9000);

  // form：22 字段全填
  const f = u.form || {};
  f.realName = f.realName || u.nickname;
  f.age = age;
  f.birthday = `${new Date().getFullYear() - age}-${String(randInt(1,12,seed)).padStart(2,'0')}-${String(randInt(1,28,seed+1)).padStart(2,'0')}`;
  f.height = isF ? randInt(155, 172, seed) : randInt(170, 188, seed);
  f.weight = isF ? randInt(42, 58, seed) : randInt(60, 88, seed);
  f.currentCity = u.city || pick(isF ? cities_f : cities_m, seed);
  u.city = f.currentCity;
  f.education = pick(isF ? edu_f : edu_m, seed);
  f.school = pick(isF ? schools_f : schools_m, seed + 3);
  f.major = pick(isF ? majors_f : majors_m, seed + 5);
  f.job = pick(isF ? jobs_f : jobs_m, seed + 7);
  f.company = pick(companies, seed + 11);
  f.income = pick(isF ? income_f_pool : income_m_pool, seed + 13);
  u.income = f.income;
  f.maritalStatus = pick(marital, seed + 17);
  u.marriage = f.maritalStatus;
  f.hasChild = pick(hasChild, seed + 19);
  f.wantChild = pick(wantChild, seed + 23);
  f.house = pick(houses, seed + 29);
  f.car = pick(cars, seed + 31);
  f.smoke = pick(smoke, seed + 37);
  f.drink = pick(drink, seed + 41);
  f.cooking = pick(cooking, seed + 43);
  f.hobby = pick(isF ? hobbies_f : hobbies_m, seed + 47);
  f.bio = pick(isF ? bios_f : bios_m, seed + 53);
  u.bio = f.bio;
  f.avatarIdx = (seed * 7) % 70 + 1;
  u.form = f;

  // 标签：随机 2-3 个
  const tagPool_f = ['爱笑的女生', '温柔善良', '会做饭', '爱旅游', '爱运动', '爱读书', '撸猫一族', '美食家', '音乐控', '电影迷'];
  const tagPool_m = ['阳光男孩', '事业心强', '爱健身', '会做饭', '爱旅游', '爱读书', '铲屎官', '音乐控', '电影迷', '孝顺'];
  const tags = [];
  const pool = isF ? tagPool_f : tagPool_m;
  tags.push(pick(pool, seed));
  tags.push(pick(pool, seed + 5));
  if (seed % 3 === 0) tags.push(pick(pool, seed + 11));
  u.tags = Array.from(new Set(tags));

  // 等级/vip 随机
  u.level = (seed % 4) + 1;
  u.vip = seed % 4 === 0;
  u.verified = seed % 3 === 0;
  u.online = seed % 2 === 0;
  u.password = u.password || '123456';

  count++;
});

fs.writeFileSync(DATA, JSON.stringify(users, null, 2), 'utf8');
console.log(`已补齐 ${count} 个用户资料（共 ${users.length} 人）`);
console.log('示例：', JSON.stringify(users[0], null, 2).slice(0, 800));
