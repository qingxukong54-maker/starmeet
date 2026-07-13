// zeai_server.js - StarMeet 跨界交友平台
// 零依赖，Node 22+ 自带 http/fs/path/crypto
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
let ExcelJS = null;
try { ExcelJS = require('exceljs'); } catch(e) { console.warn('exceljs not installed, export features will be disabled'); }
const { sendCodeMail } = require('./mailer');

const PORT = process.env.PORT || 8091;
const ROOT = __dirname;
const SITE_VERSION = '1.0.2';
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'h5');
const ADMIN_DIR = path.join(ROOT, 'admin');
const UPLOAD_DIR = path.join(ROOT, 'data', 'uploads');
const AVATAR_DIR = path.join(ROOT, 'data', 'avatars');
const ICON_DIR = path.join(ROOT, 'data', 'uploads', 'icons');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(AVATAR_DIR)) fs.mkdirSync(AVATAR_DIR, { recursive: true });
if (!fs.existsSync(ICON_DIR)) fs.mkdirSync(ICON_DIR, { recursive: true });

// 默认头像（SVG内联生成，避免外网）
function defaultAvatar(gender, idx) {
  const colors = gender === '女'
    ? ['#ffb3b3','#ffc1cc','#ffd1dc','#ffe4e1','#fff0f5','#ffd6e0','#ffb6c1','#ffaaa5']
    : ['#a8d8ea','#aa96da','#84ceeb','#82aaff','#95e1d3','#b4f8c8','#c0c0ff','#b8d4f0'];
  const color = colors[idx % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${color}"/>
    <circle cx="50" cy="38" r="16" fill="#fff" opacity="0.9"/>
    <path d="M 20 90 Q 50 60 80 90 Z" fill="#fff" opacity="0.9"/>
    <text x="50" y="55" font-size="20" text-anchor="middle" fill="${color}" font-weight="bold">${gender === '女' ? '♀' : '♂'}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
function defaultCover(idx) {
  const colors = ['#ff5a5f','#ff8a3d','#1890ff','#52c41a','#722ed1','#13c2c2','#fa8c16','#eb2f96'];
  const c = colors[idx % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>
    <rect width="600" height="300" fill="url(#g)" opacity="0.8"/>
    <text x="300" y="160" font-size="48" text-anchor="middle" fill="#fff" font-weight="bold">StarMeet</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

// ============ 简易 JSON 数据库 ============
class JsonDB {
  constructor(file, defaultData = []) {
    this.file = path.join(DATA_DIR, file);
    this.data = this._load(defaultData);
  }
  _load(defaultData) {
    try {
      if (!fs.existsSync(this.file)) {
        fs.writeFileSync(this.file, JSON.stringify(defaultData, null, 2), 'utf-8');
        return defaultData;
      }
      return JSON.parse(fs.readFileSync(this.file, 'utf-8'));
    } catch (e) { return defaultData; }
  }
  save() { fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf-8'); }
  all() { return this.data; }
  find(predicate) { return this.data.find(predicate); }
  filter(predicate) { return this.data.filter(predicate); }
  insert(record) {
    if (!record.id) record.id = crypto.randomBytes(6).toString('hex');
    record.createdAt = record.createdAt || new Date().toISOString();
    this.data.push(record);
    this.save();
    return record;
  }
  update(id, patch) {
    const idx = this.data.findIndex(x => x.id === id);
    if (idx === -1) return null;
    this.data[idx] = { ...this.data[idx], ...patch, updatedAt: new Date().toISOString() };
    this.save();
    return this.data[idx];
  }
  delete(id) {
    const idx = this.data.findIndex(x => x.id === id);
    if (idx === -1) return false;
    this.data.splice(idx, 1);
    this.save();
    return true;
  }
}

// ============ 站点配置 / Banner / 找缘分模块 / 今日之星 / 协议 / VIP ============
// 站点配置：logo (dataURL 或 /uploads/.../avatars/...) + 顶部文字
const siteConfigDB = new JsonDB('site_config.json', {
  logoType: 'emoji',           // emoji | image
  logoEmoji: '💕',
  logoImage: '',                // 当 logoType=image 时使用
  siteName: 'StarMeet-跨界交友',
  siteSlogan: '圈层升级',
  navConfig: [
    { icon: '🏠', title: '首页', page: 'home', enabled: true },
    { icon: '💖', title: '找缘分', page: 'match', enabled: true },
    { icon: '🎉', title: '活动', page: 'activity', enabled: true },
    { icon: '📖', title: '学堂', page: 'school', enabled: true },
    { icon: '💬', title: '圈子', page: 'circle', enabled: true },
    { icon: '🧠', title: '心理测试', page: 'psychtest', enabled: true },
    { icon: '👤', title: '我的', page: 'mine', enabled: true }
  ]
});

// 首页轮播 Banner
const bannersDB = new JsonDB('banners.json', [
  { title: '跨界交友', subtitle: '圈层升级 · 跨界连接 · 遇见不同', image: '', ctaText: '立即交友', ctaLink: 'match', bgColor: '#ff5a5f' },
  { title: '圈层升级', subtitle: '专业匹配 · 全程跟进 · 提高社交效率', image: '', ctaText: '了解服务', ctaLink: 'mine', bgColor: '#ff8a3d' },
  { title: '今日之星', subtitle: '每天认识一位有趣的灵魂', image: '', ctaText: '查看推荐', ctaLink: 'match', bgColor: '#722ed1' }
]);

// 找缘分模块（首页"快速入口"那种卡片，但内容可后台配）
const matchBannersDB = new JsonDB('match_banners.json', [
  { title: '找缘分', subtitle: '海量优质会员', icon: '💖', link: 'match', color: '#ff5a5f', enabled: true },
  { title: '交友活动', subtitle: '线下面对面更靠谱', icon: '🎉', link: 'activity', color: '#ff8a3d', enabled: true },
  { title: '资讯广场', subtitle: '社交技巧全攻略', icon: '📚', link: 'school', color: '#52c41a', enabled: true },
  { title: '专属服务', subtitle: '1对1匹配推荐', icon: '👤', link: 'mine', color: '#722ed1', enabled: true }
]);

// 今日之星：标题副标题 + items[{id, userId, timeStart, timeEnd}]
const starConfigDB = new JsonDB('star_config.json', {
  title: '今日之星',
  subtitle: '看看今天有谁在线',
  items: []   // {id, userId, timeStart, timeEnd, createdAt}
});

// 圈子帖子
const circlePostsDB = new JsonDB('circle_posts.json', []);

// 协议和VIP等级配置
const agreements = {
  vip: {
    title: 'StarMeet VIP会员服务协议',
    content: `第一条 定义
本协议中"VIP会员"指付费享受StarMeet平台高级功能的用户。
"VIP服务"包括但不限于：无限畅聊、专属标识、优先推荐、红娘一对一、查看谁喜欢我等。

第二条 服务内容
1. 基础VIP：无限浏览、每日5条消息
2. 银卡VIP：无限消息、查看100公里内访客
3. 金卡VIP：无限消息、查看全国访客、专属标识
4. 钻石VIP：包含金卡所有权益 + 红娘一对一
5. 至尊VIP：包含钻石所有权益 + 优先推荐 + 活动免费

第三条 费用和续费
- VIP服务一经购买，原则上不予退款
- 自动续费可随时关闭
- 续费价格可能调整，已付费用户享受价格保护

第四条 用户守则
- 不得发布虚假信息
- 不得骚扰其他用户
- 不得用于商业目的
- 违反规定将取消VIP资格

（本协议为演示版，上线前请咨询专业律师）`
  },
  user: {
    title: 'StarMeet 平台用户服务协议',
    content: `一、服务说明
StarMeet是一款婚恋交友平台，致力于为单身用户提供真实、严肃的婚恋服务。

二、用户资格
1. 年满18周岁的单身人士
2. 提供真实有效的个人信息
3. 同意并遵守本协议

三、用户行为规范
- 文明礼貌、诚实守信
- 不得发布违法违规内容
- 不得侵犯他人隐私
- 不得进行诈骗活动

四、隐私保护
- 严格保护用户个人信息
- 不会向第三方泄露
- 用户可随时查看、修改、删除自己的信息

五、免责声明
- 平台仅提供信息撮合服务
- 用户间的交往由双方自行负责
- 平台不对交往结果承担责任

六、协议修改
平台有权根据需要修改本协议，修改后会提前通知用户。

（本协议为演示版，上线前请咨询专业律师）`
  }
};

// VIP等级配置（可后台编辑）
let vipLevels = [
  { level: 1, name: '基础会员', color: '#999', price: 0,
    privileges: ['浏览资料', '每日3条消息', '基础筛选'] },
  { level: 2, name: '银卡VIP', color: '#c0c0c0', price: 99,
    privileges: ['无限消息', '查看100公里访客', '专属标识'] },
  { level: 3, name: '金卡VIP', color: '#f6c453', price: 199,
    privileges: ['银卡全部权益', '查看全国访客', '高级筛选', '隐身访问'] },
  { level: 4, name: '钻石VIP', color: '#b9f2ff', price: 399,
    privileges: ['金卡全部权益', '红娘一对一', '优先推荐', '活动免费'] },
  { level: 5, name: '至尊VIP', color: '#ff5a5f', price: 999,
    privileges: ['钻石全部权益', '专属客服', '定制化匹配', '线下活动VIP席位'] }
];

const vipLevelsDB = new JsonDB('vip_levels.json', vipLevels);
vipLevels = vipLevelsDB.all();
// 每次启动重新读取
setInterval(() => { vipLevels = vipLevelsDB.all(); }, 5000);

// ============ 初始化数据 ============
const usersDB = new JsonDB('users.json', []);
const adminsDB = new JsonDB('admins.json', [
  { id: 'admin001', username: 'admin', password: 'admin888', role: 'super', createdAt: new Date().toISOString() }
]);
const articlesDB = new JsonDB('articles.json', []);
const activitiesDB = new JsonDB('activities.json', []);
const articleCategoriesDB = new JsonDB('article_categories.json', [
  { id: 'cat_love', name: '脱单指南', order: 1 },
  { id: 'cat_date', name: '约会技巧', order: 2 },
  { id: 'cat_blind', name: '相亲攻略', order: 3 },
  { id: 'cat_keep', name: '感情保鲜', order: 4 },
  { id: 'cat_pre', name: '婚前必读', order: 5 }
]);
const messagesDB = new JsonDB('messages.json', []);
const settingsDB = new JsonDB('settings.json', {
  siteName: 'StarMeet',
  servicePhone: '400-888-8888',
  serviceWechat: 'starmeet_cs',
  smsSign: '【StarMeet】',
  favicon: '/uploads/icons/favicon.png'
});
// 联系信息 DB（电话/微信/邮箱/地址/工作时间/在线客服链接/公众号二维码）
const contactConfigDB = new JsonDB('contact_config.json', {
  phone: '400-888-8888',
  phoneDisplay: '400-888-8888',
  wechat: 'starmeet_cs',
  wechatQrcode: '',
  email: 'service@starmeet.com',
  address: '福建省福州市鼓楼区五四路 158 号 星缘大厦 12 层',
  workTime: '周一至周日 09:00 - 21:00',
  serviceUrl: '',
  wecomLink: '',
  qrcodeImage: '',
  intro: 'StarMeet 跨界交友平台，专注圈层升级与跨界社交，让不同圈层的人相遇连接。专业匹配团队 + 严格认证体系，已帮助 10万+ 用户拓展社交圈。',
  // 页面样式可配置字段
  heroBgImage: '',
  heroTitle: '联系我们',
  heroDesc: '7×24 小时为您提供真诚服务',
  phoneLabel: '客服电话',
  wechatLabel: '客服微信号（点击复制）',
  emailLabel: '联系邮箱',
  addressLabel: '公司地址',
  workTimeLabel: '工作时间',
  serviceUrlLabel: '在线客服',
  wecomLinkLabel: '企业微信客服',
  qrcodeSectionTitle: '客服微信号二维码',
  qrcodeHint: '扫码添加客服微信，获取专属服务',
  introSectionTitle: '关于我们'
});
// 自动补全缺失字段（兼容旧数据）
(function migrateContactConfig() {
  const defaults = contactConfigDB.all();
  const needed = {
    heroBgImage: '', heroTitle: '联系我们', heroDesc: '7×24 小时为您提供真诚服务',
    phoneLabel: '客服电话', wechatLabel: '客服微信号（点击复制）', emailLabel: '联系邮箱',
    addressLabel: '公司地址', workTimeLabel: '工作时间', serviceUrlLabel: '在线客服',
    wecomLinkLabel: '企业微信客服', qrcodeSectionTitle: '客服微信号二维码',
    qrcodeHint: '扫码添加客服微信，获取专属服务', introSectionTitle: '关于我们'
  };
  let changed = false;
  for (const [k, v] of Object.entries(needed)) {
    if (!(k in defaults)) { defaults[k] = v; changed = true; }
  }
  if (changed) { contactConfigDB.data = defaults; contactConfigDB.save(); }
})();

// VIP服务页面配置 DB（定制会员页面的所有可编辑内容）
const vipServiceConfigDB = new JsonDB('vip_service_config.json', {
  pageTitle: '定制会员',
  tab1Name: '定制会员',
  tab2Name: '关于我们',
  bannerImage: '',
  bannerTitle: '爱只能定制\n不可复制',
  bannerSubtitle: '',
  section1Title: '哪些人适合1对1定制服务',
  crowdItems: [
    { icon: '/uploads/vip_icons/icon_tired.svg', title: '交友疲惫', desc: '没有方向' },
    { icon: '/uploads/vip_icons/icon_busy.svg', title: '工作忙碌', desc: '异性圈窄' },
    { icon: '/uploads/vip_icons/icon_independent.svg', title: '独立自主', desc: '不愿将就' },
    { icon: '/uploads/vip_icons/icon_private.svg', title: '身份特殊', desc: '需要私密' }
  ],
  section2Title: '专属服务 祝你脱单',
  serviceItems: [
    { icon: '/uploads/vip_icons/icon_match.svg', title: '精准1对1匹配', desc: '匹配老师1对1深度了解，专属服务。' },
    { icon: '/uploads/vip_icons/icon_recommend.svg', title: '红娘主动推荐', desc: '匹配老师根据你的需求主动筛选推荐。' },
    { icon: '/uploads/vip_icons/icon_unlock.svg', title: '开放隐藏会员', desc: '部分隐藏优质资源为你打开。' },
    { icon: '/uploads/vip_icons/icon_priority.svg', title: '优先优质配对', desc: '高颜值，公务员等优质精英优先为你匹配。' },
    { icon: '/uploads/vip_icons/icon_coaching.svg', title: '情感指导服务', desc: '专属匹配老师提供情感咨询与辅导，辅助你脱单。' },
    { icon: '/uploads/vip_icons/icon_image.svg', title: '个人形象提升', desc: '专业指导形象改造，提升你的内外吸引力。' },
    { icon: '/uploads/vip_icons/icon_meetup.svg', title: '线下约见服务', desc: '双方互感兴趣，提供约会方案，安排见面。' },
    { icon: '/uploads/vip_icons/icon_feedback.svg', title: '及时反馈结果', desc: '牵线或约见后，及时跟进反馈双方印象。' }
  ],
  aboutContent: ''
});

// 邮件配置（数组化：单条配置也用数组存，方便 JsonDB 统一管理）
// 注意：mailConfig 是单条配置，存为 [config] 一项
const _defaultMailConfig = {
  id: 'mail',
  smtpHost: 'smtp.qq.com',
  smtpPort: 465,
  secure: true,
  user: '83732317@qq.com',
  pass: 'hjrppudloufvbife',
  fromName: 'StarMeet',
  codeSubject: '【StarMeet】您的注册验证码',
  codeTemplate: '您的注册验证码是：{code}\n\n验证码 10 分钟内有效，请尽快使用。\n\n如果不是您本人操作，请忽略此邮件。'
};
const mailConfigDB = new JsonDB('mail_config.json', [_defaultMailConfig]);
const emailCodesDB = new JsonDB('email_codes.json', []);
const surveysDB = new JsonDB('surveys.json', []);
const surveyResponsesDB = new JsonDB('survey_responses.json', []);
const splashAdsDB = new JsonDB('splash_ads.json', []);

// 计数器数据库（用文件而非JsonDB，支持原子更新）
const counterFile = path.join(DATA_DIR, 'counter.json');
let counter = { nextUserId: 1 };
if (fs.existsSync(counterFile)) {
  try { counter = JSON.parse(fs.readFileSync(counterFile, 'utf-8')); } catch(e) {}
}
function saveCounter() { fs.writeFileSync(counterFile, JSON.stringify(counter, null, 2)); }
function nextUserId() {
  const id = String(counter.nextUserId).padStart(5, '0');
  counter.nextUserId++;
  saveCounter();
  return id;
}

// 计算活动状态：未开始 / 报名中 / 报名截止
function statusForActivity(a, now = new Date()) {
  const joined = Number(a.joined || 0);
  const total = Number(a.total || 0);
  if (a.signupStart) {
    const start = new Date(a.signupStart);
    if (!isNaN(start.getTime()) && now < start) return '未开始';
  }
  if (a.signupEnd) {
    const end = new Date(a.signupEnd);
    if (!isNaN(end.getTime()) && now > end) return '报名截止';
  }
  if (total > 0 && joined >= total) return '报名截止';
  return '报名中';
}

// ============ StarMeet信息收集表字段（行业通用版本）===========
const MALE_FIELDS = [
  { key: 'realName', label: '真实姓名', type: 'text', required: true, sensitive: true },
  { key: 'idCard', label: '身份证号', type: 'text', required: true, sensitive: true },
  { key: 'birthday', label: '出生年月', type: 'date', required: true },
  { key: 'height', label: '身高(cm)', type: 'number', required: true },
  { key: 'weight', label: '体重(kg)', type: 'number', required: false },
  { key: 'nationality', label: '民族', type: 'text', required: false },
  { key: 'hukou', label: '户籍所在地', type: 'text', required: true },
  { key: 'currentCity', label: '现居地', type: 'text', required: true },
  { key: 'education', label: '学历', type: 'select', options: ['高中','中专','大专','本科','硕士','博士'], required: true },
  { key: 'school', label: '毕业院校', type: 'text', required: false },
  { key: 'major', label: '所学专业', type: 'text', required: false },
  { key: 'job', label: '职业', type: 'text', required: true },
  { key: 'company', label: '工作单位', type: 'text', required: false },
  { key: 'income', label: '年收入', type: 'select', options: ['5万以下','5-10万','10-20万','20-30万','30-50万','50-100万','100万以上'], required: true },
  { key: 'maritalStatus', label: '婚姻状况', type: 'select', options: ['未婚','离异未育','离异有孩','丧偶'], required: true },
  { key: 'hasChild', label: '是否有子女', type: 'radio', options: ['无','有(跟我)','有(不跟我)'], required: true },
  { key: 'wantChild', label: '是否要孩子', type: 'radio', options: ['要','不要','看情况'], required: true },
  { key: 'house', label: '是否有房', type: 'radio', options: ['有(无贷款)','有(有贷款)','无','与父母同住'], required: true },
  { key: 'car', label: '是否有车', type: 'radio', options: ['有','无'], required: true },
  { key: 'parentsJob', label: '父母职业', type: 'text', required: false },
  { key: 'smoke', label: '是否吸烟', type: 'radio', options: ['不吸','偶尔','经常'], required: true },
  { key: 'drink', label: '是否饮酒', type: 'radio', options: ['不饮','偶尔','经常'], required: true },
  { key: 'schedule', label: '作息时间', type: 'select', options: ['早睡早起','晚睡晚起','不规律'], required: false },
  { key: 'cooking', label: '是否会做饭', type: 'radio', options: ['精通','一般','不会'], required: false },
  { key: 'pets', label: '是否养宠物', type: 'text', required: false },
  { key: 'hobby', label: '兴趣爱好', type: 'text', required: false },
  { key: 'sport', label: '运动习惯', type: 'text', required: false },
  { key: 'travel', label: '旅行经历', type: 'text', required: false },
  { key: 'language', label: '掌握语言', type: 'text', required: false },
  { key: 'mateAgeRange', label: '期望对方年龄', type: 'text', required: true },
  { key: 'mateHeightRange', label: '期望对方身高', type: 'text', required: false },
  { key: 'mateEducation', label: '期望对方学历', type: 'text', required: false },
  { key: 'mateCity', label: '期望对方地区', type: 'text', required: false },
  { key: 'mateJob', label: '期望对方职业', type: 'text', required: false },
  { key: 'mateMarital', label: '期望对方婚况', type: 'text', required: false },
  { key: 'mateOther', label: '其他要求', type: 'textarea', required: false }
];

const FEMALE_FIELDS = [
  { key: 'realName', label: '真实姓名', type: 'text', required: true, sensitive: true },
  { key: 'idCard', label: '身份证号', type: 'text', required: true, sensitive: true },
  { key: 'birthday', label: '出生年月', type: 'date', required: true },
  { key: 'height', label: '身高(cm)', type: 'number', required: true },
  { key: 'weight', label: '体重(kg)', type: 'number', required: false },
  { key: 'nationality', label: '民族', type: 'text', required: false },
  { key: 'hukou', label: '户籍所在地', type: 'text', required: true },
  { key: 'currentCity', label: '现居地', type: 'text', required: true },
  { key: 'education', label: '学历', type: 'select', options: ['高中','中专','大专','本科','硕士','博士'], required: true },
  { key: 'school', label: '毕业院校', type: 'text', required: false },
  { key: 'major', label: '所学专业', type: 'text', required: false },
  { key: 'job', label: '职业', type: 'text', required: false },
  { key: 'company', label: '工作单位', type: 'text', required: false },
  { key: 'income', label: '年收入', type: 'select', options: ['5万以下','5-10万','10-20万','20-30万','30-50万','50万以上'], required: false },
  { key: 'maritalStatus', label: '婚姻状况', type: 'select', options: ['未婚','离异未育','离异有孩','丧偶'], required: true },
  { key: 'hasChild', label: '是否有子女', type: 'radio', options: ['无','有(跟我)','有(不跟我)'], required: true },
  { key: 'wantChild', label: '是否要孩子', type: 'radio', options: ['要','不要','看情况'], required: true },
  { key: 'house', label: '是否有房', type: 'radio', options: ['有(无贷款)','有(有贷款)','无','与父母同住'], required: false },
  { key: 'car', label: '是否有车', type: 'radio', options: ['有','无'], required: false },
  { key: 'parentsJob', label: '父母职业', type: 'text', required: false },
  { key: 'smoke', label: '是否吸烟', type: 'radio', options: ['不吸','偶尔','经常'], required: false },
  { key: 'drink', label: '是否饮酒', type: 'radio', options: ['不饮','偶尔','经常'], required: false },
  { key: 'schedule', label: '作息时间', type: 'select', options: ['早睡早起','晚睡晚起','不规律'], required: false },
  { key: 'cooking', label: '是否会做饭', type: 'radio', options: ['精通','一般','不会'], required: false },
  { key: 'pets', label: '是否养宠物', type: 'text', required: false },
  { key: 'hobby', label: '兴趣爱好', type: 'text', required: false },
  { key: 'sport', label: '运动习惯', type: 'text', required: false },
  { key: 'travel', label: '旅行经历', type: 'text', required: false },
  { key: 'language', label: '掌握语言', type: 'text', required: false },
  { key: 'mateAgeRange', label: '期望对方年龄', type: 'text', required: true },
  { key: 'mateHeightRange', label: '期望对方身高', type: 'text', required: false },
  { key: 'mateEducation', label: '期望对方学历', type: 'text', required: false },
  { key: 'mateCity', label: '期望对方地区', type: 'text', required: false },
  { key: 'mateJob', label: '期望对方职业', type: 'text', required: false },
  { key: 'mateMarital', label: '期望对方婚况', type: 'text', required: false },
  { key: 'mateOther', label: '其他要求', type: 'textarea', required: false }
];

// 假数据：会员（20个，含完整表单字段）
if (usersDB.all().length === 0) {
  const males = [
    { realName: '张志远', age: 30, height: 178, weight: 70, currentCity: '福州', education: '本科', school: '厦门大学', major: '计算机', job: '高级工程师', company: '某科技公司', income: '20-30万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '有(有贷款)', car: '有', smoke: '不吸', drink: '偶尔', cooking: '精通', hobby: '编程、阅读、跑步', bio: '希望找一个温柔善良、有自己事业的她', avatarIdx: 0 },
    { realName: '李建国', age: 32, height: 182, weight: 75, currentCity: '厦门', education: '硕士', school: '福州大学', major: '机械工程', job: '工程师', company: '某制造业', income: '30-50万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '有(无贷款)', car: '有', smoke: '不吸', drink: '不饮', cooking: '一般', hobby: '摄影、徒步', bio: '认真生活，期待遇见对的人', avatarIdx: 1 },
    { realName: '黄文博', age: 28, height: 175, weight: 68, currentCity: '福州', education: '本科', school: '福建师大', major: '市场营销', job: '销售经理', company: '某外企', income: '15-25万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '有(有贷款)', car: '有', smoke: '不吸', drink: '偶尔', cooking: '一般', hobby: '篮球、电影', bio: '爱运动爱美食，阳光开朗', avatarIdx: 2 },
    { realName: '杨天宇', age: 27, height: 180, weight: 72, currentCity: '泉州', education: '本科', school: '华侨大学', major: '教育学', job: '教师', company: '某中学', income: '10-15万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '无', car: '无', smoke: '不吸', drink: '不饮', cooking: '精通', hobby: '读书、音乐', bio: '陪伴是最长情的告白', avatarIdx: 3 },
    { realName: '何俊豪', age: 29, height: 176, weight: 70, currentCity: '福州', education: '本科', school: '集美大学', major: '行政管理', job: '公务员', company: '某机关', income: '12-18万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '有(无贷款)', car: '有', smoke: '不吸', drink: '偶尔', cooking: '一般', hobby: '书法、象棋', bio: '稳定工作，稳定的心', avatarIdx: 4 },
    { realName: '徐浩然', age: 31, height: 178, weight: 73, currentCity: '厦门', education: '本科', school: '中国政法大学', major: '法学', job: '律师', company: '某律所', income: '25-40万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '有(有贷款)', car: '有', smoke: '不吸', drink: '偶尔', cooking: '一般', hobby: '高尔夫、读书', bio: '认真对待每一段关系', avatarIdx: 5 },
    { realName: '高健', age: 26, height: 173, weight: 65, currentCity: '福州', education: '大专', school: '某高职', major: '烹饪', job: '厨师', company: '某餐厅', income: '8-12万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '无', car: '无', smoke: '不吸', drink: '偶尔', cooking: '精通', hobby: '烹饪、旅行', bio: '会做饭的男人最帅', avatarIdx: 6 },
    { realName: '林志杰', age: 30, height: 179, weight: 75, currentCity: '福州', education: '本科', school: '上海交大', major: '金融', job: '投资经理', company: '某基金', income: '30-50万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '有(无贷款)', car: '有', smoke: '偶尔', drink: '偶尔', cooking: '一般', hobby: '滑雪、品酒', bio: '在金融圈摸爬滚打，期待温柔的你', avatarIdx: 7 },
    { realName: '陈伟豪', age: 28, height: 174, weight: 68, currentCity: '莆田', education: '本科', school: '福建医科大', major: '临床医学', job: '医生', company: '某医院', income: '15-25万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '有(有贷款)', car: '有', smoke: '不吸', drink: '偶尔', cooking: '一般', hobby: '跑步、读书', bio: '救死扶伤，也想被温柔以待', avatarIdx: 0 },
    { realName: '马天宇', age: 27, height: 181, weight: 70, currentCity: '福州', education: '本科', school: '中央美院', major: '设计', job: '设计师', company: '某设计公司', income: '12-20万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '无', car: '无', smoke: '不吸', drink: '偶尔', cooking: '一般', hobby: '艺术、音乐', bio: '用设计的眼光看世界', avatarIdx: 1 }
  ];
  const females = [
    { realName: '林晓雪', age: 26, height: 165, weight: 50, currentCity: '福州', education: '本科', school: '福州大学', major: '设计', job: '设计师', company: '某设计公司', income: '10-20万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '有(有贷款)', car: '有', smoke: '不吸', drink: '偶尔', cooking: '精通', hobby: '旅行、看展、撸猫', bio: '喜欢旅行、看展、撸猫，希望遇到一个有趣的灵魂', avatarIdx: 0 },
    { realName: '陈思颖', age: 24, height: 162, weight: 48, currentCity: '厦门', education: '本科', school: '厦门大学', major: '教育', job: '教师', company: '某小学', income: '8-15万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '无', car: '无', smoke: '不吸', drink: '不饮', cooking: '一般', hobby: '读书、钢琴', bio: '认真生活，期待遇见对的人', avatarIdx: 1 },
    { realName: '王梓涵', age: 28, height: 168, weight: 52, currentCity: '泉州', education: '硕士', school: '福建医科大', major: '临床医学', job: '医生', company: '某医院', income: '20-30万', maritalStatus: '未婚', hasChild: '无', wantChild: '看情况', house: '有(有贷款)', car: '有', smoke: '不吸', drink: '偶尔', cooking: '一般', hobby: '瑜伽、阅读', bio: '工作比较忙，希望找一位能相互理解的另一半', avatarIdx: 2 },
    { realName: '刘美玲', age: 25, height: 163, weight: 49, currentCity: '福州', education: '大专', school: '某高职', major: '美容', job: '美甲师', company: '某美甲店', income: '5-10万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '无', car: '无', smoke: '不吸', drink: '不饮', cooking: '一般', hobby: '美妆、追剧', bio: '性格开朗，爱交朋友', avatarIdx: 3 },
    { realName: '赵雨彤', age: 27, height: 167, weight: 51, currentCity: '莆田', education: '本科', school: '集美大学', major: '会计', job: '会计', company: '某公司', income: '10-15万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '有(有贷款)', car: '有', smoke: '不吸', drink: '偶尔', cooking: '精通', hobby: '烹饪、阅读', bio: '稳定的另一半比浪漫更重要', avatarIdx: 4 },
    { realName: '孙嘉怡', age: 23, height: 160, weight: 46, currentCity: '福州', education: '本科', school: '福建幼儿师专', major: '学前教育', job: '幼教', company: '某幼儿园', income: '6-10万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '无', car: '无', smoke: '不吸', drink: '不饮', cooking: '一般', hobby: '舞蹈、画画', bio: '喜欢小朋友，期待幸福的家庭', avatarIdx: 5 },
    { realName: '周晓晓', age: 29, height: 170, weight: 55, currentCity: '厦门', education: '本科', school: '厦门理工', major: '人力资源', job: 'HR经理', company: '某外企', income: '12-20万', maritalStatus: '离异未育', hasChild: '无', wantChild: '看情况', house: '有(无贷款)', car: '有', smoke: '不吸', drink: '偶尔', cooking: '一般', hobby: '旅行、摄影', bio: '经历过，更懂得珍惜', avatarIdx: 6 },
    { realName: '吴婷婷', age: 25, height: 164, weight: 49, currentCity: '福州', education: '本科', school: '闽南师大', major: '市场营销', job: '市场专员', company: '某公司', income: '8-12万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '无', car: '无', smoke: '不吸', drink: '偶尔', cooking: '一般', hobby: '美食、旅行', bio: '爱美食爱旅行爱生活', avatarIdx: 7 },
    { realName: '钱心怡', age: 26, height: 166, weight: 50, currentCity: '漳州', education: '本科', school: '福州大学', major: '产品设计', job: '产品经理', company: '某互联网公司', income: '15-25万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '有(有贷款)', car: '有', smoke: '不吸', drink: '偶尔', cooking: '一般', hobby: '设计、瑜伽', bio: '理性又浪漫的双子座', avatarIdx: 0 },
    { realName: '郑丽娜', age: 24, height: 161, weight: 47, currentCity: '福州', education: '大专', school: '某高职', major: '销售', job: '销售', company: '某公司', income: '8-15万', maritalStatus: '未婚', hasChild: '无', wantChild: '要', house: '无', car: '无', smoke: '偶尔', drink: '偶尔', cooking: '一般', hobby: '唱歌、追剧', bio: '爱笑爱闹，希望遇到一个包容我的人', avatarIdx: 1 }
  ];

  const allUsers = [];
  let userIdCounter = 1;
  const baseTime = Date.now() - 1000 * 60 * 60 * 24 * 7; // 7天前开始

  males.forEach((m, i) => {
    const uid = String(userIdCounter++).padStart(5, '0');
    const u = {
      userId: uid,
      phone: '1390000' + String(i + 1).padStart(4, '0'),
      password: '123456',
      nickname: m.realName,
      gender: '男',
      avatar: defaultAvatar('男', m.avatarIdx || i),
      photos: [defaultAvatar('男', m.avatarIdx || i), defaultAvatar('男', (m.avatarIdx + 1) || i)],
      level: [1, 2, 3, 4][i % 4],
      vip: i % 3 !== 0,
      verified: i % 2 === 0,
      online: i % 2 === 0,
      // 表单字段
      form: m,
      bio: m.bio,
      tags: ['阳光','上进','靠谱'],
      createdAt: new Date(baseTime + i * 1000 * 60 * 60 * 5).toISOString()
    };
    allUsers.push(u);
  });
  females.forEach((f, i) => {
    const uid = String(userIdCounter++).padStart(5, '0');
    const u = {
      userId: uid,
      phone: '1390001' + String(i + 1).padStart(4, '0'),
      password: '123456',
      nickname: f.realName,
      gender: '女',
      avatar: defaultAvatar('女', f.avatarIdx || i),
      photos: [defaultAvatar('女', f.avatarIdx || i), defaultAvatar('女', (f.avatarIdx + 1) || i)],
      level: [1, 2, 3, 4][i % 4],
      vip: i % 3 !== 0,
      verified: i % 2 === 0,
      online: i % 2 === 0,
      form: f,
      bio: f.bio,
      tags: ['温柔','爱笑','文艺'],
      createdAt: new Date(baseTime + (i + 10) * 1000 * 60 * 60 * 5).toISOString()
    };
    allUsers.push(u);
  });

  allUsers.forEach(u => {
    // 顶层补 age/city 字段（确保前台/后台都能读），不设默认值
    u.age = u.age || u.form?.age || null;
    u.city = u.city || u.form?.currentCity || '';
    u.height = u.height || u.form?.height || null;
    u.weight = u.weight || u.form?.weight || null;
    u.education = u.education || u.form?.education || '';
    u.job = u.job || u.form?.job || '';
    u.income = u.income || u.form?.income || '';
    u.marriage = u.marriage || u.form?.maritalStatus || '';
    usersDB.insert(u);
  });
}

// 同步 counter：已存在用户中最大的 userId 数字 + 1
{
  const all = usersDB.all();
  let maxId = 0;
  all.forEach(u => {
    const n = parseInt(String(u.userId || '0'), 10);
    if (!isNaN(n) && n > maxId) maxId = n;
  });
  counter.nextUserId = Math.max(counter.nextUserId, maxId + 1);
  saveCounter();
}

// 初始化今日之星的 items（如果为空）
{
  const cfg = starConfigDB.all();
  // 兼容旧版 userIds → items 迁移
  if ((!cfg.items || cfg.items.length === 0) && Array.isArray(cfg.userIds) && cfg.userIds.length) {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    const start = now.toISOString();
    starConfigDB.data = { ...cfg, items: cfg.userIds.map(uid => ({ id: 'st_' + Math.random().toString(36).slice(2, 9), userId: uid, timeStart: start, timeEnd: end, createdAt: now.toISOString() })) };
    starConfigDB.save();
  } else if (!cfg.items || cfg.items.length === 0) {
    const all = usersDB.all();
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
    const start = now.toISOString();
    const picked = all.filter(u => u.online).slice(0, 3).map(u => u.id);
    if (picked.length < 3) {
      all.slice(0, 3 - picked.length).forEach(u => { if (!picked.includes(u.id)) picked.push(u.id); });
    }
    starConfigDB.data = { ...cfg, items: picked.map(uid => ({ id: 'st_' + Math.random().toString(36).slice(2, 9), userId: uid, timeStart: start, timeEnd: end, createdAt: now.toISOString() })) };
    starConfigDB.save();
  }
}

// 假数据：资讯广场文章
if (articlesDB.all().length === 0) {
  const articles = [
    { title: '第一次约会怎么安排不踩雷？', author: '情感导师 林老师', views: 2356, likes: 128, cover: defaultCover(0), category: '约会技巧', content: '第一次约会的核心是让对方感到舒适而不是炫富。建议选择环境安静、可以聊天的场所，比如咖啡馆、展览、轻食餐厅。' },
    { title: '如何识别"高质量单身"和"假装单身"？', author: '心理咨询师 王老师', views: 1892, likes: 96, cover: defaultCover(1), category: '脱单指南', content: '真正高质量的单身是主动选择而非被动剩下，ta们有自己的生活节奏。' },
    { title: '相亲见面说什么话题最加分？', author: '红娘 张姐', views: 3214, likes: 215, cover: defaultCover(2), category: '相亲攻略', content: '推荐3个万能话题：旅行经历、最近看的电影/书、对未来生活的想象。' },
    { title: '异地恋真的能走到最后吗？', author: '情感导师 林老师', views: 1567, likes: 73, cover: defaultCover(3), category: '感情保鲜', content: '异地恋成功的关键是目标一致+沟通频次稳定+定期见面计划。' },
    { title: '结婚前必须问对方的10个问题', author: '心理咨询师 王老师', views: 4521, likes: 312, cover: defaultCover(4), category: '婚前必读', content: '财务观念、生育计划、父母养老、家庭分工、婚姻忠诚...这些婚前聊透，婚后少90%的矛盾。' },
    { title: '30+女性的婚恋优势在哪里？', author: '情感导师 林老师', views: 2789, likes: 167, cover: defaultCover(5), category: '脱单指南', content: '30+不是劣势，反而是阅历、独立性、情绪稳定性的综合优势。' }
  ];
  articles.forEach(a => articlesDB.insert(a));
}

// 假数据：活动（含三种状态示范）
if (activitiesDB.all().length === 0) {
  const now = new Date();
  const inDays = (n) => { const d = new Date(now.getTime() + n * 86400000); return d.toISOString().slice(0, 16); };
  const activities = [
    // 未开始：报名从 7 天后开始
    { title: '福州万圣节单身派对', time: '2026-10-31 19:00', city: '福州', place: '三坊七巷·光禄坊', price: 99, joined: 0, total: 50, cover: defaultCover(6), desc: '主题变装、互动游戏、神秘配对，遇见心动的TA', status: '未开始', signupStart: inDays(7), signupEnd: inDays(20), joins: [] },
    // 报名中：区间内
    { title: '厦门海边BBQ相亲局', time: '2026-11-15 15:00', city: '厦门', place: '环岛路木栈道', price: 128, joined: 18, total: 30, cover: defaultCover(7), desc: '海边BBQ+桌游互动+一对一速配', status: '报名中', signupStart: inDays(-5), signupEnd: inDays(10), joins: [] },
    // 报名中：免费徒步
    { title: '泉州古城徒步相亲', time: '2026-11-22 09:00', city: '泉州', place: '西街集合', price: 0, joined: 12, total: 20, cover: defaultCover(0), desc: '免费徒步+景点讲解+分组破冰', status: '报名中', signupStart: inDays(-2), signupEnd: inDays(15), joins: [] },
    // 报名截止：人数已满
    { title: '福州读书会·遇见相似的灵魂', time: '2026-12-07 14:00', city: '福州', place: '鼓岭·松林书舍', price: 58, joined: 16, total: 16, cover: defaultCover(1), desc: '本期书目《小王子》，聊聊爱情本来的样子', status: '报名截止', signupStart: inDays(-10), signupEnd: inDays(-1), joins: [] }
  ];
  activities.forEach(a => activitiesDB.insert(a));
}

// 初始化快捷入口（如果为空）
if (matchBannersDB.all().length === 0) {
  const defaultQuickEntries = [
    { id: 'mb_001', icon: '💖', color: '#ff5a6e', title: '找缘分', subtitle: '海量本地优质会员', linkType: 'page', link: 'match', enabled: true, sortOrder: 1 },
    { id: 'mb_002', icon: '🌹', color: '#ff8a3d', title: '约会', subtitle: '同城浪漫约会', linkType: 'page', link: 'match', enabled: true, sortOrder: 2 },
    { id: 'mb_003', icon: '🎉', color: '#ffc53d', title: '活动', subtitle: '线下面对面', linkType: 'page', link: 'activity', enabled: true, sortOrder: 3 },
    { id: 'mb_004', icon: '🦋', color: '#722ed1', title: '红娘', subtitle: '1对1专属牵线', linkType: 'page', link: 'mine', enabled: true, sortOrder: 4 },
    { id: 'mb_005', icon: '🌊', color: '#1890ff', title: '动态', subtitle: 'TA 的生活圈', linkType: 'page', link: 'match', enabled: true, sortOrder: 5 },
    { id: 'mb_006', icon: '📖', color: '#52c41a', title: '学堂', subtitle: '脱单技巧全攻略', linkType: 'page', link: 'school', enabled: true, sortOrder: 6 },
    { id: 'mb_007', icon: '🎬', color: '#eb2f96', title: '视频', subtitle: '视频交友认证', linkType: 'page', link: 'match', enabled: true, sortOrder: 7 },
    { id: 'mb_008', icon: '📞', color: '#13c2c2', title: '联系我们', subtitle: '7×24小时在线', linkType: 'page', link: 'contact', enabled: true, sortOrder: 8 }
  ];
  defaultQuickEntries.forEach(item => matchBannersDB.insert(item));
}

// ============ 会话管理（持久化到文件，重启不丢失）============
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function saveSessions() {
  try {
    const data = [];
    for (const [token, session] of sessions.entries()) {
      data.push([token, session]);
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('保存会话失败:', e.message);
  }
}

// 启动时从文件恢复 sessions
let sessions = new Map();
try {
  if (fs.existsSync(SESSIONS_FILE)) {
    const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    sessions = new Map(data);
    // 启动时清理过期 token
    for (const [token, session] of sessions.entries()) {
      if (Date.now() - session.createdAt > 7 * 24 * 3600 * 1000) {
        sessions.delete(token);
      }
    }
    if (sessions.size > 0) saveSessions();
    console.log(`已从文件恢复 ${sessions.size} 个会话`);
  }
} catch (e) {
  console.error('恢复会话失败:', e.message);
  sessions = new Map();
}

function createToken(userId, isAdmin = false) {
  const token = crypto.randomBytes(16).toString('hex');
  sessions.set(token, { userId, isAdmin, createdAt: Date.now() });
  saveSessions();
  return token;
}
function verifyToken(req) {
  const rawAuth = (req.headers['authorization'] || '');
  const token = rawAuth.replace(/^Bearer\s+/i, '') || url.parse(req.url, true).query.token;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() - session.createdAt > 7 * 24 * 3600 * 1000) {
    sessions.delete(token);
    saveSessions();
    return null;
  }
  return session;
}

// ============ HTTP 工具 ============
function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}
function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}
function sendFile(res, filePath, method = 'GET') {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }
  // 检查是否是目录，如果是则尝试加载 index.html
  if (fs.statSync(filePath).isDirectory()) {
    const indexFile = path.join(filePath, 'index.html');
    if (fs.existsSync(indexFile)) {
      filePath = indexFile;
    } else {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';
  const headers = { 'Content-Type': mime, 'Content-Length': fs.statSync(filePath).size };
  // HTML/JS/CSS 禁用缓存，避免前端更新后浏览器仍使用旧文件
  if (['.html', '.js', '.css'].includes(ext)) {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  }
  res.writeHead(200, headers);
  if (method === 'HEAD') { res.end(); return; }
  fs.createReadStream(filePath).pipe(res);
}

// ============ 字段处理 ============
function getUserFields(gender) {
  return gender === '男' ? MALE_FIELDS : FEMALE_FIELDS;
}

function formatBirthday(b) {
  if (!b) return null;
  const age = Math.floor((Date.now() - new Date(b).getTime()) / (365.25 * 24 * 3600 * 1000));
  return age;
}

// 根据出生日期计算星座
function getZodiacByBirthday(birthday) {
  if (!birthday) return '';
  const d = new Date(birthday);
  if (isNaN(d.getTime())) return '';
  const m = d.getMonth() + 1, day = d.getDate();
  const signs = [
    { name: '摩羯座', startMonth: 1, startDay: 1, endMonth: 1, endDay: 19 },
    { name: '水瓶座', startMonth: 1, startDay: 20, endMonth: 2, endDay: 18 },
    { name: '双鱼座', startMonth: 2, startDay: 19, endMonth: 3, endDay: 20 },
    { name: '白羊座', startMonth: 3, startDay: 21, endMonth: 4, endDay: 19 },
    { name: '金牛座', startMonth: 4, startDay: 20, endMonth: 5, endDay: 20 },
    { name: '双子座', startMonth: 5, startDay: 21, endMonth: 6, endDay: 21 },
    { name: '巨蟹座', startMonth: 6, startDay: 22, endMonth: 7, endDay: 22 },
    { name: '狮子座', startMonth: 7, startDay: 23, endMonth: 8, endDay: 22 },
    { name: '处女座', startMonth: 8, startDay: 23, endMonth: 9, endDay: 22 },
    { name: '天秤座', startMonth: 9, startDay: 23, endMonth: 10, endDay: 23 },
    { name: '天蝎座', startMonth: 10, startDay: 24, endMonth: 11, endDay: 22 },
    { name: '射手座', startMonth: 11, startDay: 23, endMonth: 12, endDay: 21 },
    { name: '摩羯座', startMonth: 12, startDay: 22, endMonth: 12, endDay: 31 }
  ];
  for (const s of signs) {
    if (s.startMonth === s.endMonth) {
      if (m === s.startMonth && day >= s.startDay && day <= s.endDay) return s.name;
    } else {
      if ((m === s.startMonth && day >= s.startDay) || (m === s.endMonth && day <= s.endDay)) return s.name;
    }
  }
  return '';
}

// ============ 路由 ============
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    return res.end();
  }

  // 静态文件
  if ((method === 'GET' || method === 'HEAD') && !pathname.startsWith('/api/') && !pathname.startsWith('/uploads/') && !pathname.startsWith('/avatars/')) {
    let filePath;
    if (pathname === '/' || pathname === '/index.html') {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    } else if (pathname.startsWith('/admin')) {
      const adminPath = pathname === '/admin' || pathname === '/admin/' ? '/admin/index.html' : pathname;
      filePath = path.join(ROOT, adminPath);
    } else {
      filePath = path.join(PUBLIC_DIR, pathname);
    }
    return sendFile(res, filePath, method);
  }

  // favicon.ico → 重定向到实际图标文件
  if (pathname === '/favicon.ico') {
    return sendFile(res, path.join(ICON_DIR, 'favicon.png'), method);
  }

  // 头像/上传文件
  if ((method === 'GET' || method === 'HEAD') && (pathname.startsWith('/uploads/') || pathname.startsWith('/avatars/'))) {
    const subPath = pathname.startsWith('/uploads/') ? pathname.replace('/uploads/', '') : pathname.replace('/avatars/', '');
    const filePath = pathname.startsWith('/uploads/') ? path.join(UPLOAD_DIR, subPath) : path.join(AVATAR_DIR, subPath);
    return sendFile(res, filePath, method);
  }

  // API 路由
  if (pathname.startsWith('/api/')) {
    const MAX_BODY_SIZE = 20 * 1024 * 1024; // 20MB，允许大头像 Base64
    let body = '';
    let bodyTooLarge = false;
    req.on('data', chunk => {
      if (bodyTooLarge) return;
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        return sendJson(res, { code: 413, msg: '请求数据过大，请压缩图片后重试' }, 413);
      }
    });
    req.on('end', () => {
      if (bodyTooLarge) return;
      let data = {};
      try { data = body ? JSON.parse(body) : {}; } catch(e) {}
      const params = { ...parsed.query, ...data };
      route(pathname, method, params, req, res);
    });
    return;
  }

  sendJson(res, { error: 'Not found' }, 404);
});

function route(pathname, method, params, req, res) {
  console.log('[ROUTE DEBUG] pathname:', pathname, 'method:', method);
  // 全局容错：防止单个接口异常拖垮整个服务器
  try {
  // ===== 公开发布接口（不需要登录）=====
  // 获取可用问卷列表（只返回已到发布时间且未结束的问卷）
  if (pathname === '/api/surveys' && method === 'GET') {
    const now = new Date();
    let list = surveysDB.all().filter(s => {
      if (s.status !== 'published') return false;
      if (s.publishTime && new Date(s.publishTime) > now) return false;
      if (s.endTime && new Date(s.endTime) < now) return false;
      return true;
    });
    return sendJson(res, { code: 0, data: list });
  }
  // 获取单个问卷详情（公开，不需要登录）
  if (pathname === '/api/survey' && method === 'GET') {
    const id = params.id;
    if (!id) return sendJson(res, { code: 1, msg: '缺少问卷ID' });
    const survey = surveysDB.find(x => x.id === id);
    if (!survey) return sendJson(res, { code: 1, msg: '问卷不存在' });
    const now = new Date();
    if (survey.publishTime && new Date(survey.publishTime) > now) {
      return sendJson(res, { code: 1, msg: '问卷尚未发布' });
    }
    if (survey.endTime && new Date(survey.endTime) < now) {
      return sendJson(res, { code: 1, msg: '问卷收集已结束' });
    }
    let filled = false;
    let myAnswers = null;
    // 如果有登录态，检查是否已填写，并返回我的答案
    const tmpSession = verifyToken(req);
    if (tmpSession && !tmpSession.isAdmin) {
      // 兼容两种 ID 格式：userId 和 id
      const cu = usersDB.find(u =>
        u.id === tmpSession.userId || u.userId === tmpSession.userId || u.phone === tmpSession.userId
      );
      if (cu) {
        // 尝试用 cu.id 或 cu.userId 匹配答卷
        const myResp = surveyResponsesDB.find(r =>
          r.surveyId === id &&
          (r.userId === cu.id || r.userId === cu.userId)
        );
        if (myResp) { filled = true; myAnswers = myResp.answers; }
        console.log('[Survey] 查询已填写:', { sessionUserId: tmpSession.userId, foundUser: cu.id + '/' + (cu.userId||''), foundResp: !!myResp });
      } else {
        console.log('[Survey] 未找到当前用户, sessionUserId:', tmpSession.userId);
      }
    }
    return sendJson(res, { code: 0, data: { ...survey, filled, myAnswers } });
  }

  // ===== 开屏广告 API（公开，不需要登录）=====
  if (pathname === '/api/splash-ad' && method === 'GET') {
    const ads = splashAdsDB.all().filter(a => a.enabled !== false);
    const now = new Date();
    const activeAd = ads.find(a => {
      if (!a.startTime && !a.endTime) return true;
      const start = a.startTime ? new Date(a.startTime) : null;
      const end = a.endTime ? new Date(a.endTime) : null;
      if (start && now < start) return false;
      if (end && now > end) return false;
      return true;
    });
    return sendJson(res, { code: 0, data: activeAd || null });
  }

  // 微信JSSDK配置（公开，用于前端微信分享）
  if (pathname === '/api/wx-jssdk-config' && method === 'GET') {
    let payConfig = {};
    try { payConfig = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'payment_config.json'), 'utf-8')); } catch(e) {}
    const appId = (payConfig.channels && payConfig.channels.wechat && payConfig.channels.wechat.config && payConfig.channels.wechat.config.appid)
      || (payConfig.mockMode ? 'wx_mock_appid_for_jssdk' : '');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = Math.random().toString(36).substring(2, 15);
    // 真实环境需要用jsapi_ticket签名，这里返回基本配置供前端调用
    // 生产环境需接入微信access_token/jsapi_ticket接口生成真实signature
    return sendJson(res, {
      code: 0,
      data: { appId, timestamp, nonceStr, signature: 'mock_signature_replace_in_production' }
    });
  }

  const session = verifyToken(req);
  const currentUser = session && !session.isAdmin ? usersDB.find(u =>
    u.id === session.userId || u.userId === session.userId || u.phone === session.userId
  ) : null;
  const isAdmin = session && session.isAdmin;

  // ===== 公开接口 =====
  if (pathname === '/api/fields' && method === 'GET') {
    return sendJson(res, { code: 0, data: { male: MALE_FIELDS, female: FEMALE_FIELDS } });
  }

  if (pathname === '/api/agreements' && method === 'GET') {
    return sendJson(res, { code: 0, data: { vip: agreements.vip, user: agreements.user } });
  }

  // 公开 - 发送邮箱验证码
  if (pathname === '/api/auth/send-code' && method === 'POST') {
    const { email } = params;
    if (!email) return sendJson(res, { code: 1, msg: '请输入邮箱' });
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return sendJson(res, { code: 1, msg: '邮箱格式不正确' });
    if (usersDB.find(u => u.email === email)) return sendJson(res, { code: 1, msg: '该邮箱已注册' });
    // 60秒内不能重复发
    const recent = emailCodesDB.all().find(c => c.email === email && !c.used && (Date.now() - new Date(c.createdAt).getTime()) < 60 * 1000);
    if (recent) return sendJson(res, { code: 1, msg: '请稍后再试，60秒内只能发一次' });
    // 生成6位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    emailCodesDB.insert({ email, code, used: false, createdAt: new Date().toISOString() });
    // 发邮件
    return sendCodeMail(email, code).then(result => {
      if (!result.ok) return sendJson(res, { code: 1, msg: result.msg });
      return sendJson(res, { code: 0, msg: '验证码已发送，请注意查收' });
    });
  }

  // 公开 - 获取协议内容
  if (pathname === '/api/agreements' && method === 'GET' && params.type) {
    return sendJson(res, { code: 0, data: agreements[params.type] || null });
  }

  // 管理端 - 获取邮件配置（不返回密码）
  if (pathname === '/api/admin/mail-config' && method === 'GET') {
    if (!isAdmin) return sendJson(res, { code: 401, msg: '请先登录' });
    const all = mailConfigDB.all();
    const cfg = (all[0]) ? all[0] : _defaultMailConfig;
    return sendJson(res, { code: 0, data: { ...cfg, pass: cfg.pass ? '******' + cfg.pass.slice(-4) : '' } });
  }

  // 管理端 - 更新邮件配置
  if (pathname === '/api/admin/mail-config' && method === 'POST') {
    if (!isAdmin) return sendJson(res, { code: 401, msg: '请先登录' });
    const { smtpHost, smtpPort, secure, user, pass, fromName, codeSubject, codeTemplate } = params;
    const all = mailConfigDB.all();
    const cur = (all[0]) ? all[0] : _defaultMailConfig;
    const upd = {
      id: 'mail',
      smtpHost: smtpHost || cur.smtpHost,
      smtpPort: smtpPort ? Number(smtpPort) : cur.smtpPort,
      secure: secure !== undefined ? !!secure : cur.secure,
      user: user || cur.user,
      // 如果密码是带星号的占位符，保留原密码
      pass: (pass && !pass.startsWith('******')) ? pass : cur.pass,
      fromName: fromName !== undefined ? fromName : cur.fromName,
      codeSubject: codeSubject !== undefined ? codeSubject : cur.codeSubject,
      codeTemplate: codeTemplate !== undefined ? codeTemplate : cur.codeTemplate
    };
    // mailConfig 是单条配置：用 update/insert
    if (all.length === 0) mailConfigDB.insert(upd);
    else mailConfigDB.update(cur.id, upd);
    return sendJson(res, { code: 0, msg: '保存成功' });
  }

  // 管理端 - 测试邮件发送
  if (pathname === '/api/admin/mail-test' && method === 'POST') {
    if (!isAdmin) return sendJson(res, { code: 401, msg: '请先登录' });
    const { email } = params;
    if (!email) return sendJson(res, { code: 1, msg: '请输入测试邮箱' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    return sendCodeMail(email, code).then(result => {
      if (!result.ok) return sendJson(res, { code: 1, msg: result.msg });
      return sendJson(res, { code: 0, msg: '测试邮件已发送到 ' + email });
    });
  }

  // 公开 - 站点配置
  if (pathname === '/api/site-config' && method === 'GET') {
    return sendJson(res, { code: 0, data: { ...siteConfigDB.all(), version: SITE_VERSION } });
  }

  // 公开 - 系统设置（站点名称/客服电话/客服微信）
  if (pathname === '/api/settings' && method === 'GET') {
    return sendJson(res, { code: 0, data: settingsDB.all() });
  }

  // 公开 - 支付配置（仅返回是否演示模式及客服信息，用于前端决定是否弹窗）
  if (pathname === '/api/payment/config' && method === 'GET') {
    const payConfigFile = path.join(DATA_DIR, 'payment_config.json');
    let payConfig = { mock: { enabled: true } };
    if (fs.existsSync(payConfigFile)) {
      try { payConfig = JSON.parse(fs.readFileSync(payConfigFile, 'utf-8')); } catch(e) {}
    }
    const contact = contactConfigDB.all();
    return sendJson(res, {
      code: 0,
      data: {
        mockMode: payConfig.mock ? payConfig.mock.enabled !== false : true,
        serviceWechat: contact.wechat || 'StarMeet_Official',
        serviceQrcode: contact.wechatQrcode || contact.qrcodeImage || ''
      }
    });
  }

  // 公开 - 首页轮播（自动过滤已过期的）
  if (pathname === '/api/banners' && method === 'GET') {
    const now = Date.now();
    const list = bannersDB.all().filter(b => {
      if (!b.endTime) return true; // 没设结束时间=永久展示
      const eTime = new Date(b.endTime).getTime();
      if (now > eTime) return false; // 已过期
      if (b.startTime) {
        const sTime = new Date(b.startTime).getTime();
        if (now < sTime) return false; // 还没开始
      }
      return true;
    });
    return sendJson(res, { code: 0, data: list });
  }

  // 公开 - 找缘分模块
  if (pathname === '/api/match-banners' && method === 'GET') {
    const sorted = matchBannersDB.all().filter(b => b.enabled !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return sendJson(res, { code: 0, data: sorted });
  }

  // 公开 - 联系我们信息
  if (pathname === '/api/contact' && method === 'GET') {
    const d = contactConfigDB.all();
    const defaults = {'heroBgImage':'','heroTitle':'联系我们','heroDesc':'7×24 小时为您提供真诚服务','phoneLabel':'客服电话','wechatLabel':'客服微信号（点击复制）','emailLabel':'联系邮箱','addressLabel':'公司地址','workTimeLabel':'工作时间','serviceUrlLabel':'在线客服','wecomLinkLabel':'企业微信客服','qrcodeSectionTitle':'客服微信号二维码','qrcodeHint':'扫码添加客服微信，获取专属服务','introSectionTitle':'关于我们'};
    let changed = false;
    for (const [k,v] of Object.entries(defaults)) { if (!(k in d) || d[k]==='') { d[k]=v; changed=true; } }
    if (changed) { contactConfigDB.data = d; contactConfigDB.save(); }
    return sendJson(res, { code: 0, data: d });
  }

  // 公开 - VIP服务页面配置
  if (pathname === '/api/vip/service-config' && method === 'GET') {
    return sendJson(res, { code: 0, data: vipServiceConfigDB.all() });
  }

  // 公开 - 今日之星配置 + 用户
  if (pathname === '/api/star' && method === 'GET') {
    const cfg = starConfigDB.all();
    const now = Date.now();
    const items = (cfg.items || []).map(it => {
      const start = new Date(it.timeStart).getTime();
      const end = new Date(it.timeEnd).getTime();
      let status = '展示中';
      if (now < start) status = '未开始';
      else if (now >= end) status = '已下架';
      const u = usersDB.find(x => x.id === it.userId);
      return {
        id: it.id,
        userId: it.userId,
        timeStart: it.timeStart,
        timeEnd: it.timeEnd,
        status,
        expired: now >= end,
        user: u ? {
          id: u.id,
          userId: u.userId,
          nickname: u.nickname,
          avatar: u.avatar,
          gender: u.gender,
          age: u.age || (u.form && u.form.age),
          city: u.city || (u.form && u.form.currentCity),
          job: u.job || (u.form && u.form.job) || '',
          education: u.education || (u.form && u.form.education) || '',
          income: u.income || (u.form && u.form.income) || '',
          vip: u.vip,
          level: u.level,
          form: u.form || {}
        } : null
      };
    });
    // 前台只展示未下架的，按 timeStart 升序
    const visible = items.filter(it => !it.expired).sort((a, b) => new Date(a.timeStart) - new Date(b.timeStart));
    return sendJson(res, { code: 0, data: { config: { title: cfg.title, subtitle: cfg.subtitle }, items: visible } });
  }

  // 公开 - 城市列表（去重）
  if (pathname === '/api/cities' && method === 'GET') {
    const set = new Set();
    usersDB.all().forEach(u => {
      const c = u.city || u.form?.currentCity;
      if (c) set.add(c);
    });
    return sendJson(res, { code: 0, data: Array.from(set) });
  }

  if (pathname === '/api/register' && method === 'POST') {
    const { email, password, code, nickname, gender, age, city, form, avatar, agreeUser, agreeVip,
            wechatId, zodiac, birthday, bloodType, weight, hasHouse, hasCar, incomeCurrency,
            height, education, income, maritalStatus, house, car, hobby, location,
            marriageTime, salaryCurrency,
            mateAgeMin, mateAgeMax, mateHeightMin, mateHeightMax, mateEducation,
            mateMaritalStatus, mateSalary, mateSalaryCurrency, mateOther, registerFor } = params;
    if (!email || !password) return sendJson(res, { code: 1, msg: '邮箱和密码必填' });
    if (!code) return sendJson(res, { code: 1, msg: '请输入邮箱验证码' });
    if (!agreeUser || !agreeVip) return sendJson(res, { code: 1, msg: '请先勾选并同意两份协议' });
    // 邮箱格式校验
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return sendJson(res, { code: 1, msg: '邮箱格式不正确' });
    if (usersDB.find(u => u.email === email)) return sendJson(res, { code: 1, msg: '该邮箱已注册' });
    // 验证码校验（10分钟有效）
    const codes = emailCodesDB.all().filter(c => c.email === email);
    const valid = codes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).find(c => !c.used && c.code === code && (Date.now() - new Date(c.createdAt).getTime()) < 10 * 60 * 1000);
    if (!valid) return sendJson(res, { code: 1, msg: '验证码不正确或已过期' });
    // 标记验证码已用
    emailCodesDB.update(valid.id, { used: true });
    // 昵称限制：只允许中文/英文，2-16 字符
    if (nickname !== undefined && nickname !== null && String(nickname).trim() !== '') {
      const nk = String(nickname).trim();
      if (nk.length < 2 || nk.length > 16) return sendJson(res, { code: 1, msg: '昵称长度需在 2-16 个字符之间' });
      if (!/^[\u4e00-\u9fa5a-zA-Z\s]+$/.test(nk)) return sendJson(res, { code: 1, msg: '昵称仅允许中文、英文和空格' });
    }
    // 头像强制：必须是用户上传后的 URL（/avatars/ 或 /uploads/ 开头），或前端上传返回的 dataURL，或外部图片URL；
    // 不允许默认占位头像（系统生成的 SVG data:image/svg+xml）
    if (!avatar) return sendJson(res, { code: 1, msg: '请上传头像' });
    if (/^data:image\/svg\+xml/i.test(avatar)) return sendJson(res, { code: 1, msg: '请上传真实头像，不接受系统默认头像' });
    if (!/^(data:image\/(png|jpe?g|gif|webp);base64,|\/avatars\/|\/uploads\/|https?:\/\/)/i.test(avatar)) {
      return sendJson(res, { code: 1, msg: '头像格式不正确，请重新上传' });
    }
    // 注册必填字段校验（第2步基本资料）
    if (!wechatId) return sendJson(res, { code: 1, msg: '请填写微信号' });
    if (!birthday) return sendJson(res, { code: 1, msg: '请选择出生日期' });
    if (!gender) return sendJson(res, { code: 1, msg: '请选择性别' });
    if (!maritalStatus) return sendJson(res, { code: 1, msg: '请选择婚姻状况' });
    if (!height) return sendJson(res, { code: 1, msg: '请选择身高' });
    if (!education) return sendJson(res, { code: 1, msg: '请选择学历' });
    if (!income) return sendJson(res, { code: 1, msg: '请选择年薪' });
    if (!house) return sendJson(res, { code: 1, msg: '请选择房产信息' });
    if (!car) return sendJson(res, { code: 1, msg: '请选择车辆信息' });

    // 根据出生日期自动计算年龄和星座
    const calculatedAge = formatBirthday(birthday);
    const calculatedZodiac = getZodiacByBirthday(birthday);

    // 分配递增的用户ID
    const newId = nextUserId();

    const user = usersDB.insert({
      userId: newId,
      email,
      phone: '',
      password,
      nickname: nickname || '',
      gender: gender || '',
      age: calculatedAge || 0,
      city: location || city || '',
      country: params._country || '',
      province: params._province || '',
      avatar: avatar,
      photos: [avatar],
      level: 1,
      vip: false,
      verified: false,
      online: true,
      form: form || {},
      bio: '',
      tags: [],
      // ===== 基本资料（第2步）=====
      wechatId: wechatId || '',
      birthday: birthday || '',
      height: height || '',
      education: education || '',
      income: income || '',
      incomeCurrency: incomeCurrency || salaryCurrency || 'CNY',
      maritalStatus: maritalStatus || '',
      house: house || '',
      car: car || '',
      hobby: hobby || '',
      weight: parseFloat(weight) || 0,
      weightUnit: 'KG',
      bloodType: bloodType || '',
      zodiac: calculatedZodiac || '',
      hasHouse: hasHouse || '',
      hasCar: hasCar || '',
      // ===== 择偶要求（第3步）=====
      mateGender: gender === '男' ? '女' : '男',
      mateAgeMin: mateAgeMin || '',
      mateAgeMax: mateAgeMax || '',
      mateHeightMin: mateHeightMin || '',
      mateHeightMax: mateHeightMax || '',
      mateEducation: mateEducation || '',
      mateMaritalStatus: mateMaritalStatus || '',
      mateSalary: mateSalary || '',
      mateSalaryCurrency: mateSalaryCurrency || 'CNY',
      mateOther: mateOther || '',
      marriageTime: marriageTime || '',
      registerFor: registerFor || '',
      status: 'pending',
      auditStatus: 'pending',  // 审核状态：pending=待审核 approved=通过 rejected=不通过
      auditReason: '',           // 审核不通过原因
      createdAt: new Date().toISOString()
    });
    const token = createToken(user.id, false);
    return sendJson(res, { code: 0, data: { token, user: { ...user, password: undefined } } });
  }

  // 注册 - 第一步：仅邮箱+验证码+密码创建基础账号
  if (pathname === '/api/register/init' && method === 'POST') {
    const { email, password, code } = params;
    if (!email || !password) return sendJson(res, { code: 1, msg: '邮箱和密码必填' });
    if (!code) return sendJson(res, { code: 1, msg: '请输入邮箱验证码' });
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return sendJson(res, { code: 1, msg: '邮箱格式不正确' });
    if (password.length < 6) return sendJson(res, { code: 1, msg: '密码至少6位' });
    if (usersDB.find(u => u.email === email)) return sendJson(res, { code: 1, msg: '该邮箱已注册' });
    const codes = emailCodesDB.all().filter(c => c.email === email);
    const valid = codes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).find(c => !c.used && c.code === code && (Date.now() - new Date(c.createdAt).getTime()) < 10 * 60 * 1000);
    if (!valid) return sendJson(res, { code: 1, msg: '验证码不正确或已过期' });
    emailCodesDB.update(valid.id, { used: true });
    const newId = nextUserId();
    const user = usersDB.insert({
      userId: newId,
      email,
      phone: '',
      password,
      nickname: '',
      gender: '',
      age: 0,
      city: '',
      country: '',
      province: '',
      avatar: '',
      photos: [],
      level: 1,
      vip: false,
      verified: false,
      online: true,
      form: {},
      bio: '',
      tags: [],
      wechatId: '',
      birthday: '',
      height: '',
      education: '',
      income: '',
      incomeCurrency: 'CNY',
      maritalStatus: '',
      house: '',
      car: '',
      hobby: '',
      weight: 0,
      weightUnit: 'KG',
      bloodType: '',
      zodiac: '',
      hasHouse: '',
      hasCar: '',
      mateGender: '',
      mateAgeMin: '',
      mateAgeMax: '',
      mateHeightMin: '',
      mateHeightMax: '',
      mateEducation: '',
      mateMaritalStatus: '',
      mateSalary: '',
      mateSalaryCurrency: 'CNY',
      mateOther: '',
      marriageTime: '',
      registerFor: '',
      status: 'pending',
      auditStatus: 'pending',
      auditReason: '',
      createdAt: new Date().toISOString(),
      registerStep: 1
    });
    const token = createToken(user.id, false);
    return sendJson(res, { code: 0, data: { token, user: { ...user, password: undefined } } });
  }

  // 注册 - 第二步：完善资料（需登录）
  if (pathname === '/api/register/complete' && method === 'POST') {
    const session = verifyToken(req);
    if (!session) return sendJson(res, { code: 401, msg: '请先登录' });
    const user = usersDB.find(u => u.id === session.userId);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
    const { nickname, gender, avatar, wechatId, birthday, height, education, income, salaryCurrency,
            maritalStatus, house, car, hobby, location, city, _country, _province, weight, marriageTime,
            mateAgeMin, mateAgeMax, mateHeightMin, mateHeightMax, mateEducation, mateMaritalStatus,
            mateSalary, mateSalaryCurrency, mateOther, registerFor } = params;
    if (!nickname || !nickname.trim()) return sendJson(res, { code: 1, msg: '请输入昵称' });
    if (!gender) return sendJson(res, { code: 1, msg: '请选择性别' });
    if (!birthday) return sendJson(res, { code: 1, msg: '请选择出生日期' });
    if (!maritalStatus) return sendJson(res, { code: 1, msg: '请选择婚姻状况' });
    if (!height) return sendJson(res, { code: 1, msg: '请选择身高' });
    if (!education) return sendJson(res, { code: 1, msg: '请选择学历' });
    if (!income) return sendJson(res, { code: 1, msg: '请选择年薪' });
    if (!house) return sendJson(res, { code: 1, msg: '请选择房产信息' });
    if (!car) return sendJson(res, { code: 1, msg: '请选择车辆信息' });
    if (!avatar) return sendJson(res, { code: 1, msg: '请上传头像' });
    if (/^data:image\/svg\+xml/i.test(avatar)) return sendJson(res, { code: 1, msg: '请上传真实头像，不接受系统默认头像' });
    if (!/^(data:image\/(png|jpe?g|gif|webp);base64,|\/avatars\/|\/uploads\/|https?:\/\/)/i.test(avatar)) {
      return sendJson(res, { code: 1, msg: '头像格式不正确，请重新上传' });
    }
    const nk = String(nickname).trim();
    if (nk.length < 2 || nk.length > 16) return sendJson(res, { code: 1, msg: '昵称长度需在 2-16 个字符之间' });
    if (!/[\u4e00-\u9fa5a-zA-Z\s]+/.test(nk)) return sendJson(res, { code: 1, msg: '昵称仅允许中文、英文和空格' });

    const calculatedAge = formatBirthday(birthday);
    const calculatedZodiac = getZodiacByBirthday(birthday);

    const patch = {
      nickname: nk,
      gender,
      age: calculatedAge || 0,
      city: location || city || '',
      country: _country || user.country || '',
      province: _province || user.province || '',
      avatar,
      photos: [avatar],
      wechatId: wechatId || '',
      birthday: birthday || '',
      height: height || '',
      education: education || '',
      income: income || '',
      incomeCurrency: params.incomeCurrency || salaryCurrency || 'CNY',
      maritalStatus: maritalStatus || '',
      house: house || '',
      car: car || '',
      hobby: hobby || '',
      weight: parseFloat(weight) || 0,
      zodiac: calculatedZodiac || '',
      hasHouse: house || '',
      hasCar: car || '',
      mateGender: gender === '男' ? '女' : '男',
      mateAgeMin: mateAgeMin || '',
      mateAgeMax: mateAgeMax || '',
      mateHeightMin: mateHeightMin || '',
      mateHeightMax: mateHeightMax || '',
      mateEducation: mateEducation || '',
      mateMaritalStatus: mateMaritalStatus || '',
      mateSalary: mateSalary || '',
      mateSalaryCurrency: mateSalaryCurrency || 'CNY',
      mateOther: mateOther || '',
      marriageTime: marriageTime || '',
      registerFor: registerFor || '',
      registerStep: 2,
      updatedAt: new Date().toISOString()
    };
    const updated = usersDB.update(user.id, patch);
    return sendJson(res, { code: 0, data: { user: { ...updated, password: undefined } } });
  }

  if (pathname === '/api/login' && method === 'POST') {
    const { account, email, password } = params;
    // 兼容旧字段 phone 改为 account/email，支持用户ID(5位数)/邮箱/手机号登录
    const loginKey = account || email || params.phone;
    const user = usersDB.find(u => (u.email === loginKey || u.phone === loginKey || u.userId === loginKey) && u.password === password);
    if (!user) return sendJson(res, { code: 1, msg: '账号或密码错误' });
    const token = createToken(user.id, false);
    return sendJson(res, { code: 0, data: { token, user: { ...user, password: undefined } } });
  }

  if (pathname === '/api/admin/login' && method === 'POST') {
    const { username, password } = params;
    const admin = adminsDB.find(a => a.username === username && a.password === password);
    if (!admin) return sendJson(res, { code: 1, msg: '账号或密码错误' });
    const token = createToken(admin.id, true);
    return sendJson(res, { code: 0, data: { token, admin: { ...admin, password: undefined } } });
  }

  if (pathname === '/api/users' && method === 'GET') {
    let list = usersDB.all();
    // 只显示审核已通过的用户
    list = list.filter(u => u.auditStatus === 'approved');
    if (params.gender) list = list.filter(u => u.gender === params.gender);
    if (params.city) list = list.filter(u => (u.city || u.form?.currentCity || '') === params.city);
    if (params.vip === 'true') list = list.filter(u => u.vip);
    if (params.minAge) list = list.filter(u => (u.age || u.form?.age || 0) >= parseInt(params.minAge));
    if (params.maxAge) list = list.filter(u => (u.age || u.form?.age || 99) <= parseInt(params.maxAge));
    if (params.minHeight) list = list.filter(u => (u.height || u.form?.height || 0) >= parseInt(params.minHeight));
    if (params.maxHeight) list = list.filter(u => (u.height || u.form?.height || 999) <= parseInt(params.maxHeight));
    if (params.minWeight) list = list.filter(u => (u.weight || u.form?.weight || 0) >= parseInt(params.minWeight));
    if (params.maxWeight) list = list.filter(u => (u.weight || u.form?.weight || 999) <= parseInt(params.maxWeight));
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      list = list.filter(u => (u.nickname || '').toLowerCase().includes(kw) || (u.city || '').toLowerCase().includes(kw) || (u.job || '').toLowerCase().includes(kw));
    }
    if (params.sort === 'vip') list = list.sort((a, b) => (b.level || 0) - (a.level || 0));
    if (params.sort === 'online') list = list.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
    if (params.sort === 'newest') list = list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 20;
    const total = list.length;
    list = list.slice((page - 1) * pageSize, page * pageSize);
    list = list.map(u => { const { password, ...rest } = u; return rest; });
    return sendJson(res, { code: 0, data: { list, total, page, pageSize } });
  }

  if (pathname.match(/^\/api\/users\/[^\/]+$/) && method === 'GET') {
    const id = pathname.split('/').pop();
    // 支持通过内部ID或交友ID(userId)查询用户
    const user = usersDB.find(u => u.id === id || u.userId === id || String(u.userId) === id);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' }, 404);
    const { password, ...rest } = user;
    return sendJson(res, { code: 0, data: rest });
  }

  if (pathname === '/api/articles' && method === 'GET') {
    // 支持按分类过滤 + 分页
    const categoryId = params.categoryId || '';
    const pageSize = parseInt(params.pageSize || '0', 10) || 0;
    let list = articlesDB.all();
    if (categoryId) {
      const cat = articleCategoriesDB.find(c => c.id === categoryId);
      const catName = cat ? cat.name : '';
      list = list.filter(a => a.categoryId === categoryId || (catName && a.category === catName));
    }
    // 默认按 createdAt 倒序
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const total = list.length;
    if (pageSize > 0) list = list.slice(0, pageSize);
    return sendJson(res, { code: 0, data: { list, total } });
  }

  // 公开：文章分类列表
  if (pathname === '/api/article-categories' && method === 'GET') {
    const list = articleCategoriesDB.all().sort((a, b) => (a.order || 0) - (b.order || 0));
    return sendJson(res, { code: 0, data: { list } });
  }

  if (pathname.match(/^\/api\/articles\/[^\/]+$/) && method === 'GET') {
    const id = pathname.split('/').pop();
    const article = articlesDB.find(a => a.id === id);
    if (!article) return sendJson(res, { code: 1, msg: '文章不存在' }, 404);
    article.views = (article.views || 0) + 1;
    articlesDB.update(id, { views: article.views });
    return sendJson(res, { code: 0, data: article });
  }

  if (pathname === '/api/activities' && method === 'GET') {
    let list = activitiesDB.all();
    if (params.category) list = list.filter(a => a.category === params.category);
    list = list.map(a => {
      const status = statusForActivity(a);
      const joinedCount = a.joins ? a.joins.length : (a.joined || 0);
      const userSigned = currentUser && Array.isArray(a.joins) ? a.joins.some(j => String(j.userId) === String(currentUser.id)) : false;
      return { ...a, status, joinedCount, userSigned };
    });
    return sendJson(res, { code: 0, data: { list, total: list.length } });
  }

  // 活动详情（含已报名用户头像）
  if (pathname.match(/^\/api\/activities\/[^\/]+$/) && method === 'GET') {
    const id = pathname.split('/').pop();
    const a = activitiesDB.find(x => x.id === id);
    if (!a) return sendJson(res, { code: 1, msg: '活动不存在' }, 404);
    // 拉取已报名用户头像昵称
    const joins = Array.isArray(a.joins) ? a.joins : [];
    const joiners = joins.map(j => {
      const u = usersDB.find(x => x.id === j.userId);
      if (!u) return { userId: j.userId, nickname: '用户', avatar: defaultAvatar('女', 0), joinedAt: j.joinedAt };
      return { userId: u.id, nickname: u.nickname, avatar: u.avatar, joinedAt: j.joinedAt, gender: u.gender };
    });
    const status = statusForActivity(a);
    return sendJson(res, { code: 0, data: { ...a, status, joiners, joinedCount: joiners.length } });
  }

  // 用户报名活动
  if (pathname.match(/^\/api\/activities\/[^\/]+\/join$/) && method === 'POST') {
    if (!currentUser) return sendJson(res, { code: 401, msg: '请先登录' }, 401);
    const id = pathname.split('/')[3];
    const a = activitiesDB.find(x => x.id === id);
    if (!a) return sendJson(res, { code: 1, msg: '活动不存在' }, 404);
    const status = statusForActivity(a);
    if (status === '未开始') return sendJson(res, { code: 1, msg: '报名还未开始' });
    if (status === '报名截止') return sendJson(res, { code: 1, msg: '报名已截止' });
    a.joins = Array.isArray(a.joins) ? a.joins : [];
    if (a.joins.find(j => String(j.userId) === String(currentUser.id))) {
      return sendJson(res, { code: 1, msg: '您已报名过该活动' });
    }
    a.joins.push({ userId: currentUser.id, joinedAt: new Date().toISOString() });
    a.joined = a.joins.length;
    activitiesDB.update(a.id, { joins: a.joins, joined: a.joined });
    return sendJson(res, { code: 0, data: { ...a, status: statusForActivity(a) } });
  }

  // 上传头像
  if (pathname === '/api/upload/avatar' && method === 'POST') {
    if (!currentUser) return sendJson(res, { code: 401, msg: '请先登录' }, 401);
    const { image } = params;
    if (!image) return sendJson(res, { code: 1, msg: '请提供图片数据' });
    try {
      const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) return sendJson(res, { code: 1, msg: '图片格式错误' });
      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      const filename = currentUser.id + '_' + Date.now() + '.' + ext;
      fs.writeFileSync(path.join(AVATAR_DIR, filename), buffer);
      const url = '/avatars/' + filename;
      usersDB.update(currentUser.id, { avatar: url });
      return sendJson(res, { code: 0, data: { url } });
    } catch (e) {
      return sendJson(res, { code: 1, msg: '上传失败：' + e.message });
    }
  }

  // 公开 - 临时上传头像（注册时使用，不绑定 userId）
  if (pathname === '/api/upload/avatar-temp' && method === 'POST') {
    const { image } = params;
    if (!image) return sendJson(res, { code: 1, msg: '请提供图片数据' });
    try {
      const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) return sendJson(res, { code: 1, msg: '图片格式错误' });
      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > 3 * 1024 * 1024) return sendJson(res, { code: 1, msg: '图片超过3MB' });
      const filename = 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      fs.writeFileSync(path.join(AVATAR_DIR, filename), buffer);
      const url = '/avatars/' + filename;
      return sendJson(res, { code: 0, data: { url } });
    } catch (e) {
      return sendJson(res, { code: 1, msg: '上传失败：' + e.message });
    }
  }

  // 公开 - 上传快捷入口图标（存到 data/uploads/icons/，返回 /uploads/icons/xxx）
  if (pathname === '/api/upload/icon' && method === 'POST') {
    const { image } = params;
    if (!image) return sendJson(res, { code: 1, msg: '请提供图片数据' });
    try {
      const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) return sendJson(res, { code: 1, msg: '图片格式错误' });
      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
      // 图标建议 png/svg/webp；其他格式也接受
      const allowed = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
      if (!allowed.includes(ext)) return sendJson(res, { code: 1, msg: '仅支持 png/jpg/gif/webp/svg' });
      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > 1 * 1024 * 1024) return sendJson(res, { code: 1, msg: '图标大小不能超过 1MB' });
      const filename = 'icon_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      fs.writeFileSync(path.join(ICON_DIR, filename), buffer);
      const url = '/uploads/icons/' + filename;
      return sendJson(res, { code: 0, data: { url } });
    } catch (e) {
      return sendJson(res, { code: 1, msg: '上传失败：' + e.message });
    }
  }

  // 登录用户上传自己的照片（头像/相册），存到 data/avatars/，返回 /avatars/xxx
  if (pathname === '/api/upload/photo' && method === 'POST') {
    const { image, type } = params;
    if (!image) return sendJson(res, { code: 1, msg: '请提供图片数据' });
    try {
      const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) return sendJson(res, { code: 1, msg: '图片格式错误' });
      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1].toLowerCase();
      const allowed = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
      if (!allowed.includes(ext)) return sendJson(res, { code: 1, msg: '仅支持 png/jpg/gif/webp' });
      const buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > 3 * 1024 * 1024) return sendJson(res, { code: 1, msg: '图片不能超过 3MB' });
      const prefix = type === 'photo' ? 'p_' : 'a_';
      const filename = prefix + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      fs.writeFileSync(path.join(AVATAR_DIR, filename), buffer);
      const url = '/avatars/' + filename;
      return sendJson(res, { code: 0, data: { url } });
    } catch (e) {
      return sendJson(res, { code: 1, msg: '上传失败：' + e.message });
    }
  }

  // 文章分类（公开，匿名可访问）
  if (pathname === '/api/article-categories' && method === 'GET') {
    const list = articleCategoriesDB.all().sort((a, b) => (a.order || 0) - (b.order || 0));
    return sendJson(res, { code: 0, data: list });
  }

  // 系统设置（站点名称/客服电话/客服微信 等）
  if (pathname === '/api/admin/settings' && method === 'GET') {
    return sendJson(res, { code: 0, data: settingsDB.all() });
  }

  // ===== VIP公开接口（免登录） =====
  if (pathname === '/api/vip/plans' && method === 'GET') {
    const vipPlansFile = path.join(DATA_DIR, 'vip_plans.json');
    let plans = [];
    if (fs.existsSync(vipPlansFile)) {
      try { plans = JSON.parse(fs.readFileSync(vipPlansFile, 'utf-8')); } catch(e) {}
    }
    return sendJson(res, { code: 0, data: plans });
  }

  if (pathname === '/api/vip/permissions' && method === 'GET') {
    const permFile = path.join(DATA_DIR, 'vip_permissions.json');
    let permissions = { permissions: [] };
    if (fs.existsSync(permFile)) {
      try { permissions = JSON.parse(fs.readFileSync(permFile, 'utf-8')); } catch(e) {}
    }
    return sendJson(res, { code: 0, data: permissions });
  }

  // ===== 鉴权接口 =====
  // 圈子帖子相关接口是公开的，不需要登录
  const publicApis = ['/api/circle_posts','/api/circle_post_detail'];
  if (!currentUser && !isAdmin && !(publicApis.includes(pathname) && method === 'GET')) return sendJson(res, { code: 401, msg: '请先登录' }, 401);

  if (pathname === '/api/me' && method === 'GET') {
    return sendJson(res, { code: 0, data: { ...currentUser, password: undefined } });
  }

  if (pathname === '/api/me' && method === 'PUT') {
    const updates = ['country','state','nickname', 'gender', 'age', 'city', 'avatar', 'photos', 'bio', 'tags', 'form', 'wechat',
                    'height', 'weight', 'education', 'job', 'income', 'marriage', 'verified', 'online',
                    'wechatId', 'zodiac', 'birthday', 'bloodType', 'weightUnit', 'hasHouse', 'hasCar', 'incomeCurrency',
                    'mateGender','mateAgeMin','mateAgeMax','mateHeightMin','mateHeightMax','mateEducation','mateMaritalStatus','mateSalary','mateSalaryCurrency','marriageTime','registerFor','mateOther'];
    const patch = {};
    updates.forEach(k => { if (params[k] !== undefined) patch[k] = params[k]; });
    // 昵称限制：只允许中文/英文/空格，2-16 字符
    if (patch.nickname !== undefined && patch.nickname !== null && String(patch.nickname).trim() !== '') {
      const nk = String(patch.nickname).trim();
      if (nk.length < 2 || nk.length > 16) return sendJson(res, { code: 1, msg: '昵称长度需在 2-16 个字符之间' });
      if (!/^[\u4e00-\u9fa5a-zA-Z\s]+$/.test(nk)) return sendJson(res, { code: 1, msg: '昵称仅允许中文、英文和空格' });
      patch.nickname = nk;
    }
    if (patch.form && patch.form.birthday) {
      patch.age = formatBirthday(patch.form.birthday) || patch.age;
    }
    // 如果直接更新了 birthday，重新计算年龄
    if (patch.birthday) {
      patch.age = formatBirthday(patch.birthday) || patch.age;
    }
    // 用户重新提交资料（审核被拒后修改），自动变回待审核
    if (currentUser.auditStatus === 'rejected') {
      const profileFields = ['nickname','gender','age','city','avatar','photos','bio','tags','form','wechat','height','weight','education','job','income','marriage',
                            'wechatId','zodiac','birthday','bloodType','hasHouse','hasCar','incomeCurrency'];
      const hasProfileUpdate = profileFields.some(k => patch[k] !== undefined);
      if (hasProfileUpdate) patch.auditStatus = 'pending';
    }
    const updated = usersDB.update(currentUser.id, patch);
    if (!updated) return sendJson(res, { code: 1, msg: '用户不存在或更新失败' }, 404);
    return sendJson(res, { code: 0, data: { ...updated, password: undefined } });
  }

  // 关注/喜欢（toggle：再发一次则取消）
  if (pathname === '/api/like' && method === 'POST') {
    const { targetId } = params;
    const target = usersDB.find(u => u.id === targetId);
    if (!target) return sendJson(res, { code: 1, msg: '用户不存在' });
    currentUser.likes = currentUser.likes || [];
    const idx = currentUser.likes.indexOf(targetId);
    let liked;
    if (idx >= 0) { currentUser.likes.splice(idx, 1); liked = false; }
    else { currentUser.likes.push(targetId); liked = true; }
    usersDB.update(currentUser.id, { likes: currentUser.likes });
    return sendJson(res, { code: 0, data: { liked, likes: currentUser.likes, match: (target.likes || []).includes(currentUser.id) } });
  }

  // 我喜欢的列表
  if (pathname === '/api/me/likes' && method === 'GET') {
    const ids = (currentUser.likes || []);
    const users = usersDB.all().filter(u => ids.includes(u.id));
    return sendJson(res, { code: 0, data: { list: users.map(u => ({ ...u, password: undefined })) } });
  }

  // 谁喜欢我列表（VIP功能，但接口不过滤VIP，由前端控制展示）
  if (pathname === '/api/me/liked-by' && method === 'GET') {
    const likedBy = usersDB.filter(u => (u.likes || []).some(id => String(id) === String(currentUser.id)));
    return sendJson(res, { code: 0, data: { list: likedBy.map(u => ({ ...u, password: undefined })) } });
  }

  // ===== 用户审核 =====
  // 管理员审核通过
  if (pathname === '/api/admin/user/approve' && method === 'POST') {
    const { userId } = params;
    if (!userId) return sendJson(res, { code: 1, msg: 'userId必填' });
    const user = usersDB.find(u => u.userId === userId || u.id === userId);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
    usersDB.update(user.id, { auditStatus: 'approved', auditReason: '', status: 'approved' });
    // 发送站内信通知
    messagesDB.insert({ from: 'system', to: user.id, content: '恭喜！您的账号已通过审核，现在可以正常使用所有功能了。', read: false, createdAt: new Date().toISOString() });
    return sendJson(res, { code: 0, msg: '审核通过' });
  }

  // 管理员审核拒绝
  if (pathname === '/api/admin/user/reject' && method === 'POST') {
    const { userId, reason } = params;
    if (!userId) return sendJson(res, { code: 1, msg: 'userId必填' });
    if (!reason) return sendJson(res, { code: 1, msg: '请填写拒绝原因' });
    const user = usersDB.find(u => u.userId === userId || u.id === userId);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
    usersDB.update(user.id, { auditStatus: 'rejected', auditReason: reason, status: 'rejected' });
    // 发送站内信通知
    messagesDB.insert({ from: 'system', to: user.id, content: '很抱歉，您的账号审核未通过。原因：' + reason + '。请修改后重新提交。', read: false, createdAt: new Date().toISOString() });
    return sendJson(res, { code: 0, msg: '已拒绝' });
  }

  // 获取站内信
  if (pathname === '/api/me/messages' && method === 'GET') {
    const msgs = messagesDB.filter(m => m.to === currentUser.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const unreadCount = msgs.filter(m => !m.read).length;
    return sendJson(res, { code: 0, data: { list: msgs, total: msgs.length, unreadCount } });
  }

  // 标记站内信已读
  if (pathname === '/api/me/messages/read' && method === 'POST') {
    const { messageId } = params;
    if (messageId) {
      messagesDB.update(messageId, { read: true });
    } else {
      // 全部标记已读
      messagesDB.all().filter(m => m.to === currentUser.id).forEach(m => { m.read = true; });
      messagesDB.save();
    }
    return sendJson(res, { code: 0 });
  }

  // 消息
  if (pathname === '/api/messages' && method === 'GET') {
    const { with: withId } = params;
    let msgs = messagesDB.filter(m => (m.from === currentUser.id && m.to === withId) || (m.from === withId && m.to === currentUser.id));
    msgs = msgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return sendJson(res, { code: 0, data: msgs });
  }

  if (pathname === '/api/messages' && method === 'POST') {
    const { to, content } = params;
    const msg = messagesDB.insert({ from: currentUser.id, to, content, read: false });
    return sendJson(res, { code: 0, data: msg });
  }

  if (pathname === '/api/conversations' && method === 'GET') {
    const allMsgs = messagesDB.filter(m => m.from === currentUser.id || m.to === currentUser.id);
    const partnerMap = new Map();
    allMsgs.forEach(m => {
      const partnerId = m.from === currentUser.id ? m.to : m.from;
      if (!partnerMap.has(partnerId) || new Date(m.createdAt) > new Date(partnerMap.get(partnerId).createdAt)) {
        partnerMap.set(partnerId, m);
      }
    });
    const conversations = Array.from(partnerMap.entries()).map(([partnerId, lastMsg]) => {
      const partner = usersDB.find(u => u.id === partnerId);
      return { partner: partner ? { ...partner, password: undefined } : null, lastMsg };
    }).sort((a, b) => new Date(b.lastMsg.createdAt) - new Date(a.lastMsg.createdAt));
    return sendJson(res, { code: 0, data: conversations });
  }

  // 提交问卷答案（需要登录，但不是管理员接口）
  if (pathname === '/api/survey/submit' && method === 'POST') {
    if (!currentUser) return sendJson(res, { code: 401, msg: '请先登录' });
    const { surveyId, answers } = params;
    if (!surveyId) return sendJson(res, { code: 1, msg: '缺少问卷ID' });
    if (!answers) return sendJson(res, { code: 1, msg: '请填写问卷' });
    const survey = surveysDB.find(x => x.id === surveyId);
    if (!survey) return sendJson(res, { code: 1, msg: '问卷不存在' });
    const now = new Date();
    if (survey.endTime && new Date(survey.endTime) < now) {
      return sendJson(res, { code: 1, msg: '问卷收集已结束' });
    }
    if (survey.status !== 'published') return sendJson(res, { code: 1, msg: '问卷已关闭' });
    if (survey.type === 'male' && currentUser.gender !== '男') {
      return sendJson(res, { code: 1, msg: '此问卷仅限男性用户填写' });
    }
    if (survey.type === 'female' && currentUser.gender !== '女') {
      return sendJson(res, { code: 1, msg: '此问卷仅限女性用户填写' });
    }
    const existing = surveyResponsesDB.find(r => r.surveyId === surveyId && r.userId === currentUser.id);
    if (existing) return sendJson(res, { code: 1, msg: '您已填写过此问卷' });
    const record = surveyResponsesDB.insert({
      surveyId, userId: currentUser.id,
      nickname: currentUser.nickname || '', userGender: currentUser.gender || '',
      answers, submittedAt: new Date().toISOString(), read: false
    });
    return sendJson(res, { code: 0, data: { record, answers, resultType: survey.resultType || 'survey', thankYouMessage: survey.thankYouMessage, interpretation: survey.interpretation || '' }, msg: '提交成功' });
  }

  // 模拟支付
  if (pathname === '/api/vip/pay' && method === 'POST') {
    const { userId, planId } = params;
    if (!userId || !planId) return sendJson(res, { code: 1, msg: '缺少参数' });

    const vipPlansFile = path.join(DATA_DIR, 'vip_plans.json');
    let plans = [];
    if (fs.existsSync(vipPlansFile)) {
      try { plans = JSON.parse(fs.readFileSync(vipPlansFile, 'utf-8')); } catch(e) {}
    }

    const plan = plans.find(p => p.id === planId);
    if (!plan) return sendJson(res, { code: 1, msg: '套餐不存在' });

    const user = usersDB.find(u => u.id === userId || u.userId === userId || u.phone === userId);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });

    var now = new Date();
    var currentExpire = user.vip_expire ? new Date(user.vip_expire) : now;
    if (currentExpire < now) currentExpire = now;

    var newExpire = new Date(currentExpire.getTime() + plan.days * 24 * 60 * 60 * 1000);
    user.vip_type = plan.type;
    user.vip_expire = newExpire.toISOString();
    user.vip = true;
    usersDB.save();

    var payRecord = {
      id: 'pay_' + Date.now(),
      userId: user.id,
      planId: plan.id,
      planName: plan.name,
      amount: plan.price,
      status: 'success',
      paidAt: new Date().toISOString(),
      method: 'mock'
    };

    var payFile = path.join(DATA_DIR, 'payments.json');
    var payments = [];
    if (fs.existsSync(payFile)) {
      try { payments = JSON.parse(fs.readFileSync(payFile, 'utf-8')); } catch(e) {}
    }
    payments.push(payRecord);
    try { fs.writeFileSync(payFile, JSON.stringify(payments, null, 2), 'utf-8'); } catch(e) {}

    return sendJson(res, { code: 0, data: { vipType: plan.type, vipExpire: user.vip_expire }, msg: '支付成功！' + plan.name + '已开通' });
  }

  // ===== 管理员接口 =====
  // 圈子相关接口是用户接口，不需要管理员权限（但需要登录）
  const publicCircleApis = ['/api/circle_posts','/api/circle_post_detail','/api/circle_like','/api/circle_comment','/api/circle_post','/api/admin/upload'];
  if (!isAdmin && !publicCircleApis.includes(pathname)) return sendJson(res, { code: 403, msg: '需要管理员权限' }, 403);

  if (pathname === '/api/admin/users' && method === 'GET') {
    // 管理员后台需要查看/修改密码, 直接返回原始记录
    let list = usersDB.all();

    // 筛选
    const { keyword, gender, vip, auditStatus: as } = params;
    if (keyword) {
      const kw = keyword.toLowerCase();
      list = list.filter(u => (u.nickname||'').toLowerCase().includes(kw) || (u.phone||'').includes(kw) || (u.city||'').toLowerCase().includes(kw));
    }
    if (gender) list = list.filter(u => u.gender === gender);
    if (vip) list = list.filter(u => String(u.vip) === vip);
    if (as) list = list.filter(u => u.auditStatus === as);

    // 按注册时间倒序（最新的在前）
    list.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });

    // 分页
    const page = parseInt(params.page) || 1;
    const pageSize = parseInt(params.pageSize) || 10;
    const total = list.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedList = list.slice(start, end);

    return sendJson(res, {
      code: 0,
      data: {
        list: paginatedList,
        total,
        page,
        pageSize,
        totalPages
      }
    });
  }

  // 管理员 - 用户关系图谱（我喜欢的 + 喜欢我的）【必须在通配路由之前，否则被正则拦截】
  if (pathname === '/api/admin/user/relations' && method === 'GET') {
    const targetId = params.userId || params.id;
    // 兼容多种ID格式：内部id / userId（显示ID）
    const user = usersDB.find(u =>
      String(u.id) === String(targetId) ||
      String(u.userId) === String(targetId)
    );
    if (!user) {
      // 调试：列出所有用户的 id 和 userId 帮助排查
      const sampleIds = usersDB.all().slice(0, 5).map(u => ({ id: u.id, userId: u.userId, nick: u.nickname }));
      return sendJson(res, { code: 1, msg: '用户不存在 [target=' + targetId + ', 样本:' + JSON.stringify(sampleIds) + ']' });
    }
    const iLike = (user.likes || []).map(id => {
      const u = usersDB.find(x => String(x.id) === String(id));
      return u ? { id: u.id, userId: u.userId, nickname: u.nickname, avatar: u.avatar, gender: u.gender, age: u.age } : null;
    }).filter(Boolean);
    const likesMe = usersDB.filter(u => (u.likes || []).some(id => String(id) === String(user.id))).map(u => ({
      id: u.id, userId: u.userId, nickname: u.nickname, avatar: u.avatar, gender: u.gender, age: u.age
    }));
    // 互相喜欢
    const mutual = iLike.filter(u => likesMe.some(l => l.id === u.id));
    return sendJson(res, { code: 0, data: { iLike, likesMe, mutual } });
  }

  // 管理员 - 获取单个用户详情
  if (pathname.match(/^\/api\/admin\/user\/[^\/]+$/) && method === 'GET') {
    const id = pathname.split('/').pop();
    const user = usersDB.find(u => u.id === id);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' }, 404);
    const fields = getUserFields(user.gender);
    return sendJson(res, {
      code: 0,
      data: {
        user: { ...user, password: undefined },
        fields
      }
    });
  }

  if (pathname === '/api/admin/user/update' && method === 'POST') {
    const { userId, ...patch } = params;
    if (!userId) return sendJson(res, { code: 1, msg: 'userId必填' });
    // 昵称限制：只允许中文/英文/空格，2-16 字符（管理员后台修改也走这个约束）
    if (patch.nickname !== undefined && patch.nickname !== null && String(patch.nickname).trim() !== '') {
      const nk = String(patch.nickname).trim();
      if (nk.length < 2 || nk.length > 16) return sendJson(res, { code: 1, msg: '昵称长度需在 2-16 个字符之间' });
      if (!/^[\u4e00-\u9fa5a-zA-Z\s]+$/.test(nk)) return sendJson(res, { code: 1, msg: '昵称仅允许中文、英文和空格' });
      patch.nickname = nk;
    }
    const allowed = ['nickname', 'gender', 'age', 'city', 'level', 'vip', 'verified', 'phone', 'bio', 'tags', 'avatar', 'photos', 'form', 'height', 'weight', 'education', 'job', 'income', 'marriage', 'password', 'wechat',
                    'wechatId', 'zodiac', 'birthday', 'bloodType', 'weightUnit', 'hasHouse', 'hasCar', 'incomeCurrency'];
    const safePatch = {};
    allowed.forEach(k => { if (patch[k] !== undefined) safePatch[k] = patch[k]; });
    if (safePatch.vip !== undefined) safePatch.vip = !!safePatch.vip;
    if (safePatch.verified !== undefined) safePatch.verified = !!safePatch.verified;
    if (safePatch.level !== undefined) safePatch.level = parseInt(safePatch.level) || 1;
    const updated = usersDB.update(userId, safePatch);
    if (!updated) return sendJson(res, { code: 1, msg: '用户不存在' });
    return sendJson(res, { code: 0, data: { ...updated, password: undefined } });
  }

  if (pathname === '/api/admin/user/delete' && method === 'POST') {
    const { userId } = params;
    const ok = usersDB.delete(userId);
    return sendJson(res, { code: ok ? 0 : 1, msg: ok ? '删除成功' : '用户不存在' });
  }

  // 管理员 - 新建用户（字段与正常注册一致）
  if (pathname === '/api/admin/users/create' && method === 'POST') {
    const { email, password, nickname, gender, avatar, wechatId, birthday, height, education, income, salaryCurrency,
            maritalStatus, house, car, hobby, location, city, _country, _province, weight, marriageTime,
            mateAgeMin, mateAgeMax, mateHeightMin, mateHeightMax, mateEducation, mateMaritalStatus,
            mateSalary, mateSalaryCurrency, mateOther, registerFor,
            level, vip, verified, auditStatus } = params;
    if (!email || !password) return sendJson(res, { code: 1, msg: '邮箱和密码必填' });
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return sendJson(res, { code: 1, msg: '邮箱格式不正确' });
    if (password.length < 6) return sendJson(res, { code: 1, msg: '密码至少6位' });
    if (usersDB.find(u => u.email === email)) return sendJson(res, { code: 1, msg: '该邮箱已注册' });
    if (!nickname || !String(nickname).trim()) return sendJson(res, { code: 1, msg: '请输入昵称' });
    const nk = String(nickname).trim();
    if (nk.length < 2 || nk.length > 16) return sendJson(res, { code: 1, msg: '昵称长度需在 2-16 个字符之间' });
    if (!/^[一-龥a-zA-Z\s]+$/.test(nk)) return sendJson(res, { code: 1, msg: '昵称仅允许中文、英文和空格' });
    if (!gender) return sendJson(res, { code: 1, msg: '请选择性别' });

    const calculatedAge = birthday ? formatBirthday(birthday) : 0;
    const calculatedZodiac = birthday ? getZodiacByBirthday(birthday) : '';
    const newId = nextUserId();

    const user = usersDB.insert({
      userId: newId,
      email,
      phone: '',
      password,
      nickname: nk,
      gender,
      age: calculatedAge || 0,
      city: location || city || '',
      country: _country || '',
      province: _province || '',
      avatar: avatar || '',
      photos: avatar ? [avatar] : [],
      level: parseInt(level) || 1,
      vip: !!vip,
      verified: !!verified,
      online: true,
      form: {},
      bio: '',
      tags: [],
      wechatId: wechatId || '',
      birthday: birthday || '',
      height: height || '',
      education: education || '',
      income: income || '',
      incomeCurrency: params.incomeCurrency || salaryCurrency || 'CNY',
      maritalStatus: maritalStatus || '',
      house: house || '',
      car: car || '',
      hobby: hobby || '',
      weight: parseFloat(weight) || 0,
      weightUnit: 'KG',
      bloodType: '',
      zodiac: calculatedZodiac || '',
      hasHouse: house || '',
      hasCar: car || '',
      mateGender: gender === '男' ? '女' : '男',
      mateAgeMin: mateAgeMin || '',
      mateAgeMax: mateAgeMax || '',
      mateHeightMin: mateHeightMin || '',
      mateHeightMax: mateHeightMax || '',
      mateEducation: mateEducation || '',
      mateMaritalStatus: mateMaritalStatus || '',
      mateSalary: mateSalary || '',
      mateSalaryCurrency: mateSalaryCurrency || 'CNY',
      mateOther: mateOther || '',
      marriageTime: marriageTime || '',
      registerFor: registerFor || '',
      status: auditStatus === 'approved' ? 'approved' : 'pending',
      auditStatus: auditStatus === 'approved' ? 'approved' : (auditStatus === 'rejected' ? 'rejected' : 'pending'),
      auditReason: '',
      createdAt: new Date().toISOString(),
      registerStep: 2
    });
    return sendJson(res, { code: 0, data: { user: { ...user, password: undefined } } });
  }

  // ===== 导出用户 xlsx（按 id 列表） =====
  if (pathname === '/api/admin/users/export' && method === 'POST') {
    const { ids } = params;
    const all = usersDB.all();
    const list = (Array.isArray(ids) && ids.length) ? all.filter(u => ids.includes(u.id) || ids.includes(u.userId)) : all;
    if (!list.length) return sendJson(res, { code: 1, msg: '没有选中任何用户' });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('会员列表');
    ws.columns = [
      { header: '用户ID', key: 'userId', width: 10 },
      { header: '昵称', key: 'nickname', width: 16 },
      { header: '真实姓名', key: 'realName', width: 14 },
      { header: '性别', key: 'gender', width: 6 },
      { header: '年龄', key: 'age', width: 6 },
      { header: '手机号', key: 'phone', width: 14 },
      { header: '微信号', key: 'wechat', width: 18 },
      { header: '所在地', key: 'city', width: 12 },
      { header: '身高(cm)', key: 'height', width: 10 },
      { header: '体重(kg)', key: 'weight', width: 10 },
      { header: '学历', key: 'education', width: 10 },
      { header: '学校', key: 'school', width: 18 },
      { header: '专业', key: 'major', width: 14 },
      { header: '职业', key: 'job', width: 14 },
      { header: '公司', key: 'company', width: 18 },
      { header: '月收入', key: 'income', width: 12 },
      { header: '婚况', key: 'marriage', width: 10 },
      { header: '有无子女', key: 'hasChild', width: 12 },
      { header: '是否要小孩', key: 'wantChild', width: 12 },
      { header: '房产', key: 'house', width: 14 },
      { header: '车辆', key: 'car', width: 6 },
      { header: '是否吸烟', key: 'smoke', width: 8 },
      { header: '是否饮酒', key: 'drink', width: 8 },
      { header: '厨艺', key: 'cooking', width: 8 },
      { header: '爱好', key: 'hobby', width: 22 },
      { header: '个人介绍', key: 'bio', width: 50 },
      { header: '标签', key: 'tags', width: 22 },
      { header: '等级', key: 'level', width: 6 },
      { header: 'VIP', key: 'vip', width: 6 },
      { header: '是否认证', key: 'verified', width: 8 },
      { header: '注册时间', key: 'createdAt', width: 22 }
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF5A6E' } };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    list.forEach(u => {
      const f = u.form || {};
      ws.addRow({
        userId: u.userId, nickname: u.nickname, realName: f.realName || '',
        gender: u.gender, age: u.age,
        phone: u.phone || '', wechat: u.wechat || '',
        city: f.currentCity || u.city || '',
        height: f.height || u.height || '', weight: f.weight || u.weight || '',
        education: f.education || u.education || '', school: f.school || '', major: f.major || '',
        job: f.job || u.job || '', company: f.company || '',
        income: f.income || u.income || '',
        marriage: f.maritalStatus || u.marriage || '',
        hasChild: f.hasChild || '', wantChild: f.wantChild || '',
        house: f.house || '', car: f.car || '',
        smoke: f.smoke || '', drink: f.drink || '', cooking: f.cooking || '',
        hobby: f.hobby || '', bio: f.bio || '',
        tags: (u.tags || []).join('、'),
        level: u.level || 1, vip: u.vip ? '是' : '否', verified: u.verified ? '是' : '否',
        createdAt: u.createdAt ? new Date(u.createdAt).toLocaleString('zh-CN') : ''
      });
    });
    // 表头行高
    ws.getRow(1).height = 24;
    ws.eachRow((row, n) => { if (n > 1) row.alignment = { vertical: 'middle', wrapText: true }; });
    wb.xlsx.writeBuffer().then(buf => {
      const fname = `users_${new Date().toISOString().slice(0,10)}_${Date.now()}.xlsx`;
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fname}"; filename*=UTF-8''${encodeURIComponent('会员列表_' + new Date().toLocaleDateString('zh-CN') + '.xlsx')}`,
        'Content-Length': buf.length
      });
      res.end(buf);
    }).catch(err => sendJson(res, { code: 1, msg: '生成失败：' + err.message }));
    return;
  }

  // ===== 群发消息 =====
  if (pathname === '/api/admin/message/broadcast' && method === 'POST') {
    const { title, content, filter, dryRun } = params;
    if (!content || !content.trim()) return sendJson(res, { code: 1, msg: '消息内容不能为空' });
    const f = filter || {};
    let targets = usersDB.all();
    if (f.gender) targets = targets.filter(u => u.gender === f.gender);
    if (f.city) targets = targets.filter(u => (u.form && u.form.currentCity === f.city) || u.city === f.city);
    if (f.ageMin) targets = targets.filter(u => (u.age || 0) >= Number(f.ageMin));
    if (f.ageMax) targets = targets.filter(u => (u.age || 0) <= Number(f.ageMax));
    if (f.userIds && Array.isArray(f.userIds) && f.userIds.length) {
      const set = new Set(f.userIds.map(String));
      targets = targets.filter(u => set.has(String(u.id)) || set.has(String(u.userId)));
    }
    if (!targets.length) return sendJson(res, { code: 1, msg: '筛选条件下没有匹配用户' });
    // 预览模式：只返回匹配数，不入库
    if (dryRun) return sendJson(res, { code: 0, data: { count: targets.length, msg: `将匹配 ${targets.length} 位用户` } });
    const now = new Date().toISOString();
    let count = 0;
    targets.forEach(u => {
      const msg = {
        id: crypto.randomBytes(8).toString('hex'),
        from: 'system',
        to: u.id,
        type: 'broadcast',
        title: title || '系统通知',
        content: content.trim(),
        read: false,
        createdAt: now
      };
      messagesDB.insert(msg);
      count++;
    });
    // 记录群发历史
    const logFile = path.join(DATA_DIR, 'broadcasts.json');
    let logs = [];
    if (fs.existsSync(logFile)) { try { logs = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch (e) {} }
    logs.unshift({ id: crypto.randomBytes(6).toString('hex'), title: title || '系统通知', content: content.trim(), filter: f, count, createdAt: now });
    fs.writeFileSync(logFile, JSON.stringify(logs.slice(0, 200), null, 2), 'utf8');
    return sendJson(res, { code: 0, data: { count, msg: `已成功发送给 ${count} 位用户` } });
  }

  // 群发历史
  if (pathname === '/api/admin/message/broadcast/history' && method === 'GET') {
    const logFile = path.join(DATA_DIR, 'broadcasts.json');
    let logs = [];
    if (fs.existsSync(logFile)) { try { logs = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch (e) {} }
    return sendJson(res, { code: 0, data: { list: logs } });
  }

  // 用户收到的消息列表
  if (pathname === '/api/me/messages' && method === 'GET') {
    const list = messagesDB.filter(m => m.to === currentUser.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, { code: 0, data: { list } });
  }

  if (pathname === '/api/admin/stats' && method === 'GET') {
    const all = usersDB.all();
    return sendJson(res, {
      code: 0,
      data: {
        totalUsers: all.length,
        vipUsers: all.filter(u => u.vip).length,
        maleUsers: all.filter(u => u.gender === '男').length,
        femaleUsers: all.filter(u => u.gender === '女').length,
        onlineUsers: all.filter(u => u.online).length,
        verifiedUsers: all.filter(u => u.verified).length,
        totalArticles: articlesDB.all().length,
        totalActivities: activitiesDB.all().length,
        totalMessages: messagesDB.all().length
      }
    });
  }

  if (pathname === '/api/admin/article/save' && method === 'POST') {
    if (!isAdmin) return sendJson(res, { code: 401, msg: '无权限' }, 401);
    const { id, title, author, category, cover, content, views, likes } = params;
    if (id) {
      const updated = articlesDB.update(id, { title, author, category, cover, content, views, likes });
      return sendJson(res, { code: 0, data: updated });
    }
    const created = articlesDB.insert({ title, author, category, cover, content, views: views || 0, likes: likes || 0 });
    return sendJson(res, { code: 0, data: created });
  }

  if (pathname === '/api/admin/article/delete' && method === 'POST') {
    if (!isAdmin) return sendJson(res, { code: 401, msg: '无权限' }, 401);
    const { id } = params;
    const ok = articlesDB.delete(id);
    return sendJson(res, { code: ok ? 0 : 1, msg: ok ? '删除成功' : '文章不存在' });
  }

  // 文章分类管理（admin）
  if (pathname === '/api/admin/article-category/save' && method === 'POST') {
    if (!isAdmin) return sendJson(res, { code: 401, msg: '无权限' }, 401);
    const { id, name, order } = params;
    if (!name) return sendJson(res, { code: 1, msg: '分类名不能为空' });
    if (id) {
      const updated = articleCategoriesDB.update(id, { name, order: order || 0 });
      return sendJson(res, { code: 0, data: updated });
    }
    const newId = 'cat_' + Date.now().toString(36);
    const created = articleCategoriesDB.insert({ id: newId, name, order: order || 99 });
    return sendJson(res, { code: 0, data: created });
  }
  if (pathname === '/api/admin/article-category/delete' && method === 'POST') {
    if (!isAdmin) return sendJson(res, { code: 401, msg: '无权限' }, 401);
    const { id } = params;
    const used = articlesDB.all().filter(a => a.categoryId === id || a.category === articleCategoriesDB.find(c => c.id === id)?.name);
    if (used.length > 0) return sendJson(res, { code: 1, msg: '该分类下还有 ' + used.length + ' 篇文章，请先迁移' });
    const ok = articleCategoriesDB.delete(id);
    return sendJson(res, { code: ok ? 0 : 1, msg: ok ? '删除成功' : '分类不存在' });
  }

  if (pathname === '/api/admin/activity/save' && method === 'POST') {
    const { id, title, time, city, place, price, total, cover, desc, status, signupStart, signupEnd, category } = params;
    const patch = { title, time, city, place, price, total, cover, desc, status, signupStart, signupEnd, category: category || '线下活动' };
    if (id) {
      const updated = activitiesDB.update(id, patch);
      return sendJson(res, { code: 0, data: { ...updated, status: statusForActivity(updated) } });
    }
    const created = activitiesDB.insert({ ...patch, price: patch.price || 0, joined: 0, total: patch.total || 20, status: patch.status || '报名中', joins: [] });
    return sendJson(res, { code: 0, data: { ...created, status: statusForActivity(created) } });
  }

  if (pathname === '/api/admin/activity/delete' && method === 'POST') {
    const { id } = params;
    const ok = activitiesDB.delete(id);
    return sendJson(res, { code: ok ? 0 : 1, msg: ok ? '删除成功' : '活动不存在' });
  }

  // VIP等级管理
  if (pathname === '/api/admin/vip/levels' && method === 'GET') {
    return sendJson(res, { code: 0, data: vipLevels });
  }

  if (pathname === '/api/admin/vip/level/save' && method === 'POST') {
    const { level, name, color, price, privileges } = params;
    const idx = vipLevels.findIndex(v => v.level === parseInt(level));
    const newVip = {
      level: parseInt(level),
      name,
      color,
      price: parseFloat(price) || 0,
      privileges: Array.isArray(privileges) ? privileges : (privileges || '').split('\n').filter(s => s.trim())
    };
    if (idx >= 0) {
      vipLevels[idx] = newVip;
    } else {
      vipLevels.push(newVip);
      vipLevels.sort((a, b) => a.level - b.level);
    }
    vipLevelsDB.data = vipLevels;
    vipLevelsDB.save();
    return sendJson(res, { code: 0, data: newVip });
  }

  if (pathname === '/api/admin/vip/level/delete' && method === 'POST') {
    const { level } = params;
    vipLevels = vipLevels.filter(v => v.level !== parseInt(level));
    vipLevelsDB.data = vipLevels;
    vipLevelsDB.save();
    return sendJson(res, { code: 0, msg: '删除成功' });
  }

  // 协议管理
  if (pathname === '/api/admin/agreements' && method === 'GET') {
    return sendJson(res, { code: 0, data: agreements });
  }

  if (pathname === '/api/admin/agreement/save' && method === 'POST') {
    const { type, title, content } = params;
    if (!['vip', 'user'].includes(type)) return sendJson(res, { code: 1, msg: '协议类型错误' });
    agreements[type] = { title, content };
    fs.writeFileSync(path.join(DATA_DIR, 'agreements.json'), JSON.stringify(agreements, null, 2));
    return sendJson(res, { code: 0, msg: '保存成功' });
  }

  // ===== 站点配置 / Banner / 找缘分模块 / 今日之星（管理员）=====
  if (pathname === '/api/admin/site-config' && method === 'POST') {
    const cur = siteConfigDB.all();
    const patch = {};
    ['logoType','logoEmoji','logoImage','siteName','siteSlogan'].forEach(k => { if (params[k] !== undefined) patch[k] = params[k]; });
    if (Array.isArray(params.navConfig)) patch.navConfig = params.navConfig;
    if (Array.isArray(params.topNavConfig)) patch.topNavConfig = params.topNavConfig;
    if (params.mineMenuConfig !== undefined) patch.mineMenuConfig = params.mineMenuConfig;
    if (params.vipTabsConfig !== undefined) patch.vipTabsConfig = params.vipTabsConfig;
    siteConfigDB.data = { ...cur, ...patch };
    siteConfigDB.save();
    return sendJson(res, { code: 0, data: siteConfigDB.all(), msg: '保存成功' });
  }

  if (pathname === '/api/admin/banners' && method === 'POST') {
    const cur = bannersDB.all();
    const list = Array.isArray(params.list) ? params.list : cur;
    bannersDB.data = list;
    bannersDB.save();
    return sendJson(res, { code: 0, data: list, msg: '保存成功' });
  }

  // 管理员 - 获取所有快捷入口（包括未启用的）
  if (pathname === '/api/admin/match-banners' && method === 'GET') {
    return sendJson(res, { code: 0, data: matchBannersDB.all() });
  }

  if (pathname === '/api/admin/match-banners' && method === 'POST') {
    const cur = matchBannersDB.all();
    const list = Array.isArray(params.list) ? params.list : cur;
    matchBannersDB.data = list;
    matchBannersDB.save();
    return sendJson(res, { code: 0, data: list, msg: '保存成功' });
  }

  // 管理员 - 获取/保存联系信息
  if (pathname === '/api/admin/contact' && method === 'GET') {
    const d = contactConfigDB.all();
    const defaults = {'heroBgImage':'','heroTitle':'联系我们','heroDesc':'7×24 小时为您提供真诚服务','phoneLabel':'客服电话','wechatLabel':'客服微信号（点击复制）','emailLabel':'联系邮箱','addressLabel':'公司地址','workTimeLabel':'工作时间','serviceUrlLabel':'在线客服','wecomLinkLabel':'企业微信客服','qrcodeSectionTitle':'客服微信号二维码','qrcodeHint':'扫码添加客服微信，获取专属服务','introSectionTitle':'关于我们'};
    for (const [k,v] of Object.entries(defaults)) { if (!(k in d) || d[k]==='') d[k]=v; }
    return sendJson(res, { code: 0, data: d });
  }
  if (pathname === '/api/admin/contact' && method === 'POST') {
    const cur = contactConfigDB.all();
    const allowed = ['phone', 'phoneDisplay', 'wechat', 'wechatQrcode', 'email', 'address', 'workTime', 'serviceUrl', 'wecomLink', 'qrcodeImage', 'intro',
      'heroBgImage', 'heroTitle', 'heroDesc', 'phoneLabel', 'wechatLabel', 'emailLabel', 'addressLabel', 'workTimeLabel', 'serviceUrlLabel', 'wecomLinkLabel', 'qrcodeSectionTitle', 'qrcodeHint', 'introSectionTitle'];
    const patch = {};
    for (const k of allowed) {
      if (params[k] !== undefined) patch[k] = String(params[k] || '');
    }
    contactConfigDB.data = { ...cur, ...patch };
    contactConfigDB.save();
    return sendJson(res, { code: 0, data: contactConfigDB.all(), msg: '保存成功' });
  }

  // ===== 公开：通用图片上传（无需认证，仅存文件） =====
  // 注意：放在管理员权限检查之前，这样即使session过期也能正常上传
  // 规范化路径（移除尾部斜杠）
  const normalizedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (normalizedPath === '/api/admin/upload' && method === 'POST') {
    const { image, subdir } = params;
    if (!image) return sendJson(res, { code: 1, msg: '请提供图片' });
    try {
      const m = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!m) return sendJson(res, { code: 1, msg: '图片格式错误' });
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
      const dir = subdir === 'avatars' ? AVATAR_DIR : UPLOAD_DIR;
      const filename = 'admin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) + '.' + ext;
      fs.writeFileSync(path.join(dir, filename), Buffer.from(m[2], 'base64'));
      const url = (subdir === 'avatars' ? '/avatars/' : '/uploads/') + filename;
      return sendJson(res, { code: 0, data: { url }, msg: '上传成功' });
    } catch (e) {
      return sendJson(res, { code: 1, msg: '上传失败：' + e.message });
    }
  }

  // 管理员 - 获取VIP服务页面配置
  if (pathname === '/api/admin/vip/service-config' && method === 'GET') {
    return sendJson(res, { code: 0, data: vipServiceConfigDB.all() });
  }
  // 管理员 - 保存VIP服务页面配置
  if (pathname === '/api/admin/vip/service-config' && method === 'POST') {
    const cur = vipServiceConfigDB.all();
    // 允许所有顶层字段更新
    const skipKeys = ['_id', '_created', '_updated'];
    const patch = {};
    for (const [k, v] of Object.entries(params)) {
      if (!skipKeys.includes(k)) {
        patch[k] = v;
      }
    }
    vipServiceConfigDB.data = { ...cur, ...patch };
    vipServiceConfigDB.save();
    return sendJson(res, { code: 0, data: vipServiceConfigDB.all(), msg: '保存成功' });
  }

  // 系统设置（站点名称/客服电话/客服微信 等）
  if (pathname === '/api/admin/settings' && method === 'GET') {
    return sendJson(res, { code: 0, data: settingsDB.all() });
  }
  if (pathname === '/api/admin/settings' && method === 'POST') {
    const cur = settingsDB.all();
    const allowed = ['siteName', 'servicePhone', 'serviceWechat', 'smsSign', 'favicon'];
    const patch = {};
    for (const k of allowed) {
      if (params[k] !== undefined) patch[k] = String(params[k] || '').trim();
    }
    settingsDB.data = { ...cur, ...patch };
    settingsDB.save();
    return sendJson(res, { code: 0, data: settingsDB.all(), msg: '保存成功' });
  }

  if (pathname === '/api/admin/star' && method === 'POST') {
    const cur = starConfigDB.all();
    const patch = {};
    if (params.title !== undefined) patch.title = params.title;
    if (params.subtitle !== undefined) patch.subtitle = params.subtitle;
    if (Array.isArray(params.items)) {
      // 校验每条数据
      const cleaned = [];
      for (const it of params.items) {
        if (!it || !it.userId) continue;
        const u = usersDB.find(x => x.id === it.userId);
        if (!u) return sendJson(res, { code: 1, msg: '用户不存在：' + it.userId });
        if (!it.timeStart || !it.timeEnd) return sendJson(res, { code: 1, msg: '请填写完整的展示时间区间' });
        const s = new Date(it.timeStart).getTime();
        const e = new Date(it.timeEnd).getTime();
        if (isNaN(s) || isNaN(e)) return sendJson(res, { code: 1, msg: '时间格式不正确' });
        if (e <= s) return sendJson(res, { code: 1, msg: '结束时间必须晚于开始时间' });
        cleaned.push({
          id: it.id || ('st_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
          userId: it.userId,
          timeStart: new Date(s).toISOString(),
          timeEnd: new Date(e).toISOString(),
          createdAt: it.createdAt || new Date().toISOString()
        });
      }
      // 冲突检测：允许最多3个时间重叠的条目，超过3个才报错
      // 收集所有记录（新建的 + 已存在的）
      const allItems = [...cleaned, ...(cur.items || []).filter(old => !cleaned.some(c => c.id === old.id))];
      // 检查每条新建记录的时间重叠数量
      for (let i = 0; i < cleaned.length; i++) {
        const a = cleaned[i];
        const aStart = new Date(a.timeStart).getTime();
        const aEnd = new Date(a.timeEnd).getTime();
        let overlapCount = 0;
        // 与其他所有记录（包括新建的和已存在的）检查重叠
        for (let j = 0; j < allItems.length; j++) {
          const b = allItems[j];
          if (b.id === a.id) continue; // 跳过自己
          const bStart = new Date(b.timeStart).getTime();
          const bEnd = new Date(b.timeEnd).getTime();
          if (aStart < bEnd && aEnd > bStart) {
            overlapCount++;
          }
        }
        // 如果重叠数量超过3个，就报错
        if (overlapCount > 3) {
          const ou = usersDB.find(x => x.id === a.userId);
          return sendJson(res, { code: 1, msg: '配置时间冲突：「' + (ou ? ou.nickname : a.userId) + '」的时间区间与超过3条记录重叠（当前重叠：' + overlapCount + '条），最多允许3个时间重叠' });
        }
      }
      patch.items = cleaned;
    }
    starConfigDB.data = { ...cur, ...patch };
    starConfigDB.save();
    return sendJson(res, { code: 0, data: starConfigDB.all(), msg: '保存成功' });
  }

  // 管理员 - 今日之星完整配置（含已下架项，方便后台管理）
  if (pathname === '/api/admin/star/full' && method === 'GET') {
    const cfg = starConfigDB.all();
    const now = Date.now();
    const items = (cfg.items || []).map(it => {
      const start = new Date(it.timeStart).getTime();
      const end = new Date(it.timeEnd).getTime();
      let status = '展示中';
      if (now < start) status = '未开始';
      else if (now >= end) status = '已下架';
      const u = usersDB.find(x => x.id === it.userId);
      return {
        id: it.id,
        userId: it.userId,
        timeStart: it.timeStart,
        timeEnd: it.timeEnd,
        createdAt: it.createdAt,
        status,
        expired: now >= end,
        user: u ? { id: u.id, userId: u.userId, nickname: u.nickname, avatar: u.avatar, gender: u.gender, age: u.age || (u.form && u.form.age), city: u.city || (u.form && u.form.currentCity), vip: u.vip, level: u.level } : null
      };
    });
    return sendJson(res, { code: 0, data: { title: cfg.title, subtitle: cfg.subtitle, items } });
  }

  // 管理员 - 今日之星用户搜索（按 userId / 昵称 / 手机号）
  if (pathname === '/api/admin/star/search-users' && method === 'GET') {
    const kw = String(params.keyword || '').trim().toLowerCase();
    if (!kw) return sendJson(res, { code: 1, msg: '请输入搜索关键词' });
    const list = usersDB.all().filter(u => {
      if ((u.userId || '').toLowerCase() === kw) return true;
      if ((u.nickname || '').toLowerCase().includes(kw)) return true;
      if ((u.phone || '').includes(kw)) return true;
      return false;
    }).slice(0, 30).map(u => ({
      id: u.id, userId: u.userId, nickname: u.nickname, avatar: u.avatar,
      gender: u.gender, age: u.age || (u.form && u.form.age), city: u.city || (u.form && u.form.currentCity),
      vip: u.vip, level: u.level
    }));
    return sendJson(res, { code: 0, data: list });
  }

  // 管理员 - 删除今日之星某条
  if (pathname.startsWith('/api/admin/star/item/') && method === 'DELETE') {
    const itemId = pathname.replace('/api/admin/star/item/', '');
    const cur = starConfigDB.all();
    const items = (cur.items || []).filter(it => it.id !== itemId);
    starConfigDB.data = { ...cur, items };
    starConfigDB.save();
    return sendJson(res, { code: 0, msg: '已删除' });
  }

  // ===== 问卷管理 API =====
  if (pathname === '/api/admin/surveys' && method === 'GET') {
    const list = surveysDB.all().map(s => ({
      ...s,
      _count: surveyResponsesDB.filter(r => r.surveyId === s.id).length
    }));
    return sendJson(res, { code: 0, data: list });
  }
  if (pathname === '/api/admin/survey/save' && method === 'POST') {
    const body = params;
    if (!body.title) return sendJson(res, { code: 1, msg: '请输入问卷标题' });
    if (!body.questions || !body.questions.length) return sendJson(res, { code: 1, msg: '请至少添加一道题目' });
    const id = body.id || ('sv_' + Date.now().toString(36));
    body.id = id;
    body.updatedAt = new Date().toISOString();
    if (!body.createdAt) body.createdAt = new Date().toISOString();
    const existing = surveysDB.find(x => x.id === id);
    if (existing) {
      Object.assign(existing, body);
      surveysDB.save();
    } else {
      surveysDB.insert(body);
    }
    return sendJson(res, { code: 0, data: body, msg: '保存成功' });
  }
  if (pathname === '/api/admin/survey/delete' && method === 'POST') {
    const { id } = params;
    if (!id) return sendJson(res, { code: 1, msg: '缺少问卷ID' });
    const idx = surveysDB.data.findIndex(x => x.id === id);
    if (idx !== -1) { surveysDB.data.splice(idx, 1); surveysDB.save(); }
    return sendJson(res, { code: 0, msg: '删除成功' });
  }
  // 问卷统计
  if (pathname === '/api/admin/survey/stats' && method === 'GET') {
    const surveyId = params.surveyId;
    if (!surveyId) return sendJson(res, { code: 1, msg: '缺少问卷ID' });
    const survey = surveysDB.find(x => x.id === surveyId);
    if (!survey) return sendJson(res, { code: 1, msg: '问卷不存在' });
    const responses = surveyResponsesDB.filter(x => x.surveyId === surveyId);
    // 统计每个问题的选项占比
    const stats = { totalResponses: responses.length, questions: {} };
    (survey.questions || []).forEach(q => {
      stats.questions[q.id] = { text: q.text, type: q.type, options: {}, total: 0 };
      responses.forEach(r => {
        const ans = r.answers && r.answers[q.id];
        if (!ans) return;
        stats.questions[q.id].total++;
        if (Array.isArray(ans)) {
          ans.forEach(a => { stats.questions[q.id].options[a] = (stats.questions[q.id].options[a] || 0) + 1; });
        } else {
          stats.questions[q.id].options[ans] = (stats.questions[q.id].options[ans] || 0) + 1;
        }
      });
    });
    return sendJson(res, { code: 0, data: { survey, responses, stats } });
  }
  // 按用户搜索问卷填写记录
  if (pathname === '/api/admin/survey/user-responses' && method === 'GET') {
    const keyword = params.keyword || '';
    const surveyId = params.surveyId || '';
    let results = surveyResponsesDB.all();
    if (surveyId) results = results.filter(r => r.surveyId === surveyId);
    if (keyword) results = results.filter(r =>
      (r.nickname && r.nickname.includes(keyword)) ||
      (r.userId && r.userId.includes(keyword))
    );
    return sendJson(res, { code: 0, data: results });
  }

  // ===== 导出问卷结果 Excel =====
  if (pathname === '/api/admin/survey/export' && method === 'POST') {
    if (!ExcelJS) return sendJson(res, { code: 1, msg: 'ExcelJS 未安装，无法导出' });
    const { surveyIds, userKeyword } = params;
    if (!Array.isArray(surveyIds) || !surveyIds.length) return sendJson(res, { code: 1, msg: '请选择要导出的问卷' });
    const wb = new ExcelJS.Workbook();
      // Sheet1: 统计结果
      const ws1 = wb.addWorksheet('统计结果');
      ws1.columns = [
        { header: '问卷标题', key: 'title', width: 20 },
        { header: '题目', key: 'question', width: 30 },
        { header: '题目类型', key: 'type', width: 12 },
        { header: '回答人数', key: 'total', width: 10 },
        { header: '选项/答案', key: 'option', width: 20 },
        { header: '选择人数', key: 'count', width: 10 },
        { header: '占比', key: 'pct', width: 10 }
      ];
      // Sheet2: 详细结果（列A=填写用户昵称/ID, 后续列=各题答案）
      const ws2 = wb.addWorksheet('详细结果');
      surveyIds.forEach(sid => {
        const survey = surveysDB.find(x => x.id === sid);
        if (!survey) return;
        const responses = surveyResponsesDB.filter(x => x.surveyId === sid);
        const filtered = userKeyword
          ? responses.filter(r => (r.nickname && r.nickname.includes(userKeyword)) || (r.userId && r.userId.includes(userKeyword)))
          : responses;
        // === Sheet1: 统计 ===
        (survey.questions || []).forEach(q => {
          const qResponses = filtered.filter(r => r.answers && r.answers[q.id]);
          const total = qResponses.length;
          if (q.type !== 'text') {
            const optCounts = {};
            qResponses.forEach(r => {
              const ans = r.answers[q.id];
              if (Array.isArray(ans)) ans.forEach(a => { optCounts[a] = (optCounts[a] || 0) + 1; });
              else if (ans) optCounts[ans] = (optCounts[ans] || 0) + 1;
            });
            Object.entries(optCounts).forEach(([opt, count]) => {
              ws1.addRow({ title: survey.title, question: q.text, type: q.type === 'single' ? '单选' : q.type === 'multi' ? '多选' : q.type, total, option: String(opt), count, pct: total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%' });
            });
          } else {
            qResponses.forEach(r => {
              ws1.addRow({ title: survey.title, question: q.text, type: '填空', total, option: String(r.answers[q.id] || ''), count: 1, pct: '' });
            });
          }
        });
        // === Sheet2: 详细结果 — 每个问卷单独一个区块 ===
        // 写入问卷标题行
        ws2.addRow({ user: '【' + survey.title + '】' });
        // 写入列头行
        const headerRow = { user: '填写用户（昵称/ID）' };
        (survey.questions || []).forEach((q, qi) => {
          headerRow['q_' + qi] = q.text;
        });
        ws2.addRow(headerRow);
        // 写入数据行
        filtered.forEach(r => {
          const row = { user: (r.nickname || '') + ' / ' + (r.userId || '匿名') };
          (survey.questions || []).forEach((q, qi) => {
            const ans = r.answers && r.answers[q.id];
            row['q_' + qi] = ans ? (Array.isArray(ans) ? ans.join(', ') : String(ans)) : '';
          });
          ws2.addRow(row);
        });
        // 空行分隔
        ws2.addRow({});
      });
      // 设置Sheet2列宽
      ws2.getColumn(1).width = 24;
      for (let i = 2; i <= 20; i++) {
        ws2.getColumn(i).width = 24;
      }
      // 样式
      ws1.getRow(1).font = { bold: true };
      ws1.eachRow((row, n) => { if (n > 1) row.alignment = { vertical: 'middle', wrapText: true }; });
      ws2.eachRow((row) => { row.alignment = { vertical: 'middle', wrapText: true }; });
      wb.xlsx.writeBuffer().then(buf => {
        const fname = 'survey_export_' + new Date().toISOString().slice(0,10) + '.xlsx';
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="' + fname + '"; filename*=UTF-8\'\'' + encodeURIComponent('问卷结果_' + new Date().toLocaleDateString('zh-CN') + '.xlsx'),
          'Content-Length': buf.length
        });
        res.end(buf);
      }).catch(err => {
        sendJson(res, { code: 1, msg: '导出失败：' + err.message });
      });
      return;
  }

  // ===== 前端问卷API =====
  // 获取可用问卷列表（只返回已到发布时间且未结束的问卷）
  if (pathname === '/api/surveys' && method === 'GET') {
    const now = new Date();
    let list = surveysDB.all().filter(s => {
      // 状态检查：必须是已发布
      if (s.status !== 'published') return false;
      // 发布时间检查：如果设置了发布时间，必须已到发布时间
      if (s.publishTime && new Date(s.publishTime) > now) return false;
      // 结束时间检查：如果设置了结束时间，必须未到结束时间
      if (s.endTime && new Date(s.endTime) < now) return false;
      return true;
    });
    return sendJson(res, { code: 0, data: list });
  }

  // ===== 管理后台统一问卷 API（POST /api/survey with action）=====
  if (pathname === '/api/survey' && method === 'POST') {
    const action = params.action;
    
    // 列表
    if (action === 'list') {
      let list = surveysDB.all().map(s => ({
        ...s,
        responseCount: surveyResponsesDB.filter(r => r.surveyId === s.id).length,
        todayCount: surveyResponsesDB.filter(r =>
          r.surveyId === s.id &&
          new Date(r.submittedAt).toDateString() === new Date().toDateString()
        ).length
      }));
      if (params.search) list = list.filter(s => s.title && s.title.includes(params.search));
      if (params.status) list = list.filter(s => s.status === params.status);
      if (params.type) list = list.filter(s => s.type === params.type);
      
      // 按创建时间倒序（最新的在前）
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // 重新分配ID（从1开始顺序编号，仅用于显示）
      list.forEach((s, idx) => { s.displayId = idx + 1; });
      
      return sendJson(res, { success: true, data: list });
    }
    
    // 创建/保存
    if (action === 'create' || action === 'update' || action === 'save') {
      const body = params;
      if (!body.title) return sendJson(res, { success: false, message: '请输入问卷标题' });
      const id = body.id || ('sv_' + Date.now().toString(36));
      body.id = id;
      body.updatedAt = new Date().toISOString();
      if (!body.createdAt) body.createdAt = new Date().toISOString();
      if (!body.status) body.status = 'draft';
      // 新增：发布时间和结束时间
      if (!body.publishTime) body.publishTime = null;  // 发布时间
      if (!body.endTime) body.endTime = null;          // 结束时间
      
      const existing = surveysDB.find(x => x.id === id);
      if (existing) {
        Object.assign(existing, body);
        surveysDB.save();
      } else {
        surveysDB.insert(body);
      }
      return sendJson(res, { success: true, data: body, message: '保存成功' });
    }
    
    // 从模板创建
    if (action === 'createFromTemplate') {
      const templateType = params.templateType;
      if (!templateType) return sendJson(res, { success: false, message: '请选择模板类型' });
      
      let templateData = {};
      if (templateType === 'male') {
        templateData = {
          id: 'sv_' + Date.now().toString(36),
          title: 'StarMeet个人信息收集表（男性客户）',
          type: 'male',
          status: 'draft',
          publishTime: null,  // 发布时间（null表示立即发布）
          endTime: null,      // 结束时间（null表示永不结束）
          description: '男性客户基本信息收集问卷',
          questions: [
            { id: 'q1', title: '您的姓名', type: 'text', required: true },
            { id: 'q2', title: '您的年龄', type: 'number', required: true },
            { id: 'q3', title: '您的联系方式（手机号/微信）', type: 'text', required: true },
            { id: 'q4', title: '您的职业', type: 'text', required: false },
            { id: 'q5', title: '您的学历', type: 'radio', options: ['高中及以下','大专','本科','硕士及以上'], required: true },
            { id: 'q6', title: '您的年收入范围', type: 'radio', options: ['10万以下','10-20万','20-50万','50万以上'], required: false },
            { id: 'q7', title: '您期望的伴侣年龄范围', type: 'text', required: false },
            { id: 'q8', title: '您对另一半的主要要求', type: 'textarea', required: false }
          ]
        };
      } else if (templateType === 'female') {
        templateData = {
          id: 'sv_' + Date.now().toString(36),
          title: 'StarMeet个人信息收集表（女性用户）',
          type: 'female',
          status: 'draft',
          publishTime: null,
          endTime: null,
          description: '女性用户基本信息收集问卷',
          questions: [
            { id: 'q1', title: '您的姓名', type: 'text', required: true },
            { id: 'q2', title: '您的年龄', type: 'number', required: true },
            { id: 'q3', title: '您的联系方式（手机号/微信）', type: 'text', required: true },
            { id: 'q4', title: '您的职业', type: 'text', required: false },
            { id: 'q5', title: '您的学历', type: 'radio', options: ['高中及以下','大专','本科','硕士及以上'], required: true },
            { id: 'q6', title: '您的兴趣爱好', type: 'checkbox', options: ['阅读','旅行','运动','美食','音乐','电影','摄影','其他'], required: false },
            { id: 'q7', title: '您期望的伴侣类型', type: 'textarea', required: false },
            { id: 'q8', title: '您对婚恋的看法', type: 'textarea', required: false }
          ]
        };
      } else {
        return sendJson(res, { success: false, message: '不支持的模板类型' });
      }
      
      templateData.createdAt = new Date().toISOString();
      templateData.updatedAt = new Date().toISOString();
      surveysDB.insert(templateData);
      return sendJson(res, { success: true, data: templateData, message: '从模板创建成功' });
    }
    
    // 获取单个问卷详情
    if (action === 'get') {
      const id = params.id;
      if (!id) return sendJson(res, { success: false, message: '缺少问卷ID' });
      const survey = surveysDB.find(x => x.id === id);
      if (!survey) return sendJson(res, { success: false, message: '问卷不存在' });
      return sendJson(res, { success: true, data: survey });
    }
    
    // 发布
    if (action === 'publish') {
      const id = params.id;
      if (!id) return sendJson(res, { success: false, message: '缺少ID' });
      const survey = surveysDB.find(x => x.id === id);
      if (!survey) return sendJson(res, { success: false, message: '问卷不存在' });
      survey.status = 'published';
      survey.updatedAt = new Date().toISOString();
      surveysDB.save();
      return sendJson(res, { success: true, message: '发布成功' });
    }
    
    // 取消发布
    if (action === 'unpublish') {
      const id = params.id;
      if (!id) return sendJson(res, { success: false, message: '缺少ID' });
      const survey = surveysDB.find(x => x.id === id);
      if (!survey) return sendJson(res, { success: false, message: '问卷不存在' });
      survey.status = 'draft';
      survey.updatedAt = new Date().toISOString();
      surveysDB.save();
      return sendJson(res, { success: true, message: '已取消发布' });
    }
    
    // 删除
    if (action === 'delete') {
      const id = params.id;
      if (!id) return sendJson(res, { success: false, message: '缺少ID' });
      const idx = surveysDB.data.findIndex(x => x.id === id);
      if (idx !== -1) { surveysDB.data.splice(idx, 1); surveysDB.save(); }
      return sendJson(res, { success: true, message: '删除成功' });
    }
    
    return sendJson(res, { success: false, message: '未知操作: ' + action });
  }

  // ===== 开屏广告管理 API（需要管理员权限）=====
  if (pathname === '/api/admin/splash-ads' && method === 'GET') {
    return sendJson(res, { code: 0, data: splashAdsDB.all() });
  }
  if (pathname === '/api/admin/splash-ad/save' && method === 'POST') {
    const body = params;
    if (!body.image) return sendJson(res, { code: 1, msg: '请上传开屏图片' });
    const id = body.id || ('splash_' + Date.now().toString(36));
    body.id = id;
    body.updatedAt = new Date().toISOString();
    if (!body.createdAt) body.createdAt = new Date().toISOString();
    const existing = splashAdsDB.find(x => x.id === id);
    if (existing) { Object.assign(existing, body); splashAdsDB.save(); }
    else splashAdsDB.insert(body);
    return sendJson(res, { code: 0, data: body, msg: '保存成功' });
  }
  if (pathname === '/api/admin/splash-ad/delete' && method === 'POST') {
    const { id } = params;
    if (!id) return sendJson(res, { code: 1, msg: '缺少ID' });
    const idx = splashAdsDB.data.findIndex(x => x.id === id);
    if (idx !== -1) { splashAdsDB.data.splice(idx, 1); splashAdsDB.save(); }
    return sendJson(res, { code: 0, msg: '删除成功' });
  }

  // 保存VIP套餐（管理员）
  if (pathname === '/api/vip/plans/save' && method === 'POST') {
    const { plans } = params;
    if (!plans) return sendJson(res, { code: 1, msg: '缺少套餐数据' });
    const vipPlansFile = path.join(DATA_DIR, 'vip_plans.json');
    try {
      fs.writeFileSync(vipPlansFile, JSON.stringify(plans, null, 2), 'utf-8');
      return sendJson(res, { code: 0, msg: '保存成功' });
    } catch(e) {
      return sendJson(res, { code: 1, msg: '保存失败：' + e.message });
    }
  }

  // 保存VIP权限配置（管理员）
  if (pathname === '/api/vip/permissions/save' && method === 'POST') {
    const { permissions } = params;
    if (!permissions) return sendJson(res, { code: 1, msg: '缺少权限数据' });
    const permFile = path.join(DATA_DIR, 'vip_permissions.json');
    try {
      fs.writeFileSync(permFile, JSON.stringify({ permissions }, null, 2), 'utf-8');
      return sendJson(res, { code: 0, msg: '保存成功' });
    } catch(e) {
      return sendJson(res, { code: 1, msg: '保存失败：' + e.message });
    }
  }

  // 检查VIP状态
  if (pathname === '/api/vip/status' && method === 'GET') {
    const { userId } = params;
    if (!userId) return sendJson(res, { code: 1, msg: '缺少用户ID' });

    const usersFile = path.join(DATA_DIR, 'users.json');
    let users = [];
    if (fs.existsSync(usersFile)) {
      try { users = JSON.parse(fs.readFileSync(usersFile, 'utf-8')); } catch(e) {}
    }
    const user = users.find(u => u.userId === userId || u.id === userId);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });

    const now = new Date();
    const isVip = user.vip_type !== 'none' && user.vip_expire && new Date(user.vip_expire) > now;
    return sendJson(res, {
      code: 0,
      data: {
        vip_type: isVip ? user.vip_type : 'none',
        vip_expire: isVip ? user.vip_expire : null,
        is_vip: isVip
      }
    });
  }
// ===== 支付配置API（管理员） =====
// 获取支付配置
if (pathname === '/api/admin/payment/config' && method === 'GET') {
  const payConfigFile = path.join(DATA_DIR, 'payment_config.json');
  let config = { mockMode: true, wechat: { enabled: false, sandbox: true, appid: '', mchid: '', apiKey: '' }, alipay: { enabled: false, sandbox: true, appId: '', merchantPrivateKey: '', alipayPublicKey: '' }, paypal: { enabled: false, sandbox: true, clientId: '', clientSecret: '' } };
  if (fs.existsSync(payConfigFile)) {
    try { 
      const serverConfig = JSON.parse(fs.readFileSync(payConfigFile, 'utf-8'));
      // 转换服务器数据结构到前端结构
      config = {
        mockMode: serverConfig.mock ? serverConfig.mock.enabled !== false : true,
        wechat: {
          enabled: serverConfig.channels && serverConfig.channels.wechat ? serverConfig.channels.wechat.enabled || false : false,
          sandbox: serverConfig.channels && serverConfig.channels.wechat ? serverConfig.channels.wechat.sandbox !== false : true,
          appid: serverConfig.channels && serverConfig.channels.wechat && serverConfig.channels.wechat.config ? serverConfig.channels.wechat.config.appid || '' : '',
          mchid: serverConfig.channels && serverConfig.channels.wechat && serverConfig.channels.wechat.config ? serverConfig.channels.wechat.config.mch_id || '' : '',
          apiKey: serverConfig.channels && serverConfig.channels.wechat && serverConfig.channels.wechat.config ? serverConfig.channels.wechat.config.api_key || '' : ''
        },
        alipay: {
          enabled: serverConfig.channels && serverConfig.channels.alipay ? serverConfig.channels.alipay.enabled || false : false,
          sandbox: serverConfig.channels && serverConfig.channels.alipay ? serverConfig.channels.alipay.sandbox !== false : true,
          appId: serverConfig.channels && serverConfig.channels.alipay && serverConfig.channels.alipay.config ? serverConfig.channels.alipay.config.app_id || '' : '',
          merchantPrivateKey: serverConfig.channels && serverConfig.channels.alipay && serverConfig.channels.alipay.config ? serverConfig.channels.alipay.config.merchant_private_key || '' : '',
          alipayPublicKey: serverConfig.channels && serverConfig.channels.alipay && serverConfig.channels.alipay.config ? serverConfig.channels.alipay.config.alipay_public_key || '' : ''
        },
        paypal: {
          enabled: serverConfig.channels && serverConfig.channels.paypal ? serverConfig.channels.paypal.enabled || false : false,
          sandbox: serverConfig.channels && serverConfig.channels.paypal ? serverConfig.channels.paypal.sandbox !== false : true,
          clientId: serverConfig.channels && serverConfig.channels.paypal && serverConfig.channels.paypal.config ? serverConfig.channels.paypal.config.client_id || '' : '',
          clientSecret: serverConfig.channels && serverConfig.channels.paypal && serverConfig.channels.paypal.config ? serverConfig.channels.paypal.config.client_secret || '' : ''
        }
      };
    } catch(e) {}
  }
  return sendJson(res, { code: 0, data: config });
}

// 保存支付配置（完整配置）
if (pathname === '/api/admin/payment/config' && method === 'POST') {
  const { mockMode, wechat, alipay, paypal } = params;
  
  // 转换前端数据结构到服务器结构
  const serverConfig = {
    enabled: true,
    currency: { default: 'CNY', auto_switch: true, supported: ['CNY','USD'] },
    channels: {
      wechat: { 
        name: '微信支付', 
        currency: 'CNY', 
        enabled: wechat ? wechat.enabled || false : false, 
        sandbox: wechat ? wechat.sandbox !== false : true, 
        config: { 
          appid: wechat ? wechat.appid || '' : '', 
          mch_id: wechat ? wechat.mchid || '' : '', 
          api_key: wechat ? wechat.apiKey || '' : '', 
          notify_url: '' 
        } 
      },
      alipay: { 
        name: '支付宝', 
        currency: 'CNY', 
        enabled: alipay ? alipay.enabled || false : false, 
        sandbox: alipay ? alipay.sandbox !== false : true, 
        config: { 
          app_id: alipay ? alipay.appId || '' : '', 
          merchant_private_key: alipay ? alipay.merchantPrivateKey || '' : '', 
          alipay_public_key: alipay ? alipay.alipayPublicKey || '' : '', 
          notify_url: '' 
        } 
      },
      paypal: { 
        name: 'PayPal', 
        currency: 'USD', 
        enabled: paypal ? paypal.enabled || false : false, 
        sandbox: paypal ? paypal.sandbox !== false : true, 
        config: { 
          client_id: paypal ? paypal.clientId || '' : '', 
          client_secret: paypal ? paypal.clientSecret || '' : '', 
          mode: (paypal && paypal.sandbox) ? 'sandbox' : 'live' 
        } 
      }
    },
    mock: { 
      enabled: mockMode !== false, 
      auto_success: true, 
      delay_seconds: 3 
    }
  };
  
  const payConfigFile = path.join(DATA_DIR, 'payment_config.json');
  try {
    fs.writeFileSync(payConfigFile, JSON.stringify(serverConfig, null, 2), 'utf-8');
    return sendJson(res, { code: 0, msg: '保存成功' });
  } catch(e) {
    return sendJson(res, { code: 1, msg: '保存失败：' + e.message });
  }
}

// 保存支付渠道配置
if (pathname === '/api/admin/payment/config/channel' && method === 'POST') {
  const { channel, config } = params;
  if (!channel || !config) return sendJson(res, { code: 1, msg: '缺少参数' });
  const payConfigFile = path.join(DATA_DIR, 'payment_config.json');
  let payConfig = { channels: {}, mock: {} };
  if (fs.existsSync(payConfigFile)) {
    try { payConfig = JSON.parse(fs.readFileSync(payConfigFile, 'utf-8')); } catch(e) {}
  }
  if (!payConfig.channels) payConfig.channels = {};
  if (!payConfig.channels[channel]) payConfig.channels[channel] = {};
  payConfig.channels[channel].config = config;
  try {
    fs.writeFileSync(payConfigFile, JSON.stringify(payConfig, null, 2), 'utf-8');
    return sendJson(res, { code: 0, msg: '保存成功' });
  } catch(e) {
    return sendJson(res, { code: 1, msg: '保存失败：' + e.message });
  }
}

// 切换支付渠道开关
if (pathname === '/api/admin/payment/config/channel/toggle' && method === 'POST') {
  const { channel, enabled } = params;
  if (!channel) return sendJson(res, { code: 1, msg: '缺少参数' });
  const payConfigFile = path.join(DATA_DIR, 'payment_config.json');
  let payConfig = { channels: {} };
  if (fs.existsSync(payConfigFile)) {
    try { payConfig = JSON.parse(fs.readFileSync(payConfigFile, 'utf-8')); } catch(e) {}
  }
  if (!payConfig.channels) payConfig.channels = {};
  if (!payConfig.channels[channel]) payConfig.channels[channel] = {};
  payConfig.channels[channel].enabled = enabled === true || enabled === 'true';
  try {
    fs.writeFileSync(payConfigFile, JSON.stringify(payConfig, null, 2), 'utf-8');
    return sendJson(res, { code: 0, msg: '操作成功' });
  } catch(e) {
    return sendJson(res, { code: 1, msg: '操作失败：' + e.message });
  }
}

// 保存模拟支付配置
if (pathname === '/api/admin/payment/config/mock' && method === 'POST') {
  const { enabled, delay_seconds, auto_success } = params;
  const payConfigFile = path.join(DATA_DIR, 'payment_config.json');
  let payConfig = { mock: {} };
  if (fs.existsSync(payConfigFile)) {
    try { payConfig = JSON.parse(fs.readFileSync(payConfigFile, 'utf-8')); } catch(e) {}
  }
  if (!payConfig.mock) payConfig.mock = {};
  if (enabled !== undefined) payConfig.mock.enabled = enabled === true || enabled === 'true';
  if (delay_seconds !== undefined) payConfig.mock.delay_seconds = parseInt(delay_seconds) || 3;
  if (auto_success !== undefined) payConfig.mock.auto_success = auto_success === true || auto_success === 'true';
  try {
    fs.writeFileSync(payConfigFile, JSON.stringify(payConfig, null, 2), 'utf-8');
    return sendJson(res, { code: 0, msg: '保存成功' });
  } catch(e) {
    return sendJson(res, { code: 1, msg: '保存失败：' + e.message });
  }
}

// ===== 微信支付接口 =====
if (pathname === '/api/vip/pay/wechat' && method === 'POST') {
  const { userId, planId, currency } = params;
  if (!userId || !planId) return sendJson(res, { code: 1, msg: '缺少参数' });

  const vipPlansFile = path.join(DATA_DIR, 'vip_plans.json');
  let plans = [];
  if (fs.existsSync(vipPlansFile)) {
    try { plans = JSON.parse(fs.readFileSync(vipPlansFile, 'utf-8')); } catch(e) {}
  }
  const plan = plans.find(p => p.id === planId);
  if (!plan) return sendJson(res, { code: 1, msg: '套餐不存在' });

  // 读取支付配置
  const payConfigFile = path.join(DATA_DIR, 'payment_config.json');
  let payConfig = { channels: { wechat: { enabled: false, sandbox: true } } };
  if (fs.existsSync(payConfigFile)) {
    try { payConfig = JSON.parse(fs.readFileSync(payConfigFile, 'utf-8')); } catch(e) {}
  }

  // 如果微信支付未开启，使用模拟支付
  if (!payConfig.channels.wechat || !payConfig.channels.wechat.enabled) {
    // 模拟支付：直接开通VIP
    const user = usersDB.find(u => u.id === userId || u.userId === userId || u.phone === userId);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
    var now = new Date();
    var currentExpire = user.vip_expire ? new Date(user.vip_expire) : now;
    if (currentExpire < now) currentExpire = now;
    var newExpire = new Date(currentExpire.getTime() + plan.days * 24 * 60 * 60 * 1000);
    user.vip_type = plan.type;
    user.vip_expire = newExpire.toISOString();
    user.vip = true;
    usersDB.save();
    return sendJson(res, { code: 0, data: { vipType: plan.type, vipExpire: user.vip_expire }, msg: '支付成功（模拟）' });
  }

  // 真实微信支付：生成支付订单，返回跳转URL或二维码
  // TODO: 接入微信支付官方SDK
  // 当前返回模拟支付成功
  const user = usersDB.find(u => u.id === userId || u.userId === userId || u.phone === userId);
  if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
  var now = new Date();
  var currentExpire = user.vip_expire ? new Date(user.vip_expire) : now;
  if (currentExpire < now) currentExpire = now;
  var newExpire = new Date(currentExpire.getTime() + plan.days * 24 * 60 * 60 * 1000);
  user.vip_type = plan.type;
  user.vip_expire = newExpire.toISOString();
  user.vip = true;
  usersDB.save();

  // 记录支付
  var payFile = path.join(DATA_DIR, 'payments.json');
  var payments = [];
  if (fs.existsSync(payFile)) {
    try { payments = JSON.parse(fs.readFileSync(payFile, 'utf-8')); } catch(e) {}
  }
  payments.push({
    id: 'PAY' + Date.now(),
    userId: user.id,
    planId: plan.id,
    planName: plan.name,
    amount: plan.prices?.[currency||'CNY'] || plan.price,
    currency: currency || 'CNY',
    status: 'success',
    method: 'wechat',
    paidAt: new Date().toISOString()
  });
  try { fs.writeFileSync(payFile, JSON.stringify(payments, null, 2), 'utf-8'); } catch(e) {}

  return sendJson(res, { code: 0, data: { vipType: plan.type, vipExpire: user.vip_expire }, msg: '支付成功' });
}

// ===== 支付宝接口 =====
if (pathname === '/api/vip/pay/alipay' && method === 'POST') {
  const { userId, planId, currency } = params;
  if (!userId || !planId) return sendJson(res, { code: 1, msg: '缺少参数' });

  const vipPlansFile = path.join(DATA_DIR, 'vip_plans.json');
  let plans = [];
  if (fs.existsSync(vipPlansFile)) {
    try { plans = JSON.parse(fs.readFileSync(vipPlansFile, 'utf-8')); } catch(e) {}
  }
  const plan = plans.find(p => p.id === planId);
  if (!plan) return sendJson(res, { code: 1, msg: '套餐不存在' });

  // 读取支付配置
  const payConfigFile = path.join(DATA_DIR, 'payment_config.json');
  let payConfig = { channels: { alipay: { enabled: false, sandbox: true } } };
  if (fs.existsSync(payConfigFile)) {
    try { payConfig = JSON.parse(fs.readFileSync(payConfigFile, 'utf-8')); } catch(e) {}
  }

  // 如果支付宝未开启，使用模拟支付
  if (!payConfig.channels.alipay || !payConfig.channels.alipay.enabled) {
    const user = usersDB.find(u => u.id === userId || u.userId === userId || u.phone === userId);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
    var now = new Date();
    var currentExpire = user.vip_expire ? new Date(user.vip_expire) : now;
    if (currentExpire < now) currentExpire = now;
    var newExpire = new Date(currentExpire.getTime() + plan.days * 24 * 60 * 60 * 1000);
    user.vip_type = plan.type;
    user.vip_expire = newExpire.toISOString();
    user.vip = true;
    usersDB.save();
    return sendJson(res, { code: 0, data: { vipType: plan.type, vipExpire: user.vip_expire }, msg: '支付成功（模拟）' });
  }

  // 真实支付宝支付：生成支付表单，返回跳转URL
  // TODO: 接入支付宝SDK
  // 当前返回模拟支付成功
  const user = usersDB.find(u => u.id === userId || u.userId === userId || u.phone === userId);
  if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
  var now = new Date();
  var currentExpire = user.vip_expire ? new Date(user.vip_expire) : now;
  if (currentExpire < now) currentExpire = now;
  var newExpire = new Date(currentExpire.getTime() + plan.days * 24 * 60 * 60 * 1000);
  user.vip_type = plan.type;
  user.vip_expire = newExpire.toISOString();
  user.vip = true;
  usersDB.save();

  var payFile = path.join(DATA_DIR, 'payments.json');
  var payments = [];
  if (fs.existsSync(payFile)) {
    try { payments = JSON.parse(fs.readFileSync(payFile, 'utf-8')); } catch(e) {}
  }
  payments.push({
    id: 'PAY' + Date.now(),
    userId: user.id,
    planId: plan.id,
    planName: plan.name,
    amount: plan.prices?.[currency||'CNY'] || plan.price,
    currency: currency || 'CNY',
    status: 'success',
    method: 'alipay',
    paidAt: new Date().toISOString()
  });
  try { fs.writeFileSync(payFile, JSON.stringify(payments, null, 2), 'utf-8'); } catch(e) {}

  return sendJson(res, { code: 0, data: { vipType: plan.type, vipExpire: user.vip_expire }, msg: '支付成功' });
}

// ===== PayPal接口 =====
if (pathname === '/api/vip/pay/paypal' && method === 'POST') {
  const { userId, planId, currency } = params;
  if (!userId || !planId) return sendJson(res, { code: 1, msg: '缺少参数' });

  const vipPlansFile = path.join(DATA_DIR, 'vip_plans.json');
  let plans = [];
  if (fs.existsSync(vipPlansFile)) {
    try { plans = JSON.parse(fs.readFileSync(vipPlansFile, 'utf-8')); } catch(e) {}
  }
  const plan = plans.find(p => p.id === planId);
  if (!plan) return sendJson(res, { code: 1, msg: '套餐不存在' });

  // 读取支付配置
  const payConfigFile = path.join(DATA_DIR, 'payment_config.json');
  let payConfig = { channels: { paypal: { enabled: false, sandbox: true, config: { mode: 'sandbox' } } } };
  if (fs.existsSync(payConfigFile)) {
    try { payConfig = JSON.parse(fs.readFileSync(payConfigFile, 'utf-8')); } catch(e) {}
  }

  // 如果PayPal未开启，使用模拟支付
  if (!payConfig.channels.paypal || !payConfig.channels.paypal.enabled) {
    const user = usersDB.find(u => u.id === userId || u.userId === userId || u.phone === userId);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
    var now = new Date();
    var currentExpire = user.vip_expire ? new Date(user.vip_expire) : now;
    if (currentExpire < now) currentExpire = now;
    var newExpire = new Date(currentExpire.getTime() + plan.days * 24 * 60 * 60 * 1000);
    user.vip_type = plan.type;
    user.vip_expire = newExpire.toISOString();
    user.vip = true;
    usersDB.save();
    return sendJson(res, { code: 0, data: { vipType: plan.type, vipExpire: user.vip_expire }, msg: '支付成功（模拟）' });
  }

  // 真实PayPal支付：调用PayPal API创建订单，返回跳转URL
  // TODO: 接入PayPal SDK
  // 当前返回模拟支付成功
  const user = usersDB.find(u => u.id === userId || u.userId === userId || u.phone === userId);
  if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
  var now = new Date();
  var currentExpire = user.vip_expire ? new Date(user.vip_expire) : now;
  if (currentExpire < now) currentExpire = now;
  var newExpire = new Date(currentExpire.getTime() + plan.days * 24 * 60 * 60 * 1000);
  user.vip_type = plan.type;
  user.vip_expire = newExpire.toISOString();
  user.vip = true;
  usersDB.save();

  var payFile = path.join(DATA_DIR, 'payments.json');
  var payments = [];
  if (fs.existsSync(payFile)) {
    try { payments = JSON.parse(fs.readFileSync(payFile, 'utf-8')); } catch(e) {}
  }
  payments.push({
    id: 'PAY' + Date.now(),
    userId: user.id,
    planId: plan.id,
    planName: plan.name,
    amount: plan.prices?.[currency||'USD'] || (plan.price / 7).toFixed(2),
    currency: currency || 'USD',
    status: 'success',
    method: 'paypal',
    paidAt: new Date().toISOString()
  });
  try { fs.writeFileSync(payFile, JSON.stringify(payments, null, 2), 'utf-8'); } catch(e) {}

  return sendJson(res, { code: 0, data: { vipType: plan.type, vipExpire: user.vip_expire }, msg: '支付成功' });
}

// ============ 圈子功能 API ============
// 获取圈子帖子列表（公开）
if (pathname === '/api/circle_posts' && method === 'GET') {
  const page = parseInt(params.page) || 1;
  const pageSize = parseInt(params.pageSize) || 10;
  let posts = circlePostsDB.all();
  // 按创建时间倒序
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  // === 审核过滤 ===
  // 无 status 字段的旧数据视为已审核通过（向后兼容）
  // 未登录：只能看已通过审核的
  // 已登录：可以看已通过 + 自己发布的（含待审/已拒绝）
  // 管理员：可以看所有
  posts = posts.filter(p => {
    if (isAdmin) return true;
    const st = p.status || 'approved';
    if (st === 'approved') return true;
    if (currentUser && p.userId === currentUser.id) return true;
    return false;
  });
  // 支持按用户ID筛选（用于个人中心圈子/图片tab）
  if (params.userId) {
    posts = posts.filter(p => p.userId === params.userId || String(p.userId) === String(params.userId));
  }
  const total = posts.length;
  const start = (page - 1) * pageSize;
  const list = posts.slice(start, start + pageSize);
  // 为每个帖子添加作者信息
  const result = list.map(p => {
    const author = usersDB.find(u => u.id === p.userId || u.userId === p.userId);
    return {
      ...p,
      authorId: author ? (author.id || '') : '',
      authorName: author ? (author.nickname || author.email) : '未知用户',
      authorAvatar: author ? (author.avatar || '') : '',
      authorGender: author ? (author.gender || '') : ''
    };
  });
  return sendJson(res, { code: 0, data: { list: result, total, page, pageSize } });
}

// 发布圈子帖子（需要登录）
if (pathname === '/api/circle_post' && method === 'POST') {
  if (!session) return sendJson(res, { code: 401, msg: '请先登录' });
  const { content, images, video } = params;
  if ((!content || content.trim() === '') && !images?.length && !video) return sendJson(res, { code: 1, msg: '请输入内容或添加图片/视频' });
  if (content && content.length > 500) return sendJson(res, { code: 1, msg: '内容不能超过500字' });

  const post = {
    id: 'POST' + Date.now(),
    userId: currentUser.id,
    authorId: currentUser.id,
    content: (content || '').trim(),
    images: images || [],
    video: video || '',
    status: 'pending',       // 审核状态：pending/approved/rejected
    auditMsg: '',           // 审核拒绝原因
    auditedAt: null,        // 审核时间
    auditedBy: null,        // 审核人
    likes: 0,
    comments: 0,
    likedUsers: [],
    commentList: [],
    createdAt: new Date().toISOString()
  };
  circlePostsDB.insert(post);
  return sendJson(res, { code: 0, msg: '帖子已提交审核，审核通过后会对外展示', data: post });
}

// 点赞/取消点赞（需要登录）
if (pathname === '/api/circle_like' && method === 'POST') {
  if (!session) return sendJson(res, { code: 401, msg: '请先登录' });
  const { postId } = params;
  if (!postId) return sendJson(res, { code: 1, msg: '缺少帖子ID' });

  const post = circlePostsDB.find(p => p.id === postId);
  if (!post) return sendJson(res, { code: 1, msg: '帖子不存在' });

  const userId = currentUser.id;
  // 安全：兼容旧数据（likedUsers 可能为 undefined）
  if (!Array.isArray(post.likedUsers)) post.likedUsers = [];
  const likedIndex = post.likedUsers.indexOf(userId);

  if (likedIndex === -1) {
    // 点赞
    post.likedUsers.push(userId);
    post.likes = post.likedUsers.length;
  } else {
    // 取消点赞
    post.likedUsers.splice(likedIndex, 1);
    post.likes = post.likedUsers.length;
  }
  circlePostsDB.save();
  return sendJson(res, { code: 0, msg: '操作成功', data: { likes: post.likes, liked: likedIndex === -1 } });
}

// 发表评论（需要登录）
if (pathname === '/api/circle_comment' && method === 'POST') {
  if (!session) return sendJson(res, { code: 401, msg: '请先登录' });
  const { postId, id, content } = params;
  const finalPostId = postId || id;
  if (!finalPostId) return sendJson(res, { code: 1, msg: '缺少帖子ID' });
  if (!content || content.trim() === '') return sendJson(res, { code: 1, msg: '请输入评论内容' });
  
  const post = circlePostsDB.find(p => p.id === finalPostId);
  if (!post) return sendJson(res, { code: 1, msg: '帖子不存在' });
  
  if (!post.commentList) post.commentList = [];
  const comment = {
    id: 'CMT' + Date.now(),
    userId: currentUser.id,
    content: content.trim(),
    status: 'pending',       // 审核状态：pending/approved/rejected
    auditMsg: '',           // 审核拒绝原因
    auditedAt: null,        // 审核时间
    auditedBy: null,        // 审核人
    createdAt: new Date().toISOString()
  };
  post.commentList.push(comment);
  post.comments = post.commentList.length;
  circlePostsDB.save();
  return sendJson(res, { code: 0, msg: '评论已提交审核', data: comment });
}

// 获取帖子详情（含评论列表）
if (pathname === '/api/circle_post_detail' && method === 'GET') {
  const { postId, id } = params;
  const finalPostId = postId || id;
  if (!finalPostId) return sendJson(res, { code: 1, msg: '缺少帖子ID' });

  const post = circlePostsDB.find(p => p.id === finalPostId);
  if (!post) return sendJson(res, { code: 1, msg: '帖子不存在' });

  // === 审核权限检查 ===
  // 未审核通过的帖子：只有作者和管理员可以查看
  const st = post.status || 'approved';
  const canViewPost = isAdmin || st === 'approved' || (currentUser && post.userId === currentUser.id);
  if (!canViewPost) return sendJson(res, { code: 1, msg: '帖子不存在或待审核' });

  // 添加作者信息
  const author = usersDB.find(u => u.id === post.userId || u.userId === post.userId);

  // 构建点赞用户列表（从 post.likedUsers 反向查找用户信息）
  const likeList = [];
  if (post.likedUsers && Array.isArray(post.likedUsers) && post.likedUsers.length > 0) {
    post.likedUsers.forEach(uid => {
      const u = usersDB.find(u => u.id === uid || u.userId === uid);
      if (u) {
        likeList.push({
          userId: u.id,
          nickname: u.nickname || u.email || '匿名',
          avatar: u.avatar || '',
          gender: u.gender || ''
        });
      }
    });
  }

  // === 评论审核过滤 ===
  // 未审核通过的评论：只有评论作者和管理员可以查看
  const filteredComments = (post.commentList || []).filter(c => {
    if (isAdmin) return true;
    const cst = c.status || 'approved';
    if (cst === 'approved') return true;
    if (currentUser && c.userId === currentUser.id) return true;
    return false;
  }).map(c => {
    const cu = usersDB.find(u => u.id === c.userId || u.userId === c.userId);
    return {
      ...c,
      userName: cu ? (cu.nickname || cu.email) : '未知用户',
      userAvatar: cu ? (cu.avatar || '') : ''
    };
  });

  const result = {
    ...post,
    authorName: author ? (author.nickname || author.email) : '未知用户',
    authorAvatar: author ? (author.avatar || '') : '',
    authorGender: author ? (author.gender || '') : '',
    likeList: likeList,
    commentList: filteredComments
  };
  return sendJson(res, { code: 0, data: result });
}

// 删除帖子（作者或管理员）
if (pathname === '/api/circle_post' && method === 'DELETE') {
  if (!session) return sendJson(res, { code: 401, msg: '请先登录' });
  const { postId } = params;
  if (!postId) return sendJson(res, { code: 1, msg: '缺少帖子ID' });
  
  const post = circlePostsDB.find(p => p.id === postId);
  if (!post) return sendJson(res, { code: 1, msg: '帖子不存在' });
  
  // 检查权限：作者或管理员
  if (post.userId !== currentUser.id && !isAdmin) {
    return sendJson(res, { code: 1, msg: '无权删除' });
  }
  circlePostsDB.delete(postId);
  return sendJson(res, { code: 0, msg: '删除成功' });
}

// 管理员：获取所有帖子（后台管理）
if (pathname === '/api/admin/circle_posts' && method === 'GET') {
  if (!isAdmin) return sendJson(res, { code: 401, msg: '请先登录管理员账号' });
  const page = parseInt(params.page) || 1;
  const pageSize = parseInt(params.pageSize) || 20;
  const keyword = params.keyword || '';
  let posts = circlePostsDB.all();
  // 关键词搜索
  if (keyword) {
    posts = posts.filter(p => {
      const author = usersDB.find(u => u.id === p.userId || u.userId === p.userId);
      const authorEmail = author ? author.email : '';
      const authorName = author ? (author.nickname || '') : '';
      return p.content.includes(keyword) || authorEmail.includes(keyword) || authorName.includes(keyword);
    });
  }
  posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = posts.length;
  const start = (page - 1) * pageSize;
  const list = posts.slice(start, start + pageSize).map(p => {
    const author = usersDB.find(u => u.id === p.userId || u.userId === p.userId);
    return {
      ...p,
      authorName: author ? (author.nickname || author.email) : '未知用户',
      authorEmail: author ? author.email : ''
    };
  });
  return sendJson(res, { code: 0, data: { list, total, page, pageSize } });
}

// 管理员：删除帖子
if (pathname === '/api/admin/circle_post' && method === 'DELETE') {
  if (!isAdmin) return sendJson(res, { code: 401, msg: '请先登录管理员账号' });
  const { postId } = params;
  if (!postId) return sendJson(res, { code: 1, msg: '缺少帖子ID' });
  circlePostsDB.delete(postId);
  return sendJson(res, { code: 0, msg: '删除成功' });
}

// ===== 圈子审核 API =====

// 管理员：审核帖子（通过/拒绝）
if (pathname === '/api/admin/circle_audit' && method === 'POST') {
  if (!isAdmin) return sendJson(res, { code: 401, msg: '请先登录管理员账号' });
  const { postId, action, reason } = params;
  if (!postId || !action) return sendJson(res, { code: 1, msg: '缺少参数' });
  if (action !== 'approve' && action !== 'reject') return sendJson(res, { code: 1, msg: '无效操作' });
  const post = circlePostsDB.find(p => p.id === postId);
  if (!post) return sendJson(res, { code: 1, msg: '帖子不存在' });
  post.status = action === 'approve' ? 'approved' : 'rejected';
  post.auditMsg = action === 'reject' ? (reason || '') : '';
  post.auditedAt = new Date().toISOString();
  post.auditedBy = currentUser ? currentUser.id : 'admin';
  circlePostsDB.save();
  return sendJson(res, { code: 0, msg: action === 'approve' ? '已通过审核' : '已拒绝', data: { status: post.status } });
}

// 管理员：审核评论（通过/拒绝）
if (pathname === '/api/admin/circle_comment_audit' && method === 'POST') {
  if (!isAdmin) return sendJson(res, { code: 401, msg: '请先登录管理员账号' });
  const { postId, commentId, action, reason } = params;
  if (!postId || !commentId || !action) return sendJson(res, { code: 1, msg: '缺少参数' });
  if (action !== 'approve' && action !== 'reject') return sendJson(res, { code: 1, msg: '无效操作' });
  const post = circlePostsDB.find(p => p.id === postId);
  if (!post) return sendJson(res, { code: 1, msg: '帖子不存在' });
  if (!post.commentList) return sendJson(res, { code: 1, msg: '评论不存在' });
  const comment = post.commentList.find(c => c.id === commentId);
  if (!comment) return sendJson(res, { code: 1, msg: '评论不存在' });
  comment.status = action === 'approve' ? 'approved' : 'rejected';
  comment.auditMsg = action === 'reject' ? (reason || '') : '';
  comment.auditedAt = new Date().toISOString();
  comment.auditedBy = currentUser ? currentUser.id : 'admin';
  circlePostsDB.save();
  return sendJson(res, { code: 0, msg: action === 'approve' ? '已通过审核' : '已拒绝', data: { status: comment.status } });
}

// 管理员：获取待审核数量
if (pathname === '/api/admin/circle_pending_count' && method === 'GET') {
  if (!isAdmin) return sendJson(res, { code: 401, msg: '请先登录管理员账号' });
  const posts = circlePostsDB.all();
  const postCount = posts.filter(p => (p.status || 'approved') === 'pending').length;
  let commentCount = 0;
  posts.forEach(p => {
    if (p.commentList && Array.isArray(p.commentList)) {
      commentCount += p.commentList.filter(c => (c.status || 'approved') === 'pending').length;
    }
  });
  return sendJson(res, { code: 0, data: { postCount, commentCount } });
}

  } catch (err) {
    console.error('[ROUTE ERROR]', pathname, method, err.message);
    console.error(err.stack);
    if (!res.headersSent) {
      sendJson(res, { code: 500, msg: '服务器内部错误: ' + err.message }, 500);
    }
  }
}

// 加载保存的协议
const agreementsFile = path.join(DATA_DIR, 'agreements.json');
if (fs.existsSync(agreementsFile)) {
  try {
    const saved = JSON.parse(fs.readFileSync(agreementsFile, 'utf-8'));
    Object.assign(agreements, saved);
  } catch(e) {}
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🪄 StarMeet 跨界交友平台已启动`);
  console.log(`   H5手机端:  http://localhost:${PORT}/`);
  console.log(`   PC后台:   http://localhost:${PORT}/admin/`);
  console.log(`   管理员:   admin / admin888`);
  console.log(`   测试账号: 13900000001-13900010004 / 123456\n`);
});

