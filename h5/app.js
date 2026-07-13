// 择爱V11仿站 - 前端H5主逻辑
const App = {
  token: localStorage.getItem('zeai_token') || '',
  user: null,
  currentPage: 'home',
  init() {
    if (this.token) this.fetchMe();
    this.loadSiteConfig();
    this.bindNav();
    // 根据URL hash恢复到对应页面（含子页面），若无hash则默认首页
    const hash = window.location.hash.replace('#', '');
    if (!hash || hash === '') {
      this.switchPage('home');
    } else {
      // 解析子页面 hash（格式：#user?id=xxx, #post?id=xxx, #messages 等）
      if (hash.startsWith('user?id=')) {
        const id = decodeURIComponent(hash.replace('user?id=', ''));
        this.currentPage = 'home';
        this.renderBottomBar();
        Pages.showUser(id);
      } else if (hash.startsWith('post?id=')) {
        const id = decodeURIComponent(hash.replace('post?id=', ''));
        this.currentPage = 'circle';
        this.renderBottomBar();
        Pages._showComments(id);
      } else if (hash === 'messages') {
        this.currentPage = 'mine';
        this.renderBottomBar();
        Pages.showMessages();
      } else if (hash === 'conversations') {
        this.currentPage = 'mine';
        this.renderBottomBar();
        Pages.showConversations();
      } else if (hash === 'likes') {
        this.currentPage = 'mine';
        this.renderBottomBar();
        Pages.showLikes();
      } else if (hash === 'likedBy') {
        this.currentPage = 'mine';
        this.renderBottomBar();
        Pages.showLikedBy();
      } else {
        this.switchPage(hash);
      }
    }
    this.showSplashAd();
    this.checkUnreadMessages();
    // 监听浏览器前进/后退按钮
    window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace('#', '');
      if (!h || h === '') {
        App.switchPage('home');
        return;
      }
      // 解析子页面 hash（格式: #user?id=xxx, #post?id=xxx, #messages 等）
      if (h.startsWith('user?id=')) {
        const id = decodeURIComponent(h.replace('user?id=', ''));
        window.scrollTo(0, 0);
        Pages.showUser(id);
        return;
      }
      if (h.startsWith('post?id=')) {
        const id = decodeURIComponent(h.replace('post?id=', ''));
        window.scrollTo(0, 0);
        Pages._showComments(id);
        return;
      }
      if (h === 'messages') { Pages.showMessages(); return; }
      if (h === 'conversations') { Pages.showConversations(); return; }
      if (h === 'likes') { Pages.showLikes(); return; }
      if (h === 'likedBy') { Pages.showLikedBy(); return; }
      // 主页面（含 survey&id=xxx 格式）
      if (h !== this.currentPage) {
        this.switchPage(h);
      }
    });
  },
  async loadSiteConfig() {
    // 站点配置（logo / 副标题）+ 系统设置（站点名）合并加载
    const [cfgRes, setRes] = await Promise.all([this.api('/api/site-config'), this.api('/api/settings')]);
    const c = cfgRes.code === 0 ? cfgRes.data : {};
    // 存储到全局变量，供个人中心菜单等使用
    this._siteConfig = c;
    const s = setRes.code === 0 ? setRes.data : {};
    // 动态设置 favicon（浏览器标签 + iOS主屏幕图标共用一张）
    if (s.favicon) {
      const favEl = document.getElementById('favicon');
      if (favEl) favEl.href = s.favicon + '?v=' + Date.now();
      const appleEl = document.getElementById('appleTouchIcon');
      if (appleEl) appleEl.href = s.favicon + '?v=' + Date.now();
    }
    const logoEl = document.getElementById('siteLogo');
    if (logoEl) {
      if (c.logoType === 'image' && c.logoImage) {
        logoEl.innerHTML = `<img src="${c.logoImage}" style="width:24px;height:24px;border-radius:6px;vertical-align:middle;">`;
      } else {
        logoEl.innerHTML = `<span style="font-size:22px;vertical-align:middle;"><i class="fas fa-heart" style="color:var(--primary,#ff5a6e)"></i></span>`;
      }
    }
    // 站点名：优先用 settings.siteName（后台「系统设置」是主入口），回退 siteConfig.siteName
    const nameEl = document.getElementById('siteName');
    if (nameEl) nameEl.textContent = s.siteName || c.siteName || 'StarMeet';
    this._siteName = s.siteName || c.siteName || 'StarMeet';
    // 站点URL：优先用后台配置的域名，回退当前访问域名（保留localhost用于本地测试）
    this._siteUrl = s.siteUrl || c.siteUrl || '';
    if (!this._siteUrl) {
      this._siteUrl = window.location.origin;
    }
    const sloganEl = document.getElementById('siteSlogan');
    if (sloganEl) sloganEl.textContent = c.siteSlogan || '';

    // 动态渲染顶部导航（从站点配置读取）
    this.renderTopNav(c);
  },
  // 动态渲染顶部导航（从站点配置读取）
  renderTopNav(c) {
    try {
      const navConfig = c.topNavConfig || c.navConfig || [];
      if (navConfig.length === 0) return;
      const tabs = document.getElementById('navTabs');
      if (!tabs) return;
      tabs.innerHTML = navConfig.map(n =>
        `<a class="tab${this.currentPage === n.page ? ' active' : ''}" data-page="${n.page}" onclick="App.switchPage('${n.page}')">${n.title}</a>`
      ).join('');
    } catch(e) { console.error('渲染顶部导航失败', e); }
  },
  // 开屏广告
  async showSplashAd() {
    try {
      const res = await this.api('/api/splash-ad');
      if (res.code !== 0 || !res.data) return;
      const ad = res.data;
      // 创建开屏广告遮罩层
      const overlay = document.createElement('div');
      overlay.id = 'splashAdOverlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;animation:splashIn .3s ease;';
      let countdown = ad.duration || 3;
      overlay.innerHTML = '<img src="'+ad.image+'" style="max-width:100%;max-height:100%;object-fit:contain;" onerror="this.closest(\'#splashAdOverlay\')?.remove()">'
        + '<div id="splashCountdown" style="position:absolute;bottom:60px;right:20px;background:rgba(0,0,0,.5);color:#fff;padding:6px 14px;border-radius:20px;font-size:13px;cursor:pointer;" onclick="document.getElementById(\'splashAdOverlay\').remove();App._onSplashClick(\''+escape(JSON.stringify(ad))+'\')">'+countdown+'s 跳过</div>';
      document.body.appendChild(overlay);
      // 点击图片跳转
      overlay.querySelector('img').onclick = () => {
        overlay.remove();
        App._onSplashClick(ad);
      };
      // 倒计时
      const timer = setInterval(() => {
        countdown--;
        const el = document.getElementById('splashCountdown');
        if (!el) { clearInterval(timer); return; }
        if (countdown <= 0) { el.textContent = '跳过'; }
        else { el.textContent = countdown + 's 跳过'; }
      }, 1000);
      setTimeout(() => { if(document.getElementById('splashAdOverlay')) overlay.remove(); }, (ad.duration||3)*1000 + 200);
    } catch(e) { console.warn('加载开屏广告失败', e); }
  },
  _onSplashClick(ad) {
    try {
      if (ad.linkType === 'url' && ad.link) window.open(ad.link, '_blank', 'noopener');
      else if (ad.page) {
        const map = { home:'home', match:'match', activity:'activity', school:'school', psychtest:'psychtest' };
        if (map[ad.page]) this.switchPage(map[ad.page]);
      }
    } catch(e) {}
  },

  // ===== 消息未读红点 =====
  _unreadCount: 0,
  async checkUnreadMessages() {
    if (!this.user) return;
    try {
      const res = await this.api('/api/messages?pageSize=1');
      if (res.code === 0 && res.data) {
        this._unreadCount = res.data.unreadCount || (res.data.total || 0);
        this.updateMessageBadge();
      }
    } catch(e) {}
  },
  updateMessageBadge() {
    const btmBtns = document.querySelectorAll('.btm-btn');
    btmBtns.forEach(btn => {
      if (btn.dataset.page === 'mine' || btn.onclick && btn.onclick.toString().includes('mine')) return;
    });
    // 在底部"我的"tab上显示红点（如果有未读消息）
    const mineTab = document.querySelector('.btm-btn[data-page="mine"]');
    if (mineTab && this._unreadCount > 0) {
      let dot = mineTab.querySelector('.badge-dot');
      if (!dot) {
        dot = document.createElement('span'); dot.className = 'badge-dot';
        dot.style.cssText = 'position:absolute;top:-2px;right:8px;min-width:16px;height:16px;background:#ff4d4f;color:#fff;border-radius:8px;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0 4px;z-index:10;line-height:16px;';
        mineTab.style.position = 'relative';
        mineTab.appendChild(dot);
      }
      dot.textContent = this._unreadCount > 99 ? '99+' : this._unreadCount;
      dot.style.display = '';
    }
    // 更新消息图标上的数字（在个人中心页面）
    const msgBadge = document.getElementById('msgUnreadBadge');
    if (msgBadge) msgBadge.textContent = this._unreadCount > 99 ? '99+' : this._unreadCount;
    if (msgBadge) msgBadge.style.display = this._unreadCount > 0 ? '' : 'none';
  },
  // 动态生成底部导航栏（从站点配置读取）
  async renderBottomBar() {
    try {
      const res = await fetch('/api/site-config');
      const data = await res.json();
      const c = data.code === 0 ? data.data : {};
      const navConfig = (c.navConfig || []).filter(n => n.enabled !== false);
      if (navConfig.length === 0) return;
      const bar = document.querySelector('.bottombar');
      if (!bar) return;
      bar.innerHTML = navConfig.map(n => {
        const isImage = n.icon && (n.icon.startsWith('http') || n.icon.startsWith('/'));
        return `
        <div class="nav-item${this.currentPage === n.page ? ' active' : ''}" onclick="App.switchPage('${n.page}')">
          <div class="nav-icon">${isImage ? `<img src="${n.icon}">` : (n.icon || '<i class="fas fa-heart"></i>')}</div>
          <div class="nav-label">${n.title}</div>
        </div>`;
      }).join('');
    } catch(e) { console.error('渲染导航栏失败', e); }
  },
  goLink(target, linkType, filter, articleId) {
    // 外部链接直接新窗口打开
    if (linkType === 'url' && target) {
      window.open(target, '_blank', 'noopener');
      return;
    }
    if (!target) return;
    const map = { home: 'home', match: 'match', activity: 'activity', school: 'school', mine: 'mine', contact: 'contact', survey: 'survey', psychtest: 'psychtest', vip: 'vip' };
    if (map[target]) {
      // 如果是找缘分页面，并且指定了筛选条件，则记住它
      if (target === 'match' && filter) {
        this._matchFilter = filter;
      }
      // 如果是学堂页面，并且指定了文章ID，则直接打开文章详情
      if (target === 'school' && articleId) {
        Pages.showArticle(articleId);
        return;
      }
      this.switchPage(map[target]);
    }
  },
  api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    return fetch(path, {
      method: opts.method || 'GET',
      headers,
      credentials: 'include',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(err => {
      console.warn('api error:', path, err);
      return { code: 1, msg: '网络异常，请检查网络连接' };
    });
  },
  async fetchMe() {
    const res = await this.api('/api/me');
    if (res.code === 0) { this.user = res.data; this.updateLoginUI(); this.checkAuditStatus(); }
    else { this.token = ''; localStorage.removeItem('zeai_token'); }
  },
  // 检查审核状态：待审核/审核驳回时弹窗提示去完善资料
  checkAuditStatus() {
    if (!this.user) return;
    const as = this.user.auditStatus;
    if (as === 'pending' || as === 'rejected') {
      const modal = document.getElementById('auditModal');
      const titleEl = document.getElementById('auditTitle');
      const descEl = document.getElementById('auditDesc');
      if (!modal) return;
      if (as === 'rejected') {
        titleEl.textContent = '就差一步就能开启交友啦！';
        descEl.textContent = this.user.auditReason ? '审核未通过：' + this.user.auditReason + '。修改资料后可重新提交审核。' : '您的资料审核未通过，修改后可重新提交。';
      } else {
        titleEl.textContent = '就差一步就能开启交友啦！';
        descEl.textContent = '完善资料后提交审核，审核通过即可开启交友功能。';
      }
      modal.style.display = 'flex';
    }
  },
  updateLoginUI() {
    const btn = document.getElementById('loginBtn');
    if (this.user) {
      btn.textContent = this.user.nickname;
      btn.onclick = () => this.switchPage('mine');
    } else {
      btn.textContent = '登录';
      btn.onclick = () => Auth.openLogin();
    }
  },
  bindNav() {
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        this.switchPage(el.dataset.page);
      });
    });
  },
  switchPage(page) {
    this.currentPage = page;
    Pages._hideCircleFab();
    this.renderBottomBar();
    // 更新URL hash，使每个页面有独立网址
    if (window.location.hash !== '#' + page) {
      window.location.hash = page;
    }
    // 页面切换时自动滚动到顶部
    window.scrollTo(0, 0);
    const contentEl = document.getElementById('content');
    if (contentEl) { contentEl.scrollTop = 0; contentEl.style.minHeight = ''; contentEl.classList.remove('article-view'); }
    document.querySelectorAll('[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page && el.classList.contains('tab') || el.dataset.page === page && el.classList.contains('btm-btn'));
    });
    // 解析 page&id=xxx 格式的参数
    let pageName = page;
    let pageId = null;
    const ampIdx = page.indexOf('&');
    if (ampIdx !== -1) {
      pageName = page.substring(0, ampIdx);
      const paramPart = page.substring(ampIdx + 1);
      const eqIdx = paramPart.indexOf('=');
      if (eqIdx !== -1 && paramPart.substring(0, eqIdx) === 'id') {
        pageId = decodeURIComponent(paramPart.substring(eqIdx + 1));
      }
    }
    const renderers = {
      home: Pages.renderHome,
      match: Pages.renderMatch,
      activity: Pages.renderActivity,
      school: Pages.renderSchool,
      mine: Pages.renderMine,
      circle: Pages.renderCircle,
      contact: Pages.renderContact,
      survey: (id) => Pages.renderSurvey(id),
      psychtest: Pages.renderPsychTests,
      vip: Pages.renderVipService
    };
    if (renderers[pageName]) renderers[pageName].call(Pages, pageId);
  },
  toast(msg, duration = 1800) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.style.display = 'none', duration);
  },
  // 根据出生日期计算星座
  getZodiac(birthday) {
    if (!birthday) return '';
    const d = new Date(birthday);
    if (isNaN(d.getTime())) return '';
    const m = d.getMonth() + 1, day = d.getDate();
    const signs = [
      { name: '摩羯座', start: [1,1], end: [1,19] },
      { name: '水瓶座', start: [1,20], end: [2,18] },
      { name: '双鱼座', start: [2,19], end: [3,20] },
      { name: '白羊座', start: [3,21], end: [4,19] },
      { name: '金牛座', start: [4,20], end: [5,20] },
      { name: '双子座', start: [5,21], end: [6,21] },
      { name: '巨蟹座', start: [6,22], end: [7,22] },
      { name: '狮子座', start: [7,23], end: [8,22] },
      { name: '处女座', start: [8,23], end: [9,22] },
      { name: '天秤座', start: [9,23], end: [10,23] },
      { name: '天蝎座', start: [10,24], end: [11,22] },
      { name: '射手座', start: [11,23], end: [12,21] },
      { name: '摩羯座', start: [12,22], end: [12,31] }
    ];
    for (const s of signs) {
      // 处理跨年（摩羯座跨12月-1月）
      if (s.start[0] === s.end[0]) {
        if (m === s.start[0] && day >= s.start[1] && day <= s.end[1]) return s.name;
      } else {
        // 跨年情况：12.22 - 1.19
        if ((m === s.start[0] && day >= s.start[1]) || (m === s.end[0] && day <= s.end[1])) return s.name;
      }
    }
    return '';
  },
  // ===== 悬浮按钮 =====
  toggleFab() {
    const g = document.getElementById('fabGroup');
    if (g) g.classList.toggle('open');
  },
  closeFab() {
    const g = document.getElementById('fabGroup');
    if (g) g.classList.remove('open');
  },
  // ===== 分享功能 =====
  _siteName: '',
  // 更新 OG Meta 标签（分享时调用）
  updateOGTags(title, desc, url, img) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.setAttribute('content', v || ''); };
    set('ogTitle', title);
    set('ogDesc', desc);
    set('ogImage', img || '');
    set('ogUrl', url || '');
    set('twTitle', title);
    set('twDesc', desc);
    set('twImage', img || '');
    // 同时更新页面 title
    document.title = title || 'StarMeet - 跨界交友平台';
  },
  getCurrentShareData() {
    const base = this._siteUrl || window.location.origin;
    let title = (this._siteName || 'StarMeet') + ' - 跨界交友平台';
    let desc = '连接中国男性与海外女性，真诚交友，遇见真爱！';
    let url = base + '/';
    let img = base + '/img/logo.svg';
    // 根据当前页面动态生成分享链接
    const page = App.currentPage;
    if (page === 'survey' && Pages._currentSurvey) {
      const s = Pages._currentSurvey;
      title = s.title || '问卷调查';
      desc = (s.desc || '').substring(0, 50);
      url = base + '/#survey:' + s.id;
      img = s.cover || img;
    } else if (page === 'user-detail' && Pages._currentUserId) {
      url = base + '/#user?id=' + Pages._currentUserId;
      title = '看看这位优质会员 - ' + this._siteName;
      desc = '点击查看TA的详细资料';
      // 尝试获取用户头像作为分享图片
      const u = App.user;
      if (u && u.avatar) img = u.avatar.startsWith('http') ? u.avatar : base + u.avatar;
    } else if (page === 'activity' && Activity._data && Activity._data.id) {
      url = base + '/#activity:' + Activity._data.id;
      title = Activity._data.title || '精彩活动';
      desc = (Activity._data.desc || '').substring(0, 50) || '点击了解活动详情';
      img = Activity._data.cover || img;
    } else if (page === 'article' && Pages._currentArticleId) {
      url = base + '/#article:' + Pages._currentArticleId;
      title = Pages._currentArticleTitle || '学堂文章';
      desc = '点击阅读精彩内容';
    } else if (Pages._currentPostId) {
      // 动态详情页：分享当前帖子链接
      url = base + '/#post?id=' + Pages._currentPostId;
      title = '看看这条动态 - ' + this._siteName;
      desc = '点击查看动态详情';
    }
    return { title, desc, url, img };
  },
  shareCurrentPage() {
    this.closeFab();
    // 更新 OG Meta 标签
    const d = this.getCurrentShareData();
    this.updateOGTags(d.title, d.desc, d.url, d.img || '');
    const m = document.getElementById('shareModal');
    if (m) m.classList.add('show');
  },
  closeShare() {
    const m = document.getElementById('shareModal');
    if (m) m.classList.remove('show');
  },
  doShare(ch) {
    const d = this.getCurrentShareData();
    this.closeShare();
    if (ch === 'copy') {
      if (navigator.clipboard) navigator.clipboard.writeText(d.url).then(() => App.toast('链接已复制')).catch(() => {});
      else { var t=document.createElement('textarea'); t.value=d.url; document.body.appendChild(t); t.select(); try{document.execCommand('copy');App.toast('链接已复制')}catch(e){} document.body.removeChild(t); }
      return;
    }
    if (ch==='wechat'||ch==='moments') {
      const isWx = /MicroMessenger/i.test(navigator.userAgent);
      if (isWx) { this.sharePage(); return; }
      App.toast('请在微信中打开链接分享'); return;
    }
    var u=encodeURIComponent(d.url), tt=encodeURIComponent(d.title), td=encodeURIComponent(d.desc);
    if (ch==='qq') window.open('https://connect.qq.com/widget/shareqq/index.html?url='+u+'&title='+tt+'&desc='+td,'_blank','width=600,height=500');
    else if (ch==='weibo') window.open('https://service.weibo.com/share/share.php?url='+u+'&title='+tt,'_blank','width=600,height=500');
  },
  // 分享按钮入口（顶部导航）
  sharePage() {
    const d = this.getCurrentShareData();
    // 更新 OG Meta 标签
    this.updateOGTags(d.title, d.desc, d.url, d.img || '');
    // 检测是否在微信环境
    const isWechat = /MicroMessenger/i.test(navigator.userAgent);
    if (isWechat && typeof wx !== 'undefined' && wx.config) {
      // 已加载JSSDK，直接调起分享
      this._wxCallShare(d);
      App.toast('请点击右上角「...」分享给朋友');
    } else if (isWechat) {
      // 微信环境但未加载JSSDK，尝试加载并配置
      this._initWxJssdk(d);
      App.toast('请点击右上角「...」分享给朋友');
    } else {
      // 非微信环境，显示分享面板
      this.shareCurrentPage();
    }
  },
  // 初始化微信JSSDK
  async _initWxJssdk(shareData) {
    try {
      const res = await this.api('/api/wx-jssdk-config?url=' + encodeURIComponent(location.href.split('#')[0]));
      if (res.code !== 0 || !res.data) return;
      // 动态加载JSSDK
      if (typeof wx === 'undefined') {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const cfg = res.data;
      wx.config({
        debug: false,
        appId: cfg.appId,
        timestamp: cfg.timestamp,
        nonceStr: cfg.nonceStr,
        signature: cfg.signature,
        jsApiList: ['updateAppMessageShareData', 'updateTimelineShareData', 'onMenuShareAppMessage', 'onMenuShareTimeline']
      });
      wx.ready(() => { this._wxCallShare(shareData); });
    } catch(e) { console.warn('微信JSSDK初始化失败', e); }
  },
  // 调用微信分享接口
  _wxCallShare(d) {
    if (!wx || !wx.ready) return;
    const shareImg = d && d.img ? d.img : ((this._siteUrl || location.origin) + '/img/logo.png');
    const shareData = { title: d.title, desc: d.desc, link: d.url, imgUrl: shareImg };
    // 新版接口
    if (wx.updateAppMessageShareData) wx.updateAppMessageShareData(shareData);
    if (wx.updateTimelineShareData) wx.updateTimelineShareData({ ...shareData, title: d.title });
    // 兼容旧版
    if (wx.onMenuShareAppMessage) wx.onMenuShareAppMessage(shareData);
    if (wx.onMenuShareTimeline) wx.onMenuShareTimeline({ ...shareData, title: d.title });
  },
};

// ===== 鉴权 =====
const Auth = {
  mode: 'login',
  _dragBound: false,
  open(mode = 'login') {
    if (mode === 'register') {
      // 使用新的注册流程页面（参考截图5-28）
      Pages.openRegisterFlow();
      return;
    }
    this.mode = mode;
    this.switch(mode);
    document.getElementById('authModal').style.display = 'flex';
    this._bindDrag(); this._bindAvatar(); this._prefillLogin();
  },
  openLogin() { this.open('login'); },
  // 打开登录弹窗时，预填记住的账号和密码
  _prefillLogin() {
    const savedAccount = localStorage.getItem('zeai_saved_account') || '';
    const savedPwd = localStorage.getItem('zeai_saved_pwd') || '';
    const accountEl = document.getElementById('phone');
    const pwdEl = document.getElementById('password');
    const rememberEl = document.getElementById('rememberPwd');
    if (accountEl && savedAccount) accountEl.value = savedAccount;
    if (pwdEl && savedPwd) pwdEl.value = savedPwd;
    if (rememberEl) rememberEl.checked = !!savedPwd;
  },
  // 性别切换时，显示/隐藏男生专属字段
  _onGenderChange() {
    const gender = document.getElementById('gender').value;
    document.querySelectorAll('.male-only').forEach(el => {
      el.style.display = (this.mode === 'register' && gender === '男') ? '' : 'none';
    });
  },
  // 切到 register 时清掉头像预览和数据
  _resetAvatar() {
    const dataEl = document.getElementById('avatarData');
    if (dataEl) dataEl.value = '';
    const preview = document.getElementById('avatarPreview');
    if (preview) preview.innerHTML = '+';
    const file = document.getElementById('avatarFile');
    if (file) file.value = '';
  },
  togglePassword() {
    const inp = document.getElementById('password');
    const btn = document.getElementById('pwToggle');
    if (!inp || !btn) return;
    if (inp.type === 'password') {
      inp.type = 'text';
      btn.classList.add('showing');
    } else {
      inp.type = 'password';
      btn.classList.remove('showing');
    }
  },
  close() {
    document.getElementById('authModal').style.display = 'none';
    const c = document.getElementById('authCard');
    if (c) { c.style.transform = ''; c.classList.remove('dragging'); }
  },
  switch(mode) {
    this.mode = mode;
    document.querySelectorAll('.auth-tabs a').forEach(a => a.classList.toggle('active', a.dataset.mode === mode));
    // reg-only：注册时显示，登录时隐藏
    document.querySelectorAll('.reg-only').forEach(el => el.style.display = mode === 'register' ? '' : 'none');
    // login-only：登录时显示，注册时隐藏
    document.querySelectorAll('.login-only').forEach(el => el.style.display = mode === 'login' ? '' : 'none');
    // male-only：仅在注册模式且性别为男时显示
    const gender = document.getElementById('gender')?.value || '';
    document.querySelectorAll('.male-only').forEach(el => el.style.display = (mode === 'register' && gender === '男') ? '' : 'none');
    document.getElementById('authTitle').textContent = mode === 'login' ? '登录' : '注册';
    if (mode === 'register') { this._resetAvatar(); this._bindAgreementChecks(); }
  },
  // 让弹窗内容超出时可滚动 + 顶部拖动手柄
  _bindDrag() {
    if (this._dragBound) return;
    this._dragBound = true;
    const card = document.getElementById('authCard');
    if (!card) return;
    const handle = card.querySelector('.modal-drag-handle');
    let startY = 0, startX = 0, origY = 0, origX = 0, dragging = false;
    const onDown = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      startY = pt.clientY; startX = pt.clientX;
      const rect = card.getBoundingClientRect();
      origY = rect.top; origX = rect.left;
      card.style.position = 'fixed';
      card.style.top = rect.top + 'px';
      card.style.left = rect.left + 'px';
      card.style.margin = '0';
      card.classList.add('dragging');
      dragging = true;
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      const dy = pt.clientY - startY;
      const dx = pt.clientX - startX;
      card.style.top = (origY + dy) + 'px';
      card.style.left = (origX + dx) + 'px';
    };
    const onUp = () => { dragging = false; card.classList.remove('dragging'); };
    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
  },
  async _bindAgreementChecks() {
    if (this._bound) return;
    this._bound = true;
    const res = await App.api('/api/agreements');
    if (res.code === 0) {
      document.getElementById('ag_vip_text').textContent = res.data.vip.title;
      document.getElementById('ag_user_text').textContent = res.data.user.title;
      this._agreements = res.data;
    }
    document.getElementById('ag_vip_open').onclick = (e) => { e.preventDefault(); Auth.showAgreement('vip'); };
    document.getElementById('ag_user_open').onclick = (e) => { e.preventDefault(); Auth.showAgreement('user'); };
  },
  showAgreement(type) {
    if (!this._agreements || !this._agreements[type]) {
      App.toast('协议加载中，请稍后');
      return;
    }
    this._currentAgreementType = type; // 记录当前打开的协议类型
    const ag = this._agreements[type];
    document.getElementById('agreementTitle').textContent = ag.title;
    document.getElementById('agreementContent').textContent = ag.content;
    document.getElementById('agreementModal').style.display = 'flex';
  },
  closeAgreement(shouldCheck) {
    if (shouldCheck && this._currentAgreementType) {
      // 点"我已阅读"后，自动勾选对应复选框
      const cb = document.getElementById('agree_' + this._currentAgreementType);
      if (cb) cb.checked = true;
    }
    document.getElementById('agreementModal').style.display = 'none';
  },
  async sendCode() {
    const email = document.getElementById('email').value.trim();
    if (!email) return App.toast('请输入邮箱');
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return App.toast('邮箱格式不正确');
    const btn = document.getElementById('sendCodeBtn');
    if (btn.disabled || btn.classList.contains('countdown')) return;
    btn.disabled = true;
    btn.classList.add('countdown');
    const origText = btn.textContent;
    btn.textContent = '发送中...';
    const res = await App.api('/api/auth/send-code', { method: 'POST', body: { email } });
    if (res.code === 0) {
      App.toast(res.msg || '验证码已发送');
      let s = 60;
      const timer = setInterval(() => {
        s--;
        if (s <= 0) {
          clearInterval(timer);
          btn.disabled = false;
          btn.classList.remove('countdown');
          btn.textContent = origText;
        } else {
          btn.textContent = s + 's 后重发';
        }
      }, 1000);
      this._sendCodeTimer = timer;
    } else {
      btn.disabled = false;
      btn.classList.remove('countdown');
      btn.textContent = origText;
      App.toast(res.msg || '发送失败');
    }
  },
  async submit() {
    const password = document.getElementById('password').value;
    if (this.mode === 'login') {
      const account = document.getElementById('phone').value.trim();
      if (!account || !password) return App.toast('请填写账号和密码');
      const res = await App.api('/api/login', { method: 'POST', body: { account, password } });
      if (res.code === 0) {
        App.token = res.data.token; App.user = res.data.user;
        localStorage.setItem('zeai_token', App.token);
        // 记住账号（默认记住）
        localStorage.setItem('zeai_saved_account', account);
        // 记住密码（仅勾选时保存）
        const rememberEl = document.getElementById('rememberPwd');
        if (rememberEl && rememberEl.checked) {
          localStorage.setItem('zeai_saved_pwd', password);
        } else {
          localStorage.removeItem('zeai_saved_pwd');
        }
        App.updateLoginUI(); App.toast('登录成功'); this.close();
        App.switchPage(App.currentPage);
        App.checkAuditStatus();
      } else { App.toast(res.msg); }
    } else {
      // 注册：邮箱+密码+验证码+昵称+性别+头像 + 勾选两份协议 + 新增必填字段
      if (!password) return App.toast('请填写密码');
      const agreeUser = document.getElementById('agree_user').checked;
      const agreeVip = document.getElementById('agree_vip').checked;
      if (!agreeUser || !agreeVip) return App.toast('请先勾选并同意两份协议');
      const email = document.getElementById('email').value.trim();
      const code = document.getElementById('code').value.trim();
      if (!email) return App.toast('请输入邮箱');
      if (!code) return App.toast('请输入邮箱验证码');
      const nickname = document.getElementById('nickname').value.trim();
      const gender = document.getElementById('gender').value;
      if (!gender) return App.toast('请选择性别');
      const avatar = document.getElementById('avatarData').value;
      if (!avatar) return App.toast('请上传头像');
      if (!nickname) return App.toast('请填写昵称');
      if (nickname.length < 2 || nickname.length > 16) return App.toast('昵称长度需在 2-16 个字符之间');
      if (!/^[\u4e00-\u9fa5a-zA-Z\s]+$/.test(nickname)) return App.toast('昵称仅允许中文、英文和空格');
      // 新增必填字段校验
      const wechatId = document.getElementById('reg_wechatId').value.trim();
      const zodiac = document.getElementById('reg_zodiac').value;
      const birthday = document.getElementById('reg_birthday').value;
      const bloodType = document.getElementById('reg_bloodType').value;
      const weight = document.getElementById('reg_weight').value;
      if (!wechatId) return App.toast('请填写微信号');
      if (!zodiac) return App.toast('请选择星座');
      if (!birthday) return App.toast('请选择出生日期');
      if (!bloodType) return App.toast('请选择血型');
      if (!weight) return App.toast('请填写体重');
      let hasHouse = '', hasCar = '';
      if (gender === '男') {
        hasHouse = document.getElementById('reg_hasHouse').value;
        hasCar = document.getElementById('reg_hasCar').value;
        if (!hasHouse) return App.toast('请选择是否有房产');
        if (!hasCar) return App.toast('请选择是否有车子');
      }
      const res = await App.api('/api/register', { method: 'POST', body: { email, password, code, nickname, gender, avatar, agreeUser, agreeVip, wechatId, zodiac, birthday, bloodType, weight, hasHouse, hasCar } });
      if (res.code === 0) {
        App.token = res.data.token; App.user = res.data.user;
        localStorage.setItem('zeai_token', App.token);
        // 注册成功后也记住账号
        localStorage.setItem('zeai_saved_account', email);
        localStorage.removeItem('zeai_saved_pwd');
        App.updateLoginUI(); App.toast('注册成功'); this.close();
        App.switchPage('mine');
        App.checkAuditStatus();
      } else { App.toast(res.msg); }
    }
  },
  // 昵称只允许中文/英文/空格 + 半角点，输入时直接过滤掉非法字符
  _filterNickname(input) {
    const v = input.value;
    const cleaned = v.replace(/[^\u4e00-\u9fa5a-zA-Z\s·\.]/g, '');
    if (cleaned !== v) {
      const pos = input.selectionStart;
      input.value = cleaned;
      // 简单把光标移到末尾（防止光标错位即可）
      try { input.setSelectionRange(cleaned.length, cleaned.length); } catch (e) {}
    }
  },
  _bindAvatar() {
    if (this._avatarBound) return;
    this._avatarBound = true;
    const file = document.getElementById('avatarFile');
    file.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!/^image\//i.test(f.type)) return App.toast('请选择图片文件');
      if (f.size > 2 * 1024 * 1024) return App.toast('图片不能超过 2MB');
      const reader = new FileReader();
      reader.onload = async () => {
        // 先把预览放上去
        const preview = document.getElementById('avatarPreview');
        preview.innerHTML = '';
        const img = document.createElement('img');
        img.src = reader.result;
        img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover';
        preview.appendChild(img);
        // 上传到服务器（注册时使用临时端点，无需登录）
        const r = await App.api('/api/upload/avatar-temp', { method: 'POST', body: { image: reader.result } });
        if (r.code === 0) {
          document.getElementById('avatarData').value = r.data.url;
          App.toast('头像已上传');
        } else {
          App.toast(r.msg || '上传失败');
          document.getElementById('avatarData').value = '';
          preview.innerHTML = '+';
        }
      };
      reader.readAsDataURL(f);
    };
  },
  // 昵称输入过滤：实时去掉非中英/空格字符
  _filterNickname(input) {
    const orig = input.value;
    const filtered = orig.replace(/[^\u4e00-\u9fa5a-zA-Z\s]/g, '');
    if (filtered !== orig) {
      input.value = filtered;
    }
  }
};

// ===== 各页面 =====

const LOCATION_DATA = {
  '中国': {
    '北京市': ['北京市'],
    '上海市': ['上海市'],
    '天津市': ['天津市'],
    '重庆市': ['重庆市'],
    '河北省': ['石家庄市','唐山市','秦皇岛市','邯郸市','邢台市','保定市','张家口市','承德市','沧州市','廊坊市','衡水市'],
    '山西省': ['太原市','大同市','阳泉市','长治市','晋城市','朔州市','晋中市','运城市','忻州市','临汾市','吕梁市'],
    '辽宁省': ['沈阳市','大连市','鞍山市','抚顺市','本溪市','丹东市','锦州市','营口市','阜新市','辽阳市','盘锦市','铁岭市','朝阳市','葫芦岛市'],
    '吉林省': ['长春市','吉林市','四平市','辽源市','通化市','白山市','松原市','白城市','延边州'],
    '黑龙江省': ['哈尔滨市','齐齐哈尔市','鸡西市','鹤岗市','双鸭山市','大庆市','伊春市','佳木斯市','七台河市','牡丹江市','黑河市','绥化市','大兴安岭地区'],
    '江苏省': ['南京市','无锡市','徐州市','常州市','苏州市','南通市','连云港市','淮安市','盐城市','扬州市','镇江市','泰州市','宿迁市'],
    '浙江省': ['杭州市','宁波市','温州市','嘉兴市','湖州市','绍兴市','金华市','衢州市','舟山市','台州市','丽水市'],
    '安徽省': ['合肥市','芜湖市','蚌埠市','淮南市','马鞍山市','淮北市','铜陵市','安庆市','黄山市','滁州市','阜阳市','宿州市','六安市','亳州市','池州市','宣城市'],
    '福建省': ['福州市','厦门市','莆田市','三明市','泉州市','漳州市','南平市','龙岩市','宁德市'],
    '江西省': ['南昌市','景德镇市','萍乡市','九江市','新余市','鹰潭市','赣州市','吉安市','宜春市','抚州市','上饶市'],
    '山东省': ['济南市','青岛市','淄博市','枣庄市','东营市','烟台市','潍坊市','济宁市','泰安市','威海市','日照市','临沂市','德州市','聊城市','滨州市','菏泽市'],
    '河南省': ['郑州市','开封市','洛阳市','平顶山市','安阳市','鹤壁市','新乡市','焦作市','濮阳市','许昌市','漯河市','三门峡市','南阳市','商丘市','信阳市','周口市','驻马店市'],
    '湖北省': ['武汉市','黄石市','十堰市','宜昌市','襄阳市','鄂州市','荆门市','孝感市','荆州市','黄冈市','咸宁市','随州市','恩施州'],
    '湖南省': ['长沙市','株洲市','湘潭市','衡阳市','邵阳市','岳阳市','常德市','张家界市','益阳市','郴州市','永州市','怀化市','娄底市','湘西州'],
    '广东省': ['广州市','韶关市','深圳市','珠海市','汕头市','佛山市','江门市','湛江市','茂名市','肇庆市','惠州市','梅州市','汕尾市','河源市','阳江市','清远市','东莞市','中山市','潮州市','揭阳市','云浮市'],
    '海南省': ['海口市','三亚市','三沙市','儋州市'],
    '四川省': ['成都市','自贡市','攀枝花市','泸州市','德阳市','绵阳市','广元市','遂宁市','内江市','乐山市','南充市','眉山市','宜宾市','广安市','达州市','雅安市','巴中市','资阳市','阿坝州','甘孜州','凉山州'],
    '贵州省': ['贵阳市','六盘水市','遵义市','安顺市','毕节市','铜仁市','黔西南州','黔东南州','黔南州'],
    '云南省': ['昆明市','曲靖市','玉溪市','保山市','昭通市','丽江市','普洱市','临沧市','楚雄州','红河州','文山州','西双版纳州','大理州','德宏州','迪庆州'],
    '西藏自治区': ['拉萨市','日喀则市','昌都市','林芝市','山南市','那曲市'],
    '陕西省': ['西安市','铜川市','宝鸡市','咸阳市','渭南市','延安市','汉中市','榆林市','安康市','商洛市'],
    '甘肃省': ['兰州市','嘉峪关市','金昌市','白银市','天水市','武威市','张掖市','平凉市','酒泉市','庆阳市','定西市','陇南市','临夏州','甘南州'],
    '青海省': ['西宁市','海东市','海北州','黄南州','海南州','果洛州','玉树州','海西州'],
    '台湾省': ['台北市','高雄市','台中市','台南市','新北市','桃园市'],
    '内蒙古自治区': ['呼和浩特市','包头市','乌海市','赤峰市','通辽市','鄂尔多斯市','呼伦贝尔市','巴彦淖尔市','乌兰察布市','兴安盟','锡林郭勒盟','阿拉善盟'],
    '广西壮族自治区': ['南宁市','柳州市','桂林市','梧州市','北海市','防城港市','钦州市','贵港市','玉林市','百色市','贺州市','河池市','来宾市','崇左市'],
    '宁夏回族自治区': ['银川市','石嘴山市','吴忠市','固原市','中卫市'],
    '新疆维吾尔自治区': ['乌鲁木齐市','克拉玛依市','吐鲁番市','哈密市','昌吉州','博尔塔拉州','巴音郭楞州','阿克苏地区','克孜勒苏州','喀什地区','和田地区','伊犁州','塔城地区','阿勒泰地区'],
    '香港特别行政区': ['香港'],
    '澳门特别行政区': ['澳门'],
  },
  '美国': {
    'Alabama': ['Birmingham','Montgomery','Mobile','Huntsville','Tuscaloosa'],
    'Alaska': ['Anchorage','Fairbanks','Juneau'],
    'Arizona': ['Phoenix','Tucson','Mesa','Chandler','Scottsdale'],
    'Arkansas': ['Little Rock','Fort Smith','Fayetteville','Springdale','Jonesboro'],
    'California': ['Los Angeles','San Francisco','San Diego','San Jose','Sacramento','Fresno','Long Beach','Oakland','Bakersfield','Anaheim'],
    'Colorado': ['Denver','Colorado Springs','Aurora','Fort Collins','Lakewood'],
    'Connecticut': ['Bridgeport','New Haven','Hartford','Stamford','Waterbury'],
    'Delaware': ['Wilmington','Dover','Newark'],
    'Florida': ['Miami','Orlando','Tampa','Jacksonville','St. Petersburg','Hialeah','Tallahassee','Fort Lauderdale'],
    'Georgia': ['Atlanta','Augusta','Columbus','Savannah','Athens'],
    'Hawaii': ['Honolulu','Hilo','Kailua'],
    'Idaho': ['Boise','Meridian','Nampa','Idaho Falls'],
    'Illinois': ['Chicago','Aurora','Rockford','Joliet','Naperville'],
    'Indiana': ['Indianapolis','Fort Wayne','Evansville','South Bend','Bloomington'],
    'Iowa': ['Des Moines','Cedar Rapids','Davenport','Sioux City','Iowa City'],
    'Kansas': ['Wichita','Overland Park','Kansas City','Topeka','Olathe'],
    'Kentucky': ['Louisville','Lexington','Bowling Green','Owensboro','Frankfort'],
    'Louisiana': ['New Orleans','Baton Rouge','Shreveport','Lafayette','Lake Charles'],
    'Maine': ['Portland','Lewiston','Bangor','South Portland'],
    'Maryland': ['Baltimore','Frederick','Rockville','Gaithersburg','Bowie'],
    'Massachusetts': ['Boston','Worcester','Springfield','Lowell','Cambridge'],
    'Michigan': ['Detroit','Grand Rapids','Warren','Sterling Heights','Ann Arbor'],
    'Minnesota': ['Minneapolis','St. Paul','Rochester','Duluth','Bloomington'],
    'Mississippi': ['Jackson','Gulfport','Southaven','Hattiesburg','Biloxi'],
    'Missouri': ['Kansas City','St. Louis','Springfield','Columbia','Independence'],
    'Montana': ['Billings','Missoula','Great Falls','Bozeman','Helena'],
    'Nebraska': ['Omaha','Lincoln','Bellevue','Grand Island','Kearney'],
    'Nevada': ['Las Vegas','Reno','Henderson','North Las Vegas','Carson City'],
    'New Hampshire': ['Manchester','Nashua','Concord','Derry'],
    'New Jersey': ['Newark','Jersey City','Paterson','Elizabeth','Trenton'],
    'New Mexico': ['Albuquerque','Las Cruces','Rio Rancho','Santa Fe','Roswell'],
    'New York': ['New York City','Buffalo','Rochester','Syracuse','Albany','Yonkers'],
    'North Carolina': ['Charlotte','Raleigh','Greensboro','Durham','Winston-Salem'],
    'North Dakota': ['Fargo','Bismarck','Grand Forks','Minot'],
    'Ohio': ['Columbus','Cleveland','Cincinnati','Toledo','Akron'],
    'Oklahoma': ['Oklahoma City','Tulsa','Norman','Broken Arrow','Edmond'],
    'Oregon': ['Portland','Salem','Eugene','Gresham','Hillsboro'],
    'Pennsylvania': ['Philadelphia','Pittsburgh','Harrisburg','Scranton','Allentown'],
    'Rhode Island': ['Providence','Warwick','Cranston','Pawtucket'],
    'South Carolina': ['Columbia','Charleston','North Charleston','Mount Pleasant','Rock Hill'],
    'South Dakota': ['Sioux Falls','Rapid City','Aberdeen','Brookings'],
    'Tennessee': ['Nashville','Memphis','Knoxville','Chattanooga','Clarksville'],
    'Texas': ['Houston','Dallas','San Antonio','Austin','Fort Worth','El Paso','Arlington'],
    'Utah': ['Salt Lake City','West Valley City','Provo','West Jordan','Orem'],
    'Vermont': ['Burlington','Montpelier','Rutland','Barre'],
    'Virginia': ['Virginia Beach','Norfolk','Chesapeake','Richmond','Newport News'],
    'Washington': ['Seattle','Spokane','Tacoma','Vancouver','Bellevue'],
    'West Virginia': ['Charleston','Huntington','Morgantown','Parkersburg'],
    'Wisconsin': ['Milwaukee','Madison','Green Bay','Kenosha','Racine'],
    'Wyoming': ['Cheyenne','Casper','Laramie','Gillette'],
  },
};

const Pages = {
  async renderHome() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page active">
        <div id="homeBanner" class="banner-carousel"></div>
        <div class="section-title" style="margin-top:16px;">快捷入口</div>
        <div id="homeMatchBanners" class="quick-grid"><div class="loading">加载中...</div></div>
        <!-- 问卷调查入口 -->
        <div id="homeSurveySection" style="display:none;">
          <div class="section-title">📋 问卷调查 <a class="more" onclick="App.switchPage('psychtest')">更多 →</a></div>
          <div id="homeSurveyList" class="activity-list activity-row"></div>
        </div>
        <div id="homeStarSection" style="display:none;">
          <div class="section-title" id="homeStarTitle">今日之星 <a class="more" onclick="App.switchPage('match')">更多 →</a></div>
          <div id="homeStar" class="star-row"></div>
        </div>

        <!-- 最新会员：3 tab + 左文右图卡片 -->
        <div class="section-title section-title-row">
          <span>最新嘉宾</span>
          <div class="member-tabs" id="memberTabs">
            <a class="mtab active" data-gender="" onclick="Pages._homeMemberTab(this, '')">最新</a>
            <a class="mtab" data-gender="男" onclick="Pages._homeMemberTab(this, '男')">找男生</a>
            <a class="mtab" data-gender="女" onclick="Pages._homeMemberTab(this, '女')">找女生</a>
          </div>
          <a class="more" onclick="App.switchPage('match')">更多 →</a>
        </div>
        <div id="homeMembers" class="member-list"><div class="loading">加载中...</div></div>

        <!-- 交友活动：横滑卡片，一屏 2.5 个 -->
        <div class="section-title section-title-row">
          <div>交友活动</div>
          <a class="more" onclick="App.switchPage('activity')">更多活动 →</a>
        </div>
        <div id="homeActivities" class="activity-list activity-row"><div class="loading">加载中...</div></div>

        <!-- 资讯广场：分类 tab + 卡片 -->
        <div class="section-title section-title-row">
          <div>资讯广场</div>
          <a class="more" onclick="App.switchPage('school')">更多文章 →</a>
        </div>
        <div class="article-tabs" id="articleTabs"></div>
        <div id="homeArticles" class="article-list"><div class="loading">加载中...</div></div>
      </div>
    `;
    // 拉轮播
    try {
      const bannerRes = await App.api('/api/banners');
      if (bannerRes.code === 0 && bannerRes.data.length) {
        Pages._renderBannerCarousel(bannerRes.data);
      }
    } catch (e) { console.warn('banner load fail', e); }
    // 拉找缘分模块
    try {
      const mbRes = await App.api('/api/match-banners');
      const mbBox = document.getElementById('homeMatchBanners');
      if (mbRes.code === 0 && mbRes.data.length) {
        // 给 icon 盒加浅色背景（取主色 + 透明度 0.12）
        const lighten = (hex) => {
          if (!hex || hex[0] !== '#') return '#fff0f1';
          const h = hex.replace('#','');
          const r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
          return `rgba(${r},${g},${b},0.12)`;
        };
        mbBox.innerHTML = mbRes.data.filter(b => b.enabled !== false).map(b => {
          // icon 字段：emoji 字符 / 或 /uploads/ 路径 → 渲染成图片
          const iconHtml = (b.icon && /^\//.test(b.icon))
            ? `<img src="${b.icon}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'">`
            : (b.icon || '<i class="fas fa-heart"></i>');
          const articleId = b.articleId || '';
          return `<div class="item" onclick="App.goLink('${(b.link||'home').replace(/'/g,"\\'")}', '${b.linkType || 'page'}', '${(b.filter||'').replace(/'/g,"\\'")}', '${articleId}')">
            <div class="icon" style="--icon-bg:none;--icon-bg2:${b.color || '#ff6b9d'};">${iconHtml}</div>
            <div class="label">${b.title || ''}</div>
            <div class="sub">${b.subtitle || ''}</div>
          </div>`;
        }).join('');
      } else {
        mbBox.innerHTML = '<div class="empty">暂无模块</div>';
      }
    } catch (e) { console.warn('match-banners load fail', e); }
    // 拉今日之星
    try {
      const starRes = await App.api('/api/star');
      const sec = document.getElementById('homeStarSection');
      const ttl = document.getElementById('homeStarTitle');
      const starBox = document.getElementById('homeStar');
      const items = (starRes.data && (starRes.data.items || starRes.data.users)) || [];
      const cfg = (starRes.data && starRes.data.config) || {};
      if (starRes.code === 0 && items.length) {
        ttl.innerHTML = `${cfg.title || '今日之星'} <a class="more" onclick="App.switchPage('match')">更多 →</a>`;
        sec.style.display = 'block';
        const cards = items.slice(0, 3).map(it => Pages.starCard(it.user || it)).join('');
        starBox.innerHTML = cards;
      } else {
        sec.style.display = 'none';
      }
    } catch (e) { console.warn('star load fail', e); }
    // 最新会员：默认 tab 拉一次（gender = '' 即最新）
    Pages._homeMemberTab(document.querySelector('#memberTabs .mtab.active') || document.querySelector('#memberTabs .mtab'), '');
    // 交友活动：拉最新 3 个还能报名的
    try {
      const aRes = await App.api('/api/activities');
      const aBox = document.getElementById('homeActivities');
      if (aRes.code === 0 && aRes.data && Array.isArray(aRes.data.list)) {
        const open = aRes.data.list
          .filter(a => a.status === '报名中')
          .sort((x, y) => new Date(y.createdAt || 0) - new Date(x.createdAt || 0))
          .slice(0, 3);
        if (open.length) {
          aBox.innerHTML = open.map(Pages._activityCardTemplate).join('');
          // 启动倒计时
          Pages._startActivityCountdowns();
        } else {
          aBox.innerHTML = '<div class="empty">暂无可报名的活动</div>';
        }
      } else {
        aBox.innerHTML = '<div class="empty">暂无活动</div>';
      }
    } catch (e) { console.warn('activities load fail', e); }
    // 资讯广场：先拉分类，默认选前 4 个
    try {
      const catRes = await App.api('/api/article-categories');
      const tabsBox = document.getElementById('articleTabs');
      if (catRes.code === 0 && catRes.data && catRes.data.list.length) {
        const cats = catRes.data.list.slice(0, 4);
        tabsBox.innerHTML = cats.map((c, i) => `<a class="atab ${i===0?'active':''}" data-cat="${c.id}" onclick="Pages._homeArticleTab(this, '${c.id}')">${c.name}</a>`).join('');
        Pages._homeArticleTab(tabsBox.querySelector('.atab.active'), cats[0].id);
      } else {
        tabsBox.innerHTML = '';
        document.getElementById('homeArticles').innerHTML = '<div class="empty">暂无文章分类</div>';
      }
    } catch (e) { console.warn('article-categories load fail', e); }
  },

  // ===== 会员 tab 切换 =====
  async _homeMemberTab(el, gender) {
    const tabs = document.querySelectorAll('#memberTabs .mtab');
    tabs.forEach(t => t.classList.toggle('active', t === el));
    const box = document.getElementById('homeMembers');
    box.innerHTML = '<div class="loading">加载中...</div>';
    try {
      const qs = gender ? `gender=${encodeURIComponent(gender)}` : '';
      const allRes = await App.api('/api/users?sort=newest&pageSize=20' + (qs ? '&' + qs : ''));
      if (allRes.code === 0 && allRes.data && Array.isArray(allRes.data.list)) {
        const isRealAvatar = (u) => {
          if (!u.avatar) return false;
          if (/^data:image\/svg\+xml/i.test(u.avatar)) return false;
          if (/^data:image\//i.test(u.avatar)) return true;
          if (/^\/(avatars|uploads)\//.test(u.avatar)) return true;
          return false;
        };
        const list = allRes.data.list.filter(isRealAvatar).slice(0, 6);
        box.innerHTML = list.length ? list.map(Pages._memberCardTemplate).join('') : '<div class="empty">暂无会员</div>';
      } else {
        box.innerHTML = '<div class="empty">暂无数据</div>';
      }
    } catch (e) {
      console.warn('members load fail', e);
      box.innerHTML = '<div class="empty">加载失败</div>';
    }
  },

  // ===== 资讯广场分类 tab 切换 =====
  async _homeArticleTab(el, catId) {
    const tabs = document.querySelectorAll('#articleTabs .atab');
    tabs.forEach(t => t.classList.toggle('active', t === el));
    const box = document.getElementById('homeArticles');
    box.innerHTML = '<div class="loading">加载中...</div>';
    try {
      const res = await App.api('/api/articles?categoryId=' + encodeURIComponent(catId) + '&pageSize=3');
      if (res.code === 0 && res.data && res.data.list.length) {
        box.innerHTML = res.data.list.map(Pages._articleCardTemplate).join('');
      } else {
        box.innerHTML = '<div class="empty">该分类暂无文章</div>';
      }
    } catch (e) {
      console.warn('articles load fail', e);
      box.innerHTML = '<div class="empty">加载失败</div>';
    }
  },

  // ===== 会员卡片（左文右图，按参考图） =====
  _memberCardTemplate(u) {
    const f = u.form || {};
    const age = u.age || f.age || '';
    // 出生年份：优先取birthday字段，其次反算age
    let year = '';
    const bd = u.birthday || f.birthday || '';
    if (bd && String(bd).length >= 4) {
      year = String(bd).substring(0, 4) + '年';
    } else if (age && !isNaN(Number(age))) {
      year = (new Date().getFullYear() - Number(age)) + '年';
    }
    const job = u.job || f.job || '';
    const city = u.city || f.currentCity || '';
    const edu = u.education || f.education || '';
    const height = u.height || f.height || '';
    const income = u.income || f.income || '';
    const avatar = u.avatar || ('https://i.pravatar.cc/300?u=' + u.id);
    const safeNick = (u.nickname || '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    return `<div class="member-card" onclick="Pages.showUser('${u.id}')">
      <div class="member-card-photo">
        <img src="${avatar}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22><rect fill=%22%23ff5a6e%22 width=%22300%22 height=%22300%22/><text x=%22150%22 y=%22160%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2280%22>?</text></svg>'">
        ${u.vip ? `<div class="vip-tag">★ VIP${u.level || 1}</div>` : ''}
      </div>
      <div class="member-card-info">
        <div class="row1">
          <div class="meta-name">${safeNick}</div>
        </div>
        ${(year || job) ? `<div class="row-birthjob">
          ${year ? `<span class="birth-year">${year}</span>` : ''}
          ${job ? `<span class="job">${job}</span>` : ''}
        </div>` : ''}
        <div class="row2">
          ${city ? `<span>📍 ${city}</span>` : ''}
          ${edu ? `<span>🎓 ${edu}</span>` : ''}
        </div>
        <div class="row2">
          ${height ? `<span>📏 ${height}cm</span>` : ''}
          ${income ? `<span>💰 ${Pages._formatIncome(u)}</span>` : ''}
        </div>
        <div class="row3">
          <span></span>
          <button class="apply-btn" onclick="event.stopPropagation();Pages._homeLikeUser('${u.id}',this)">喜欢TA</button>
        </div>
      </div>
    </div>`;
  },

  // ===== 活动卡片（顶部大图 + 标题 + 倒计时 + 地点） =====
  _activityCardTemplate(a) {
    const cover = a.cover || '';
    const endIso = a.signupEnd || '';
    const endMs = endIso ? new Date(endIso).getTime() : 0;
    return `<div class="activity-card" onclick="Pages._openActivity('${a.id}')">
      <div class="activity-cover" style="background:${cover ? `url(${cover}) center/cover` : 'var(--gradient-primary)'};">
        ${a.status === '报名中' ? '<span class="status-badge">报名中</span>' : ''}
      </div>
      <div class="activity-info">
        <div class="activity-title">${a.title || ''}</div>
        <div class="activity-countdown" data-end="${endMs}">加载中...</div>
        <div class="activity-place">📍 ${a.city || ''} · ${a.place || ''}</div>
      </div>
    </div>`;
  },

  // 启动活动卡片倒计时
  _startActivityCountdowns() {
    if (this._countdownTimer) clearInterval(this._countdownTimer);
    const tick = () => {
      const els = document.querySelectorAll('.activity-countdown');
      const now = Date.now();
      els.forEach(el => {
        const end = parseInt(el.dataset.end || '0', 10);
        if (!end) { el.textContent = '已截止'; return; }
        const diff = end - now;
        if (diff <= 0) { el.innerHTML = '<span class="ended">已截止报名</span>'; return; }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.innerHTML = `<b>${d}</b>天 <b>${h}</b>时 <b>${m}</b>分 <b>${s}</b>秒`;
      });
    };
    tick();
    this._countdownTimer = setInterval(tick, 1000);
  },

  // 打开活动详情
  _openActivity(id) {
    if (typeof Activity !== 'undefined' && Activity.show) Activity.show(id);
    else { App.toast('活动详情见「活动」页'); App.switchPage('activity'); }
  },

  // ===== 文章卡片（左缩略图 + 右标题/热度/日期） =====
  _articleCardTemplate(a) {
    const cover = a.cover || '';
    const heat = (a.likes || 0) + (a.views || 0) * 0.1;
    const heatLabel = heat >= 1000 ? (heat / 1000).toFixed(1) + 'k' : Math.round(heat);
    const date = a.createdAt ? new Date(a.createdAt).toLocaleDateString('zh-CN').replace(/\//g, '-') : '';
    return `<div class="article-card" onclick="Pages._openArticle('${a.id}')">
      <div class="article-thumb" style="background:${cover ? `url(${cover}) center/cover` : 'var(--gradient-primary)'};"></div>
      <div class="article-info">
        <div class="article-title">${a.title || ''}</div>
        <div class="article-meta">
          <span class="heat">🔥 ${heatLabel}</span>
          <span class="date">${date}</span>
        </div>
      </div>
    </div>`;
  },

  _openArticle(id) {
    if (typeof Article !== 'undefined' && Article.show) Article.show(id);
    else { App.toast('文章详情见「学堂」页'); App.switchPage('school'); }
  },

  _renderBannerCarousel(banners) {
    const wrap = document.getElementById('homeBanner');
    wrap.innerHTML = `
      <div class="banner-track" id="bannerTrack">
        ${banners.map((b, i) => `
          <div class="banner-slide" data-idx="${i}" data-link="${b.ctaLink || 'home'}" style="background:${b.image ? `url(${b.image}) center/cover` : (b.bgColor || '#ff5a5f')}; cursor:pointer;">
            <div class="banner-mask"></div>
            <div class="banner-content">
              <h2>${b.title || ''}</h2>
              <p>${b.subtitle || ''}</p>
              ${b.ctaText ? `<a class="banner-cta">${b.ctaText}</a>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="banner-dots">${banners.map((_, i) => `<span class="dot ${i===0?'active':''}" data-idx="${i}"></span>`).join('')}</div>
    `;
    const track = document.getElementById('bannerTrack');
    const slides = track.children;
    const dots = wrap.querySelectorAll('.dot');
    let current = 0;
    const total = slides.length;
    if (total <= 1) return;
    const go = (n) => {
      current = (n + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
    };
    // 自动轮播
    let timer = setInterval(() => go(current + 1), 4000);
    // 触摸滑动
    let startX = 0, dx = 0, dragging = false;
    track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; dragging = true; clearInterval(timer); }, { passive: true });
    track.addEventListener('touchmove', e => { if (!dragging) return; dx = e.touches[0].clientX - startX; }, { passive: true });
    track.addEventListener('touchend', () => {
      dragging = false;
      if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
      dx = 0;
      timer = setInterval(() => go(current + 1), 4000);
    });
    // 鼠标拖动（PC测试用）
    track.addEventListener('mousedown', e => { startX = e.clientX; dragging = true; clearInterval(timer); track.style.cursor = 'grabbing'; });
    window.addEventListener('mousemove', e => { if (!dragging) return; dx = e.clientX - startX; });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
      dx = 0;
      timer = setInterval(() => go(current + 1), 4000);
      track.style.cursor = 'grab';
    });
    // 圆点点击
    dots.forEach(d => d.onclick = () => { clearInterval(timer); go(parseInt(d.dataset.idx)); timer = setInterval(() => go(current + 1), 4000); });
    // 整张轮播图点击跳转（仅未滑动时触发）
    wrap.addEventListener('click', e => {
      const slide = e.target.closest('.banner-slide');
      if (!slide) return;
      // 如果是滑动操作（dx>10），不触发点击跳转
      if (Math.abs(dx) > 10) return;
      const link = slide.dataset.link || 'home';
      App.goLink(link);
    });
    // banner-cta 按钮也走同样逻辑（不需要 stopPropagation）
  },

  starCard(u) {
    return `<div class="star-card" onclick="Pages.showUser('${u.id}')">
      <div class="star-avatar">
        <img src="${u.avatar}">
        ${u.online ? '<span class="online-dot"></span>' : ''}
      </div>
      <div class="star-name">${u.nickname}</div>
      <div class="star-meta">${u.age || u.form?.age || ''}岁 · ${u.city || u.form?.currentCity || ''}</div>
      <div class="star-job">${u.job || u.form?.job || ''}</div>
    </div>`;
  },

  async renderContact() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="page active"><div class="loading">加载中...</div></div>';
    const res = await App.api('/api/contact?t=' + Date.now());
    const c = (res.code === 0 && res.data) ? res.data : {};
    const safe = (s) => (s || '').replace(/[<>&"]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[ch]));
    const wechat = safe(c.wechat || '');
    const wechatQrcode = c.wechatQrcode || '';
    const email = safe(c.email || '');
    const workTime = safe(c.workTime || '');
    const intro = safe(c.intro || '');
    const wechatLabel = safe(c.wechatLabel || '客服微信号（点击复制）');
    const emailLabel = safe(c.emailLabel || '联系邮箱');
    const workTimeLabel = safe(c.workTimeLabel || '工作时间');
    const qrcodeSectionTitle = safe(c.qrcodeSectionTitle || '客服微信号二维码');
    const qrcodeHint = safe(c.qrcodeHint || '扫码添加客服微信，获取专属服务');
    const introSectionTitle = safe(c.introSectionTitle || '关于我们');
    content.innerHTML = `
      <div class="page active contact-page">
        ${intro ? `<div class="intro-box"><div class="intro-title">${introSectionTitle}</div><div class="intro-content">${intro}</div></div>` : ''}
        ${wechat ? `<div class="contact-card wechat" onclick="Pages._copyText('${wechat}', '客服微信号已复制')">
          <div class="icon-box"><i class="fas fa-comment"></i></div>
          <div class="info"><div class="label">${wechatLabel}</div><div class="value">${wechat}</div></div>
          <div class="arrow">›</div>
        </div>` : ''}
        ${email ? `<div class="contact-card email" onclick="window.location.href='mailto:${email}'">
          <div class="icon-box"><i class="fas fa-envelope"></i></div>
          <div class="info"><div class="label">${emailLabel}</div><div class="value">${email}</div></div>
          <div class="arrow">›</div>
        </div>` : ''}
        ${workTime ? `<div class="contact-card time">
          <div class="icon-box">🕒</div>
          <div class="info"><div class="label">${workTimeLabel}</div><div class="value">${workTime}</div></div>
        </div>` : ''}
        ${wechatQrcode ? `
        <div class="contact-section-title">${qrcodeSectionTitle}</div>
        <div class="qrcode-box">
          <img src="${wechatQrcode}" onerror="this.style.display='none'">
          <div class="qr-hint">${qrcodeHint}</div>
        </div>
        ` : ''}
      </div>
    `;
  },
  _copyText(text, msg) {
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try { ta.setSelectionRange(0, ta.value.length); } catch (e) {}
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    };
    const okMsg = msg || '已复制';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => App.toast(okMsg)).catch(() => {
        if (fallback()) App.toast(okMsg);
        else App.toast('复制失败，请长按微信号手动复制');
      });
    } else {
      if (fallback()) App.toast(okMsg);
      else App.toast('复制失败，请长按微信号手动复制');
    }
  },
  _openMap(addr) {
    // 调起高德/百度地图（PC 上 fallback 到 Google）
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) {
      window.location.href = 'https://maps.apple.com/?q=' + encodeURIComponent(addr);
    } else {
      window.open('https://uri.amap.com/marker?position=lng,lat&name=' + encodeURIComponent(addr) + '&src=StarMeet', '_blank');
    }
  },

  // ===== 问卷调查页面 =====
  async renderSurvey(surveyId) {
    // 未登录 → 弹登录窗
    if (!App.user) { Auth.openLogin(); App.toast('请先登录后再填写问卷'); return; }
    const content = document.getElementById('content');
    // 如果没有指定surveyId，先获取可用问卷列表
    if (!surveyId) {
      const listRes = await App.api('/api/surveys');
      const surveys = (listRes && listRes.data) ? listRes.data : [];
      if (!surveys.length) { content.innerHTML = '<div class="page active"><div class="empty">暂无可用问卷</div></div>'; return; }
      surveyId = surveys[0].id;
    }
    content.innerHTML = '<div class="page active"><div class="loading">加载问卷中...</div></div>';
    const res = await App.api('/api/survey?id=' + surveyId);
    if (res.code !== 0 || !res.data) { content.innerHTML = '<div class="page active"><div class="empty">问卷不存在或已关闭</div></div>'; return; }
    const s = res.data;
    console.log('[Survey] API返回:', { filled: s.filled, hasMyAnswers: !!s.myAnswers, myAnswers: s.myAnswers, userId: App.user?.id });
    // 已填写过 → 显示用户答案（解答型同时显示解答内容）
    if (s.filled) { this._renderSurveyResult(s, s.myAnswers); return; }

    this._currentSurvey = s;
    let html = `<div class="page active"><div class="sv-container">`;
    // 问卷顶图
    if (s.topImage) {
      html += `<div class="sv-top-image"><img src="${s.topImage}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px 8px 0 0;"></div>`;
    }
    html += `<div class="sv-header"><span class="back" onclick="App.switchPage('home')">‹</span><h2>${s.title}</h2>`;
    if (s.description) html += `<p class="sv-desc">${s.description}</p>`;
    html += '</div><form id="svForm" onsubmit="return false;"><div class="sv-body">';
    (s.questions || []).forEach((q, i) => {
      html += `<div class="sv-question"><div class="sv-q-title">${i+1}. ${q.title || q.text}${['text','textarea','date','image'].includes(q.type)?'':'<span style="color:var(--danger);">*</span>'}</div>`;
      if (q.type === 'single' || q.type === 'radio') {
        html += '<div class="sv-options">' + (q.options||[]).map(o => `<label class="sv-opt"><input type="radio" name="${q.id}" value="${o}" required><span>${o}</span></label>`).join('') + '</div>';
      } else if (q.type === 'multiple' || q.type === 'checkbox') {
        html += '<div class="sv-options sv-options-multi">' + (q.options||[]).map(o => `<label class="sv-opt"><input type="checkbox" name="${q.id}" value="${o}"><span>${o}</span></label>`).join('') + '</div>';
      } else if (q.type === 'date' || q.type === 'text' || q.type === 'textarea') {
        html += `<textarea name="${q.id}" rows=3 placeholder="请填写..." style="width:100%;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:14px;resize:vertical;"></textarea>`;
      } else if (q.type === 'number') {
        html += `<input type="number" name="${q.id}" placeholder="请输入数字..." style="width:100%;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:14px;">`;
      } else if (q.type === 'image') {
        html += `<div style="padding:10px;"><input type="file" name="${q.id}" accept="image/*" capture="environment" onchange="Pages._previewImage(this)" style="font-size:14px;">
          <img id="preview_${q.id}" style="max-width:100%;max-height:150px;margin-top:8px;display:none;border-radius:6px;border:1px dashed var(--border);"></div>`;
      } else {
        html += `<input type="text" name="${q.id}" placeholder="请填写..." style="width:100%;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:14px;">`;
      }
      html += '</div>';
    });
    html += `</div><button class="primary-btn sv-submit" onclick="Pages._submitSurvey()">提交问卷</button></form></div>`;
    // 结果展示区（初始隐藏）
    html += `<div id="svResult" style="display:none;padding:30px 20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;"><i class="fas fa-party-horn"></i></div>
      <h3 id="svResultTitle"></h3>
      <p id="svResultContent" style="color:#666;line-height:1.6;margin-top:10px;font-size:14px;"></p>
      <button class="primary-btn" style="margin-top:24px;" onclick="App.switchPage('home')">返回首页</button>
    </div></div>`;
    content.innerHTML = html;
  },
  // 渲染问卷结果页（已填写 / 提交后）
  _renderSurveyResult(survey, myAnswers) {
    const content = document.getElementById('content');
    const esc = v => (v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const getAns = (qId) => {
      if (!myAnswers) return '（未填写）';
      if (myAnswers[qId] !== undefined) return myAnswers[qId];
      if (Array.isArray(myAnswers)) {
        const a = myAnswers.find(x => x && (x.questionId === qId || x.qid === qId || x.id === qId));
        return a ? (a.answer || a.value) : '（未填写）';
      }
      const idx = (survey.questions||[]).findIndex(q => q.id === qId);
      if (idx >= 0) {
        const altKeys = [String(idx), 'q' + (idx + 1), '_' + qId];
        for (const k of altKeys) { if (myAnswers[k] !== undefined) return myAnswers[k]; }
      }
      return '（未填写）';
    };
    const hasAnswers = myAnswers && typeof myAnswers === 'object' && Object.keys(myAnswers).length > 0;
    let html = `<div class="page active" style="padding:0;">`;
    // 问卷顶图
    if (survey.topImage) {
      html += `<img src="${esc(survey.topImage)}" style="width:100%;display:block;max-height:220px;object-fit:cover;">`;
    }
    html += `<div style="padding:20px;">
      <div style="text-align:center;margin-bottom:16px;">
        <h2 style="margin:0 0 4px 0;">${esc(survey.title)}</h2>
        <p style="color:#999;font-size:13px;">${hasAnswers ? '您已填写，以下是您的答案' : '您已填写过此问卷'}</p>
      </div>`;
    // 解答型：显示解答内容
    if (survey.resultType === 'interpretation' && survey.interpretation) {
      html += `<div style="background:#fff8f0;border-radius:12px;padding:18px;margin-bottom:16px;border-left:4px solid #ff5a6e;">
        <div style="font-size:15px;font-weight:600;color:#ff5a6e;margin-bottom:10px;">💡 专属解答</div>
        <div style="color:#333;line-height:1.8;font-size:14px;">${survey.interpretation.replace(/\n/g,'<br>')}</div>
      </div>`;
    }
    // 调查型感谢语
    if (survey.resultType !== 'interpretation' && hasAnswers) {
      html += `<div style="background:linear-gradient(135deg,#f0fff4,#e6ffed);border-radius:12px;padding:24px 18px;margin-bottom:16px;text-align:center;border:1.5px solid #b7eb8f;min-height:auto;height:auto;">
        <div style="font-size:40px;margin-bottom:8px;color:#52c41a;"><i class="fas fa-party-horn"></i></div>
        <div style="font-size:17px;font-weight:700;color:#07c160;">感谢填写</div>
        <div style="color:#666;font-size:13.5px;margin-top:8px;line-height:1.5;">${esc(survey.thankYouMessage || '感谢您的参与！')}</div>
      </div>`;
    }
    // 用户填写内容（题目粗体 + 答案灰色背景框）
    (survey.questions||[]).forEach((q, i) => {
      const ans = getAns(q.id);
      let ansText = '';
      if (Array.isArray(ans)) ansText = ans.join('，');
      else if (typeof ans === 'string' && ans.startsWith('data:image')) ansText = '[图片]';
      else if (typeof ans === 'string' && ans.length > 200) ansText = ans.substring(0, 200) + '...';
      else ansText = ans || '（未填写）';
      html += `<div style="margin-bottom:16px;">
        <div style="font-size:15px;font-weight:600;color:#222;margin-bottom:6px;">${esc(q.title||q.text||'')}</div>
        <div style="background:#f7f7f7;border-radius:8px;padding:12px 14px;font-size:14px;color:#444;line-height:1.5;word-break:break-all;">${typeof ans === 'string' && ans.startsWith('data:image') ? '<img src="' + esc(ans) + '" style="max-width:100%;max-height:200px;border-radius:6px;">' : esc(ansText)}</div>
      </div>`;
    });
    html += `<button class="primary-btn" style="margin-top:20px;width:100%;" onclick="App.switchPage('home')">返回首页</button></div></div>`;
    content.innerHTML = html;
  },
  _previewImage(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    const imgId = 'preview_' + input.name;
    reader.onload = function(e) {
      const img = document.getElementById(imgId);
      if (img) { img.src = e.target.result; img.style.display = 'block'; }
      // 把 base64 存到隐藏字段
      let hidden = document.getElementById('hidden_' + input.name);
      if (!hidden) {
        hidden = document.createElement('input');
        hidden.type = 'hidden';
        hidden.id = 'hidden_' + input.name;
        hidden.name = input.name;
        hidden.value = e.target.result;
        input.parentNode.appendChild(hidden);
      } else {
        hidden.value = e.target.result;
      }
    };
    reader.readAsDataURL(input.files[0]);
  },
  async _submitSurvey() {
    if (!this._currentSurvey) return;
    if (!App.user) { Auth.openLogin(); return; }
    const form = document.getElementById('svForm');
    if (!form) return;
    const answers = {};
    for (const q of (this._currentSurvey.questions || [])) {
      if (q.type === 'single' || q.type === 'radio') { answers[q.id] = form.querySelector(`input[name="${q.id}"]:checked`)?.value || ''; if (!answers[q.id]) return App.toast(`请完成第${(this._currentSurvey.questions.indexOf(q)+1)}题`); }
      else if (q.type === 'multiple' || q.type === 'checkbox') { const checked = [...form.querySelectorAll(`input[name="${q.id}"]:checked`)].map(el => el.value); if (!checked.length) return App.toast(`请完成第${(this._currentSurvey.questions.indexOf(q)+1)}题`); answers[q.id] = checked; }
      else if (q.type === 'image') { const hidden = document.getElementById('hidden_' + q.id); answers[q.id] = hidden?.value || ''; }
      else { // text / textarea / number / date 等文本类题目
        const input = form.querySelector(`[name="${q.id}"]`);
        answers[q.id] = input ? input.value.trim() : '';
        if (!answers[q.id] && q.required) return App.toast(`请完成第${(this._currentSurvey.questions.indexOf(q)+1)}题：${q.title||q.text||''}`);
      }
    }
    this._currentSurvey._lastAnswers = answers;
    console.log('[Survey] 提交答案:', JSON.stringify(answers).substring(0, 200));
    const res = await App.api('/api/survey/submit', { method:'POST', body:{ surveyId: this._currentSurvey.id, answers }});
    if (res.code !== 0) return App.toast(res.msg);
    // 提交成功 → 显示结果页
    const s = this._currentSurvey;
    this._renderSurveyResult(s, (res.data && res.data.answers) || this._currentSurvey._lastAnswers || null);
  },

  async renderPsychTests() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading">加载中...</div>';
    try {
      const res = await App.api('/api/surveys');
      const surveys = (res && res.data) ? res.data : [];
      if (!surveys.length) {
        content.innerHTML = '<div class="empty">暂无心理测试</div>';
        return;
      }
      const esc2 = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      let html = '<div class="psychtest-grid">';
      surveys.forEach(s => {
        const coverImg = s.cover
          ? `<img class="cover" src="${esc2(s.cover)}" alt="${esc2(s.title)}" onerror="this.style.display='none'">`
          : `<div class="cover-text">${esc2(s.title).substring(0,1)}</div>`;
        html += `<div class="psychtest-card" onclick="App.switchPage('survey&id=${s.id}')">
          <div class="cover-wrap">${coverImg}</div>
          <div class="info">
            <div class="title">${esc2(s.title)}</div>
            <div class="meta">${s.type === 'normal' ? '感谢型' : '解读型'} · ${s.questionCount || 0}题</div>
          </div>
        </div>`;
      });
      html += '</div>';
      content.innerHTML = html;
    } catch(e) {
      content.innerHTML = '<div class="empty">加载失败</div>';
      console.error('加载心理测试失败', e);
    }
  },

  async renderMatch() {
    const content = document.getElementById('content');
    const cities = await App.api('/api/cities');
    const cityOptions = (cities.data || []).map(c => `<option value="${c}">${c}</option>`).join('');
    content.innerHTML = `
      <div class="page active">
        <div class="filter-bar">
          <div class="chip active" data-gender="">全部</div>
          <div class="chip" data-gender="女">找女生</div>
          <div class="chip" data-gender="男">找男生</div>
          <div class="chip" data-vip="true">VIP</div>
          <div class="chip filter-btn" onclick="Pages.openFilterDrawer()">
            <span>🔍 筛选</span>
            <span id="filterBadge" style="display:none;background:var(--primary);color:#fff;border-radius:8px;padding:0 5px;font-size:10px;margin-left:2px;"></span>
          </div>
        </div>
        <div id="activeFilters" style="display:none;padding:6px 12px;background:#fff;border-radius:10px;margin-bottom:8px;font-size:12px;color:var(--text-2);"></div>
        <div id="userList" class="user-grid"><div class="loading">加载中...</div></div>
        <div id="loadMore" style="text-align:center; padding: 16px; color: var(--text-3); font-size: 13px;">上滑加载更多</div>
      </div>
      <div id="filterDrawer" class="drawer" style="display:none;">
        <div class="drawer-mask" onclick="Pages.closeFilterDrawer()"></div>
        <div class="drawer-panel">
          <div class="drawer-header">
            <span>高级筛选</span>
            <span style="float:right;cursor:pointer;" onclick="Pages.closeFilterDrawer()">×</span>
          </div>
          <div class="drawer-body">
            <div class="form-group">
              <label>所在城市</label>
              <select id="fd_city">
                <option value="">全部城市</option>
                ${cityOptions}
              </select>
            </div>
            <div class="form-group">
              <label>年龄范围</label>
              <div class="range-row">
                <input id="fd_minAge" type="number" min="18" max="80" value="18" placeholder="最小">
                <span>—</span>
                <input id="fd_maxAge" type="number" min="18" max="80" value="80" placeholder="最大">
              </div>
            </div>
            <div class="form-group">
              <label>身高范围 (cm)</label>
              <div class="range-row">
                <input id="fd_minHeight" type="number" min="140" max="220" value="140" placeholder="最矮">
                <span>—</span>
                <input id="fd_maxHeight" type="number" min="140" max="220" value="220" placeholder="最高">
              </div>
            </div>
            <div class="form-group">
              <label>体重范围 (kg)</label>
              <div class="range-row">
                <input id="fd_minWeight" type="number" min="30" max="200" value="30" placeholder="最轻">
                <span>—</span>
                <input id="fd_maxWeight" type="number" min="30" max="200" value="200" placeholder="最重">
              </div>
            </div>
          </div>
          <div class="drawer-footer">
            <button class="btn" onclick="Pages.resetFilter()">重置</button>
            <button class="primary-btn" onclick="Pages.applyFilter()">应用筛选</button>
          </div>
        </div>
      </div>
    `;
    let state = { page: 1, gender: '', vip: '', city: '', minAge: '', maxAge: '', minHeight: '', maxHeight: '', minWeight: '', maxWeight: '', loading: false, done: false };
    const load = async () => {
      if (state.loading || state.done) return;
      state.loading = true;
      const params = new URLSearchParams({ page: state.page, pageSize: 20, sort: 'newest' });
      Object.keys(state).forEach(k => { if (state[k] && ['gender','vip','city','minAge','maxAge','minHeight','maxHeight','minWeight','maxWeight'].includes(k)) params.set(k, state[k]); });
      const res = await App.api('/api/users?' + params);
      state.loading = false;
      if (res.code === 0) {
        const list = res.data.list;
        if (state.page === 1) document.getElementById('userList').innerHTML = list.length ? list.map(Pages.userCard).join('') : '<div class="empty"><div class="icon">😢</div>暂无符合条件的会员</div>';
        else if (list.length) document.getElementById('userList').insertAdjacentHTML('beforeend', list.map(Pages.userCard).join(''));
        if (list.length < 20) { state.done = true; document.getElementById('loadMore').textContent = '没有更多了'; }
        else { state.page++; }
      }
    };
    document.querySelectorAll('.filter-bar .chip:not(.filter-btn)').forEach(c => c.addEventListener('click', () => {
      document.querySelectorAll('.filter-bar .chip:not(.filter-btn)').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      state.gender = c.dataset.gender || '';
      state.vip = c.dataset.vip || '';
      state.page = 1; state.done = false;
      load();
    }));
    // 应用快捷入口带来的性别筛选条件
    let skipDefaultLoad = false;
    if (App._matchFilter) {
      const mf = App._matchFilter;
      App._matchFilter = null;
      document.querySelectorAll('.filter-bar .chip:not(.filter-btn)').forEach(x => x.classList.remove('active'));
      const targetChip = document.querySelector(`.filter-bar .chip[data-gender="${mf}"]`);
      if (targetChip) {
        targetChip.classList.add('active');
        state.gender = mf;
        state.page = 1;
        state.done = false;
        skipDefaultLoad = true;
        load();
      }
    }
    // 滚动加载 - 同时监听窗口滚动和页面容器滚动
    const onScroll = () => {
      const sc = document.getElementById('loadMore');
      if (!sc || state.loading || state.done) return;
      const rect = sc.getBoundingClientRect();
      if (rect.top < window.innerHeight + 120) load();
    };
    window.addEventListener('scroll', onScroll);
    const pageEl = content.querySelector('.page');
    if (pageEl) pageEl.addEventListener('scroll', onScroll);
    // 初始检查（loadMore 可能已经在可视区）
    setTimeout(onScroll, 300);
    if (!skipDefaultLoad) load();
  },

  openFilterDrawer() {
    document.getElementById('filterDrawer').style.display = 'flex';
  },
  closeFilterDrawer() {
    document.getElementById('filterDrawer').style.display = 'none';
  },
  applyFilter() {
    const city = document.getElementById('fd_city').value;
    const minAge = document.getElementById('fd_minAge').value;
    const maxAge = document.getElementById('fd_maxAge').value;
    const minHeight = document.getElementById('fd_minHeight').value;
    const maxHeight = document.getElementById('fd_maxHeight').value;
    const minWeight = document.getElementById('fd_minWeight').value;
    const maxWeight = document.getElementById('fd_maxWeight').value;
    this._matchState = this._matchState || {};
    Object.assign(this._matchState, { city, minAge, maxAge, minHeight, maxHeight, minWeight, maxWeight });
    this.closeFilterDrawer();
    // 重新渲染列表
    this._reloadMatchWithFilter();
  },
  resetFilter() {
    document.getElementById('fd_city').value = '';
    document.getElementById('fd_minAge').value = '18';
    document.getElementById('fd_maxAge').value = '80';
    document.getElementById('fd_minHeight').value = '140';
    document.getElementById('fd_maxHeight').value = '220';
    document.getElementById('fd_minWeight').value = '30';
    document.getElementById('fd_maxWeight').value = '200';
    this._matchState = {};
    this.closeFilterDrawer();
    this._reloadMatchWithFilter();
  },
  async _reloadMatchWithFilter() {
    const f = this._matchState || {};
    // 构造活动筛选标签
    const tags = [];
    if (f.city) tags.push('📍 ' + f.city);
    if (f.minAge || f.maxAge) tags.push(`🎂 ${f.minAge || 18}-${f.maxAge || 80}岁`);
    if (f.minHeight || f.maxHeight) tags.push(`📏 ${f.minHeight || 140}-${f.maxHeight || 220}cm`);
    if (f.minWeight || f.maxWeight) tags.push(`<i class="fas fa-weight-scale"></i> ${f.minWeight || 30}-${f.maxWeight || 200}kg`);
    const af = document.getElementById('activeFilters');
    const badge = document.getElementById('filterBadge');
    if (tags.length) {
      af.style.display = 'block';
      af.innerHTML = tags.join(' · ') + ' <a style="color:var(--primary);margin-left:6px;" onclick="Pages.resetFilter()">清除</a>';
      badge.style.display = 'inline-block';
      badge.textContent = tags.length;
    } else {
      af.style.display = 'none';
      badge.style.display = 'none';
    }
    // 直接调一次
    const params = new URLSearchParams({ page: 1, pageSize: 99, sort: 'newest' });
    Object.entries(f).forEach(([k, v]) => v && params.set(k, v));
    const res = await App.api('/api/users?' + params);
    const listEl = document.getElementById('userList');
    if (res.code === 0) {
      listEl.innerHTML = res.data.list.length ? res.data.list.map(Pages.userCard).join('') : '<div class="empty"><div class="icon">😢</div>暂无符合条件的会员</div>';
      document.getElementById('loadMore').textContent = '— 已应用筛选 —';
    }
  },

  async renderActivity() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="page active"><div class="loading">加载中...</div></div>';
    const res = await App.api('/api/activities');
    if (res.code !== 0) return;
    const allActs = res.data.list || [];
    // 客户端备用：根据 joins 数组计算 userSigned（防止服务端 userSigned 不准确）
    if (App.user && App.user.id) {
      const myId = String(App.user.id);
      allActs.forEach(a => {
        a.userSigned = Array.isArray(a.joins) && a.joins.some(j => String(j.userId) === myId);
      });
    }
    // 活动筛选状态
    window._actCategoryFilterValue = '';
    window._actSignedFilterValue = '';
    // 渲染活动列表（根据分类和报名状态筛选）
    window._renderActList = function() {
      const filtered = allActs.filter(a => {
        if (window._actCategoryFilterValue && a.category !== window._actCategoryFilterValue) return false;
        if (window._actSignedFilterValue === 'signed') return !!a.userSigned;
        if (window._actSignedFilterValue === 'unsigned') return !a.userSigned;
        return true;
      });
      document.getElementById('actListBox').innerHTML = filtered.length ? filtered.map(a => `
        <div class="act-card" onclick="Activity.show('${a.id}')">
          <img src="${a.cover}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22><rect fill=%22%23ff5a6e%22 width=%22300%22 height=%22300%22/><text x=%22150%22 y=%22160%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2280%22>?</text></svg>'">
          <div class="body">
            <h3>${a.title}</h3>
            <div class="meta"><span class="tag" style="display:inline-block;margin-bottom:6px;padding:2px 8px;border-radius:10px;background:#f0f0f0;color:#666;font-size:11px;">${a.category || '线下活动'}</span><br>🕒 ${a.time}<br>📍 ${a.place}</div>
            <div class="footer">
              <span class="price ${a.price === 0 ? 'free' : ''}">${a.price === 0 ? '免费' : '¥' + a.price}</span>
              <span class="meta">${a.joinedCount || 0}人已报名</span>
              <span class="join-btn">${a.status}</span>
            </div>
          </div>
        </div>
      `).join('') : '<div class="empty"><div class="icon">📅</div>暂无活动</div>';
    };
    // 渲染页面
    content.innerHTML = `<div class="page active">
      <div class="filter-bar" id="actCategoryBar" style="margin-bottom:4px;">
        <div class="chip active" data-filter="" onclick="window._actCategoryFilter(this, '')">全部</div>
        <div class="chip" data-filter="线下活动" onclick="window._actCategoryFilter(this, '线下活动')">线下活动</div>
        <div class="chip" data-filter="线上活动" onclick="window._actCategoryFilter(this, '线上活动')">线上活动</div>
      </div>
      <div class="filter-bar" id="actFilterBar">
        <div class="chip active" data-filter="" onclick="window._actSignedFilter(this, '')">全部</div>
        <div class="chip" data-filter="signed" onclick="window._actSignedFilter(this, 'signed')">我已报名</div>
        <div class="chip" data-filter="unsigned" onclick="window._actSignedFilter(this, 'unsigned')">我未报名</div>
      </div>
      <div id="actListBox"><div class="loading">加载中...</div></div>
    </div>`;
    // 定义筛选切换函数
    window._actCategoryFilter = function(el, filter) {
      document.querySelectorAll('#actCategoryBar .chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      window._actCategoryFilterValue = filter;
      window._renderActList();
    };
    window._actSignedFilter = function(el, filter) {
      document.querySelectorAll('#actFilterBar .chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      window._actSignedFilterValue = filter;
      window._renderActList();
    };
    // 默认渲染全部
    window._renderActList();
  },

  async renderSchool() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="page active"><div class="loading">加载中...</div></div>';
    // 拉取文章分类
    let categories = [];
    try {
      const catRes = await App.api('/api/article-categories');
      if (catRes.code === 0) categories = catRes.data.list || catRes.data || [];
    } catch(e) { console.warn('分类加载失败', e); }
    // 渲染页面结构：分类tabs + 文章列表（第一个tab是"全部"）
    const tabsHtml = `<div class="article-tabs" id="schoolArticleTabs">
      <a class="atab active" data-cat="" onclick="window._schoolArticleTab(this, '')">全部</a>
      ${categories.map(c => `<a class="atab" data-cat="${c.id}" onclick="window._schoolArticleTab(this, '${c.id}')">${c.name}</a>`).join('')}
    </div>`;
    content.innerHTML = `<div class="page active">
      ${tabsHtml}
      <div id="schoolArticles"><div class="loading">加载中...</div></div>
    </div>`;
    // 定义tab切换函数
    window._schoolArticleTab = async function(el, catId) {
      const tabs = document.querySelectorAll('#schoolArticleTabs .atab');
      tabs.forEach(t => t.classList.toggle('active', t === el));
      const box = document.getElementById('schoolArticles');
      box.innerHTML = '<div class="loading">加载中...</div>';
      try {
        const params = catId ? '?categoryId=' + catId : '';
        const res = await App.api('/api/articles' + params);
        if (res.code === 0) {
          const list = res.data.list || res.data || [];
          box.innerHTML = list.length ? list.map(a => `
            <div class="act-card" onclick="Article.show('${a.id}')">
              <img src="${a.cover}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22><rect fill=%22%23ff5a6e%22 width=%22300%22 height=%22300%22/><text x=%22150%22 y=%22160%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2280%22>?</text></svg>'">
              <div class="body">
                <h3>${a.title}</h3>
                <div class="meta"><i class="fas fa-pen"></i> ${a.author} · <i class="fas fa-eye"></i> ${a.views}</div>
                <div class="footer">
                  <span class="meta">${a.category || '资讯广场'}</span>
                  <span class="join-btn">阅读全文</span>
                </div>
              </div>
            </div>
          `).join('') : '<div class="empty"><div class="icon"><i class="fas fa-book"></i></div>暂无文章</div>';
        }
      } catch(e) { box.innerHTML = '<div class="empty">加载失败</div>'; }
    };
    // 默认加载全部文章（"全部"tab 已默认 active）
    const defaultTab = document.querySelector('#schoolArticleTabs .atab.active') || document.querySelector('#schoolArticleTabs .atab');
    if (defaultTab) {
      window._schoolArticleTab(defaultTab, defaultTab.dataset.cat || '');
    } else {
      window._schoolArticleTab(null, '');
    }
  },

  async renderMine() {
    if (!App.user) { Auth.openLogin(); return; }
    const content = document.getElementById('content');
    const u = App.user;
    const profileItems = [
      u.zodiac ? u.zodiac : null,
      u.bloodType ? u.bloodType : null,
      u.birthday ? u.birthday : null,
      u.weight ? u.weight + 'kg' : null,
      u.height ? (String(u.height).includes('cm') ? u.height : u.height + 'cm') : null,
      u.education ? u.education : null,
      u.job ? u.job : null,
      u.income ? Pages._formatIncome(u) : null,
    ].filter(Boolean);
    const extraItems = [];
    if (u.gender === '男') {
      if (u.hasHouse) extraItems.push('<i class="fas fa-home"></i> ' + u.hasHouse);
      if (u.hasCar) extraItems.push('🚗 ' + u.hasCar);
    }
    content.innerHTML = `
      <div class="page active">
        <div class="profile-header">
          <div class="profile-avatar-wrap" onclick="document.getElementById('avatarFileInput').click()">
            <img id="mineAvatar" src="${u.avatar}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22><rect fill=%22%23ff5a6e%22 width=%22300%22 height=%22300%22/><text x=%22150%22 y=%22160%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2280%22>?</text></svg>'">
            <div class="profile-avatar-mask">📷 换头像</div>
          </div>
          <input type="file" id="avatarFileInput" accept="image/*" style="display:none;" onchange="Pages.uploadAvatar(this)">
          <div class="profile-info">
            <div class="name">${u.nickname || '未设置昵称'} <span style="font-size:15px;color:#fff;">ID: ${u.userId || u.id || ''}</span> ${u.vip ? '<span class="vip-badge">VIP' + (u.level || 1) + '</span>' : ''}</div>
            <div class="level">${[u.gender, u.age ? u.age + '岁' : '', u.city].filter(Boolean).join(' · ')} ${u.verified ? '· ✓ 已认证' : ''}</div>
            <div class="stats">
              <div id="mineLikedByCount"><b>${u.likes ? u.likes.length : 0}</b>谁喜欢我</div>
              <div><b>${u.views || 0}</b>谁看过我</div>
              <div><b>${u.level || 1}</b>会员等级</div>
            </div>
          </div>
        </div>
        ${profileItems.length || extraItems.length ? `
        <div style="background:#fff; border-radius:12px; padding:12px 16px; margin-bottom:12px;">
          <div style="font-size:13px; color:var(--text-3); margin-bottom:8px;">个人信息</div>
          <div style="display:flex; flex-wrap:wrap; gap:6px 12px; font-size:13px; color:var(--text-2);">
            ${profileItems.map(t => `<span style="background:#f5f5f5; padding:3px 10px; border-radius:12px;">${t}</span>`).join('')}
            ${extraItems.map(t => `<span style="background:#f5f5f5; padding:3px 10px; border-radius:12px;">${t}</span>`).join('')}
          </div>
        </div>
        ` : ''}
        <div class="menu-grid" id="mineMenuGrid">${Pages._buildMineMenuHtml()}</div>
        <div class="menu-list">
          <div class="item" onclick="Pages.showVip()">VIP特权 <span class="arrow">→</span></div>
          <div class="item" onclick="Pages.showSettings()">账号设置 <span class="arrow">→</span></div>
          <div class="item" onclick="Pages.logout()">退出登录 <span class="arrow">→</span></div>
        </div>
      </div>
    `;
    // 校正“谁喜欢我”计数：调用 /api/me/liked-by，而非 u.likes.length
    (async () => {
      try {
        const res = await App.api('/api/me/liked-by', { method: 'GET' });
        if (res.code === 0 && res.data && Array.isArray(res.data.list)) {
          const el = document.getElementById('mineLikedByCount');
          if (el) el.innerHTML = `<b>${res.data.list.length}</b>谁喜欢我`;
        }
      } catch(e) { console.warn('liked-by count error', e); }
    })();
  },
  _buildMineMenuHtml() {
    // 优先用配置，没有则用默认菜单
    const config = (App._siteConfig && App._siteConfig.mineMenuConfig) || [
      { icon: '/img/mine_icons/edit.png', label: '编辑资料', action: 'editProfile', enabled: true },
      { icon: '/img/mine_icons/messages.png', label: '我的消息', action: 'conversations', enabled: true },
      { icon: '/img/mine_icons/likes.png', label: '我喜欢的', action: 'likes', enabled: true },
      { icon: '/img/mine_icons/liked_by.png', label: '谁喜欢我', action: 'likedBy', enabled: true },
      { icon: '/img/mine_icons/mail.png', label: '站内信', action: 'messages', enabled: true },
      { icon: '/img/mine_icons/activity.png', label: '我的活动', action: 'page:activity', enabled: true }
    ];
    return config.filter(m => m.enabled).map(m => {
      let iconHtml;
      if (m.icon && m.icon.startsWith('<i')) {
        iconHtml = m.icon;
      } else if (m.icon && (m.icon.startsWith('http') || m.icon.startsWith('/'))) {
        iconHtml = '<img src="' + m.icon + '" style="width:100%;height:100%;object-fit:contain;">';
      } else {
        iconHtml = '<span style="font-size:22px;">' + (m.icon || '📋') + '</span>';
      }
      return '<div class="item" onclick="Pages._onMineMenuClick(\'' + m.action + '\')"><div class="icon">' + iconHtml + '</div><div class="label">' + m.label + '</div></div>';
    }).join('');
  },
  _renderMineMenuGrid() {
    const grid = document.getElementById('mineMenuGrid');
    if (!grid) return;
    grid.innerHTML = this._buildMineMenuHtml();
  },
  _onMineMenuClick(action) {
    if (action === 'editProfile') Pages.editProfile();
    else if (action === 'conversations') Pages.showConversations();
    else if (action === 'likes') Pages.showLikes();
    else if (action === 'likedBy') Pages.showLikedBy();
    else if (action === 'messages') Pages.showMessages();
    else if (action.startsWith('page:')) App.switchPage(action.replace('page:', ''));
  },

  // ============ 圈子功能 ============
  _showCircleFab() {
    this._hideCircleFab();
    const fabContainer = document.querySelector('.fab-container');
    if (!fabContainer) return;
    const btn = document.createElement('a');
    btn.id = 'circleFab';
    btn.className = 'fab-btn fab-post';
    btn.setAttribute('onclick', 'Pages._showPostEditor()');
    btn.setAttribute('title', '发帖');
    btn.innerHTML = '<span class="fab-icon" style="background:linear-gradient(135deg,#ff7eb3,#ff6b9d);box-shadow:0 3px 12px rgba(255,107,157,0.3);">✏️</span>';
    fabContainer.prepend(btn);
  },
  _hideCircleFab() {
    const el = document.getElementById('circleFab');
    if (el) el.remove();
  },

  async renderCircle() {
    const content = document.getElementById('content');
    content.innerHTML = `
      <style>
        /* 强制圈子布局样式 - 覆盖所有可能的全局规则 */
        #circleList { padding: 0 0 20px; }
        #circleList .circle-post {
          position: relative !important;
          display: flex !important;
          flex-direction: row !important;
          gap: 12px !important;
          padding: 16px !important;
          background: #fff !important;
          border-bottom: 1px solid #f0f0f0 !important;
          align-items: flex-start !important;
        }
        #circleList .circle-post:last-child { border-bottom: none !important; }
        #circleList .circle-avatar-col {
          flex-shrink: 0 !important;
          width: 44px !important;
        }
        #circleList .circle-avatar-col img {
          width: 44px !important;
          height: 44px !important;
          max-width: 44px !important;
          max-height: 44px !important;
          border-radius: 10px !important;
          object-fit: cover !important;
          display: block !important;
        }
        #circleList .circle-content-col {
          flex: 1 !important;
          min-width: 0 !important;
        }
        #circleList .circle-author {
          font-size: 15px !important;
          font-weight: 600 !important;
          color: #576b95 !important;
          margin-bottom: 4px !important;
        }
        #circleList .circle-text {
          font-size: 15px !important;
          line-height: 1.6 !important;
          color: #333 !important;
          margin-bottom: 8px !important;
          word-break: break-word !important;
        }
        #circleList .circle-images {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 5px !important;
          margin-bottom: 8px !important;
          max-width: 280px !important;
        }
        #circleList .circle-images img {
          width: 100% !important;
          max-width: 100% !important;
          aspect-ratio: 1 !important;
          object-fit: cover !important;
          border-radius: 6px !important;
          cursor: pointer !important;
        }
        #circleList .circle-images.circle-imgs-1 {
          grid-template-columns: 1fr !important;
          max-width: 200px !important;
        }
        #circleList .circle-images.circle-imgs-2 {
          grid-template-columns: 1fr 1fr !important;
          max-width: 190px !important;
        }
        /* 时间行+按钮组：flexbox布局，按钮始终靠右 */
        #circleList .circle-time-row {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          width: 100% !important;
          margin-top: 6px !important;
        }
        #circleList .circle-time { font-size: 12px !important; color: #999 !important; flex-shrink: 0 !important; }
        /* 按钮组：普通flex子元素，不使用绝对定位 */
        #circleList .circle-actions-row {
          display: flex !important;
          align-items: center !important;
          gap: 14px !important;
          flex-shrink: 0 !important;
        }
        #circleList .circle-action-btn {
          display: inline-flex !important;
          align-items: center !important;
          gap: 3px !important;
          font-size: 13px !important;
          color: #666 !important;
          cursor: pointer !important;
          padding: 2px 4px !important;
        }
        #circleList .circle-action-btn.liked { color: #ff5a5f !important; }
      </style>
      <div id="circleList"></div>
      <div id="circleLoading" style="text-align:center;padding:20px;color:#999;">加载中...</div>
    `;
    this._circlePage = 1;
    this._circleLoading = false;
    this._circleNoMore = false;
    this._loadCirclePosts();
    // 显示发帖悬浮按钮
    this._showCircleFab();
    // 滚动到底部时加载更多（支持 #content 容器滚动 和 window 滚动）
    this._circleScrollHandler = () => {
      if (this._circleLoading || this._circleNoMore) return;
      // 判断哪个容器在滚动
      const contentEl = document.getElementById('content');
      let nearBottom = false;
      if (contentEl && contentEl.scrollHeight > contentEl.clientHeight) {
        // #content 容器内部滚动
        nearBottom = contentEl.scrollTop + contentEl.clientHeight >= contentEl.scrollHeight - 120;
      } else {
        // window 滚动
        nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 120;
      }
      if (nearBottom) {
        this._circlePage++;
        this._loadCirclePosts();
      }
    };
    // 绑定滚动事件（使用 addEventListener 避免被覆盖）
    window.removeEventListener('scroll', this._circleScrollHandler);
    window.addEventListener('scroll', this._circleScrollHandler, { passive: true });
    const contentEl = document.getElementById('content');
    if (contentEl) {
      contentEl.removeEventListener('scroll', this._circleScrollHandler);
      contentEl.addEventListener('scroll', this._circleScrollHandler, { passive: true });
    }
  },

  async _loadCirclePosts() {
    if (this._circleLoading || this._circleNoMore) return;
    this._circleLoading = true;
    const loading = document.getElementById('circleLoading');
    if (loading) loading.style.display = 'block';
    try {
      const res = await App.api('/api/circle_posts?page=' + this._circlePage + '&pageSize=20');
      if (res.code !== 0) return App.toast('加载失败');
      const posts = res.data.list || [];
      if (posts.length === 0) {
        this._circleNoMore = true;
        if (loading) loading.textContent = this._circlePage === 1 ? '暂无动态，快来发第一条帖子吧！' : '没有更多了';
        return;
      }
      const list = document.getElementById('circleList');
      posts.forEach(p => {
        // 直接插入模板HTML，避免双重嵌套 .circle-post 导致布局错乱
        list.insertAdjacentHTML('beforeend', this._renderPostItem(p));
      });
      if (posts.length < 20) {
        this._circleNoMore = true;
        if (loading) loading.textContent = '没有更多了';
      }
    } catch(e) {
      App.toast('加载失败');
    } finally {
      this._circleLoading = false;
      if (loading) loading.style.display = 'none';
    }
  },

  _renderPostItem(p) {
    const isLiked = p.likedUsers && p.likedUsers.includes(App.user && App.user.id);
    const imgCount = (p.images && p.images.length) || 0;
    let imgClass = 'circle-images';
    if (imgCount === 1) imgClass += ' circle-imgs-1';
    else if (imgCount === 2) imgClass += ' circle-imgs-2';
    // === 审核状态标识 ===
    const st = p.status || 'approved';
    let auditBadge = '';
    if (st === 'pending') auditBadge = '<span class="audit-badge audit-pending">审核中</span>';
    else if (st === 'rejected') auditBadge = '<span class="audit-badge audit-rejected">已拒绝</span>';
    // 预览评论（最多2条）
    let commentsHtml = '';
    if (p.commentsData && p.commentsData.length) {
      const preview = p.commentsData.slice(0, 2);
      commentsHtml = '<div class="circle-comments-preview">' +
        preview.map(c => '<div class="circle-comment-item"><span class="cc-name">' + this._escapeHtml(c.authorName || '用户') + '</span>：' + this._escapeHtml(c.content) + '</div>').join('') +
        (p.commentsData.length > 2 ? '<div style="color:#999;font-size:12px;margin-top:4px;">查看全部' + p.commentsData.length + '条评论</div>' : '') +
        '</div>';
    }
    // 点赞用户名列表
    let likeNamesHtml = '';
    if (p.likedUsersData && p.likedUsersData.length) {
      const names = p.likedUsersData.slice(0, 5).map(u => this._escapeHtml(u.name || '用户')).join('、');
      likeNamesHtml = '<div class="circle-like-names"><i class="fas fa-heart" style="color:#ff5a5f;margin-right:4px;font-size:12px;"></i>' + names + (p.likedUsersData.length > 5 ? '等' + p.likedUsersData.length + '人' : '') + '觉得赞</div>';
    }
    return `
      <div class="circle-post" data-post-id="${p.id}">
        <div class="circle-avatar-col" onclick="Pages.showUser('${p.authorId || p.userId}')">
          <img src="${p.authorAvatar || '/h5/avatar_default.png'}" onerror="this.src='/h5/avatar_default.png'">
        </div>
        <div class="circle-content-col">
          <div class="circle-author" onclick="Pages.showUser('${p.authorId || p.userId}')">${this._escapeHtml(p.authorName || '未知用户')}</div>
          <div class="circle-text" onclick="Pages._showComments('${p.id}')" style="cursor:pointer">${this._escapeHtml(p.content).replace(/\n/g, '<br>')}</div>
          ${imgCount > 0 ? `<div class="${imgClass}">${p.images.map(img => '<img src="' + img + '" onclick="Pages._previewImage(\'' + img + '\',\'' + p.images.join(',') + '\')">').join('')}</div>` : ''}
          ${p.video ? `<div class="circle-video-wrap" style="margin-bottom:8px;max-width:280px;border-radius:8px;overflow:hidden;"><video src="${p.video}" controls preload="metadata" style="width:100%;max-height:240px;background:#000;" poster="${(p.images && p.images[0]) || ''}"></video></div>` : ''}
          ${likeNamesHtml}
          ${commentsHtml}
          <div class="circle-time-row">
            <span class="circle-time">${this._formatTime(p.createdAt)}</span>
            ${auditBadge}
            <div class="circle-actions-row">
              <span class="circle-action-btn like-btn ${isLiked ? 'liked' : ''}" onclick="Pages._toggleLike('${p.id}')">
                <i class="fas fa-heart"></i> <span class="like-count">${p.likes || 0}</span>
              </span>
              <span class="circle-action-btn comment-btn" onclick="Pages._showComments('${p.id}')">
                <i class="fas fa-comment"></i> ${p.comments || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
    if (diff < 604800) return Math.floor(diff / 86400) + '天前';
    return d.toLocaleDateString();
  },

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML.replace(/\n/g, '<br>');
  },

  async _toggleLike(postId) {
    if (!App.user) return Auth.openLogin();
    const res = await App.api('/api/circle_like', { method: 'POST', body: { postId } });
    if (res.code !== 0) return App.toast(res.msg);
    // 更新UI
    const postEl = document.querySelector('[data-post-id="' + postId + '"]');
    if (postEl) {
      const likeBtn = postEl.querySelector('.like-btn');
      const countSpan = postEl.querySelector('.like-count');
      if (likeBtn) {
        likeBtn.classList.toggle('liked', res.data.liked);
      }
      if (countSpan) {
        countSpan.textContent = res.data.likes;
      }
    }
  },

  /* ===== 全屏发布编辑器（朋友圈风格）===== */
  _postMedia: [],   // [{type:'image',url,dataURL}, {type:'video',url,file}]

  async _showPostEditor() {
    if (!App.user) return Auth.openLogin();
    this._postMedia = [];
    const overlay = document.createElement('div');
    overlay.id = 'circlePostOverlay';
    overlay.innerHTML = `
      <style>
        #circlePostOverlay {
          position:fixed;top:0;left:0;width:100%;height:100%;
          background:#fff;z-index:99999;display:flex;flex-direction:column;
        }
        .cp-header {
          display:flex;justify-content:space-between;align-items:center;
          padding:12px 16px;border-bottom:1px solid #eee;
          background:#fff;position:-webkit-sticky;position:sticky;top:0;z-index:10;
        }
        .cp-cancel { font-size:16px;color:#333;background:none;border:none;padding:8px 4px;cursor:pointer; }
        .cp-publish { font-size:16px;color:#ccc;background:none;border:none;padding:8px 16px;cursor:pointer;font-weight:600; }
        .cp-publish.active { color:#ff5a5f; }
        .cp-body { flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column; }
        .cp-textarea {
          width:100%;min-height:150px;border:none;outline:none;resize:none;
          font-size:16px;line-height:1.6;color:#333;background:transparent;
          placeholder-color:#999;
        }
        .cp-textarea::placeholder { color:#bbb; }
        .cp-media-area { margin-top:20px; }
        .cp-media-grid { display:flex;flex-wrap:wrap;gap:8px; }
        .cp-media-item {
          position:relative;width:78px;height:78px;border-radius:6px;
          overflow:hidden;flex-shrink:0;
        }
        .cp-media-item img,.cp-media-item video { width:100%;height:100%;object-fit:cover; }
        .cp-media-del {
          position:absolute;top:2px;right:2px;width:20px;height:20px;
          background:rgba(0,0,0,0.55);color:#fff;border-radius:50%;
          border:none;font-size:13px;text-align:center;line-height:20px;
          cursor:pointer;z-index:2;
        }
        .cp-add-btn {
          width:78px;height:78px;border:1px dashed #ccc;border-radius:6px;
          display:flex;align-items:center;justify-content:center;
          background:#fafafa;cursor:pointer;box-sizing:border-box;flex-shrink:0;
        }
        .cp-add-btn svg { width:28px;height:28px;stroke:#999; }
        .cp-add-btn:active { background:#f0f0f0; }
        #cpFileInput { display:none; }
      </style>
      <div class="cp-header">
        <button class="cp-cancel" id="cpCancelBtn">取消</button>
        <button class="cp-publish" id="cpPublishBtn">发表</button>
      </div>
      <div class="cp-body">
        <textarea class="cp-textarea" id="cpTextarea" placeholder="这一刻的想法..." maxlength="500"></textarea>
        <div class="cp-media-area">
          <div class="cp-media-grid" id="cpMediaGrid"></div>
          <div class="cp-add-btn" id="cpAddBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
        </div>
        <input type="file" id="cpFileInput" accept="image/*,video/*" multiple>
      </div>
    `;
    document.body.appendChild(overlay);

    const textarea = document.getElementById('cpTextarea');
    const pubBtn = document.getElementById('cpPublishBtn');
    const cancelBtn = document.getElementById('cpCancelBtn');
    const addBtn = document.getElementById('cpAddBtn');
    const fileInput = document.getElementById('cpFileInput');
    const mediaGrid = document.getElementById('cpMediaGrid');

    // 发布按钮状态（有内容才高亮）
    const updatePubState = () => {
      const hasContent = textarea.value.trim() || this._postMedia.length > 0;
      pubBtn.classList.toggle('active', hasContent);
    };
    textarea.addEventListener('input', updatePubState);

    // 取消
    cancelBtn.onclick = () => {
      if (textarea.value.trim() || this._postMedia.length > 0) {
        if (!confirm('确定放弃编辑的内容吗？')) return;
      }
      overlay.remove();
    };

    // 发表
    pubBtn.onclick = () => this._submitPost(textarea, overlay);

    // 添加媒体（批量处理，严格限制数量）
    addBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const files = Array.from(e.target.files);
      const maxImages = 9;
      const imgCount = this._postMedia.filter(m => m.type === 'image').length;
      const hasVideo = this._postMedia.some(m => m.type === 'video');

      // 先按类型分类
      const images = files.filter(f => f.type.startsWith('image/'));
      const videos = files.filter(f => f.type.startsWith('video/'));

      // 严格校验
      if (hasVideo && (images.length > 0 || videos.length > 0)) {
        App.toast('视频和图片不能同时添加');
        fileInput.value = '';
        return;
      }
      if (videos.length > 1) {
        App.toast('最多添加1个视频');
        fileInput.value = '';
        return;
      }
      if (images.length > 0 && imgCount + images.length > maxImages) {
        App.toast('最多添加' + maxImages + '张图片（还能选' + Math.max(0, maxImages - imgCount) + '张）');
        // 只取能放下的数量
        images.splice(maxImages - imgCount);
      }

      // 逐个处理（异步读取）
      [...images, ...videos].forEach(f => this._handleMediaFile(f));
      fileInput.value = '';
    };
  },

  // 处理单个媒体文件
  _handleMediaFile(file) {
    const isVideo = file.type.startsWith('video/');

    const reader = new FileReader();
    reader.onload = (e) => {
      const item = {
        type: isVideo ? 'video' : 'image',
        dataURL: e.target.result,
        file: file,
        name: file.name
      };
      this._postMedia.push(item);
      this._refreshMediaGrid();
    };
    reader.readAsDataURL(file);
  },

  // 刷新媒体预览网格
  _refreshMediaGrid() {
    const grid = document.getElementById('cpMediaGrid');
    if (!grid) return;
    grid.innerHTML = this._postMedia.map((m, i) => `
      <div class="cp-media-item">
        ${m.type === 'image'
          ? `<img src="${m.dataURL}">`
          : `<video src="${m.dataURL}" muted></video>`
        }
        <button class="cp-media-del" onclick="Pages._removePostMedia(${i})">&times;</button>
      </div>
    `).join('');

    // 动态控制 + 按钮和文件选择器的状态
    const addBtn = document.getElementById('cpAddBtn');
    const fileInput = document.getElementById('cpFileInput');
    const imgCount = this._postMedia.filter(m => m.type === 'image').length;
    const hasVideo = this._postMedia.some(m => m.type === 'video');

    if (addBtn && fileInput) {
      if (hasVideo) {
        // 已有视频：隐藏+按钮（不能再添加任何媒体）
        addBtn.style.display = 'none';
        fileInput.accept = '';
      } else if (imgCount >= 9) {
        // 已有9张图片：隐藏+按钮
        addBtn.style.display = 'none';
        fileInput.accept = 'image/*';
      } else {
        // 正常显示+按钮
        addBtn.style.display = 'flex';
        fileInput.accept = 'image/*,video/*';
      }
    }

    // 更新发布按钮状态
    const pubBtn = document.getElementById('cpPublishBtn');
    const textarea = document.getElementById('cpTextarea');
    if (pubBtn && textarea) {
      const hasContent = textarea.value.trim() || this._postMedia.length > 0;
      pubBtn.classList.toggle('active', hasContent);
    }
  },

  // 删除已选媒体
  _removePostMedia(index) {
    this._postMedia.splice(index, 1);
    this._refreshMediaGrid();
  },

  // 提交帖子（上传媒体+发布）
  async _submitPost(textareaEl, overlay) {
    const content = textareaEl.value.trim();
    if (!content && this._postMedia.length === 0) return App.toast('请输入内容或添加图片/视频');
    if (content && content.length > 500) return App.toast('内容不能超过500字');

    const pubBtn = document.getElementById('cpPublishBtn');
    pubBtn.textContent = '发布中...';
    pubBtn.disabled = true;

    try {
      // 上传所有图片
      let imageUrls = [];
      let videoUrl = '';

      for (const m of this._postMedia) {
        if (m.type === 'image') {
          const res = await App.api('/api/admin/upload', {
            method: 'POST',
            body: { image: m.dataURL, subdir: 'uploads' }
          });
          if (res.code !== 0) throw new Error('图片上传失败: ' + (res.msg || '?'));
          imageUrls.push(res.data.url);
        } else if (m.type === 'video') {
          // 视频转base64上传
          const videoBase64 = await this._videoToBase64(m.file);
          const res = await App.api('/api/admin/upload', {
            method: 'POST',
            body: { image: videoBase64, subdir: 'uploads' }
          });
          if (res.code !== 0) throw new Error('视频上传失败: ' + (res.msg || '?'));
          videoUrl = res.data.url;
        }
      }

      // 发布帖子
      const res = await App.api('/api/circle_post', {
        method: 'POST',
        body: {
          content: content || '(分享了一张' + (videoUrl ? '视频' : '图片') + ')',
          images: imageUrls,
          video: videoUrl || undefined
        }
      });

      if (res.code !== 0) throw new Error(res.msg || '发布失败');

      App.toast('✅ 发布成功！');
      overlay.remove();

      // 刷新圈子列表
      this._circlePage = 1;
      this._circleNoMore = false;
      const list = document.getElementById('circleList');
      if (list) list.innerHTML = '';
      this._loadCirclePosts();
    } catch(e) {
      App.toast(e.message || '发布失败，请重试');
      pubBtn.textContent = '发表';
      pubBtn.disabled = false;
    }
  },

  // 视频文件转base64
  _videoToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  async _showComments(postId, silent) {
    try {
    // 页面跳转后滚动到顶部
    window.scrollTo(0, 0);
    const contentEl = document.getElementById('content');
    if (contentEl) contentEl.scrollTop = 0;
    // 参数验证：如果没有 postId，尝试从 URL hash 获取
    if (!postId) {
      const hash = window.location.hash.replace('#', '');
      if (hash.startsWith('post?id=')) {
        postId = decodeURIComponent(hash.replace('post?id=', ''));
      }
    }
    if (!postId) {
      if (!silent) App.toast('帖子ID缺失，请返回重试');
      App.switchPage('circle');
      return;
    }
    // 保存当前 postId 到实例变量，供后续使用
    this._currentPostId = postId;
    // 更新URL hash（仅当hash变化时才更新，避免递归）
    const newHash = 'post?id=' + postId;
    if (window.location.hash !== '#' + newHash) {
      window.location.hash = newHash;
    }
    // 加载帖子详情和评论
    const res = await App.api('/api/circle_post_detail?id=' + postId);
    if (!res || res.code !== 0) { if (!silent) App.toast((res && res.msg) || '加载失败：网络异常'); return; }
    const post = res.data;
    if (!post) { if (!silent) App.toast('帖子数据异常'); return; }

    // ===== 数据安全校验：确保所有字段都有默认值 =====
    const safePost = {
      id: postId,
      authorId: String(post.authorId || post.userId || ''),
      authorName: String(post.authorName || '未知用户'),
      authorAvatar: String(post.authorAvatar || ''),
      content: String(post.content || ''),
      images: Array.isArray(post.images) ? post.images : [],
      video: post.video || '',
      createdAt: post.createdAt || Date.now(),
      likes: Number(post.likes || 0),
      likeCount: Number(post.likeCount || post.likes || 0),
      comments: Number(post.comments || 0),
      commentCount: Number(post.commentCount || post.comments || 0),
      likedUsers: Array.isArray(post.likedUsers) ? post.likedUsers : [],
      likeList: Array.isArray(post.likeList) ? post.likeList : [],
      commentList: Array.isArray(post.commentList) ? post.commentList : [],
    };
    // 构建详情页HTML - 参考图1样式重写
    let html = '';
    html += '<div class="cpd-wrap"><style>';
    /* ===== 帖子详情页全新样式（参考图1） ===== */
    html += '.cpd-wrap{background:#fff;min-height:100vh;}';
    /* 头部返回栏 */
    html += '.cpd-header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fff;position:sticky;top:0;z-index:10;border-bottom:1px solid #f5f5f5;}';
    html += '.cpd-back{font-size:14px;color:#666;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;}';
    html += '.cpd-back i{font-size:16px;}';
    /* 日期+统计行 */
    html += '.cpd-meta-row{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 8px;}';
    html += '.cpd-date{font-size:15px;color:#999;}';
    html += '.cpd-stats{display:flex;gap:16px;font-size:14px;color:#999;}';
    html += '.cpd-stats span{display:flex;align-items:center;gap:4px;}';
    /* 赞头像区 */
    html += '.cpd-like-section{padding:8px 16px 12px;display:flex;align-items:center;gap:10px;}';
    html += '.cpd-like-label{font-size:15px;color:#999;flex-shrink:0;}';
    html += '.cpd-like-avatars{display:flex;flex-wrap:wrap;gap:8px;flex:1;}';
    html += '.cpd-like-avatar{width:32px;height:32px;border-radius:50%;object-fit:cover;background:#f0f0f0;flex-shrink:0;}';
    /* 分割线 */
    html += '.cpd-divider{height:1px;background:#f5f5f5;margin:0 16px;}';
    /* 评论区 */
    html += '.cpd-comment-section{padding:4px 16px 100px;}'; /* 底部留输入框空间 */
    html += '.cpd-comment-item{display:flex;gap:10px;padding:12px 0;}';
    html += '.cpd-comment-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#f0f0f0;}';
    html += '.cpd-comment-body{flex:1;min-width:0;}';
    html += '.cpd-comment-name{font-size:14px;font-weight:500;color:#333;margin-bottom:2px;}';
    html += '.cpd-comment-text{font-size:14px;color:#333;line-height:1.6;word-break:break-word;}';
    html += '.cpd-comment-time{font-size:13px;color:#999;margin-top:4px;text-align:right;}';
    /* 评论输入框 */
    html += '.cpd-input-bar{position:fixed;bottom:0;left:0;right:0;display:flex;gap:8px;padding:10px 16px;background:#fff;border-top:1px solid #eee;z-index:100;padding-bottom:calc(10px + env(safe-area-inset-bottom));}';
    html += '.cpd-input-bar input{flex:1;border:1px solid #e0e0e0;border-radius:20px;padding:9px 16px;font-size:14px;outline:none;background:#f8f8f8;}';
    html += '.cpd-input-bar input:focus{border-color:#ff6b9d;background:#fff;}';
    html += '.cpd-input-bar button{background:linear-gradient(135deg,#ff7eb3,#ff6b9d);color:#fff;border:none;border-radius:20px;padding:9px 22px;font-size:14px;font-weight:500;cursor:pointer;white-space:nowrap;}';
    /* 喜欢TA按钮 */
    html += '.cpd-like-author-btn{margin-left:auto;flex-shrink:0;background:#fff;border:1.5px solid #ff6b9d;color:#ff6b9d;border-radius:20px;padding:7px 16px;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:4px;transition:all .2s;}';
    html += '.cpd-like-author-btn:hover,.cpd-like-author-btn:active{background:#ff6b9d;color:#fff;}';
    html += '.cpd-like-author-btn.liked{background:#ff6b9d;color:#fff;border-color:#ff6b9d;}';
    /* 内容文字 */
    html += '.cpd-content{padding:0 16px 8px;font-size:15px;line-height:1.7;color:#333;word-break:break-word;}';
    html += '</style>';
    // ★ 头部：返回按钮
    html += '<div class="cpd-header">';
    html += '  <span class="cpd-back" onclick="App.switchPage(\'circle\')"><i class="fas fa-arrow-left"></i> 返回</span>';
    html += '</div>';

    // ★ 作者信息行（昵称 + 喜欢TA按钮）— 点击头像/昵称跳转主页
    const authorId = safePost.authorId;
    html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 16px 6px;">';
    const authAvatar = safePost.authorAvatar;
    const authName = this._escapeHtml(safePost.authorName.charAt(0));
    const authFullName = this._escapeHtml(safePost.authorName);
    // 双元素方案：img + 隐藏span备用，onerror只做简单的display切换，彻底避免引号嵌套
    if (authAvatar && authAvatar.length > 5) {
      html += '  <div style="position:relative;width:36px;height:36px;flex-shrink:0;cursor:pointer;" onclick="Pages.showUser(\'' + authorId + '\')">';
      html += '    <img src="' + authAvatar + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;display:block;" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">';
      html += '    <span style="display:none;width:36px;height:36px;border-radius:50%;background:#f0f0f0;color:#999;align-items:center;justify-content:center;font-size:14px;font-weight:600;position:absolute;top:0;left:0;">' + authName + '</span>';
      html += '  </div>';
    } else {
      html += '  <span style="width:36px;height:36px;border-radius:50%;background:#f0f0f0;color:#999;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex-shrink:0;cursor:pointer;" onclick="Pages.showUser(\'' + authorId + '\')">' + authName + '</span>';
    }
    html += '  <span style="font-size:15px;font-weight:600;color:#333;cursor:pointer;" onclick="Pages.showUser(\'' + authorId + '\')">' + authFullName + '</span>';
    const liked = (App.user && App.user.likes && App.user.likes.includes(authorId)) || false;
    html += '<button class="cpd-like-author-btn ' + (liked ? 'liked' : '') + '" onclick="Pages._likePostAuthor(\'' + authorId + '\', this)">♥ 喜欢TA</button>';
    html += '</div>';

    // ★ 审核状态提示（作者/管理员可见）
    const postSt = safePost.status || 'approved';
    if (postSt !== 'approved') {
      if (postSt === 'pending') {
        html += '<div class="cpd-audit-notice pending">⏳ 帖子审核中，审核通过后会对外展示</div>';
      } else if (postSt === 'rejected') {
        html += '<div class="cpd-audit-notice rejected">❌ 帖子未通过审核' + (safePost.auditMsg ? '：' + this._escapeHtml(safePost.auditMsg) : '') + '</div>';
      }
    }

    // ★ 图片（两侧留边，跟列表页一样用网格展示，点击预览）
    if (safePost.images.length > 0) {
      // 单张图：宽幅展示（但两侧留16px边距）
      if (safePost.images.length === 1) {
        const safeSrc = safePost.images[0].replace(/'/g, "\\'");
        html += '<div style="padding:2px 16px 8px;"><img src="' + safePost.images[0] + '" onclick="Pages._previewImage(\'' + safeSrc + '\',\'' + safePost.images.join(',') + '\')" style="width:100%;border-radius:8px;display:block;"></div>';
      } else {
        // 多张图：3列网格（跟帖子列表页一致）
        html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:2px 16px 8px;">';
        safePost.images.forEach(img => {
          const s = img.replace(/'/g, "\\'");
          html += '<img src="' + img + '" onclick="Pages._previewImage(\'' + s + '\',\'' + safePost.images.join(',') + '\')" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:4px;cursor:pointer;display:block;">';
        });
        html += '</div>';
      }
    }

    // ★ 视频（两侧留边）
    if (safePost.video) {
      html += '<div style="padding:2px 16px 8px;"><video src="' + safePost.video + '" controls preload="metadata" poster="' + (safePost.images[0] || '') + '" style="width:100%;border-radius:8px;background:#000;"></video></div>';
    }

    // ★ 文字内容
    if (safePost.content.trim()) {
      html += '<div class="cpd-content">' + this._escapeHtml(safePost.content).replace(/\n/g, '<br>') + '</div>';
    }

    // ★ 日期 + 点赞/评论统计行
    const dateStr = this._formatDetailDate(safePost.createdAt) || '';
    html += '<div class="cpd-meta-row">';
    html += '  <span class="cpd-date">' + dateStr + '</span>';
    html += '  <div class="cpd-stats">';
    html += '    <span style="cursor:pointer;display:flex;align-items:center;gap:4px;" onclick="Pages._togglePostLike(\'' + postId + '\', this)"><i class="far fa-thumbs-up"></i> ' + safePost.likeCount + '</span>';
    html += '    <span style="cursor:pointer;display:flex;align-items:center;gap:4px;" onclick="document.getElementById(\'commentInput\')?.focus()"><i class="far fa-comment"></i> ' + safePost.commentCount + '</span>';
    html += '  </div>';
    html += '</div>';

    // ★ 赞区：点赞用户头像列表
    const likers = safePost.likeList;
    html += '<div class="cpd-like-section">';
    html += '  <span class="cpd-like-label">赞</span>';
    html += '  <div class="cpd-like-avatars">';
    if (likers.length > 0) {
      likers.forEach(l => {
        const lavatar = (l.avatar || l.userAvatar || '');
        const lnick = this._escapeHtml((l.nickname || l.userName || '?').charAt(0));
        const ltitle = this._escapeHtml(l.nickname || l.userName || '');
        if (lavatar && lavatar.length > 5) {
          const ls = lavatar.replace(/'/g, "\\'");
          html += '<div style="position:relative;width:32px;height:32px;flex-shrink:0;">';
          html += '<img class="cpd-like-avatar" src="' + ls + '" style="display:block;" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'" title="' + ltitle + '">';
          html += '<span class="cpd-like-avatar" style="display:none;position:absolute;top:0;left:0;background:#f0f0f0;color:#999;font-size:13px;font-weight:600;">' + lnick + '</span>';
          html += '</div>';
        } else {
          html += '<span class="cpd-like-avatar" style="display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#999;font-size:13px;font-weight:600;" title="' + ltitle + '">' + lnick + '</span>';
        }
      });
    } else {
      html += '<span style="color:#ccc;font-size:13px;">暂无点赞</span>';
    }
    html += '  </div>';
    html += '</div>';

    // ★ 分割线
    html += '<div class="cpd-divider"></div>';

    // ★ 评区：评论列表
    const comments = safePost.commentList;
    html += '<div class="cpd-comment-section">';
    comments.forEach(c => {
      html += '<div class="cpd-comment-item">';
      const cAvatar = (c.userAvatar || c.avatar || '');
      const cName = this._escapeHtml((c.userName || '未知').charAt(0));
      if (cAvatar && cAvatar.length > 5) {
        html += '<div style="position:relative;width:36px;height:36px;flex-shrink:0;">';
        html += '  <img class="cpd-comment-avatar" src="' + cAvatar + '" style="display:block;" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'">';
        html += '  <span class="cpd-comment-avatar" style="display:none;position:absolute;top:0;left:0;background:#f0f0f0;color:#999;font-size:13px;font-weight:600;">' + cName + '</span>';
        html += '</div>';
      } else {
        html += '  <span class="cpd-comment-avatar" style="display:flex;align-items:center;justify-content:center;background:#f0f0f0;color:#999;font-size:13px;font-weight:600;">' + cName + '</span>';
      }
      html += '  <div class="cpd-comment-body">';
      html += '    <div class="cpd-comment-name">' + (c.userName || c.nickname || '未知用户') + '：</div>';
      html += '    <div class="cpd-comment-text">' + this._escapeHtml(c.content).replace(/\n/g, '<br>') + '</div>';
      html += '    <div class="cpd-comment-time">' + this._formatTimeAgo(c.createdAt) + '</div>';
      html += '  </div>';
      html += '</div>';
    });
    if (!comments.length) {
      html += '<div style="text-align:center;padding:30px 0;color:#999;font-size:14px;">暂无评论，来说点什么吧~</div>';
    }
    html += '</div>'; // .cpd-comment-section

    // ★ 评论输入框（底部固定）
    html += '<div class="cpd-input-bar">';
    html += '  <input type="text" id="commentInput" placeholder="写下你的评论...">';
    html += '  <button onclick="Pages._submitComment(\'' + postId + '\')">发送</button>';
    html += '</div>';

    html += '</div>'; // .cpd-wrap
    // 渲染到页面
    const content = document.getElementById('content');
    content.innerHTML = html;
    // 滚动到顶部
    content.scrollTop = 0;
    } catch(e) {
      console.error('_showComments error:', e.message, e.stack);
      if (!silent) App.toast('加载失败：' + (e.message || '未知错误'));
    }
  },

  /* 格式化详情页日期：YYYY-MM-DD */
  _formatDetailDate(ts) {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    } catch(e) { return ''; }
  },

  /* 格式化相对时间（用于评论） */
  _formatTimeAgo(ts) {
    try {
      const now = Date.now();
      const diff = now - new Date(ts).getTime();
      if (diff < 60000) return '刚刚';
      if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
      if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
      if (diff < 2592000000) return Math.floor(diff / 86400000) + '天前';
      // 超过一个月显示日期
      const d = new Date(ts);
      return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    } catch(e) { return ''; }
  },

  async _submitComment(postId) {
    if (!App.user) return Auth.openLogin();
    // 如果没有传入 postId，使用保存的当前帖子ID
    if (!postId) postId = this._currentPostId;
    if (!postId) return App.toast('缺少帖子ID，请返回重试');
    const input = document.getElementById('commentInput');
    if (!input || !input.value.trim()) return App.toast('请输入评论内容');
    try {
      const res = await App.api('/api/circle_comment', { method: 'POST', body: { postId, content: input.value } });
      if (res.code !== 0) return App.toast(res.msg);
      App.toast('评论成功');
      input.value = '';
      // 重新加载详情页（silent模式：失败不弹toast，不影响已成功的评论体验）
      this._showComments(postId, true).catch(() => {});
    } catch(e) {
      App.toast('网络异常，请重试');
    }
  },

  /* 喜欢TA按钮：在帖子详情页点击喜欢作者 */
  _likePostAuthor(authorId, btnEl) {
    if (!App.user) return Auth.openLogin();
    // 调用现有的 likeUser 方法
    this.likeUser(authorId, null);
    // 切换按钮状态
    if (btnEl) {
      btnEl.classList.toggle('liked');
      const icon = btnEl.querySelector('i');
      if (btnEl.classList.contains('liked')) {
        App.toast('已喜欢 ❤️');
      } else {
        App.toast('已取消喜欢');
      }
    }
  },

  /* 帖子详情页：点赞/取消点赞帖子 */
  async _togglePostLike(postId, spanEl) {
    if (!App.user) return Auth.openLogin();
    try {
      const res = await App.api('/api/circle_like', { method: 'POST', body: { postId } });
      if (res.code !== 0) return App.toast(res.msg || '操作失败');
      // 更新数字显示
      if (spanEl) {
        const numSpan = spanEl;
        const currentNum = parseInt(numSpan.textContent.trim()) || 0;
        const newNum = Math.max(0, currentNum + (res.data.liked ? 1 : -1));
        numSpan.innerHTML = '<i class="fas fa-thumbs-up"></i> ' + newNum;
        // 切换图标样式
        const icon = numSpan.querySelector('i');
        if (icon) {
          icon.className = res.data.liked ? 'fas fa-thumbs-up' : 'far fa-thumbs-up';
          icon.style.color = res.data.liked ? '#ff6b9d' : '';
        }
      }
      App.toast(res.data.liked ? '点赞成功 👍' : '已取消点赞');
    } catch(e) { App.toast('操作失败'); }
  },

  async showMessages() {
    // 更新URL hash（仅当hash变化时才更新，避免递归）
    const newHash = 'messages';
    if (window.location.hash !== '#' + newHash) {
      window.location.hash = newHash;
    }
    if (!App.user) return Auth.openLogin();
    const res = await App.api('/api/me/messages');
    if (res.code !== 0) return App.toast('加载失败');
    const msgs = res.data.list || [];
    this._allMessages = msgs;
    const content = document.getElementById('content');
    const unreadCount = msgs.filter(m => !m.read).length;
    App._unreadCount = unreadCount;
    App.updateMessageBadge();

    content.innerHTML = `
      <div class="page active">
        <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">📨 站内信 <span style="font-size:12px;color:var(--text-3);font-weight:400;">共 ${msgs.length} 条 · 未读 ${unreadCount} 条</span></div>
        <div class="msg-filter-bar">
          <button class="msg-filter-btn active" data-filter="all" onclick="Pages._filterMessages(this,'all')">全部</button>
          <button class="msg-filter-btn" data-filter="unread" onclick="Pages._filterMessages(this,'unread')">未读 (${unreadCount})</button>
          <button class="msg-filter-btn" data-filter="read" onclick="Pages._filterMessages(this,'read')">已读</button>
        </div>
        <div id="msgListContainer">
        ${msgs.length === 0 ? '<div class="empty"><div class="icon">📭</div>暂无站内信</div>' :
          msgs.map(m => `
            <div class="msg-item ${m.read ? '' : 'unread'}" data-read="${m.read}" onclick="Pages.markMessageRead('${m.id}')">
              <div style="display:flex;align-items:flex-start;gap:8px;">
                ${!m.read ? '<span style="width:8px;height:8px;background:var(--primary);border-radius:50%;flex-shrink:0;margin-top:7px;"></span>' : '<span style="width:8px;flex-shrink:0;"></span>'}
                <div style="flex:1;">
                  <div class="msg-content">${m.content}</div>
                  <div class="msg-time">${new Date(m.createdAt).toLocaleString('zh-CN')}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <div style="text-align:center;margin-top:12px;">
          <button class="btn btn-sm" onclick="Pages.markMessageRead()">全部标为已读</button>
        </div>
      </div>
    `;
    // 绑定筛选
    window._currentMsgFilter = 'all';
  },
  _filterMessages(el, filter) {
    window._currentMsgFilter = filter;
    document.querySelectorAll('.msg-filter-btn').forEach(b => b.classList.toggle('active', b === el));
    const container = document.getElementById('msgListContainer');
    if(!container || !this._allMessages) return;
    const filtered = filter === 'all' ? this._allMessages
      : filter === 'unread' ? this._allMessages.filter(m => !m.read)
      : this._allMessages.filter(m => m.read);
    container.innerHTML = filtered.length ? filtered.map(m => `
      <div class="msg-item ${m.read?'':'unread'}" onclick="Pages.markMessageRead('${m.id}')">
        <div style="display:flex;align-items:flex-start;gap:8px;">
          ${!m.read ? '<span style="width:8px;height:8px;background:var(--primary);border-radius:50%;flex-shrink:0;margin-top:7px;"></span>' : '<span style="width:8px;flex-shrink:0;"></span>'}
          <div style="flex:1;"><div class="msg-content">${m.content}</div><div class="msg-time">${new Date(m.createdAt).toLocaleString('zh-CN')}</div></div>
        </div>
      </div>`).join('') : '<div class="empty"><div class="icon">📭</div>暂无消息</div>';
  },

  async markMessageRead(messageId) {
    await App.api('/api/me/messages/read', { method: 'POST', body: messageId ? { messageId } : {} });
    if (App._unreadCount > 0 && messageId) App._unreadCount--;
    App.updateMessageBadge();
    this.showMessages();
  },

  async uploadAvatar(input) {
    if (!App.user) { Auth.openLogin(); return; }
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//i.test(file.type)) { App.toast('请选择图片文件'); input.value = ''; return; }
    if (file.size > 8 * 1024 * 1024) { App.toast('图片不能超过 8MB'); input.value = ''; return; }
    App.toast('正在处理图片...');
    try {
      const dataUrl = await this._compressImage(file, 400, 0.85);
      const res = await App.api('/api/upload/avatar', { method: 'POST', body: { image: dataUrl } });
      input.value = '';
      if (res.code === 0) {
        // 同时更新本地 App.user（避免还要重新拉 /api/me）
        App.user.avatar = res.data.url + '?t=' + Date.now();
        const img = document.getElementById('mineAvatar');
        if (img) img.src = App.user.avatar;
        // 同步更新顶部导航栏头像（如果存在）
        const topAvatar = document.querySelector('.topbar-avatar');
        if (topAvatar) topAvatar.src = App.user.avatar;
        App.toast('头像已更新');
      } else {
        App.toast(res.msg || '上传失败');
      }
    } catch (e) {
      App.toast('上传失败：' + e.message);
      input.value = '';
    }
  },
  _compressImage(file, maxSize, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          // 居中裁剪为正方形，再缩放到 maxSize
          const w = img.width, h = img.height;
          const side = Math.min(w, h);
          const canvas = document.createElement('canvas');
          canvas.width = maxSize; canvas.height = maxSize;
          const ctx = canvas.getContext('2d');
          // 圆形裁剪
          ctx.beginPath();
          ctx.arc(maxSize / 2, maxSize / 2, maxSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, maxSize, maxSize);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('图片读取失败'));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  },

  // 收入格式化：显示币种符号
  _formatIncome(u) {
    const income = u.income || (u.form && u.form.income) || '';
    if (!income) return '保密';
    const currency = u.incomeCurrency || u.salaryCurrency || 'CNY';
    const symbol = currency === 'USD' ? '$' : '￥';
    // 去掉可能已存在的币种符号（兼容旧数据）
    const cleanIncome = income.replace(/^[$￥]/, '');
    return symbol + cleanIncome + '/年';
  },

  userCard(u, mode) {
    const f = u.form || {};
    const age = u.age || f.age || '';
    const city = u.city || f.currentCity || '';
    const job = u.job || f.job || '';
    const isLiked = mode === 'liked';
    const btnIcon = isLiked ? '<i class="fas fa-heart-broken"></i>' : '<i class="fas fa-heart"></i>';
    const btnText = isLiked ? '不喜欢了' : '喜欢TA';
    const btnClass = 'like' + (isLiked ? ' liked' : '');
    const btnAction = isLiked
      ? `event.stopPropagation();if(confirm('确定取消喜欢？'))Pages.unlikeUser('${u.id}',this)`
      : `event.stopPropagation();Pages.likeUser('${u.id}',this)`;
    return `<div class="grid-card" onclick="Pages.showUser('${u.id}')">
      <img src="${u.avatar}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22><rect fill=%22%23ff5a6e%22 width=%22300%22 height=%22300%22/><text x=%22150%22 y=%22160%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2280%22>?</text></svg>'">
      ${u.vip ? '<div class="vip-tag">★ VIP' + (u.level || 1) + '</div>' : ''}
      <div class="info">
        <div class="name">${u.nickname}</div>
        <div class="meta">${age ? age + '岁' : ''}${age && city ? ' · ' : ''}${city}${job ? ' · ' + job : ''}</div>
        <button class="${btnClass}" onclick="${btnAction}">
          <span class="lb-icon">${btnIcon}</span>
          <span class="lb-text">${btnText}</span>
        </button>
      </div>
    </div>`;
  },

  async showUser(id) {
    // 页面跳转后滚动到顶部
    window.scrollTo(0, 0);
    const content = document.getElementById('content');
    if (content) content.scrollTop = 0;
    // 先用内部ID获取用户数据
    const res = await App.api('/api/users/' + id);
    if (res.code !== 0) return App.toast('用户不存在');
    const u = res.data;
    // 用交友ID(userId)作为URL标识，使地址更友好
    const friendId = u.userId || u.id;
    // 更新URL hash为交友ID（仅当hash变化时才更新）
    const newHash = 'user?id=' + friendId;
    if (window.location.hash !== '#' + newHash) {
      window.location.hash = newHash;
    }
    // 标记当前页面状态，供分享功能使用
    this._currentUserId = friendId;
    // 始终用 API 返回的内部 ID（u.id），不依赖 URL 参数（URL 可能被改为交友ID后刷新导致丢失）
    this._currentInternalId = u.id;
    // 重置Tab加载标志，确保每次查看新用户时重新加载数据
    const circleEl = document.getElementById('profileCircleList');
    const photoEl = document.getElementById('profilePhotoList');
    const videoEl = document.getElementById('profileVideoList');
    if (circleEl) delete circleEl.dataset.loaded;
    if (photoEl) delete photoEl.dataset.loaded;
    if (videoEl) delete videoEl.dataset.loaded;
    App.currentPage = 'user-detail';
    // 底部导航栏始终置底展示，不隐藏
    const allPhotos = (u.photos && u.photos.length) ? u.photos : (u.avatar ? [u.avatar] : []);
    const photos = allPhotos.slice(0, 4);
    const myLikes = (App.user && App.user.likes) || [];
    const liked = myLikes.includes(u.id);
    const f = u.form || {};
    const safeBio = (u.bio || '这个用户很懒，还没写自我介绍~').toString().replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    const safeNick = (u.nickname || '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));

    // 构建标签（显示：年龄、身高、星座、职业、收入）
    const tagsHtml = [];
    if (u.age) tagsHtml.push(`<span class="pdp-tag pdp-tag-age">${u.age}岁</span>`);
    if (f.height || u.height) { const hv = f.height || u.height; tagsHtml.push(`<span class="pdp-tag pdp-tag-height">${String(hv).includes('cm') ? hv : hv + 'cm'}</span>`); }
    const zodiacVal = App.getZodiac(u.birthday) || u.zodiac;
    if (zodiacVal) tagsHtml.push(`<span class="pdp-tag pdp-tag-zodiac">${zodiacVal}</span>`);
    if (f.job || u.job) tagsHtml.push(`<span class="pdp-tag pdp-tag-job">${f.job||u.job}</span>`);
    const incomeStr = Pages._formatIncome(u);
    if (incomeStr && incomeStr !== '保密') tagsHtml.push(`<span class="pdp-tag pdp-tag-income">${incomeStr}</span>`);

    content.innerHTML = `
      <div class="page active profile-detail-page">
        <!-- 头部大图区域 -->
        <div class="pdp-header">
          <img src="${photos[0] || ''}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22><rect fill=%22%234a9d9%22 width=%22300%22 height=%22300%22/><text x=%22150%22 y=%22160%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2280%22>?</text></svg>'">
          <button class="pdp-back-btn" onclick="Pages.closeDetail()"><i class="fas fa-chevron-left"></i></button>
        </div>

        <!-- 昵称行 -->
        <div class="pdp-name-row">
          <h1>${safeNick} <span class="pdp-gender-icon">${u.gender === '男' ? '<i class="fas fa-mars"></i>' : '<i class="fas fa-venus"></i>'}</span></h1>
          <span class="pdp-uid">交友ID:${u.userId || u.id}</span>
          <span class="pdp-location"><i class="fas fa-map-marker-alt"></i> ${(f.currentCity && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(f.currentCity)) ? f.currentCity : (u.city || '未知')}</span>
        </div>

        <!-- 标签 -->
        <div class="pdp-tags">
          ${tagsHtml.join('')}
        </div>

        <!-- 个人中心分页选项卡 -->
        <div class="pdp-tabs">
          <div class="pdp-tab active" onclick="Pages._switchProfileTab('basic', this)">资料</div>
          <div class="pdp-tab" onclick="Pages._switchProfileTab('circle', this)">动态</div>
          <div class="pdp-tab" onclick="Pages._switchProfileTab('album', this)">相册</div>
        </div>

        <!-- 基础资料面板 -->
        <div class="pdp-tab-panel active" id="profileTabBasic">
          <!-- 基本资料 -->
          <div class="pdp-section">
            <div class="pds-title">基本资料</div>
            <div class="pds-grid">
              <div class="pds-field"><span class="label">性别</span><span class="value">${u.gender || '保密'}</span></div>
              <div class="pds-field"><span class="label">年龄</span><span class="value">${u.age ? u.age + '岁' : '保密'}</span></div>
              <div class="pds-field"><span class="label">身高</span><span class="value">${(f.height||u.height) ? (String(f.height||u.height).includes('cm')?(f.height||u.height):(f.height||u.height)+'cm') : '保密'}</span></div>
              <div class="pds-field"><span class="label">婚姻状况</span><span class="value">${f.maritalStatus || u.maritalStatus || '保密'}</span></div>
              <div class="pds-field"><span class="label">学历</span><span class="value">${f.education || u.education || '保密'}</span></div>
              <div class="pds-field"><span class="label">所在地</span><span class="value">${u.city || f.currentCity || '未选择'}</span></div>
              <div class="pds-field"><span class="label">房产信息</span><span class="value">${f.house || u.house || '保密'}</span></div>
              <div class="pds-field"><span class="label">车辆信息</span><span class="value">${f.car || u.car || '保密'}</span></div>
              <div class="pds-field pds-full"><span class="label">兴趣爱好</span><span class="value">${(f.hobby||u.hobby)?(Array.isArray(f.hobby||u.hobby)?(f.hobby||u.hobby).join('、'):(f.hobby||u.hobby)):'保密'}</span></div>
            </div>
          </div>

          <!-- 猜你喜欢 -->
          <div class="pdp-suggest">
            <div class="psug-header">
              <div class="psug-title">猜你喜欢</div>
            </div>
            <div class="psug-list" id="guessLikeList">
              <div class="psug-item skeleton"><div class="psug-avatar skel"></div><div class="psug-name skel" style="width:40px;height:12px;"></div></div>
              <div class="psug-item skeleton"><div class="psug-avatar skel"></div><div class="psug-name skel" style="width:40px;height:12px;"></div></div>
              <div class="psug-item skeleton"><div class="psug-avatar skel"></div><div class="psug-name skel" style="width:40px;height:12px;"></div></div>
              <div class="psug-item skeleton"><div class="psug-avatar skel"></div><div class="psug-name skel" style="width:40px;height:12px;"></div></div>
              <div class="psug-item skeleton"><div class="psug-avatar skel"></div><div class="psug-name skel" style="width:40px;height:12px;"></div></div>
            </div>
          </div>
        </div>

        <!-- 圈子面板 -->
        <div class="pdp-tab-panel" id="profileTabCircle">
          <div id="profileCircleList" class="photo-empty">加载中...</div>
        </div>

        <!-- 相册面板 -->
        <div class="pdp-tab-panel" id="profileTabAlbum">
          <div id="profilePhotoList" class="photo-empty">加载中...</div>
        </div>

        <!-- 底部操作栏 -->
        <div class="pdp-bottom-bar" id="profileBottomBar">
          <button class="pdb-action" onclick="App.toast('功能开发中')">
            <i class="fas fa-gift" style="color:#ff6b9d;"></i>
            <span>送礼物</span>
          </button>
          <button class="pdb-action pdb-like-btn ${liked?'liked':''}" onclick="Pages.likeUser('${u.id}', this)">
            <i class="fa${liked ? 's' : 'r'} fa-heart" style="font-size:22px;"></i>
            <span>喜欢Ta</span>
          </button>
          <button class="pdb-contact-btn" onclick="Pages.checkVipChat('${u.id}')">
            <i class="fas fa-comment-dots"></i> 联系Ta
          </button>
        </div>
      </div>
    `;
    setTimeout(() => this._loadGuessLike(), 100);
  },

  /** 加载"猜你喜欢" — 根据登录用户性别随机推荐5个异性，未登录则不限 */
  async _loadGuessLike() {
    const list = document.getElementById('guessLikeList');
    if (!list) return;
    try {
      const res = await App.api('/api/users?limit=50');
      if (res.code !== 0 || !res.data) return;
      let users = (res.data.list || res.data) || [];
      // 如果已登录，只推荐异性
      if (App.user && App.user.gender) {
        const oppGender = App.user.gender === '男' ? '女' : '男';
        const filtered = users.filter(u => u.gender === oppGender && u.id !== App.user.id);
        users = filtered.length >= 5 ? filtered : users;
      }
      // 随机选5个
      for (let i = users.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [users[i], users[j]] = [users[j], users[i]];
      }
      const picks = users.slice(0, 5);
      if (!picks.length) return;
      list.innerHTML = picks.map(u => `
        <div class="psug-item" onclick="Pages.showUser('${u.id}')">
          <div class="psug-avatar"><img src="${u.avatar || u.photos?.[0] || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect fill=%22%23ff6b9d%22 width=%2264%22 height=%2264%22 rx=%2232%22/><text x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2228%22>?</text></svg>'}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22><rect fill=%22%23ff6b9d%22 width=%2264%22 height=%2264%22 rx=%2232%22/><text x=%2232%22 y=%2240%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2228%22>?</text></svg>'"></div>
          <div class="psug-name">${u.nickname || '用户'}</div>
        </div>
      `).join('');
    } catch(e) {
      console.warn('猜你喜欢加载失败:', e);
      list.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#999;padding:20px;font-size:13px;">暂无推荐</div>';
    }
  },

  closeDetail() {
    const bar = document.querySelector('.bottombar');
    if (bar) bar.style.display = '';
    App.switchPage('home');
  },

  /* 个人中心分页选项卡切换 */
  _switchProfileTab(tab, el) {
    // 切换tab样式
    document.querySelectorAll('.pdp-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    // 切换面板
    document.querySelectorAll('.pdp-tab-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('profileTab' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (panel) panel.classList.add('active');
    // 底部操作栏只在第一页显示
    const bottomBar = document.getElementById('profileBottomBar');
    if (bottomBar) bottomBar.style.display = tab === 'basic' ? '' : 'none';
    // 加载对应内容
    const uid = this._currentInternalId || this._currentUserId || (App.user && (App.user.userId || App.user.id));
    if (tab === 'circle' && panel) this._loadProfileCircle(uid);
    if (tab === 'album' && panel) this._loadProfileAlbum(uid);
    if (tab === 'video' && panel) this._loadProfileVideo(uid);
  },

  /* 加载个人中心的圈子帖子（按日期分组，左缩略图+右文字） */
  async _loadProfileCircle(userId) {
    const container = document.getElementById('profileCircleList');
    if (!container) return;
    if (!userId) { container.innerHTML = '<div class="photo-empty">暂无圈子动态</div>'; return; }
    if (container.dataset.loaded) return;
    container.dataset.loaded = '1';
    try {
      const res = await App.api('/api/circle_posts?userId=' + encodeURIComponent(userId) + '&page=1&pageSize=50');
      if (res.code !== 0) return container.innerHTML = '<div class="photo-empty">加载失败</div>';
      const posts = (res.data.list || []).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
      if (!posts.length) return container.innerHTML = '<div class="photo-empty">暂无圈子动态</div>';
      // 按日期分组
      const groups = this._groupPostsByDate(posts);
      let html = '';
      for (const [label, items] of groups) {
        html += `<div class="pdp-date-header">${this._escapeHtml(label)}</div>`;
        for (const p of items) {
          const thumb = (p.images && p.images.length) ? this._escapeHtml(p.images[0]) : '';
          const hasVideo = !!p.video;
          html += `
            <div class="pdp-circle-row" onclick="Pages._showComments('${p.id}')">
              <div class="pdp-circle-thumb">${thumb ? `<img src="${thumb}">` : (hasVideo ? '<div class="pdp-thumb-video-icon">▶</div>' : '')}</div>
              <div class="pdp-circle-body">
                <div class="pdp-circle-content">${this._escapeHtml(p.content).replace(/\n/g, '<br>')}</div>
              </div>
            </div>`;
        }
      }
      container.innerHTML = html;
    } catch(e) {
      container.innerHTML = '<div class="photo-empty">加载失败</div>';
    }
  },

  /* 按日期分组帖子（返回 Map: label→items） */
  _groupPostsByDate(posts) {
    const now = new Date();
    const today = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    const yesterday = new Date(now - 86400000);
    const yestStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth()+1).padStart(2,'0') + '-' + String(yesterday.getDate()).padStart(2,'0');
    const groups = new Map();
    posts.forEach(p => {
      const d = new Date(p.createdAt || Date.now());
      const dKey = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      let label;
      if (dKey === today) label = '今天';
      else if (dKey === yestStr) label = '昨天';
      else if (d.getFullYear() === now.getFullYear()) label = d.getDate() + '月'; // 按日显示
      else label = d.getFullYear() + '年';
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(p);
    });
    return groups;
  },

  /* 加载个人中心的相册（3列网格，按发布时间倒序，最新在最前） */
  async _loadProfileAlbum(userId) {
    const container = document.getElementById('profilePhotoList');
    if (!container) return;
    if (!userId) { container.innerHTML = '<div class="photo-empty">暂无照片</div>'; return; }
    if (container.dataset.loaded) return;
    container.dataset.loaded = '1';
    try {
      const res = await App.api('/api/circle_posts?userId=' + encodeURIComponent(userId) + '&page=1&pageSize=100');
      if (res.code !== 0) return container.innerHTML = '<div class="photo-empty">加载失败</div>';
      const posts = res.data.list || [];
      // 提取所有图片，记录每张图的发布时间
      const photos = [];
      posts.forEach(p => {
        if (p.images && p.images.length) {
          p.images.forEach(img => { photos.push({ url: img, date: p.createdAt || Date.now() }); });
        }
      });
      if (!photos.length) return container.innerHTML = '<div class="photo-empty">暂无照片</div>';
      // 按发布时间倒序排列（最新的在最前面）
      photos.sort((a, b) => new Date(b.date) - new Date(a.date));
      // 渲染3列网格（参考图3样式）
      container.innerHTML = '<div class="album-grid">' + photos.map(ph => {
        const safeUrl = ph.url.replace(/'/g, "\\'");
        return `<div class="album-grid-item"><img src="${ph.url}" onclick="Pages._previewImage('${safeUrl}', '${photos.map(p=>p.url).join(',')}')" loading="lazy"></div>`;
      }).join('') + '</div>';
    } catch(e) {
      container.innerHTML = '<div class="photo-empty">加载失败</div>';
    }
  },

  /* 加载个人中心的视频（左侧时间标签，右侧视频播放器） */
  async _loadProfileVideo(userId) {
    const container = document.getElementById('profileVideoList');
    if (!container) return;
    if (!userId) { container.innerHTML = '<div class="photo-empty">暂无视频</div>'; return; }
    if (container.dataset.loaded) return;
    container.dataset.loaded = '1';
    try {
      const res = await App.api('/api/circle_posts?userId=' + encodeURIComponent(userId) + '&page=1&pageSize=100');
      if (res.code !== 0) return container.innerHTML = '<div class="photo-empty">加载失败</div>';
      const posts = (res.data.list || []).filter(p => p.video);
      if (!posts.length) return container.innerHTML = '<div class="photo-empty">暂无视频</div>';
      // 按日期分组
      const groups = this._groupPostsByDate(posts);
      let html = '';
      for (const [label, items] of groups) {
        html += `<div class="pdp-date-header">${this._escapeHtml(label)}</div>`;
        for (const p of items) {
          const poster = (p.images && p.images.length) ? this._escapeHtml(p.images[0]) : '';
          html += `
            <div class="pdp-video-row">
              <video src="${this._escapeHtml(p.video)}" controls preload="metadata" poster="${poster}" 
                style="width:140px;height:90px;border-radius:8px;background:#000;object-fit:cover;"></video>
              <div class="pdp-video-info">
                <div class="pdp-video-title">${this._escapeHtml(p.content || '视频')}</div>
              </div>
            </div>`;
        }
      }
      container.innerHTML = html;
    } catch(e) {
      container.innerHTML = '<div class="photo-empty">加载失败</div>';
    }
  },

  /* 预览图片（大图） */
  _previewImage(src, all) {
    const urls = all ? all.split(',') : [src];
    const idx = urls.indexOf(src);
    let current = idx >= 0 ? idx : 0;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
    const img = document.createElement('img');
    img.src = urls[current];
    img.style.cssText = 'max-width:90%;max-height:80vh;object-fit:contain;border-radius:8px;';
    overlay.appendChild(img);
    // 左右切换
    if (urls.length > 1) {
      const prev = document.createElement('button');
      prev.textContent = '‹';
      prev.style.cssText = 'position:absolute;left:10px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.3);color:#fff;border:none;font-size:30px;width:40px;height:40px;border-radius:50%;cursor:pointer;';
      prev.onclick = (e) => { e.stopPropagation(); current = (current-1+urls.length)%urls.length; img.src = urls[current]; };
      overlay.appendChild(prev);
      const next = document.createElement('button');
      next.textContent = '›';
      next.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.3);color:#fff;border:none;font-size:30px;width:40px;height:40px;border-radius:50%;cursor:pointer;';
      next.onclick = (e) => { e.stopPropagation(); current = (current+1)%urls.length; img.src = urls[current]; };
      overlay.appendChild(next);
    }
    overlay.onclick = () => overlay.remove();
    document.body.appendChild(overlay);
  },

  checkVipChat(partnerId) {
    if (!App.user) return Auth.openLogin();
    // 检查VIP权限
    this._checkVipPermission('chat', () => {
      Chat.open(partnerId);
    });
  },

  async likeUser(id, btn) {
    if (!App.user) return Auth.openLogin();
    const res = await App.api('/api/like', { method: 'POST', body: { targetId: id } });
    if (res.code === 0) {
      if (!App.user.likes) App.user.likes = [];
      if (res.data.liked) {
        if (!App.user.likes.includes(id)) App.user.likes.push(id);
        App.toast(res.data.match ? '互相喜欢！可以开始聊天了' : '已喜欢TA，期待TA也喜欢你');
        if (btn) {
          btn.classList.add('liked');
          const heartIcon = btn.querySelector('i.fa-heart');
          const textSpan = btn.querySelector('span');
          if (heartIcon) { heartIcon.className = 'fas fa-heart'; }
          if (textSpan) textSpan.textContent = '已喜欢';
        }
      } else {
        App.user.likes = App.user.likes.filter(x => x !== id);
        App.toast('已取消喜欢');
        if (btn) {
          btn.classList.remove('liked');
          const heartIcon = btn.querySelector('i.fa-heart');
          const textSpan = btn.querySelector('span');
          if (heartIcon) { heartIcon.className = 'far fa-heart'; }
          if (textSpan) textSpan.textContent = '喜欢Ta';
        }
      }
    } else { App.toast(res.msg || '操作失败'); }
  },
  async unlikeUser(id, btn) {
    if (!App.user) return Auth.openLogin();
    const res = await App.api('/api/like', { method: 'POST', body: { targetId: id } });
    if (res.code === 0) {
      App.user.likes = (App.user.likes || []).filter(x => x !== id);
      App.toast('已取消喜欢 💔');
      // 从DOM移除该卡片
      const card = btn.closest('.grid-card');
      if (card) card.style.opacity = '0.4';
      setTimeout(() => {
        if (card) card.remove();
        // 更新计数
        const title = document.querySelector('.page.active h2');
        if (title) {
          const m = title.textContent.match(/\d+/);
          const n = m ? parseInt(m[0]) - 1 : 0;
          title.textContent = '我喜欢的 (' + n + ')';
        }
      }, 300);
    } else { App.toast(res.msg || '操作失败'); }
  },

  /** 首页喜欢TA按钮：未登录→登录，已登录→喜欢后跳转"我喜欢的" */
  async _homeLikeUser(id, btn) {
    if (!App.user) return Auth.openLogin();
    // 调用喜欢接口
    const res = await App.api('/api/like', { method: 'POST', body: { targetId: id } });
    if (res.code === 0) {
      if (!App.user.likes) App.user.likes = [];
      if (res.data.liked && !App.user.likes.includes(id)) App.user.likes.push(id);
      App.toast(res.data.match ? '互相喜欢！可以开始聊天了' : '已喜欢TA，期待TA也喜欢你');
      // 按钮状态变化
      if (btn) {
        btn.textContent = '已喜欢';
        btn.style.background = 'var(--primary)';
        btn.style.color = '#fff';
      }
      // 跳转到"我喜欢的"页面
      setTimeout(() => Pages.showLikes(), 600);
    } else {
      App.toast(res.msg || '操作失败');
    }
  },
  _switchDetailPhoto(img, url) {
    const main = document.getElementById('dpMainImg');
    if (main) main.src = url;
    img.parentElement.querySelectorAll('img').forEach(i => i.classList.remove('active'));
    img.classList.add('active');
  },

  editProfile() {
    // 优先使用编辑中的数据（包含用户刚修改但未保存的值），否则用原始数据
    const baseUser = App.user || {};
    // 标准化字段名：后端 storage 字段映射到前端展示字段
    const normalized = {
      ...baseUser,
      maritalStatus: baseUser.maritalStatus !== undefined ? baseUser.maritalStatus : baseUser.marriage,
      house: baseUser.house !== undefined ? baseUser.house : baseUser.hasHouse,
      car: baseUser.car !== undefined ? baseUser.car : baseUser.hasCar,
      salaryCurrency: baseUser.salaryCurrency !== undefined ? baseUser.salaryCurrency : baseUser.incomeCurrency,
      province: baseUser.province !== undefined ? baseUser.province : baseUser.state,
    };
    const u = this._editData ? { ...normalized, ...this._editData } : normalized;
    const content = document.getElementById('content');
    const isMale = u.gender === '男';
    content.innerHTML = `
      <div class="page active edit-profile-page" style="background:#f7f6f9; margin:-10px -12px; min-height:100vh;">
        <!-- 顶部标题 -->
        <div class="ep-header">
          <span class="ep-back" onclick="Pages.renderMine()"><i class="fas fa-chevron-left"></i></span>
          <h2>编辑资料</h2>
          <span></span>
        </div>

        <!-- Tab切换 -->
        <div class="ep-tabs">
          <div class="ep-tab active" data-tab="basic" onclick="Pages._switchEditTab('basic',this)">
            <i class="fas fa-user"></i> 个人资料
          </div>
          <div class="ep-tab" data-tab="mate" onclick="Pages._switchEditTab('mate',this)">
            <i class="fas fa-heart"></i> 择偶条件
          </div>
        </div>

        <!-- Tab内容区 -->
        <div id="epBasicTab" class="ep-tab-content active">
          <!-- 头像 -->
          <div class="ep-avatar-section">
            <div class="ep-avatar-wrap" onclick="document.getElementById('avatarFileInput').click()">
              <img src="${u.avatar || ''}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ff6b9d%22 width=%22100%22 height=%22100%22 rx=%2250%22/><text x=%2250%22 y=%2264%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2236%22>?</text></svg>'">
              <div class="ep-avatar-mask">换头像</div>
            </div>
            <input type="file" id="avatarFileInput" accept="image/*" style="display:none;" onchange="Pages.uploadAvatar(this)">
          </div>

          <!-- 个人资料字段（按钮样式，每行间隔） -->
          <div class="ep-section">
            <div class="ep-field-btn" onclick="Pages._openFieldEditor('nickname','昵称','${(u.nickname||'').replace(/'/g,"&#39;")}','text')">
              <span class="ep-fb-label">昵称</span><span class="ep-fb-value">${u.nickname || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="document.getElementById('f_birthday_picker').click()">
              <span class="ep-fb-label">出生日期</span><span class="ep-fb-value">${u.birthday || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
              <input type="date" id="f_birthday_picker" value="${u.birthday||''}" style="display:none;" onchange="Pages._updateBirthday(this.value)">
            </div>
            <div class="ep-field-btn">
              <span class="ep-fb-label">星座</span><span class="ep-fb-value ep-zodiac-display" style="text-align:center;flex:1;">${App.getZodiac(u.birthday) || '保密'}</span>
            </div>
            <div class="ep-field-btn" style="pointer-events:${u.gender?'none':'auto'};opacity:${u.gender?'0.6':'1'}">
              <span class="ep-fb-label">性别</span><span class="ep-fb-value">${u.gender || '未设置'}</span>${u.gender?'<span style="font-size:12px;color:var(--text-3);margin-left:8px;">注册后不可修改</span>':'<i class="fas fa-chevron-right ep-fb-arrow"></i>'}
            </div>
            <div class="ep-field-btn" onclick="Pages._openFieldEditor('height','身高(cm)','${u.height||''}','number')">
              <span class="ep-fb-label">身高</span><span class="ep-fb-value">${u.height ? (String(u.height).includes('cm') ? u.height : u.height + 'cm') : '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openFieldEditor('education','学历','${(u.education||'').replace(/'/g,"&#39;")}','select',['高中','大专','本科','硕士','博士'])">
              <span class="ep-fb-label">学历</span><span class="ep-fb-value">${u.education || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openFieldEditor('maritalStatus','婚姻状况','${(u.maritalStatus||'').replace(/'/g,"&#39;")}','select',['未婚','离异','丧偶'])">
              <span class="ep-fb-label">婚姻状况</span><span class="ep-fb-value">${u.maritalStatus || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openLocationPicker()">
              <span class="ep-fb-label">所在地</span><span class="ep-fb-value ep-location-display">${u.city || '未选择'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            ${isMale ? `
            <div class="ep-field-btn" onclick="Pages._openFieldEditor('house','房产信息','${(u.house||'').replace(/'/g,"&#39;")}','select',['有(无贷款)','有(有贷款)','无','与父母同住'])">
              <span class="ep-fb-label">房产信息</span><span class="ep-fb-value">${u.house || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openFieldEditor('car','车辆信息','${(u.car||'').replace(/'/g,"&#39;")}','select',['有','无'])">
              <span class="ep-fb-label">车辆信息</span><span class="ep-fb-value">${u.car || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>` : ''}
            <div class="ep-field-btn" onclick="Pages._openFieldEditor('job','职业','${(u.job||'').replace(/'/g,"&#39;")}','text')">
              <span class="ep-fb-label">职业</span><span class="ep-fb-value">${u.job || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openIncomeEditor()">
              <span class="ep-fb-label">年收入</span><span class="ep-fb-value">${u.income ? (u.incomeCurrency==='USD'?'$':'￥')+u.income+'/年' : '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openFieldEditor('wechatId','微信号','${(u.wechatId||'').replace(/'/g,"&#39;")}','text')">
              <span class="ep-fb-label">微信号</span><span class="ep-fb-value">${u.wechatId || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openFieldEditor('hobby','兴趣爱好','${Array.isArray(u.hobby)?u.hobby.join(','):(u.hobby||'').replace(/'/g,"&#39;")}','text')">
              <span class="ep-fb-label">兴趣爱好</span><span class="ep-fb-value">${(u.hobby)?(Array.isArray(u.hobby)?u.hobby.join('、'):u.hobby):'未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openFieldEditor('bio','个人介绍','${(u.bio||'').replace(/'/g,"&#39;")}','textarea')">
              <span class="ep-fb-label">个人介绍</span><span class="ep-fb-value">${u.bio ? u.bio.substring(0,20)+'...' : '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
          </div>

          <button class="ep-save-btn" onclick="Pages.saveBasicProfile()">保存资料</button>
        </div>

        <!-- 择偶条件Tab -->
        <div id="epMateTab" class="ep-tab-content">
          <div class="ep-section">
            <div class="ep-field-btn" onclick="Pages._openMateField('mateGender','期望性别','${(u.mateGender||'').replace(/'/g,"&#39;")}','select',['女','男','不限'])">
              <span class="ep-fb-label">期望性别</span><span class="ep-fb-value">${u.mateGender || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openMateAgeRange()">
              <span class="ep-fb-label">年龄范围</span><span class="ep-fb-value">${u.mateAgeMin&&u.mateAgeMax?(String(u.mateAgeMin).includes('岁')?u.mateAgeMin:u.mateAgeMin+'岁')+'-'+(String(u.mateAgeMax).includes('岁')?u.mateAgeMax:u.mateAgeMax+'岁'):'未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openMateHeightRange()">
              <span class="ep-fb-label">身高范围</span><span class="ep-fb-value">${u.mateHeightMin&&u.mateHeightMax?(String(u.mateHeightMin).includes('cm')?u.mateHeightMin:u.mateHeightMin+'cm')+'-'+(String(u.mateHeightMax).includes('cm')?u.mateHeightMax:u.mateHeightMax+'cm'):'未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openMateField('mateEducation','最低学历','${(u.mateEducation||'').replace(/'/g,"&#39;")}','select',['不限','高中','大专','本科','硕士','博士'])">
              <span class="ep-fb-label">最低学历</span><span class="ep-fb-value">${u.mateEducation || '不限'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openMateField('mateMaritalStatus','婚况要求','${(u.mateMaritalStatus||'').replace(/'/g,"&#39;")}','select',['不限','未婚','离异','丧偶'])">
              <span class="ep-fb-label">婚况要求</span><span class="ep-fb-value">${u.mateMaritalStatus || '不限'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openMateSalary()">
              <span class="ep-fb-label">最低年薪</span><span class="ep-fb-value">${u.mateSalary?(u.mateSalaryCurrency==='USD'?'$':'￥')+u.mateSalary+'/年':'未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openMateField('marriageTime','期望结婚时间','${(u.marriageTime||'').replace(/'/g,"&#39;")}','select',['随时','1年内','2年内','3年内','暂不考虑'])">
              <span class="ep-fb-label">期望结婚时间</span><span class="ep-fb-value">${u.marriageTime || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openMateField('registerFor','注册目的','${(u.registerFor||'').replace(/'/g,"&#39;")}','select',['真诚交友','寻找结婚对象','拓展人脉'])">
              <span class="ep-fb-label">注册目的</span><span class="ep-fb-value">${u.registerFor || '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
            <div class="ep-field-btn" onclick="Pages._openMateField('mateOther','其他要求','${(u.mateOther||'').replace(/'/g,"&#39;")}','textarea')">
              <span class="ep-fb-label">其他要求</span><span class="ep-fb-value">${u.mateOther ? u.mateOther.substring(0,20)+'...' : '未设置'}</span><i class="fas fa-chevron-right ep-fb-arrow"></i>
            </div>
          </div>

          <button class="ep-save-btn" style="background:linear-gradient(135deg,#ff7eb3,#ff6b9d);" onclick="Pages.saveMateProfile()">保存择偶条件</button>
        </div>
      </div>`;
    // 初始化编辑用的临时数据
    this._editData = { ...u };
  },
  _switchEditTab(tabName, el) {
    document.querySelectorAll('.ep-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.ep-tab-content').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const target = document.getElementById(tabName === 'basic' ? 'epBasicTab' : 'epMateTab');
    if (target) target.classList.add('active');
  },
  _updateBirthday(val) {
    const u = App.user;
    u.birthday = val;
    // 更新显示
    const display = document.querySelector('.ep-field-btn:has([id="f_birthday_picker"]) .ep-fb-value');
    if (display) display.textContent = val || '未设置';
    // 更新星座
    const zDisplay = document.querySelector('.ep-zodiac-display');
    if (zDisplay) zDisplay.textContent = App.getZodiac(val) || '保密';
    this._editData.birthday = val;
    this._editData.zodiac = App.getZodiac(val);
  },
  async saveBasicProfile() {
    const u = App.user || {};
    const d = this._editData || {};
    const patch = {
      nickname: d.nickname !== undefined ? d.nickname : (u.nickname || ''),
      gender: d.gender !== undefined ? d.gender : (u.gender || ''),
      birthday: d.birthday !== undefined ? d.birthday : (u.birthday || ''),
      zodiac: App.getZodiac(d.birthday || u.birthday),
      height: d.height !== undefined ? (parseInt(d.height) || 0) : (u.height || 0),
      education: d.education !== undefined ? d.education : (u.education || ''),
      // 后端字段映射
      marriage: d.maritalStatus !== undefined ? d.maritalStatus : (d.marriage !== undefined ? d.marriage : (u.maritalStatus || u.marriage || '')),
      city: d.city !== undefined ? d.city : (u.city || ''),
      country: d.country !== undefined ? d.country : (u.country || ''),
      state: d.province !== undefined ? d.province : (d.state !== undefined ? d.state : (u.province || u.state || '')),
      job: d.job !== undefined ? d.job : (u.job || ''),
      income: d.income !== undefined ? d.income : (u.income || ''),
      incomeCurrency: d.salaryCurrency !== undefined ? d.salaryCurrency : (d.incomeCurrency !== undefined ? d.incomeCurrency : (u.salaryCurrency || u.incomeCurrency || 'CNY')),
      wechatId: d.wechatId !== undefined ? d.wechatId : (u.wechatId || ''),
      bio: d.bio !== undefined ? d.bio : (u.bio || ''),
      hasHouse: d.house !== undefined ? d.house : (d.hasHouse !== undefined ? d.hasHouse : (u.house || u.hasHouse || '')),
      hasCar: d.car !== undefined ? d.car : (d.hasCar !== undefined ? d.hasCar : (u.car || u.hasCar || '')),
    };
    // 清理空值但保留0和空字符串
    const cleanPatch = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined && v !== null) cleanPatch[k] = v;
    }
    const res = await App.api('/api/me', { method: 'PUT', body: cleanPatch });
    if (res.code === 0) { App.user = res.data; this._editData = null; App.toast('保存成功'); }
    else App.toast(res.msg);
  },
  async saveMateProfile() {
    const u = App.user || {};
    const d = this._editData || {};
    const patch = {
      mateGender: d.mateGender !== undefined ? d.mateGender : (u.mateGender || ''),
      mateAgeMin: d.mateAgeMin !== undefined ? (parseInt(d.mateAgeMin) || 0) : (u.mateAgeMin || 0),
      mateAgeMax: d.mateAgeMax !== undefined ? (parseInt(d.mateAgeMax) || 0) : (u.mateAgeMax || 0),
      mateHeightMin: d.mateHeightMin !== undefined ? (parseInt(d.mateHeightMin) || 0) : (u.mateHeightMin || 0),
      mateHeightMax: d.mateHeightMax !== undefined ? (parseInt(d.mateHeightMax) || 0) : (u.mateHeightMax || 0),
      mateEducation: d.mateEducation !== undefined ? d.mateEducation : (u.mateEducation || ''),
      mateMaritalStatus: d.mateMaritalStatus !== undefined ? d.mateMaritalStatus : (u.mateMaritalStatus || ''),
      mateSalary: d.mateSalary !== undefined ? d.mateSalary : (u.mateSalary || ''),
      mateSalaryCurrency: d.mateSalaryCurrency !== undefined ? d.mateSalaryCurrency : (u.mateSalaryCurrency || 'CNY'),
      marriageTime: d.marriageTime !== undefined ? d.marriageTime : (u.marriageTime || ''),
      registerFor: d.registerFor !== undefined ? d.registerFor : (u.registerFor || ''),
      mateOther: d.mateOther !== undefined ? d.mateOther : (u.mateOther || ''),
    };
    const cleanPatch = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined && v !== null) cleanPatch[k] = v;
    }
    const res = await App.api('/api/me', { method: 'PUT', body: cleanPatch });
    if (res.code === 0) { App.user = res.data; this._editData = null; App.toast('择偶条件已保存'); }
    else App.toast(res.msg);
  },

  // ===== 编辑资料辅助方法 =====
  _openFieldEditor(field, label, currentVal, type, options) {
    if (!this._editData) this._editData = { ...App.user };
    // 身高字段去除已有单位，方便输入数字
    if (field === 'height' && currentVal) {
      currentVal = String(currentVal).replace(/cm/g, '').trim();
    }
    // 先关闭已打开的
    this._closePickerSheet();
    // 创建遮罩层（独立于sheet，确保z-index生效）
    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.id = 'pickerSheetMask';
    mask.onclick = () => { Pages._closePickerSheet(); };
    // 创建弹窗主体
    const sheet = document.createElement('div');
    sheet.id = 'pickerSheet';
    sheet.className = 'picker-sheet';
    sheet.innerHTML = '<div class="picker-body"><div class="picker-header"><span class="picker-cancel" onclick="Pages._closePickerSheet()">取消</span><span class="picker-title">编辑</span><span class="picker-confirm" onclick="Pages._confirmFieldEdit()">确定</span></div><div class="picker-options" id="pickerOptions"></div></div>';
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => { sheet.classList.add('show'); });
    this._editingField = field;
    document.querySelector('.picker-sheet .picker-title').textContent = label;
    const optsEl = document.getElementById('pickerOptions');
    if (type === 'select' && options) {
      optsEl.innerHTML = options.map(opt =>
        `<div class="po-item${currentVal===opt?' selected':''}" data-val="${opt}" onclick="Pages._selectOption(this)">${opt}${currentVal===opt?'<i class="fas fa-check" style="float:right;color:var(--primary);"></i>':''}</div>`
      ).join('');
    } else {
      const isTextarea = type === 'textarea';
      const isNumber = type === 'number';
      const tag = isTextarea ? 'textarea' : 'input';
      const inputType = isNumber ? 'number' : 'text';
      const extraAttrs = isNumber ? ' inputmode="numeric" pattern="[0-9]*"' : '';
      const attrs = isTextarea
        ? 'style="width:100%;min-height:100px;padding:12px;border:1px solid #eee;border-radius:10px;font-size:15px;resize:none;"'
        : `type="${inputType}"${extraAttrs} style="width:100%;padding:12px;border:1px solid #eee;border-radius:10px;font-size:15px;"`;
      const safeVal = (currentVal || '').replace(/"/g, '&quot;');
      optsEl.innerHTML = '<div style="padding:16px;"><' + tag + ' id="fieldEditorInput" ' + attrs + ' value="' + safeVal + '" placeholder="请输入' + label + '"></' + tag + '></div>';
      setTimeout(function() {
        var inp = document.getElementById('fieldEditorInput');
        if (inp) {
          inp.focus();
          if (inp.select && !isTextarea) { try { inp.select(); } catch(e){} }
          inp.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !isTextarea) { e.preventDefault(); Pages._confirmFieldEdit(); }
          });
        }
      }, 100);
    }
  },
  _selectOption(el) {
    document.querySelectorAll('#pickerOptions .po-item').forEach(i => {
      i.classList.remove('selected');
      i.classList.remove('checked');
      // 移除可能存在的对勾图标
      const check = i.querySelector('.fa-check');
      if (check) check.remove();
    });
    el.classList.add('selected');
    // 添加对勾图标
    el.innerHTML = el.textContent + '<i class="fas fa-check" style="float:right;color:var(--primary);"></i>';
  },
  _confirmFieldEdit() {
    let val = '';
    const input = document.getElementById('fieldEditorInput');
    const selectedOpt = document.querySelector('#pickerOptions .po-item.selected');
    if (input) {
      val = input.value.trim();
      // textarea 没有 value 属性时用 textContent
      if (!val && input.tagName === 'TEXTAREA') val = input.textContent.trim();
    } else if (selectedOpt) {
      val = selectedOpt.dataset.val;
    }
    // 身高统一存纯数字（去掉 cm）
    if (this._editingField === 'height' && val) {
      val = String(val).replace(/cm/g, '').trim();
    }
    if (this._editingField && this._editData) {
      this._editData[this._editingField] = val;
    }
    this._closePickerSheet();
    Pages.editProfile();
    App.toast('已修改');
  },
  _closePickerSheet() {
    const s = document.getElementById('pickerSheet');
    if (s) { s.classList.remove('show'); s.remove(); }
    const m = document.getElementById('pickerSheetMask');
    if (m) m.remove();
  },
  _openLocationPicker() {
    // 复用注册时的三级联动选择器
    this._openCityPickerForEdit();
  },
  _openCityPickerForEdit() {
    const baseUser = App.user || {};
    // 标准化位置字段（后端存 country/state，前端编辑用 _country/_province）
    const u = {
      ...baseUser,
      _country: baseUser._country || baseUser.country || '中国',
      _province: baseUser._province || baseUser.province || baseUser.state || '',
      city: baseUser.city || ''
    };
    this._editData = this._editData || { ...u };
    // 先关闭已打开的弹窗
    this._closePickerSheet();
    this.hidePicker();

    const selCountry = this._editData._country || '中国';
    const selProvince = this._editData._province || '';
    const selCity = this._editData.city || '';

    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.id = 'pickerSheetMask';
    mask.onclick = () => { Pages._closePickerSheet(); };

    const sheet = document.createElement('div');
    sheet.id = 'pickerSheet';
    sheet.className = 'picker-sheet';

    sheet.innerHTML = `
      <div class="picker-body">
        <div class="picker-header">
          <span class="picker-cancel" onclick="Pages._closePickerSheet()">取消</span>
          <span class="picker-title">所在地</span>
          <button class="picker-confirm" onclick="Pages._confirmEditLocation()">确定</button>
        </div>
        <div class="cascade-row">
          <div class="cascade-col" id="locCountryCol">
            <div class="po-item${selCountry==='中国'?' selected':''}" data-val="中国" onclick="Pages._selLocCountry(this)">中国</div>
            <div class="po-item${selCountry==='美国'?' selected':''}" data-val="美国" onclick="Pages._selLocCountry(this)">美国</div>
            <div class="po-item" data-val="其他" onclick="Pages._selLocCountry(this)">其他国家</div>
          </div>
          <div class="cascade-col" id="locProvinceCol"></div>
          <div class="cascade-col" id="locCityCol"></div>
        </div>
      </div>`;

    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => { sheet.classList.add('show'); });
    this._currentPicker = { mask, sheet, data: this._editData };

    // 加载省份/州
    this._loadProvinces(selCountry);
    if (selProvince) {
      this._loadCities(selCountry, selProvince, selCity);
    }
  },
  _confirmEditLocation() {
    if (!this._editData) return;
    this._editData._country = this._editData._country || '中国';
    this._editData.country = this._editData._country;
    this._editData._province = this._editData._province || '';
    this._editData.province = this._editData._province;
    this._editData.city = this._editData.city || '';
    if (this._editData._locationData?.[this._editData._country]?.[this._editData._province]?.length > 0 && !this._editData.city) {
      App.toast('请选择具体城市'); return;
    }
    const locText = [this._editData._country, this._editData._province, this._editData.city].filter(Boolean).join(' ');
    this._editData.locationText = locText;
    this._closePickerSheet();
    Pages.editProfile();
    App.toast('已修改');
  },
  _openIncomeEditor() {
    const u = App.user || {};
    this._editData = this._editData || { ...u };
    this._closePickerSheet();
    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.id = 'pickerSheetMask';
    mask.onclick = () => { Pages._closePickerSheet(); };
    const sheet = document.createElement('div');
    sheet.id = 'pickerSheet';
    sheet.className = 'picker-sheet';
    sheet.innerHTML = '<div class="picker-body"><div class="picker-header"><span class="picker-cancel" onclick="Pages._closePickerSheet()">取消</span><span class="picker-title">年收入</span><span class="picker-confirm" onclick="Pages._confirmIncomeEdit()">确定</span></div><div class="picker-options" id="pickerOptions"></div></div>';
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => { sheet.classList.add('show'); });
    document.querySelector('.picker-sheet .picker-title').textContent = '设置年收入';
    const curInc = u.income || '';
    const curCur = u.salaryCurrency || u.incomeCurrency || 'CNY';
    document.getElementById('pickerOptions').innerHTML = `
      <div style="padding:16px;">
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <select id="incCurrency" style="flex:0 0 90px;padding:10px;border:1px solid #eee;border-radius:8px;">
            <option value="CNY"${curCur==='CNY'?' selected':''}>人民币</option>
            <option value="USD"${curCur==='USD'?' selected':''}>美元</option>
          </select>
          <select id="incAmount" style="flex:1;padding:10px;border:1px solid #eee;border-radius:8px;">
            <option value=""${!curInc?' selected':''}>请选择</option>
            <option value="5万以下"${curInc==='5万以下'?' selected':''}>5万以下</option>
            <option value="5-10万"${curInc==='5-10万'?' selected':''}>5-10万</option>
            <option value="10-20万"${curInc==='10-20万'?' selected':''}>10-20万</option>
            <option value="20-30万"${curInc==='20-30万'?' selected':''}>20-30万</option>
            <option value="30-50万"${curInc==='30-50万'?' selected':''}>30-50万</option>
            <option value="50万以上"${curInc==='50万以上'?' selected':''}>50万以上</option>
          </select>
        </div>
      </div>`;
  },
  _confirmIncomeEdit() {
    const currency = document.getElementById('incCurrency').value;
    const amount = document.getElementById('incAmount').value;
    if (this._editData) {
      this._editData.income = amount;
      this._editData.salaryCurrency = currency;
    }
    this._closePickerSheet();
    Pages.editProfile();
    App.toast('已修改');
  },
  _openMateField(field, label, currentVal, type, options) {
    this._openFieldEditor(field, label, currentVal, type, options);
  },
  _openMateAgeRange() {
    const u = App.user || {};
    this._editData = this._editData || { ...u };
    this._closePickerSheet();
    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.id = 'pickerSheetMask';
    mask.onclick = () => { Pages._closePickerSheet(); };
    const sheet = document.createElement('div');
    sheet.id = 'pickerSheet';
    sheet.className = 'picker-sheet';
    sheet.innerHTML = '<div class="picker-body"><div class="picker-header"><span class="picker-cancel" onclick="Pages._closePickerSheet()">取消</span><span class="picker-title">年龄范围</span><span class="picker-confirm" onclick="Pages._confirmMateAge()">确定</span></div><div class="picker-options" id="pickerOptions"></div></div>';
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => { sheet.classList.add('show'); });
    document.getElementById('pickerOptions').innerHTML = `
      <div style="padding:16px;display:flex;align-items:center;gap:8px;">
        <input type="number" id="mateAgeMin" value="${u.mateAgeMin||''}" placeholder="最小岁" style="flex:1;padding:11px;border:1px solid #eee;border-radius:8px;text-align:center;font-size:15px;">
        <span style="color:#999;">~</span>
        <input type="number" id="mateAgeMax" value="${u.mateAgeMax||''}" placeholder="最大岁" style="flex:1;padding:11px;border:1px solid #eee;border-radius:8px;text-align:center;font-size:15px;"> 岁
      </div>`;
  },
  _confirmMateAge() {
    const minEl = document.getElementById('mateAgeMin');
    const maxEl = document.getElementById('mateAgeMax');
    if (!minEl || !maxEl) { App.toast('操作异常'); this._closePickerSheet(); return; }
    if (this._editData) {
      this._editData.mateAgeMin = parseInt(minEl.value)||0;
      this._editData.mateAgeMax = parseInt(maxEl.value)||0;
    }
    this._closePickerSheet(); Pages.editProfile(); App.toast('已修改');
  },
  _openMateHeightRange() {
    const u = App.user || {};
    this._editData = this._editData || { ...u };
    this._closePickerSheet();
    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.id = 'pickerSheetMask';
    mask.onclick = () => { Pages._closePickerSheet(); };
    const sheet = document.createElement('div');
    sheet.id = 'pickerSheet';
    sheet.className = 'picker-sheet';
    sheet.innerHTML = '<div class="picker-body"><div class="picker-header"><span class="picker-cancel" onclick="Pages._closePickerSheet()">取消</span><span class="picker-title">身高范围</span><span class="picker-confirm" onclick="Pages._confirmMateHeight()">确定</span></div><div class="picker-options" id="pickerOptions"></div></div>';
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => { sheet.classList.add('show'); });
    document.getElementById('pickerOptions').innerHTML = `
      <div style="padding:16px;display:flex;align-items:center;gap:8px;">
        <input type="number" id="mateHeightMin" value="${u.mateHeightMin||''}" placeholder="最小cm" style="flex:1;padding:11px;border:1px solid #eee;border-radius:8px;text-align:center;font-size:15px;">
        <span style="color:#999;">~</span>
        <input type="number" id="mateHeightMax" value="${u.mateHeightMax||''}" placeholder="最大cm" style="flex:1;padding:11px;border:1px solid #eee;border-radius:8px;text-align:center;font-size:15px;"> cm
      </div>`;
  },
  _confirmMateHeight() {
    const minEl = document.getElementById('mateHeightMin');
    const maxEl = document.getElementById('mateHeightMax');
    if (!minEl || !maxEl) { App.toast('操作异常'); this._closePickerSheet(); return; }
    if (this._editData) {
      this._editData.mateHeightMin = parseInt(minEl.value)||0;
      this._editData.mateHeightMax = parseInt(maxEl.value)||0;
    }
    this._closePickerSheet(); Pages.editProfile(); App.toast('已修改');
  },
  _openMateSalary() {
    const u = App.user || {};
    this._editData = this._editData || { ...u };
    this._closePickerSheet();
    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.id = 'pickerSheetMask';
    mask.onclick = () => { Pages._closePickerSheet(); };
    const sheet = document.createElement('div');
    sheet.id = 'pickerSheet';
    sheet.className = 'picker-sheet';
    sheet.innerHTML = '<div class="picker-body"><div class="picker-header"><span class="picker-cancel" onclick="Pages._closePickerSheet()">取消</span><span class="picker-title">最低年薪</span><span class="picker-confirm" onclick="Pages._confirmMateSalary()">确定</span></div><div class="picker-options" id="pickerOptions"></div></div>';
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => { sheet.classList.add('show'); });
    const curS = u.mateSalary || '';
    const curSC = u.mateSalaryCurrency || 'CNY';
    document.getElementById('pickerOptions').innerHTML = `
      <div style="padding:16px;">
        <div style="display:flex;gap:8px;">
          <select id="msCurrency" style="flex:0 0 90px;padding:10px;border:1px solid #eee;border-radius:8px;">
            <option value="CNY"${curSC==='CNY'?' selected':''}>人民币</option>
            <option value="USD"${curSC==='USD'?' selected':''}>美元</option>
          </select>
          <select id="msAmount" style="flex:1;padding:10px;border:1px solid #eee;border-radius:8px;">
            <option value=""${!curS?' selected':''}>请选择</option>
            <option value="5万以下"${curS==='5万以下'?' selected':''}>5万以下</option>
            <option value="5-10万"${curS==='5-10万'?' selected':''}>5-10万</option>
            <option value="10-20万"${curS==='10-20万'?' selected':''}>10-20万</option>
            <option value="20-30万"${curS==='20-30万'?' selected':''}>20-30万</option>
            <option value="30-50万"${curS==='30-50万'?' selected':''}>30-50万</option>
            <option value="50万以上"${curS==='50万以上'?' selected':''}>50万以上</option>
          </select>
        </div>
      </div>`;
  },
  _confirmMateSalary() {
    const amtEl = document.getElementById('msAmount');
    const curEl = document.getElementById('msCurrency');
    if (!amtEl || !curEl) { App.toast('操作异常'); this._closePickerSheet(); return; }
    if (this._editData) {
      this._editData.mateSalary = amtEl.value;
      this._editData.mateSalaryCurrency = curEl.value;
    }
    this._closePickerSheet(); Pages.editProfile(); App.toast('已修改');
  },
  _calcAge(birthday) {
    if (!birthday) return null;
    const age = Math.floor((Date.now() - new Date(birthday).getTime()) / (365.25 * 24 * 3600 * 1000));
    return age;
  },

  _onCountryChange() {
    const country = document.getElementById('f_country').value;
    const stateSel = document.getElementById('f_state');
    const citySel = document.getElementById('f_city');
    stateSel.innerHTML = '<option value="">州/省</option>';
    citySel.innerHTML = '<option value="">城市</option>';
    if (!country || !LOCATION_DATA[country]) return;
    const states = Object.keys(LOCATION_DATA[country]);
    states.forEach(s => stateSel.add(new Option(s, s)));
  },
  _onStateChange() {
    const country = document.getElementById('f_country').value;
    const state = document.getElementById('f_state').value;
    const citySel = document.getElementById('f_city');
    citySel.innerHTML = '<option value="">城市</option>';
    if (!country || !state || !LOCATION_DATA[country] || !LOCATION_DATA[country][state]) return;
    const cities = LOCATION_DATA[country][state];
    cities.forEach(ci => citySel.add(new Option(ci, ci)));
  },
  _calcZodiac() {
    const birthInput = document.getElementById('f_birthday');
    const zSpan = document.getElementById('f_zodiac_display');
    if (!birthInput || !zSpan) return;
    const val = birthInput.value;
    if (!val) { zSpan.textContent = '保密'; return; }
    const d = new Date(val);
    const mo = d.getMonth() + 1;
    const da = d.getDate();
    let z = '保密';
    if ((mo===1&&da>=20)||(mo===2&&da<=18)) z='水瓶座';
    else if ((mo===2&&da>=19)||(mo===3&&da<=20)) z='双鱼座';
    else if ((mo===3&&da>=21)||(mo===4&&da<=19)) z='白羊座';
    else if ((mo===4&&da>=20)||(mo===5&&da<=20)) z='金牛座';
    else if ((mo===5&&da>=21)||(mo===6&&da<=21)) z='双子座';
    else if ((mo===6&&da>=22)||(mo===7&&da<=22)) z='巨蟹座';
    else if ((mo===7&&da>=23)||(mo===8&&da<=22)) z='狮子座';
    else if ((mo===8&&da>=23)||(mo===9&&da<=22)) z='处女座';
    else if ((mo===9&&da>=23)||(mo===10&&da<=23)) z='天秤座';
    else if ((mo===10&&da>=24)||(mo===11&&da<=22)) z='天蝎座';
    else if ((mo===11&&da>=23)||(mo===12&&da<=21)) z='射手座';
    else if ((mo===12&&da>=22)||(mo===1&&da<=19)) z='摩羯座';
    zSpan.textContent = z;
    const h = document.getElementById('f_zodiac');
    if (h) h.value = z;
  },

  _clearProfilePhoto(i) {
    const inp = document.getElementById('f_photo_' + i);
    if (inp) inp.value = '';
    const slot = document.querySelector(`#f_photos_grid .photo-slot[data-i="${i}"]`);
    if (!slot) return;
    slot.innerHTML = `<input type="hidden" id="f_photo_${i}" value="">
      <input type="file" accept="image/*" data-i="${i}" style="display:none;" onchange="Pages._uploadProfilePhoto(this)">
      <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-3); font-size:24px;">+</div>`;
    slot.onclick = () => slot.querySelector('input[type=file]').click();
  },
  async _uploadProfilePhoto(input) {
    const i = input.dataset.i;
    const f = input.files[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { App.toast('图片不能超过 3MB'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await App.api('/api/upload/photo', { method: 'POST', body: { image: reader.result, type: 'photo' } });
      if (res.code === 0) {
        const url = res.data.url;
        const hidden = document.getElementById('f_photo_' + i);
        if (hidden) hidden.value = url;
        const slot = document.querySelector(`#f_photos_grid .photo-slot[data-i="${i}"]`);
        if (slot) {
          slot.innerHTML = `<input type="hidden" id="f_photo_${i}" value="${url}">
            <input type="file" accept="image/*" data-i="${i}" style="display:none;" onchange="Pages._uploadProfilePhoto(this)">
            <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
            <div style="position:absolute; top:4px; right:4px; width:20px; height:20px; background:rgba(0,0,0,0.5); color:#fff; border-radius:50%; text-align:center; line-height:20px; font-size:14px;" onclick="event.stopPropagation(); Pages._clearProfilePhoto(${i})">×</div>`;
          slot.onclick = () => slot.querySelector('input[type=file]').click();
        }
        App.toast(`第 ${Number(i)+1} 张已上传`);
      } else App.toast(res.msg);
    };
    reader.readAsDataURL(f);
  },
  async saveProfile() {
    const photos = [];
    for (let i = 0; i < 3; i++) {
      const v = document.getElementById('f_photo_' + i);
      if (v && v.value) photos.push(v.value);
    }
    const patch = {
      nickname: document.getElementById('f_nickname').value,
      birthday: document.getElementById('f_birthday').value,
      zodiac: document.getElementById('f_zodiac').value,
      bloodType: document.getElementById('f_bloodType').value,
      weight: parseFloat(document.getElementById('f_weight').value) || 0,
      city: document.getElementById('f_city').value,
      height: parseInt(document.getElementById('f_height').value),
      education: document.getElementById('f_education').value,
      job: document.getElementById('f_job').value,
      income: document.getElementById('f_income').value,
      incomeCurrency: document.getElementById('f_incomeCurrency').value,
      marriage: document.getElementById('f_marriage').value,
      bio: document.getElementById('f_bio').value,
      country: document.getElementById('f_country').value,
      state: document.getElementById('f_state').value,
      city: document.getElementById('f_city').value,
      photos: photos
    };
    // 男生额外字段
    const hasHouseEl = document.getElementById('f_hasHouse');
    const hasCarEl = document.getElementById('f_hasCar');
    if (hasHouseEl) patch.hasHouse = hasHouseEl.value;
    if (hasCarEl) patch.hasCar = hasCarEl.value;
    const res = await App.api('/api/me', { method: 'PUT', body: patch });
    if (res.code === 0) { App.user = res.data; App.toast('保存成功'); Pages.renderMine(); }
    else App.toast(res.msg);
  },

  async showConversations() {
    // 更新URL hash（仅当hash变化时才更新，避免递归）
    const newHash = 'conversations';
    if (window.location.hash !== '#' + newHash) {
      window.location.hash = newHash;
    }
    if (!App.user) return Auth.openLogin();
    const content = document.getElementById('content');
    content.innerHTML = '<div class="page active"><div class="loading">加载中...</div></div>';
    const res = await App.api('/api/conversations');
    if (res.code === 0) {
      // 过滤无效会话（对方用户可能被删除）
      const conversations = (res.data || []).filter(c => c && c.partner);
      content.innerHTML = `<div class="page active chat-page"><h2 style="padding: 0 4px 12px;">消息</h2><div class="chat-list">${conversations.length ? conversations.map(c => `
        <div class="item" onclick="Chat.open('${c.partner.id}')">
          <img src="${c.partner.avatar || ''}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23ff5a6e%22 width=%22100%22 height=%22100%22 rx=%2250%22/><text x=%2250%22 y=%2264%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2236%22>?</text></svg>'">
          <div class="info">
            <div style="display:flex; justify-content:space-between;">
              <span class="name">${c.partner.nickname || '未知用户'}</span>
              <span class="time">${c.lastMsg && c.lastMsg.createdAt ? new Date(c.lastMsg.createdAt).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'}) : ''}</span>
            </div>
            <div class="preview">${(c.lastMsg && c.lastMsg.content) || ''}</div>
          </div>
        </div>
      `).join('') : '<div class="empty"><div class="icon"><i class="fas fa-comment"></i></div>暂无消息<br><span style="font-size:12px;">去找个心仪的TA打招呼吧</span></div>'}</div></div>`;
    }
  },

  async showLikes() {
    // 更新URL hash（仅当hash变化时才更新，避免递归）
    const newHash = 'likes';
    if (window.location.hash !== '#' + newHash) {
      window.location.hash = newHash;
    }
    if (!App.user) return Auth.openLogin();
    const content = document.getElementById('content');
    content.innerHTML = '<div class="page active"><div class="loading">加载中...</div></div>';
    const res = await App.api('/api/me/likes');
    const users = (res.code === 0 && res.data && res.data.list) ? res.data.list : [];
    // 同步本端 likes
    if (App.user) App.user.likes = users.map(u => u.id);
    content.innerHTML = `<div class="page active"><h2 style="padding: 4px 4px 12px;">我喜欢的 (${users.length})</h2><div class="user-grid">${users.length ? users.map(u => Pages.userCard(u, 'liked')).join('') : '<div class="empty"><div class="icon"><i class="fas fa-heart"></i></div>还没喜欢过谁<br><span style="font-size:12px;color:var(--text-3);">去首页点「喜欢TA」吧</span></div>'}</div></div>`;
  },

  async showLikedBy() {
    // 更新URL hash（仅当hash变化时才更新，避免递归）
    const newHash = 'likedBy';
    if (window.location.hash !== '#' + newHash) {
      window.location.hash = newHash;
    }
    if (!App.user) return Auth.openLogin();
    // 检查VIP权限
    this._checkVipPermission('view_liked', async () => {
      const content = document.getElementById('content');
      content.innerHTML = '<div class="page active"><div class="loading">加载中...</div></div>';
      const res = await App.api('/api/me/liked-by');
      const users = (res.code === 0 && res.data && res.data.list) ? res.data.list : [];
      content.innerHTML = `<div class="page active"><h2 style="padding: 4px 4px 12px;">谁喜欢我 (${users.length})</h2><div class="user-grid">${users.length ? users.map(Pages.userCard).join('') : '<div class="empty"><div class="icon">💌</div>还没有人喜欢你<br><span style="font-size:12px;color:var(--text-3);">完善资料让更多人看到你</span></div>'}</div></div>`;
    });
  },

  // VIP升级引导弹窗
  async _showVipUpgradePopup() {
    // 获取联系我们配置
    const res = await App.api('/api/contact');
    const c = (res.code === 0 && res.data) ? res.data : {};
    const wechat = c.wechat || '';
    const qrcode = c.wechatQrcode || c.qrcodeImage || '';
    // 填充弹窗内容
    const wechatText = document.getElementById('vipWechatText');
    if (wechatText) wechatText.textContent = wechat || '请联系客服';
    const qrcodeBox = document.getElementById('vipQrcodeBox');
    if (qrcodeBox) {
      qrcodeBox.innerHTML = qrcode ? `<img src="${qrcode}" style="width:160px;height:160px;border-radius:8px;border:1px solid #eee;display:block;margin:0 auto;" onerror="this.style.display='none'">` : '';
    }
    const modal = document.getElementById('vipUpgradeModal');
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
  },

  showVip() { App.switchPage('vip'); },

  async renderVipService() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="page active"><div class="loading">加载中...</div></div>';
    // 加载 VIP 配置和站点配置（获取动态 tab 配置）
    const [vipRes, siteRes] = await Promise.all([
      App.api('/api/vip/service-config'),
      App.api('/api/site-config')
    ]);
    let cfg = {};
    try {
      if (vipRes.code === 0 && vipRes.data) cfg = vipRes.data;
    } catch(e) { console.error('VIP config load error', e); }
    const siteConfig = (siteRes.code === 0 && siteRes.data) || {};
    const vipTabs = Array.isArray(siteConfig.vipTabsConfig) && siteConfig.vipTabsConfig.length ? siteConfig.vipTabsConfig : [
      { id: 'service', title: 'VIP服务', enabled: true },
      { id: 'about', title: '关于VIP', enabled: true }
    ];
    const enabledTabs = vipTabs.filter(t => t.enabled);
    const c = cfg;
    const esc = (s) => String(s || '').replace(/[<>&"]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[ch]));
    // 默认 tab1 数据
    const tab1 = enabledTabs[0] || { id: 'service', title: 'VIP服务' };
    const bannerImg = c.bannerImage || '';
    const bannerTitle = c.bannerTitle || '定制会员';
    const bannerSubtitle = c.bannerSubtitle || '';
    const section1Title = c.section1Title || '哪些人适合1对1定制服务';
    const crowd = Array.isArray(c.crowdItems) ? c.crowdItems : [
      { icon: '/uploads/vip_icons/1.png', title: '交友疲惫', desc: '没有方向' },
      { icon: '/uploads/vip_icons/9.png', title: '工作忙碌', desc: '异性圈窄' },
      { icon: '/uploads/vip_icons/11.png', title: '独立自主', desc: '不愿将就' },
      { icon: '/uploads/vip_icons/12.png', title: '身份特殊', desc: '需要私密' }
    ];
    const section2Title = c.section2Title || '专属服务 祝你脱单';
    const services = Array.isArray(c.serviceItems) ? c.serviceItems : [
      { icon: '/uploads/vip_icons/1.png', title: '精准1对1匹配', desc: '匹配老师1对1深度了解，专属服务。' },
      { icon: '/uploads/vip_icons/2.png', title: '红娘主动推荐', desc: '匹配老师根据你的需求主动筛选推荐。' },
      { icon: '/uploads/vip_icons/3.png', title: '开放隐藏会员', desc: '部分隐藏优质资源为你打开。' },
      { icon: '/uploads/vip_icons/4.png', title: '优先优质配对', desc: '高颜值，公务员等优质精英优先为你匹配。' },
      { icon: '/uploads/vip_icons/5.png', title: '情感指导服务', desc: '专属匹配老师提供情感咨询与辅导，辅助你脱单。' },
      { icon: '/uploads/vip_icons/6.png', title: '个人形象提升', desc: '专业指导形象改造，提升你的内外吸引力。' },
      { icon: '/uploads/vip_icons/7.png', title: '线下约见服务', desc: '双方互感兴趣，提供约会方案，安排见面。' },
      { icon: '/uploads/vip_icons/8.png', title: '及时反馈结果', desc: '牵线或约见后，及时跟进反馈双方印象。' }
    ];

    let tabsHtml = '';
    let contentHtml = '';
    if (enabledTabs.length > 0) {
      tabsHtml = enabledTabs.map((t, i) => `<a class="vsp-tab${i===0?' active':''}" data-tab="${t.id}" onclick="Pages._switchVipTab(this,'${t.id}')">${esc(t.title)}</a>`).join('');
      // 第一个 tab：VIP 服务（使用现有结构）
      contentHtml += `<div id="vipTab_${enabledTabs[0].id}" class="vip-tab-content">${bannerImg ? `<div class="vsp-banner" style="background-image:url('${esc(bannerImg)}')"><div class="vsp-banner-text">${esc(bannerTitle).replace(/\\n|\n/g,'<br>')}</div></div>` :
        `<div class="vsp-banner vsp-banner-default"><div class="vsp-banner-text">${esc(bannerTitle).replace(/\\n|\n/g,'<br>')}<br><small>${esc(bannerSubtitle)}</small></div></div>`}
        <div class="vsp-section">
          <h3 class="vsp-section-title">${esc(section1Title)}</h3>
          <div class="vsp-crowd-grid">${crowd.map(item => `
              <div class="vsp-crowd-item">
                <div class="vsp-crowd-icon"><img src="${esc(item.icon)}" onerror="this.parentElement.style.display='none'"></div>
                <div class="vsp-crowd-title">${esc(item.title)}</div>
                <div class="vsp-crowd-desc">${esc(item.desc)}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="vsp-section">
          <h3 class="vsp-section-title">${esc(section2Title)}</h3>
          <div class="vsp-service-list">${services.map(item => `
              <div class="vsp-svc-item">
                <div class="vsp-svc-icon"><img src="${esc(item.icon)}" onerror="this.parentElement.innerHTML='<span>✦</span>'"></div>
                <div class="vsp-svc-info">
                  <div class="vsp-svc-title">${esc(item.title)}</div>
                  <div class="vsp-svc-desc">${esc(item.desc)}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
      // 其余 tab：从 vipTabsConfig 读取 content，若无则显示默认"关于VIP"内容
      for (let i = 1; i < enabledTabs.length; i++) {
        const t = enabledTabs[i];
        const tabContent = t.content || '<div style="padding:20px;text-align:center;color:var(--text-3);">暂无内容，请在后台配置</div>';
        contentHtml += `<div id="vipTab_${t.id}" class="vip-tab-content" style="display:none;">${tabContent}</div>`;
      }
    }

    content.innerHTML = `
    <div class="page active vip-service-page">
      <div class="vsp-tabs">${tabsHtml}</div>
      ${contentHtml}
      <div class="vip-float-bar" onclick="Pages._showVipUpgradePopup()">
        <i class="fas fa-crown"></i> 立即升级成为VIP
      </div>
    </div>`;
  },

  _switchVipTab(el, tabId) {
    document.querySelectorAll('.vsp-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.vip-tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById('vipTab_' + tabId);
    if (target) target.style.display = '';
  },
  showSettings() { App.toast('设置功能开发中'); },
  logout() {
    if (confirm('确定退出登录吗？')) {
      App.token = ''; App.user = null;
      localStorage.removeItem('zeai_token');
      localStorage.removeItem('zeai_saved_pwd');
      App.updateLoginUI(); App.toast('已退出');
      App.switchPage('home');
    }
  },

  // ===== 新注册流程页面（参考截图5-28） =====
  _regStep: 1, // 当前步骤：1=帐号信息, 2=基本资料, 3=择偶要求, 4=完成
  _regData: {}, // 注册数据缓存
  _regCountdown: 0, // 验证码倒计时

  /** 打开新注册流程（全屏页面，非弹窗） */
  openRegisterFlow() {
    this._regStep = 1;
    this._regData = {};
    clearInterval(this._regCountdown);
    // 确保协议数据已加载
    if (!Auth._agreements) Auth._bindAgreementChecks();
    this._renderRegisterStep();
  },

  _renderRegisterStep() {
    const content = document.getElementById('content');
    const step = this._regStep;
    const d = this._regData;

    if (step === 1) {
      // 第1步：帐号信息（邮箱/手机 + 验证码 + 密码 + 协议）
      const cdText = (d._cd > 0) ? `${d._cd}s后重发` : '发送验证码';
      content.innerHTML = `<div class="page active register-page">
        <button style="position:absolute;top:14px;left:16px;background:none;border:none;font-size:22px;color:#666;cursor:pointer;z-index:10;" onclick="App.switchPage('home')"><i class="fas fa-chevron-left"></i></button>
        <div class="reg-steps">
          <div class="rs-step active"><div class="rs-step-num">1</div><div class="rs-step-label">帐号信息</div><div class="rs-line"></div></div>
          <div class="rs-step"><div class="rs-step-num">2</div><div class="rs-step-label">登记资料</div><div class="rs-line"></div></div>
          <div class="rs-step"><div class="rs-step-num">3</div><div class="rs-step-label">择偶要求</div><div class="rs-line"></div></div>
          <div class="rs-step"><div class="rs-step-num">4</div><div class="rs-step-label">注册完成</div></div>
        </div>

        <div class="reg-form-title" style="margin-top:30px;">创建帐号</div>
        <div class="reg-form-subtitle">请填写真实有效的联系方式</div>

        <!-- 帐号表单 -->
        <div class="reg-account-form">
          <div class="raf-group">
            <label>邮箱 <span class="required">*</span></label>
            <input type="email" id="regEmail" value="${(d.email||'').replace(/"/g,'&quot;')}" placeholder="请输入邮箱地址" autocomplete="email">
          </div>
          <div class="raf-row">
            <div class="raf-group flex-grow">
              <label>验证码 <span class="required">*</span></label>
              <input type="text" id="regCode" value="${(d.code||'').replace(/"/g,'&quot;')}" placeholder="请输入验证码" maxlength="6" autocomplete="one-time-code">
            </div>
            <button id="regSendBtn" class="raf-send-btn ${d._cd>0?'disabled':''}" onclick="Pages._sendRegCode()" ${d._cd>0?'disabled':''}>${cdText}</button>
          </div>
          <div class="raf-group">
            <label>设置密码 <span class="required">*</span></label>
            <input type="password" id="regPassword" value="${(d.password||'').replace(/"/g,'&quot;')}" placeholder="请设置6位以上密码" autocomplete="new-password">
          </div>

          <!-- 协议勾选 -->
          <div class="raf-agreement" onclick="Pages._toggleAgreement(this)">
            <i class="${d.agreed ? 'fas fa-check-circle raf-agree-icon checked' : 'far fa-circle raf-agree-icon'}"></i>
            <span>我已阅读并同意 <a href="javascript:void(0)" onclick="event.stopPropagation();Auth.showAgreement('user')">《${(Auth._agreements&&Auth._agreements.user)?Auth._agreements.user.title:'用户服务协议'}》</a> 和 <a href="javascript:void(0)" onclick="event.stopPropagation();Auth.showAgreement('vip')">《${(Auth._agreements&&Auth._agreements.vip)?Auth._agreements.vip.title:'VIP会员服务协议'}》</a></span>
          </div>

          <button class="reg-next-btn" onclick="Pages._regNextStep()">下一步 (1/4)</button>
        </div>
      </div>`;
    } else if (step === 2) {
      // 第2步：基本资料（头像+双列表单）
      content.innerHTML = `<div class="page active register-page">
        <button style="position:absolute;top:14px;left:16px;background:none;border:none;font-size:22px;color:#666;cursor:pointer;z-index:10;" onclick="Pages._regStep=1;Pages._renderRegisterStep()"><i class="fas fa-chevron-left"></i></button>
        <div class="reg-steps">
          <div class="rs-step done"><div class="rs-step-num"><i class="fas fa-check" style="font-size:13px;"></i></div><div class="rs-step-label">帐号信息</div><div class="rs-line"></div></div>
          <div class="rs-step active"><div class="rs-step-num">2</div><div class="rs-step-label">登记资料</div><div class="rs-line"></div></div>
          <div class="rs-step"><div class="rs-step-num">3</div><div class="rs-step-label">择偶要求</div><div class="rs-line"></div></div>
          <div class="rs-step"><div class="rs-step-num">4</div><div class="rs-step-label">注册完成</div></div>
        </div>

        <div class="reg-form-title" style="margin-top:30px;">基本资料</div>
        <div class="reg-form-subtitle">请完善以下真实信息，否则将不能通过审核<br>注册完成后，生日无法更改</div>

        <!-- 上传头像 -->
        <div class="reg-avatar-upload" onclick="Pages._pickRegAvatar()">
          ${d.avatar ? `<img src="${d.avatar}">` : '<i class="fas fa-camera"></i><span>上传头像</span>'}
        </div>

        <!-- 双列表单 -->
        <div class="reg-form-fields">
          <div class="rf-row">
            <div class="rf-cell" onclick="Pages._openPicker('gender')"><div class="rf-cell-label">性别</div><div class="rf-cell-value ${d.gender?'filled':''}">${d.gender||'请选择'}</div></div>
            <div class="rf-cell" onclick="Pages._openInputPicker('nickname')"><div class="rf-cell-label">昵称</div><div class="rf-cell-value ${d.nickname?'filled':''}">${d.nickname||'请输入'}</div></div>
          </div>
          <div class="rf-row">
            <div class="rf-cell" onclick="Pages._openDatePicker('birthday')"><div class="rf-cell-label">生日</div><div class="rf-cell-value ${d.birthday?'filled':''}">${d.birthday||'请选择'}</div></div>
            <div class="rf-cell" onclick="Pages._openCityPicker()"><div class="rf-cell-label">所在地</div><div class="rf-cell-value ${d.city?'filled':''}">${d.city||'请选择'}</div></div>
          </div>
          <div class="rf-row">
            <div class="rf-cell full-width" onclick="Pages._openInputPicker('wechatId')"><div class="rf-cell-label">微信号</div><div class="rf-cell-value ${d.wechatId?'filled':''}">${d.wechatId||'请输入微信号'}</div></div>
          </div>
          <div class="rf-row">
            <div class="rf-cell" onclick="Pages._openPicker('maritalStatus')"><div class="rf-cell-label">婚姻状况</div><div class="rf-cell-value ${d.maritalStatus?'filled':''}">${d.maritalStatus||'请选择'}</div></div>
            <div class="rf-cell" onclick="Pages._openPicker('height')"><div class="rf-cell-label">身高</div><div class="rf-cell-value ${d.height?'filled':''}">${d.height||(d.heightVal?d.heightVal+'cm':'请选择')}</div></div>
          </div>
          <div class="rf-row">
            <div class="rf-cell" onclick="Pages._openPicker('education')"><div class="rf-cell-label">学历</div><div class="rf-cell-value ${d.education?'filled':''}">${d.education||'请选择'}</div></div>
            <div class="rf-cell" onclick="Pages._openSalaryPicker()"><div class="rf-cell-label">年薪</div><div class="rf-cell-value ${d.salary?'filled':''}">${d.salary||'请选择'}</div></div>
          </div>
          <div class="rf-row">
            <div class="rf-cell" onclick="Pages._openPicker('house')"><div class="rf-cell-label">房产信息</div><div class="rf-cell-value ${d.house?'filled':''}">${d.house||'请选择'}</div></div>
            <div class="rf-cell" onclick="Pages._openPicker('car')"><div class="rf-cell-label">车辆信息</div><div class="rf-cell-value ${d.car?'filled':''}">${d.car||'请选择'}</div></div>
          </div>
          <div class="rf-row">
            <div class="rf-cell full-width" onclick="Pages._openPicker('marriageTime')"><div class="rf-cell-label">期望结婚时间</div><div class="rf-cell-value ${d.marriageTime?'filled':''}">${d.marriageTime||'请选择'}</div></div>
          </div>
          <div class="rf-row">
            <div class="rf-cell full-width" onclick="Pages._openMultiPicker('hobby')"><div class="rf-cell-label">兴趣爱好</div><div class="rf-cell-value ${d.hobby&&d.hobby.length?'filled':''}">${d.hobby&&d.hobby.length?d.hobby.join(','):''}</div></div>
          </div>
        </div>

        <button class="reg-next-btn" onclick="Pages._regNextStep()">下一步 (2/4)</button>
      </div>`;
    } else if (step === 3) {
      // 第3步：择偶要求
      content.innerHTML = `<div class="page active register-page">
        <button style="position:absolute;top:14px;left:16px;background:none;border:none;font-size:22px;color:#666;cursor:pointer;z-index:10;" onclick="Pages._regStep=2;Pages._renderRegisterStep()"><i class="fas fa-chevron-left"></i></button>
        <div class="reg-steps">
          <div class="rs-step done"><div class="rs-step-num"><i class="fas fa-check" style="font-size:13px;"></i></div><div class="rs-step-label">帐号信息</div><div class="rs-line"></div></div>
          <div class="rs-step done"><div class="rs-step-num"><i class="fas fa-check" style="font-size:13px;"></i></div><div class="rs-step-label">登记资料</div><div class="rs-line"></div></div>
          <div class="rs-step active"><div class="rs-step-num">3</div><div class="rs-step-label">择偶要求</div><div class="rs-line"></div></div>
          <div class="rs-step"><div class="rs-step-num">4</div><div class="rs-step-label">注册完成</div></div>
        </div>

        <div class="reg-form-title" style="margin-top:30px;">择偶要求</div>
        <div class="reg-form-subtitle">不要为幸福设置太高门槛<br>相处后才有可能找到真爱</div>

        <div class="reg-form-fields">
          <div class="rf-row">
            <div class="rf-cell" onclick="Pages._openRangePicker('mateAge')"><div class="rf-cell-label">年龄范围</div><div class="rf-cell-value ${d.mateAgeMin?'filled':''}">${d.mateAgeMin?(d.mateAgeMin+'~'+(d.mateAgeMax||'?')):'请选择'}</div></div>
            <div class="rf-cell" onclick="Pages._openRangePicker('mateHeight')"><div class="rf-cell-label">身高范围</div><div class="rf-cell-value ${d.mateHeightMin?'filled':''}">${d.mateHeightMin?(d.mateHeightMin+'~'+(d.mateHeightMax||'?')):'请选择'}</div></div>
          </div>
          <div class="rf-row">
            <div class="rf-cell" onclick="Pages._openMultiPicker('mateMarriage')"><div class="rf-cell-label">婚况要求</div><div class="rf-cell-value ${d.mateMarriage&&d.mateMarriage.length?'filled':''}">${d.mateMarriage&&d.mateMarriage.length?d.mateMarriage.join(','):'请选择'}</div></div>
            <div class="rf-cell" onclick="Pages._openPicker('mateEdu')"><div class="rf-cell-label">最低学历</div><div class="rf-cell-value ${d.mateEdu?'filled':''}">${d.mateEdu||'请选择'}</div></div>
          </div>
          <div class="rf-row">
            <div class="rf-cell" onclick="Pages._openMateSalaryPicker()"><div class="rf-cell-label">最低年薪</div><div class="rf-cell-value ${d.mateSalary?'filled':''}">${d.mateSalary||'请选择'}</div></div>
            <div class="rf-cell" onclick="Pages._openInputPicker('mateOther')"><div class="rf-cell-label">其他要求</div><div class="rf-cell-value ${d.mateOther?'filled':''}">${d.mateOther||'请输入'}</div></div>
          </div>
        </div>

        <button class="reg-next-btn" onclick="Pages._regSubmit()">提交注册 (3/4)</button>
      </div>`;
    }
  },

  async _regNextStep() {
    const d = this._regData;
    if (this._regStep === 1) {
      // 第1步 → 第2步：校验并异步创建基础账号
      const email = document.getElementById('regEmail').value.trim();
      const code = document.getElementById('regCode').value.trim();
      const password = document.getElementById('regPassword').value.trim();
      if (!email) return App.toast('请输入邮箱');
      if (!code) return App.toast('请输入验证码');
      if (!password || password.length < 6) return App.toast('密码至少6位');
      if (!d.agreed) return App.toast('请阅读并同意用户协议');
      d.email = email; d.code = code; d.password = password;
      App.toast('创建账号中...');
      try {
        const res = await App.api('/api/register/init', { method: 'POST', body: { email, password, code } });
        if (res.code !== 0) return App.toast(res.msg || '创建账号失败');
        App.token = res.data.token;
        App.user = res.data.user;
        localStorage.setItem('zeai_token', App.token);
        localStorage.setItem('zeai_saved_account', email);
        App.updateLoginUI();
        this._regStep = 2;
      } catch(e) {
        App.toast('网络错误，请检查网络连接');
        return;
      }
    } else if (this._regStep === 2) {
      // 第2步 → 第3步：校验基本资料（全部必填）
      if (!d.gender) return App.toast('请选择性别');
      if (!d.nickname || !d.nickname.trim()) return App.toast('请输入昵称');
      if (!d.birthday) return App.toast('请选择生日');
      if (!d.maritalStatus) return App.toast('请选择婚姻状况');
      if (!d.height) return App.toast('请选择身高');
      if (!d.education) return App.toast('请选择学历');
      if (!d.salary) return App.toast('请选择年薪');
      if (!d.house) return App.toast('请选择房产信息');
      if (!d.car) return App.toast('请选择车辆信息');
      if (!d.hobby || !d.hobby.length) return App.toast('请选择兴趣爱好');
      this._regStep = 3;
    }
    this._renderRegisterStep();
  },

  /** 发送注册验证码 */
  async _sendRegCode() {
    const emailEl = document.getElementById('regEmail');
    if (!emailEl || !emailEl.value.trim()) {
      App.toast('请先输入邮箱'); return;
    }
    const email = emailEl.value.trim();
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      App.toast('邮箱格式不正确'); return;
    }
    const btn = document.getElementById('regSendBtn');
    if (btn && btn.disabled) return;

    App.toast('验证码发送中...');
    try {
      const res = await App.api('/api/auth/send-code', { method: 'POST', body: { email } });
      if (res.code === 0) {
        this._regData._cd = 60;
        this._startCountdown(btn);
        App.toast(res.msg || '验证码已发送，请注意查收');
      } else {
        App.toast(res.msg || '发送失败，请稍后重试');
      }
    } catch(e) {
      App.toast('网络错误，请检查网络连接');
    }
  },

  /** 验证码倒计时 */
  _startCountdown(btn) {
    if (!btn) btn = document.getElementById('regSendBtn');
    clearInterval(this._regCountdown);
    this._regCountdown = setInterval(() => {
      this._regData._cd--;
      if (this._regData._cd <= 0) {
        clearInterval(this._regCountdown);
        if (btn) { btn.textContent = '发送验证码'; btn.disabled = false; btn.classList.remove('disabled'); }
      } else {
        if (btn) { btn.textContent = `${this._regData._cd}s后重发`; btn.disabled = true; btn.classList.add('disabled'); }
      }
    }, 1000);
  },

  /** 切换协议勾选状态 */
  _toggleAgreement(el) {
    // 先从 DOM 读取当前已填写的值，避免重渲染丢失
    this._saveRegStep1Input();
    this._regData.agreed = !this._regData.agreed;
    this._renderRegisterStep();
  },

  /** 保存第1步表单输入值到缓存 */
  _saveRegStep1Input() {
    const emailEl = document.getElementById('regEmail');
    const codeEl = document.getElementById('regCode');
    const pwEl = document.getElementById('regPassword');
    if (emailEl) this._regData.email = emailEl.value.trim();
    if (codeEl) this._regData.code = codeEl.value.trim();
    if (pwEl) this._regData.password = pwEl.value;
  },

  async _regSubmit() {
    const d = this._regData;
    // 校验必填项
    if (!d.email) return App.toast('请输入邮箱');
    if (!d.password) return App.toast('请设置密码');
    if (!d.code) return App.toast('请输入验证码');
    if (!d.agreed) return App.toast('请阅读并同意用户协议');
    if (!d.nickname || !d.nickname.trim()) return App.toast('请输入昵称');
    if (!d.gender) return App.toast('请选择性别');
    if (!d.birthday) return App.toast('请选择生日');
    if (!d.avatar) return App.toast('请上传头像');

    App.toast('提交注册中...');
    try {
      // 构建所在地字符串
      const location = [d._country, d._province, d.city].filter(Boolean).join(' ');
      const body = {
        nickname: d.nickname.trim(),
        gender: d.gender,
        avatar: d.avatar,
        wechatId: d.wechatId || '',
        birthday: d.birthday,
        height: d.height || '',
        education: d.education || '',
        income: d.salary || '',
        salaryCurrency: d.salaryCurrency || 'CNY',
        maritalStatus: d.maritalStatus || '',
        house: d.house || '',
        car: d.car || '',
        hobby: Array.isArray(d.hobby) ? d.hobby.join(',') : (d.hobby || ''),
        location: location,
        city: d.city || '',
        _country: d._country || '',
        _province: d._province || '',
        weight: d.weight || '',
        marriageTime: d.marriageTime || '',
        // 择偶要求
        mateAgeMin: d.mateAgeMin || '',
        mateAgeMax: d.mateAgeMax || '',
        mateHeightMin: d.mateHeightMin || '',
        mateHeightMax: d.mateHeightMax || '',
        mateEducation: d.mateEdu || '',
        mateMaritalStatus: Array.isArray(d.mateMarriage) ? d.mateMarriage.join(',') : (d.mateMarriage || ''),
        mateSalary: d.mateSalary || '',
        mateSalaryCurrency: d.mateSalaryCurrency || 'CNY',
        mateOther: d.mateOther || '',
        registerFor: d.registerFor || '',
      };
      const res = await App.api('/api/register/complete', { method: 'POST', body });
      if (res.code === 0) {
        App.user = res.data.user;
        App.updateLoginUI();
        this._renderRegSuccess();
      } else {
        App.toast(res.msg || '注册失败，请重试');
      }
    } catch(e) {
      App.toast('网络错误，请检查网络连接');
    }
  },

  async _renderRegSuccess() {
    const content = document.getElementById('content');
    // 隐藏顶部导航、安全提示、底部导航，实现全屏效果
    const topbar = document.querySelector('.topbar');
    const safetyTip = document.querySelector('.safety-tip');
    const bottombar = document.querySelector('.bottombar');
    if(topbar) topbar.style.display = 'none';
    if(safetyTip) safetyTip.style.display = 'none';
    if(bottombar) bottombar.style.display = 'none';

    // 读取客服配置
    const contactRes = await App.api('/api/contact', { method: 'GET' });
    const contact = (contactRes.code === 0 && contactRes.data) || {};
    const csAccount = contact.wechat || 'starmeet_vip';
    const csQr = contact.wechatQrcode || contact.qrcodeImage || ('https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent('wechat://' + csAccount));

    content.innerHTML = `<div class="page active reg-success-page">
      <div class="rsp-container">
        <div class="rsp-check-icon"><i class="fas fa-check"></i></div>
        <div class="rsp-title">恭喜您，注册成功！</div>
        <div class="rsp-subtitle">离脱单又近了一步，稍后客服将进行审核</div>

        <div class="rsp-cs-card">
          <img class="rsp-qrcode" src="${csQr}" onerror="this.src='https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(csAccount)}'" alt="客服微信二维码">
        </div>

        <button class="rsp-cs-btn" onclick="Pages._copyCsAccount('${csAccount}')">
          <i class="fab fa-weixin" style="color:#07c160;font-size:18px;margin-right:6px;"></i>
          <span>客服微信号：${csAccount}</span>
          <i class="far fa-copy" style="margin-left:auto;color:#999;font-size:15px;"></i>
        </button>

        <div class="rsp-qrcode-hint">扫描二维码或复制客服微信号添加客服</div>

        <button class="rsp-enter-btn" onclick="Pages._enterAfterReg()">先去看看</button>
      </div>
    </div>`;
  },

  /** 复制客服账号 */
  _copyCsAccount(account) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(account).then(() => App.toast('客服账号已复制：' + account)).catch(() => this._fallbackCopy(account));
    } else {
      this._fallbackCopy(account);
    }
  },

  _fallbackCopy(text) {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position='fixed';ta.style.left='-9999px'; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); App.toast('客服账号已复制：' + text); } catch(e) { App.toast('复制失败，请手动复制：' + text); }
    document.body.removeChild(ta);
  },

  /** 注册完成后进入网站 */
  _enterAfterReg() {
    // 恢复顶部导航、安全提示、底部导航
    const topbar = document.querySelector('.topbar');
    const safetyTip = document.querySelector('.safety-tip');
    const bottombar = document.querySelector('.bottombar');
    if(topbar) topbar.style.display = '';
    if(safetyTip) safetyTip.style.display = '';
    if(bottombar) bottombar.style.display = '';
    // 注册API已在_regSubmit中设置好了App.user和token，这里直接跳转首页
    App.switchPage('home');
    App.toast('欢迎加入 StarMeet！');
  },

  // ===== 底部弹出选择器组件 =====
  _currentPicker: null,

  /** 显示底部选择器 */
  _showPicker(options) {
    const { title, items, selectedValue, multi, grid, onCancel, onConfirm } = options;
    this.hidePicker();
    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.onclick = () => { this.hidePicker(); if(onCancel) onCancel(); };

    const sheet = document.createElement('div');
    sheet.className = 'picker-sheet show';
    sheet.id = 'activePickerSheet';

    let optionsHtml = '';
    if (grid) {
      // 两列网格模式（如兴趣爱好）
      optionsHtml = `<div class="picker-options po-grid po-multi">${items.map(item =>
        `<div class="po-item${Array.isArray(selectedValue)&&selectedValue.includes(item)?' checked':''}" data-val="${item}" onclick="Pages._togglePickerItem(this)">${item}</div>`
      ).join('')}</div>`;
    } else if (multi) {
      // 多选列表
      optionsHtml = `<div class="picker-options po-multi">${items.map(item =>
        `<div class="po-item${Array.isArray(selectedValue)&&selectedValue.includes(item)?' checked selected':''}" data-val="${item}" onclick="Pages._togglePickerItem(this)">${item}<i class="fas fa-check po-check-icon"></i></div>`
      ).join('')}</div>`;
    } else {
      // 单选列表
      optionsHtml = `<div class="picker-options">${items.map(item =>
        `<div class="po-item${selectedValue===item?' selected':''}" data-val="${item}" onclick="document.querySelectorAll('#activePickerSheet .po-item').forEach(el=>{el.classList.remove('selected')});this.classList.add('selected')">${item}${selectedValue===item?'<i class=\"fas fa-check\" style=\"float:right;\"></i>':''}</div>`
      ).join('')}</div>`;
    }

    sheet.innerHTML = `
      <div class="picker-header">
        <span class="picker-cancel" id="pickerCancelBtn">取消</span>
        <span class="picker-title">${title}</span>
        <button class="picker-confirm" id="pickerConfirmBtn">确定</button>
      </div>
      ${optionsHtml}
    `;

    sheet.querySelector('#pickerCancelBtn').onclick = () => { this.hidePicker(); if(onCancel) onCancel(); };
    sheet.querySelector('#pickerConfirmBtn').onclick = () => {
      if (multi || grid) {
        const vals = Array.from(sheet.querySelectorAll('.po-item.checked')).map(el => el.dataset.val);
        this.hidePicker();
        if(onConfirm) onConfirm(vals);
      } else {
        const sel = sheet.querySelector('.po-item.selected');
        this.hidePicker();
        if(onConfirm && sel) onConfirm(sel.dataset.val);
      }
    };
    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    this._currentPicker = { mask, sheet };
  },

  hidePicker() {
    if (this._currentPicker) {
      this._currentPicker.mask.remove();
      this._currentPicker.sheet.remove();
      this._currentPicker = null;
    }
  },

  /** 切换多选picker项的选中状态 */
  _togglePickerItem(el) {
    el.classList.toggle('checked');
    el.classList.toggle('selected');
    // 更新勾选图标颜色
    const icon = el.querySelector('.po-check-icon');
    if (icon) {
      icon.style.color = el.classList.contains('checked') ? 'var(--primary)' : 'transparent';
    }
  },

  // 各类选择器快捷方法
  _openPicker(type) {
    const configs = {
      gender: { title: '性别', items: ['男','女'] },
      maritalStatus: { title: '婚况', items: ['未婚','已婚','离异','丧偶'] },
      height: { title: '身高', items: Array.from({length:81},(_,i)=>(140+i)+'cm') },
      education: { title: '学历', items: ['初中','高中','大专','本科','硕士','博士'] },
      salary: { title: '月薪', items: ['1千以下','1~2千','2~3千','3~4千','5~8千','8千~1万','1~2万','2~5万','5万以上'] },
      house: { title: '房子', items: ['全款购房','按揭购房','有能力购房','老家自建房','暂未购房'] },
      car: { title: '车子', items: ['全款购车','按揭购车','未购车'] },
      marriageTime: { title: '期望结婚时间', items: ['随时','半年内','一年内','两年内','三年内','暂不考虑'] },
      registerFor: { title: '替谁征婚', items: ['为自己','父亲为子女','母亲为子女','为亲友'] },
      mateEdu: { title: '最低学历', items: ['初中','高中','大专','本科','硕士','博士'] },
      mateSalary: { title: '最低月薪', items: ['1~2千','2~3千','3~4千','5~8千','8千~1万','1~2万','2~5万'] }
    };
    const cfg = configs[type];
    if (!cfg) return;
    this._showPicker({
      ...cfg,
      selectedValue: this._regData[type],
      onConfirm: val => { this._regData[type] = val; this._renderRegisterStep(); }
    });
  },

  _openMultiPicker(type) {
    const cfgs = {
      hobby: { title: '兴趣爱好（可多选）', items: ['运动','美食','音乐','影视','娱乐','科学','汽车','聚会','睡觉觉','理财','网购','旅游','钓鱼','吹牛','读书','玩游戏'], grid: true },
      mateMarriage: { title: '婚况要求（可多选）', items: ['未婚','已婚','离异','丧偶'], multi: true }
    };
    const cfg = cfgs[type];
    if (!cfg) return;
    this._showPicker({
      ...cfg,
      selectedValue: this._regData[type] || [],
      onConfirm: vals => { this._regData[type] = vals; this._renderRegisterStep(); }
    });
  },

  _openInputPicker(field) {
    const curVal = this._regData[field] || '';
    const labelMap = { nickname: '昵称', wechatId: '微信号', mateOther: '其他要求' };
    const phMap = { nickname: '请输入', wechatId: '请输入微信号', mateOther: '请输入' };
    this._showPicker({
      title: labelMap[field] || field,
      items: [],
      onConfirm: () => {}
    });
    // 替换为输入框
    const sheet = document.getElementById('activePickerSheet');
    if (sheet) {
      const optsEl = sheet.querySelector('.picker-options');
      if (optsEl) {
        // 昵称字段：限制只能输入中文和英文（使用keydown阻止非法字符，避免光标跳动）
        const isNickname = field === 'nickname';
        optsEl.innerHTML = `
          <div style="padding:16px;">
            <input type="text" id="pickerInputField" value="${curVal.replace(/"/g,'&quot;')}"
              placeholder="${phMap[field] || ('请输入' + labelMap[field])}"
              style="width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;font-size:15px;outline:none;"
              onfocus="this.style.borderColor='var(--primary)'"
              onblur="this.style.borderColor='#f0f0f0'"
              ${isNickname ? 'data-nickname-filter="1" maxlength="20"' : ''}
            >
            ${isNickname ? '<div style="font-size:12px;color:#999;margin-top:6px;">仅支持中文和英文字母，最多20字</div>' : ''}
          </div>
        `;
        // 昵称输入过滤：用keydown事件在输入前拦截非法字符，避免replace导致的光标跳动
        if (isNickname) {
          const inputEl = optsEl.querySelector('#pickerInputField');
          if (inputEl) {
            inputEl.addEventListener('keydown', function(e) {
              // 允许：退格/删除/方向键/Ctrl/A/C/V/X/Z等控制键
              if (e.key.length > 1 || e.ctrlKey || e.metaKey || e.altKey) return;
              // 只允许中文、英文字母、数字
              const ch = e.key;
              if (!/^[a-zA-Z\u4e00-\u9fa5]$/.test(ch)) {
                e.preventDefault();
              }
            });
            // 聚焦到输入框
            setTimeout(() => inputEl.focus(), 100);
          }
        }
        sheet.querySelector('#pickerConfirmBtn').onclick = () => {
          const v = document.getElementById('pickerInputField').value.trim();
          if (!v && field !== 'mateOther') return App.toast(`请输入${labelMap[field]}`);
          this._regData[field] = v;
          this.hidePicker();
          this._renderRegisterStep();
        };
      }
    }
  },

  /** 三列滚轮式日期选择器（年/月/日）——参考旧版starmeet_v1.0.3 */
  _openDatePicker(field) {
    const curVal = this._regData[field] || '';
    this.hidePicker();

    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.onclick = () => this.hidePicker();

    const sheet = document.createElement('div');
    sheet.className = 'picker-sheet show';
    sheet.id = 'activePickerSheet';

    // 不做任何日期范围限制，允许选择任意年月日
    const now = new Date();
    const yearList = [];
    for (let y = 1970; y <= now.getFullYear(); y++) yearList.push(y + '年');
    const monthList = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0') + '月');
    const dayList = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0') + '日');

    let selY = curVal ? curVal.substring(0, 4) + '年' : '2000年';
    let selM = curVal ? parseInt(curVal.substring(5, 7)) + '月' : '01月';
    let selD = curVal ? parseInt(curVal.substring(8, 10)) + '日' : '01日';

    sheet.innerHTML = `
      <div class="picker-header">
        <span class="picker-cancel" onclick="Pages.hidePicker()">取消</span>
        <span class="picker-title">生日</span>
        <button class="picker-confirm" onclick="Pages._confirmDate('${field}')">确定</button>
      </div>
      <div class="picker-wheel-wrap">
        <div class="pw-highlight"></div>
        <div class="pw-column" id="pwYearCol">${yearList.map(y => '<div class="pw-option' + (y === selY ? ' selected' : '') + '" data-v="' + y + '">' + y + '</div>').join('')}</div>
        <div class="pw-column" id="pwMonthCol">${monthList.map(m => '<div class="pw-option' + (m === selM ? ' selected' : '') + '" data-v="' + m + '">' + m + '</div>').join('')}</div>
        <div class="pw-column" id="pwDayCol">${dayList.map(d => '<div class="pw-option' + (d === selD ? ' selected' : '') + '" data-v="' + d + '">' + d + '</div>').join('')}</div>
      </div>`;

    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    this._currentPicker = { mask, sheet };
    this._curPickField = field;

    // 滚动选中 + 点击选中
    ['#pwYearCol', '#pwMonthCol', '#pwDayCol'].forEach(id => {
      const col = sheet.querySelector(id);
      if (!col) return;
      col.addEventListener('scroll', function() {
        clearTimeout(col._st);
        col._st = setTimeout(function() {
          var st = col.scrollTop + col.offsetHeight / 2 - 20;
          var opts = col.querySelectorAll('.pw-option');
          opts.forEach(function(o) { o.classList.remove('selected'); });
          for (var oi = 0; oi < opts.length; oi++) {
            if (Math.abs(opts[oi].offsetTop - st) < 21) { opts[oi].classList.add('selected'); break; }
          }
        }, 80);
      });
      // 支持点击选项
      var colOpts = col.querySelectorAll('.pw-option');
      for (var ci = 0; ci < colOpts.length; ci++) {
        (function(opt) {
          opt.addEventListener('click', function(e) {
            e.stopPropagation();
            var allOpts = col.querySelectorAll('.pw-option');
            allOpts.forEach(function(o) { o.classList.remove('selected'); });
            opt.classList.add('selected');
            col.scrollTo({ top: opt.offsetTop - col.offsetHeight / 2 + opt.offsetHeight / 2, behavior: 'smooth' });
          });
        })(colOpts[ci]);
      }
    });

    // 初始滚动到已选值
    requestAnimationFrame(function() {
      ['#pwYearCol', '#pwMonthCol', '#pwDayCol'].forEach(function(id) {
        var col = sheet.querySelector(id);
        if (!col) return;
        var selOpt = col.querySelector('.pw-option.selected');
        if (selOpt) col.scrollTo({ top: selOpt.offsetTop - col.offsetHeight / 2 + selOpt.offsetHeight / 2 });
      });
    });
  },

  _confirmDate(field) {
    var sheet = document.getElementById('activePickerSheet');
    if (!sheet) return;
    var getSel = function(id) {
      var col = sheet.querySelector(id);
      if (!col) return '';
      var s = col.querySelector('.pw-option.selected');
      return s ? s.dataset.v.replace(/年|月|日/g, '') : '';
    };
    var y = getSel('#pwYearCol'), m = getSel('#pwMonthCol'), d = getSel('#pwDayCol');
    this._regData[field] = y + '-' + m + '-' + d;
    this.hidePicker();
    this._renderRegisterStep();
  },

  _openCityPicker() {
    // 三级联动选择器：国家 → 省/州 → 城市
    this.hidePicker();

    const d = this._regData;
    const selCountry = d._country || '中国';
    const selProvince = d._province || '';
    const selCity = d.city || '';

    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.onclick = () => this.hidePicker();

    const sheet = document.createElement('div');
    sheet.className = 'picker-sheet show';
    sheet.id = 'activePickerSheet';

    sheet.innerHTML = `
      <div class="picker-header">
        <span class="picker-cancel" onclick="Pages.hidePicker()">取消</span>
        <span class="picker-title">所在地</span>
        <button class="picker-confirm" onclick="Pages._confirmLocation()">确定</button>
      </div>
      <div class="cascade-row">
        <div class="cascade-col" id="locCountryCol">
          <div class="po-item${selCountry==='中国'?' selected':''}" data-val="中国" onclick="Pages._selLocCountry(this)">中国</div>
          <div class="po-item${selCountry==='美国'?' selected':''}" data-val="美国" onclick="Pages._selLocCountry(this)">美国</div>
          <div class="po-item" data-val="其他" onclick="Pages._selLocCountry(this)">其他国家</div>
        </div>
        <div class="cascade-col" id="locProvinceCol"></div>
        <div class="cascade-col" id="locCityCol"></div>
      </div>`;

    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    this._currentPicker = { mask, sheet, data: this._regData };

    // 加载省份/州
    this._loadProvinces(selCountry);
    if (selProvince) {
      this._loadCities(selCountry, selProvince, selCity);
    }
  },

  /** 省份数据 */
  _locationData: {
    '中国': {
      '北京': ['北京市'],
      '上海': ['上海市'],
      '天津': ['天津市'],
      '重庆': ['重庆市'],
      '广东省': ['广州市','深圳市','东莞市','佛山市','珠海市','中山市','惠州市','江门市','汕头市','湛江市','茂名市','肇庆市','揭阳市','清远市','韶关市','梅州市','河源市','汕尾市','阳江市','潮州市'],
      '浙江省': ['杭州市','宁波市','温州市','绍兴市','嘉兴市','金华市','台州市','湖州市','丽水市','衢州市','舟山市'],
      '江苏省': ['南京市','苏州市','无锡市','常州市','南通市','徐州市','扬州市','镇江市','泰州市','盐城市','连云港市','淮安市','宿迁市'],
      '四川省': ['成都市','绵阳市','德阳市','南充市','宜宾市','自贡市','乐山市','泸州市','达州市','内江市','遂宁市','攀枝花市','广元市','眉山市','广安市','资阳市','雅安市','巴中市'],
      '湖北省': ['武汉市','宜昌市','襄阳市','荆州市','十堰市','孝感市','黄冈市','黄石市','咸宁市','随州市','鄂州市','恩施州','仙桃市','天门市','潜江市'],
      '陕西省': ['西安市','宝鸡市','咸阳市','渭南市','汉中市','安康市','延安市','榆林市','商洛市','铜川市'],
      '山东省': ['济南市','青岛市','烟台市','潍坊市','临沂市','济宁市','淄博市','威海市','东营市','泰安市','德州市','日照市','聊城市','滨州市','菏泽市','枣庄市','莱芜市'],
      '河南省': ['郑州市','洛阳市','开封市','新乡市','许昌市','平顶山市','安阳市','焦作市','商丘市','周口市','驻马店市','南阳市','信阳市','漯河市','濮阳市','鹤壁市','三门峡市'],
      '福建省': ['福州市','厦门市','泉州市','漳州市','莆田市','龙岩市','三明市','南平市','宁德市'],
      '湖南省': ['长沙市','株洲市','湘潭市','衡阳市','邵阳市','岳阳市','常德市','张家界市','益阳市','郴州市','永州市','怀化市','娄底市'],
      '安徽省': ['合肥市','芜湖市','蚌埠市','安庆市','阜阳市','宿州市','六安市','亳州市','滁州市','马鞍山市','铜陵市','宣城市','黄山市','池州市','淮北市','淮南市'],
      '河北省': ['石家庄市','唐山市','秦皇岛市','邯郸市','保定市','张家口市','承德市','廊坊市','沧州市','衡水市','邢台市'],
      '辽宁省': ['沈阳市','大连市','鞍山市','抚顺市','本溪市','丹东市','锦州市','营口市','阜新市','辽阳市','盘锦市','铁岭市','朝阳市','葫芦岛市'],
      '江西省': ['南昌市','九江市','赣州市','上饶市','宜春市','吉安市','抚州市','景德镇市','萍乡市','新余市','鹰潭市'],
      '黑龙江省': ['哈尔滨市','齐齐哈尔市','大庆市','牡丹江市','佳木斯市','鸡西市','双鸭山市','伊春市','七台河市','鹤岗市','黑河市','绥化市'],
      '吉林省': ['长春市吉林市四平市通化市白城市白山市松原市延边州'.split(/(?<=[市州])/).filter(Boolean)],
      '山西省': ['太原市','大同市','阳泉市','长治市','晋城市','朔州市','晋中市','运城市','忻州市','临汾市','吕梁市'],
      '云南省': ['昆明市','曲靖市','玉溪市','保山市','昭通市','丽江市','普洱市','临沧市','楚雄州','红河州','文山州','西双版纳州','大理州','德宏州','怒江州','迪庆州'],
      '贵州省': ['贵阳市','六盘水市','遵义市','安顺市','毕节市','铜仁市','黔东南州','黔南州','黔西南州'],
      '广西壮族自治区': ['南宁市','柳州市','桂林市','梧州市','北海市','防城港市','钦州市','贵港市','玉林市','百色市','贺州市','河池市','来宾市','崇左市'],
      '海南省': ['海口市','三亚市','三沙市','儋州市'],
      '内蒙古自治区': ['呼和浩特市','包头市','乌海市','赤峰市','通辽市','鄂尔多斯市','呼伦贝尔市','巴彦淖尔市','乌兰察布市','兴安盟','锡林郭勒盟','阿拉善盟'],
      '新疆维吾尔自治区': ['乌鲁木齐市','克拉玛依市吐鲁番市哈密市昌吉州博尔塔拉州巴音郭楞州阿克苏州克孜勒苏州喀什地区和田地区伊犁州塔城地区阿勒泰地区'.split(/(?<=[市州地区])/).filter(Boolean)],
      '西藏自治区': ['拉萨市日喀则市昌都市林芝市山南市那曲市阿里地区'.split(/(?<=[市地区])/).filter(Boolean)],
      '宁夏回族自治区': ['银川市石嘴山市吴忠市固原市中卫市'.split(/(?<=[市])/).filter(Boolean)],
      '甘肃省': ['兰州市嘉峪关市金昌市白银市天水市武威市张掖市平凉市酒泉市庆阳市定西市陇南市临夏州甘南州'.split(/(?<=[市州])/).filter(Boolean)],
      '青海省': ['西宁市海东市海北州黄南州海南州果洛州玉树州海西州'.split(/(?<=[市州])/).filter(Boolean)],
      '香港特别行政区': [],
      '澳门特别行政区': []
    },
    '美国': {
      'California (加州)': ['Los Angeles','San Francisco','San Diego','San Jose','Sacramento','San Francisco Bay Area','Fresno','Oakland','Long Beach','Bakersfield','Anaheim','Santa Ana','Riverside','Stockton','Chula Vista','Irvine','Fremont','San Bernardino','Modesto','Fontana','Oxnard','Moreno Valley','Huntington Beach','Glendale','Santa Clarita','Garden Grove','Oceanside','Rancho Cucamonga','Santa Rosa','Ontario','Lancaster','Elk Grove','Palmdale','Corona','Salinas','Pomona','Torrance','Hayward','Sunnyvale','Pasadena','Fullerton','Orange','Thousand Oaks','Visalia','Clovis','Simi Valley','Concord','Roseville','Vallejo','Victorville','Santa Clara','Milpitas','Berkeley','Foster City','Mountain View','Palo Alto','San Mateo','Redwood City','Cupertino','Sunnyvale','Menlo Park','Irvine','Newport Beach','Huntington Beach','Costa Mesa','Santa Ana','Anaheim'],
      'New York (纽约州)': ['New York City','Buffalo','Rochester','Yonkers','Syracuse','Albany','New Rochelle','Mount Vernon','Schenectady','Utica','White Plains','Hempstead','Brooklyn','Queens','Bronx','Staten Island','Jamaica','Flushing','Long Island City','Astoria','Bayside','Forest Hills'],
      'Texas (德州)': ['Houston','Dallas','San Antonio','Austin','Fort Worth','El Paso','Arlington','Corpus Christi','Plano','Laredo','Lubbock','Garland','Irving','Frisco','McKinney','Grand Prairie','Brownsville','Killeen','Round Rock','Pearland','Richardson','College Station','Beaumont','Waco','Port Arthur','Midland','Odessa','Sugar Land','The Woodlands'],
      'Florida (佛罗里达)': ['Jacksonville','Miami','Tampa','Orlando','St. Petersburg','Hollywood','Fort Lauderdale','Tallahassee','Cape Coral','Fort Myers','Pembroke Pines','Hollywood','Miramar','Gainesville','Coral Springs','West Palm Beach','Daytona Beach','Pompano Beach','Boca Raton','Delray Beach','Naples','Sarasota','Bradenton','Port St. Lucie','Lakeland','Melbourne','Homestead','Dania Beach','Hialeah'],
      'Illinois (伊利诺伊)': ['Chicago','Aurora','Naperville','Joliet','Rockford','Springfield','Peoria','Elgin','Waukegan','Cicero','Champaign','Urbana','Evanston','Schaumburg','Bolingbrook','Palatine','Skokie','Des Plaines','Arlington Heights','Oak Park','Oak Lawn','Berwyn','Mount Prospect','Downers Grove','Wheaton','Addison','Glendale Heights',' Hoffman Estates','Villa Park','Carol Stream','Glen Ellyn',' Lombard','St. Charles','Geneva'],
      'Pennsylvania (宾州)': ['Philadelphia','Pittsburgh','Allentown','Erie','Reading','Scranton','Bethlehem','Lancaster','Harrisburg','Altoona','York','State College','Wilkes-Barre','Chester','Norristown','Quakertown','Easton','Lebanon','Pottstown','West Chester','Doylestown','New Castle','Butler','Washington','Greensburg','Monroeville','Bethel Park','Upper Darby','Abington','Bensalem','Warminster','Horsham','Blue Bell'],
      'Ohio (俄亥俄)': ['Columbus','Cleveland','Cincinnati','Toledo','Akron','Dayton','Parma','Canton','Youngstown','Lorain','Hamilton','Springfield','Kettering','Elyria','Lakewood','Cuyahoga Falls','Euclid','Mentor','Middletown','Dublin','Delaware','Fairfield','Strongsville','Beachwood','Shaker Heights','Hudson','Westlake','Brunswick','Medina','Wadsworth','Barberton','Massillon','Mansfield','Zanesville','Findlay','Bowling Green','Sandusky'],
      'Georgia (乔治亚)': ['Atlanta','Augusta','Columbus','Savannah','Athens','Sandy Springs','Roswell','Macon','Johns Creek','Albany','Smyrna','Marietta','Brookhaven','Sandy Springs','Decatur','Dunwoody','Kennesaw','Lawrenceville','Suwanee','Buford','Duluth','Alpharetta','Roswell','Woodstock','Acworth','Cartersville','Douglasville','Newnan','Peachtree City','Fayetteville','Griffin','LaGrange','Rome','Dalton','Valdosta','Brunswick','Waycross'],
      'North Carolina (北卡)': ['Charlotte','Raleigh','Durham','Winston-Salem','Greensboro','Fayetteville','Cary','Wilmington','High Point','Greenville','Asheville','Concord','Gastonia','Jacksonville','Chapel Hill','Cary','Morrisville','Apex','Holly Springs','Fuquay-Varina','Knightdale','Wake Forest','Rolesville','Zebulon','Garner','Clayton','Smithfield','Benson','Lumberton','Fayetteville','Wilson','Rocky Mount','Goldsboro','Kinston','New Bern','Morehead City','Wilmington'],
      'Michigan (密歇根)': ['Detroit','Grand Rapids','Warren','Sterling Heights','Ann Arbor','Lansing','Flint','Dearborn','Livonia','Clinton Township','Canton','Troy','Farmington Hills','Rochester Hills','West Bloomfield','Novi','Southfield','Pontiac','Royal Oak','Bloomfield Hills','Birmingham','Rochester','Macomb','Shelby','Utica','St. Clair Shores','East Lansing','Kalamazoo','Battle Creek','Jackson','Saginaw','Bay City','Muskegon','Traverse City','Petoskey','Marquette'],
      'New Jersey (新泽西)': ['Newark','Jersey City','Paterson','Elizabeth','Edison','Toms River','Trenton','Camden','Clifton','Bridgewater','Cherry Hill','Princeton','New Brunswick','Atlantic City','Hoboken','Morristown','Montclair','Summit','Short Hills','Millburn','Livingston','West Orange','Maplewood','South Orange','Union','Rahway','Metuchen','Perth Amboy','Old Bridge','Sayreville','East Brunswick','North Brunswick','South Plainfield','Piscataway','Somerset','Franklin Park'],
      'Virginia (弗吉尼亚)': ['Virginia Beach','Norfolk','Chesapeake','Richmond','Newport News','Alexandria','Arlington','Hampton','Roanoke','Portsmouth','Suffolk','Charlottesville','Lynchburg','Harrisonburg','Blacksburg','Staunton','Waynesboro','Fredericksburg','Manassas','Leesburg','Herndon','Reston','Tysons Corner','McLean','Vienna','Falls Church','Annandale','Fairfax','Centreville','Chantilly','Ashburn','Sterling','Dulles','Loudoun'],
      'Washington (华盛顿)': ['Seattle','Spokane','Tacoma','Vancouver','Bellevue','Kent','Everett','Renton','Federal Way','Spokane Valley','Yakima','Kennewick','Pasco','Richland','Bellingham','Auburn','Kirkland','Redmond','Bothell','Marysville','Lynnwood','Edmonds','Mountlake Terrace','Shoreline','Lake Forest Park','Woodinville','Sammamish','Issaquah','Snoqualmie','North Bend','Olympia','Tacoma','University Place','Lakewood','Puyallup','Sumner','Enumclaw','Bonney Lake'],
      'Arizona (亚利桑那)': ['Phoenix','Tucson','Mesa','Chandler','Scottsdale','Gilbert','Glendale','Peoria','Tempe','Surprise','Avondale','Goodyear','Buckeye','Flagstaff','Prescott','Sedona','Yuma','Lake Havasu City','Bullhead City','Mohave Valley','Kingman','Williams','Winslow','Holbrook','Showlow','Pinetop-Lakeside','Sierra Vista','Nogales','Douglas','Bisbee','Tombstone','Page','Grand Canyon Village'],
      'Massachusetts (麻省)': ['Boston','Worcester','Springfield','Cambridge','Lowell','New Bedford','Brookline','Quincy','Lynn','Fall River','Newton','Somerville','Medford','Arlington','Beverly','Malden','Waltham','Framingham','Marlborough','Woburn','Revere','Braintree','Weymouth','Plymouth','Brockton','Taunton','Attleborough','Northampton','Amherst','Holyoke','Greenfield','Pittsfield','Lenox','Great Barrington','Berkshire County','Cape Cod','Hyannis','Falmouth','Provincetown'],
      'Colorado (科罗拉多)': ['Denver','Colorado Springs','Aurora','Fort Collins','Lakewood','Thornton','Arvada','Westminster','Pueblo','Boulder','Greeley','Longmont','Loveland','Broomfield','Castle Rock','Highlands Ranch','Centennial','Littleton','Englewood','Golden','Wheat Ridge','Arvada','Commerce City','Federal Heights','Northglenn','Thornton','Westminster','Broomfield','Superior','Louisville','Lafayette','Erie','Firestone','Dacono','Brighton','Strasberg','Keenesburg','Fort Morgan','Grand Junction','Montrose','Durango','Aspen','Vail','Steamboat Springs','Telluride'],
      'Indiana (印第安纳)': ['Indianapolis','Fort Wayne','Evansville','South Bend','Carmel','Fishers','Bloomington','Lafayette','Muncie','Anderson','Terre Haute','Greenwood','Noblesville','Zionsville','Columbus','Jeffersonville','New Albany','Clarksville','Sellersburg','Seymour','Madison','Hanover','Lawrenceburg','Aurora','Shelbyville','Frankfort','Logansport','Peru','Kokomo','Marion','Muncie','Richmond','Connersville','Winchester','New Castle','Portland','Hartford City','Angola','Auburn','Goshen','Elkhart','Mishawaka','South Bend','Notre Dame','Granger'],
      'Tennessee (田纳西)': ['Nashville','Memphis','Knoxville','Chattanooga','Clarksville','Murfreesboro','Franklin','Johnson City','Jackson','Bristol','Kingsport','Cookeville','Cleveland','Athens','Maryville','Sevierville','Pigeon Forge','Gatlinburg','Crossville','Tullahoma','Shelbyville','Manchester','Troy','Lawrenceburg','Dyersburg','Union City','Martin','Paris','Brownsville','Henderson','Lexington','Camden','Benton','Carthage','Smithville','Lewisburg','Lynchburg','Winchester','Tullahoma','Manchester','Estill Springs','Decherd'],
      'Missouri (密苏里)': ['Kansas City','St. Louis','Springfield','Independence','Columbia','St. Joseph','Lee\'s Summit','O\'Fallon','St. Charles','St. Peters','Florissant','Chesterfield','Wildwood','Ballwin','Kirkwood','Webster Groves','Clayton','University City','Brentwood','Maplewood','Richmond Heights','Ferguson','Jennings','Bridgeton','Maryland Heights','Creve Coeur','Town and Country','Des Peres','Frontenac','Ladue','Hazelwood','Florissant','Ferguson'],
      'Maryland (马里兰)': ['Baltimore','Columbia','Silver Spring','Germantown','Wheaton-Glenmont','Rockville','Gaithersburg','Bethesda','Potomac','Towson','Catonsville','Dundalk','Essex','Middle River','Owings Mills','Pikesville','Randallstown','Reisterstown','Hunt Valley','Timonium','Lutherville-Timonium','Annapolis','Bowie','Greenbelt','College Park','Hyattsville','Upper Marlboro','Prince Frederick','Salisbury','Ocean City','Hagerstown','Frederick','Cumberland','Oakland','Deep Creek Lake'],
      'Wisconsin (威斯康星)': ['Milwaukee','Madison','Green Bay','Kenosha','Racine','Appleton','Waukesha','Eau Claire','Oshkosh','Janesville','La Crosse','Sheboygan','Wauwatosa','West Allis','New Berlin','Brookfield','Menomonee Falls','Grafton','Cedarburg','Mequon','Thiensville','Germantown','Sussex','Menomonee Falls','Hartford','Watertown','Beaver Dam','Waupun','Fond du Lac','Neenah','Menasha','Appleton','Kaukauna','Little Chute','Oshkosh','Winneconne','Omro','Stevens Point','Wausau','Rhinelander','Wausau','Eau Claire','Chippewa Falls','La Crosse','Sparta','Tomah','Prairie du Chien','Platteville','Dodgeville','Janesville','Beloit','Monroe','Whitewater'],
      'Minnesota (明尼苏达)': ['Minneapolis','Saint Paul','Rochester','Duluth','Bloomington','Brooklyn Park','Plymouth','St. Cloud','Eagan','Woodbury','Lakeville','Coon Rapids','Maple Grove','Burnsville','Eden Prairie','Minnetonka','Apple Valley','Savage','Shakopee','Prior Lake','Inver Grove Heights',' Cottage Grove','Stillwater','Woodbury','Oakdale','Mahtomedi','White Bear Lake','North St. Paul','Roseville','Falcon Heights','Lauderdale','Mounds View','New Brighton','Shoreview','Arden Hills','Spring Lake Park','Fridley','Columbia Heights','Anoka','Andover','Blaine','Coon Rapids','Ramsey','Maple Grove','Osseo','Champlin','Brooklyn Center','Crystal','Robbinsdale','New Hope','Golden Valley','Plymouth','Medina','Wayzata','Minnetonka','Chaska','Victoria','Chanhassen','Savage',' Prior Lake','Shakopee','Jordan','Carver','Waconia','Norwood Young America','Hutchinson','Glencoe','Willmar','St. Cloud','Sartell','Sauk Rapids','Brainerd','Bemidji','Duluth','Superior','Two Harbors','Grand Marais','International Falls'],
      'Colorado (科罗拉多)': ['Denver','Colorado Springs','Aurora','Fort Collins','Lakewood','Thornton','Arvada','Westminster','Pueblo','Boulder','Greeley','Longmont','Loveland','Broomfield','Castle Rock','Highlands Ranch','Centennial','Littleton','Englewood','Golden']
    }
  },

  _selLocCountry(el) {
    // 更新国家选中状态
    el.parentElement.querySelectorAll('.po-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    const country = el.dataset.val;
    const d = this._currentPicker?.data || this._regData;
    d._country = country;
    d._province = '';
    d.city = '';
    this._loadProvinces(country);
  },

  _loadProvinces(country) {
    const col = document.getElementById('locProvinceCol');
    const cityCol = document.getElementById('locCityCol');
    if (!col) return;
    const d = this._currentPicker?.data || this._regData;
    const provinces = Object.keys(this._locationData[country] || {});
    col.innerHTML = provinces.map(p =>
      `<div class="po-item" data-val="${p}" onclick="Pages._selLocProvince(this)">${p}</div>`
    ).join('');
    cityCol.innerHTML = '';
    if (provinces.length) {
      col.querySelector('.po-item')?.classList.add('selected');
      d._province = provinces[0];
      this._loadCities(country, provinces[0]);
    } else {
      d._province = '';
      d.city = '';
    }
  },

  _selLocProvince(el) {
    el.parentElement.querySelectorAll('.po-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    const province = el.dataset.val;
    const d = this._currentPicker?.data || this._regData;
    d._province = province;
    d.city = '';
    this._loadCities(d._country || '中国', province);
  },

  _loadCities(country, province, preSel) {
    const col = document.getElementById('locCityCol');
    if (!col) return;
    const cities = this._locationData[country]?.[province] || [];
    if (cities.length === 0) {
      col.innerHTML = '<div style="padding:12px;color:#999;font-size:13px;text-align:center;">无下级</div>';
      return;
    }
    col.innerHTML = cities.map(c => `<div class="po-item${c===preSel?' selected':''}" data-val="${c}" onclick="Pages._selLocCity(this)">${c}</div>`).join('');
  },

  _selLocCity(el) {
    el.parentElement.querySelectorAll('.po-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    const d = this._currentPicker?.data || this._regData;
    d.city = el.dataset.val;
  },

  _confirmLocation() {
    const country = this._regData._country || '中国';
    const province = this._regData._province || '';
    const city = this._regData.city || '';
    if (!city && this._locationData[country]?.[province]?.length > 0) {
      App.toast('请选择具体城市'); return;
    }
    this._regData.locationText = [country, province, city].filter(Boolean).join(' ');
    this.hidePicker();
    this._renderRegisterStep();
  },

  /** 年薪选择器（支持人民币/美元） */
  _openSalaryPicker() {
    this.hidePicker();

    const d = this._regData;
    const currency = d.salaryCurrency || 'CNY';

    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.onclick = () => this.hidePicker();

    const sheet = document.createElement('div');
    sheet.className = 'picker-sheet show';
    sheet.id = 'activePickerSheet';

    const cnyItems = ['5万以下','5-10万','10-20万','20-30万','30-50万','50万以上'];
    const usdItems = ['5万以下','5-10万','10-20万','20-30万','30-50万','50万以上'];

    sheet.innerHTML = `
      <div class="picker-header">
        <span class="picker-cancel" onclick="Pages.hidePicker()">取消</span>
        <span class="picker-title">年薪</span>
        <button class="picker-confirm" onclick="Pages._confirmSalary()">确定</button>
      </div>
      <!-- 币种切换 -->
      <div class="salary-currency-toggle">
        <button class="sc-btn ${currency==='CNY'?'active':''}" onclick="Pages._switchSalaryCurrency('CNY')">¥ 人民币(CNY)</button>
        <button class="sc-btn ${currency==='USD'?'active':''}" onclick="Pages._switchSalaryCurrency('USD')">$ 美元(USD)</button>
      </div>
      <div class="picker-options" id="salaryOptionsList">
        ${(currency === 'CNY' ? cnyItems : usdItems).map(item =>
          `<div class="po-item${d.salary===item?' selected':''}" data-val="${item}" onclick="document.querySelectorAll('#salaryOptionsList .po-item').forEach(e=>e.classList.remove('selected'));this.classList.add('selected');">${item}</div>`
        ).join('')}
      </div>`;

    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    this._currentPicker = { mask, sheet };
  },

  _switchSalaryCurrency(cur) {
    this._regData.salaryCurrency = cur;
    const list = document.getElementById('salaryOptionsList');
    const cnyItems = ['5万以下','5-10万','10-20万','20-30万','30-50万','50万以上'];
    const usdItems = ['5万以下','5-10万','10-20万','20-30万','30-50万','50万以上'];
    const items = cur === 'CNY' ? cnyItems : usdItems;

    // 切换按钮状态
    document.querySelectorAll('.sc-btn').forEach(b => b.classList.toggle('active', b.textContent.includes(cur === 'CNY' ? 'CNY' : 'USD')));

    list.innerHTML = items.map(item =>
      `<div class="po-item" data-val="${item}" onclick="document.querySelectorAll('#salaryOptionsList .po-item').forEach(e=>e.classList.remove('selected'));this.classList.add('selected');">${item}</div>`
    ).join('');

    this._regData.salary = '';
  },

  _confirmSalary() {
    const sheet = document.getElementById('activePickerSheet');
    if (!sheet) return;
    const sel = sheet.querySelector('#salaryOptionsList .po-item.selected');
    if (!sel) { App.toast('请选择年薪范围'); return; }
    this._regData.salary = sel.dataset.val;
    this.hidePicker();
    this._renderRegisterStep();
  },

  /** 择偶要求 - 最低年薪选择器（支持CNY/USD切换） */
  _openMateSalaryPicker() {
    this.hidePicker();

    const d = this._regData;
    const currency = d.mateSalaryCurrency || 'CNY';

    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.onclick = () => this.hidePicker();

    const sheet = document.createElement('div');
    sheet.className = 'picker-sheet show';
    sheet.id = 'activePickerSheet';

    const cnyItems = ['5万以下','5-10万','10-20万','20-30万','30-50万','50万以上'];
    const usdItems = ['5万以下','5-10万','10-20万','20-30万','30-50万','50万以上'];

    sheet.innerHTML = `
      <div class="picker-header">
        <span class="picker-cancel" onclick="Pages.hidePicker()">取消</span>
        <span class="picker-title">最低年薪</span>
        <button class="picker-confirm" onclick="Pages._confirmMateSalary()">确定</button>
      </div>
      <div class="salary-currency-toggle">
        <button class="sc-btn ${currency==='CNY'?'active':''}" onclick="Pages._switchMateSalaryCurrency('CNY')">¥ 人民币(CNY)</button>
        <button class="sc-btn ${currency==='USD'?'active':''}" onclick="Pages._switchMateSalaryCurrency('USD')">$ 美元(USD)</button>
      </div>
      <div class="picker-options" id="mateSalaryOptionsList">
        ${(currency === 'CNY' ? cnyItems : usdItems).map(item =>
          `<div class="po-item${d.mateSalary===item?' selected':''}" data-val="${item}" onclick="document.querySelectorAll('#mateSalaryOptionsList .po-item').forEach(e=>e.classList.remove('selected'));this.classList.add('selected');">${item}</div>`
        ).join('')}
      </div>`;

    document.body.appendChild(mask);
    document.body.appendChild(sheet);
    this._currentPicker = { mask, sheet };
  },

  _switchMateSalaryCurrency(cur) {
    this._regData.mateSalaryCurrency = cur;
    const list = document.getElementById('mateSalaryOptionsList');
    if (!list) return;
    const items = ['5万以下','5-10万','10-20万','20-30万','30-50万','50万以上'];
    document.querySelectorAll('.sc-btn').forEach(b => b.classList.toggle('active', b.textContent.includes(cur === 'CNY' ? 'CNY' : 'USD')));
    list.innerHTML = items.map(item =>
      `<div class="po-item${this._regData.mateSalary===item?' selected':''}" data-val="${item}" onclick="document.querySelectorAll('#mateSalaryOptionsList .po-item').forEach(e=>e.classList.remove('selected'));this.classList.add('selected');">${item}</div>`
    ).join('');
    this._regData.mateSalary = '';
  },

  _confirmMateSalary() {
    const sheet = document.getElementById('activePickerSheet');
    if (!sheet) return;
    const sel = sheet.querySelector('#mateSalaryOptionsList .po-item.selected');
    if (!sel) { App.toast('请选择最低年薪范围'); return; }
    this._regData.mateSalary = sel.dataset.val;
    this.hidePicker();
    this._renderRegisterStep();
  },

  _openRangePicker(type) {
    const maps = {
      mateAge: { title: '年龄范围', minKey:'mateAgeMin', maxKey:'mateAgeMax', suffix:'岁', min:18, max:60 },
      mateHeight: { title: '身高范围', minKey:'mateHeightMin', maxKey:'mateHeightMax', suffix:'cm', min:145, max:200 }
    };
    const m = maps[type]; if(!m) return;

    this.hidePicker();
    const mask = document.createElement('div');
    mask.className = 'picker-mask';
    mask.onclick = () => this.hidePicker();

    const sheet = document.createElement('div');
    sheet.className = 'picker-sheet show';
    sheet.id = 'activePickerSheet';

    const minItems=[], maxItems=[];
    for(let i=m.min;i<=m.max;i++){ minItems.push(i+m.suffix); maxItems.push(i+m.suffix); }
    const selMin=this._regData[m.minKey]||(type==='mateAge'?'20岁':'160cm');
    const selMax=this._regData[m.maxKey]||(type==='mateAge'?'27岁':'175cm');

    sheet.innerHTML=`
      <div class="picker-header"><span class="picker-cancel" onclick="Pages.hidePicker()">取消</span><span class="picker-title">${m.title}</span><button class="picker-confirm" onclick="Pages._confirmRange('${m.minKey}','${m.maxKey}')">确定</button></div>
      <div class="picker-wheel-wrap">
        <div class="pw-column" id="rangeMinCol">${minItems.map(v=>`<div class="pw-option${v===selMin?' selected':''}" data-v="${v}">${v}</div>`).join('')}</div>
        <div class="pw-column" id="rangeMaxCol">${maxItems.map(v=>`<div class="pw-option${v===selMax?' selected':''}" data-v="${v}">${v}</div>`).join('')}</div>
      </div>`;

    document.body.appendChild(mask); document.body.appendChild(sheet);
    this._currentPicker={mask,sheet};
    [sheet.querySelector('#rangeMinCol'),sheet.querySelector('#rangeMaxCol')].forEach(col=>{
      if(!col)return;
      col.addEventListener('scroll',()=>{
        clearTimeout(col._st);col._st=setTimeout(()=>{
          const st=col.scrollTop+col.offsetHeight/2-20;
          col.querySelectorAll('.pw-option').forEach(o=>o.classList.remove('selected'));
          for(const o of col.querySelectorAll('.pw-option')){if(Math.abs(o.offsetTop-st)<21){o.classList.add('selected');break;}}
        },80);
      });
    });
  },

  _confirmRange(minKey,maxKey){
    const sheet=document.getElementById('activePickerSheet');if(!sheet)return;
    const g=id=>{const c=sheet.querySelector(id);if(!c)return'';const s=c.querySelector('.pw-option.selected');return s?s.dataset.v:'';};
    this._regData[minKey]=g('#rangeMinCol');this._regData[maxKey]=g('#rangeMaxCol');
    this.hidePicker();this._renderRegisterStep();
  },

  _showPhotoGuide() {
    // 照片审核标准弹窗（卡通SVG示意图）
    const modal = document.createElement('div');
    modal.className = 'photo-guide-modal show';
    modal.id = 'photoGuideModal';
    modal.innerHTML = `
      <div class="pgm-mask" onclick="document.getElementById('photoGuideModal').remove()"></div>
      <div class="pgm-card">
        <div class="pgm-close" onclick="document.getElementById('photoGuideModal').remove()">&times;</div>
        <div class="pgm-title">照片审核通过标准</div>
        <div class="pgm-grid">
          <!-- 1 真实居中 ✓ -->
          <div class="pgm-item">
            <div class="pgm-thumb">
              <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="14" fill="#e8f5e9"/><circle cx="60" cy="52" r="24" fill="#ffccbc"/><path d="M30 115 Q60 78 90 115 L90 150 L30 150Z" fill="#81c784"/><circle cx="50" cy="48" r="3" fill="#555"/><circle cx="70" cy="48" r="3" fill="#555"/><path d="M53 58 Q60 65 67 58" stroke="#e57373" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M40 38 Q45 28 54 34" stroke="#a1887f" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M80 38 Q75 28 66 34" stroke="#a1887f" stroke-width="2.5" fill="none" stroke-linecap="round"/><text x="60" y="140" text-anchor="middle" font-size="11" fill="#43a047" font-weight="700">✓ 通过</text></svg>
              <span class="pgm-status ok">真实居中</span>
            </div><div class="pgm-label">真实居中</div></div>
          <!-- 2 上半身照 ✓ -->
          <div class="pgm-item">
            <div class="pgm-thumb">
              <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="14" fill="#e3f2fd"/><circle cx="60" cy="42" r="22" fill="#f8bbd9"/><ellipse cx="60" cy="95" rx="32" ry="36" fill="#90caf9"/><circle cx="51" cy="39" r="2.8" fill="#444"/><circle cx="69" cy="39" r="2.8" fill="#444"/><path d="M54 49 Q60 56 66 49" stroke="#e91e63" stroke-width="2" fill="none" stroke-linecap="round"/><line x1="35" y1="82" x2="85" y2="82" stroke="#64b5f6" stroke-width="1.5"/><text x="60" y="142" text-anchor="middle" font-size="11" fill="#1976d2" font-weight="700">✓ 通过</text></svg>
              <span class="pgm-status ok">上半身照</span>
            </div><div class="pgm-label">上半身照</div></div>
          <!-- 3 模糊不清 ✗ -->
          <div class="pgm-item">
            <div class="pgm-thumb">
              <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><defs><filter id="blur3"><feGaussianBlur stdDeviation="4"/></filter></defs><rect width="120" height="150" rx="14" fill="#ffebee"/><g filter="url(#blur3)"><circle cx="60" cy="55" r="26" fill="#d7ccc8"/><path d="M28 118 Q60 80 92 118 L92 150 L28 150Z" fill="#bcaaa4"/></g><text x="60" y="138" text-anchor="middle" font-size="13" fill="#c62828" font-weight="700">✗ 不通过</text></svg>
              <span class="pgm-status fail">模糊不清</span>
            </div><div class="pgm-label">模糊不清</div></div>
          <!-- 4 过于暴露 ✗ -->
          <div class="pgm-item">
            <div class="pgm-thumb">
              <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="14" fill="#fce4ec"/><circle cx="60" cy="42" r="20" fill="#f8bbd9"/><path d="M25 130 Q60 70 95 130 Z" fill="#ef5350" opacity=".7"/><text x="60" y="46" text-anchor="middle" font-size="18" fill="#c2185b" font-weight="bold" opacity=".85">🚫</text><line x1="15" y1="135" x2="105" y2="135" stroke="#e91e63" stroke-width="2.5" stroke-dasharray="6,4"/><text x="60" y="146" text-anchor="middle" font-size="11" fill="#c62828" font-weight="700">✗ 不通过</text></svg>
              <span class="pgm-status fail">过于暴露</span>
            </div><div class="pgm-label">过于暴露</div></div>
          <!-- 5 P图过度 ✗ -->
          <div class="pgm-item">
            <div class="pgm-thumb">
              <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="14" fill="#fff3e0"/><circle cx="60" cy="50" r="23" fill="#ffe0b2"/><ellipse cx="60" cy="100" rx="30" ry="34" fill="#ffcc80"/><circle cx="51" cy="46" r="4" fill="#333" opacity=".6"/><circle cx="69" cy="46" r="4" fill="#333" opacity=".6"/><path d="M47 64 Q60 72 73 64" stroke="#e65100" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M22 30 L98 125 M105 22 L17 132" stroke="#ff9800" stroke-width="2.5" stroke-dasharray="4,4" opacity=".6"/><text x="96" y="32" font-size="10" fill="#e65100" font-weight="600">P图</text><text x="60" y="144" text-anchor="middle" font-size="11" fill="#e65100" font-weight="700">✗ 不通过</text></svg>
              <span class="pgm-status fail">P图过度</span>
            </div><div class="pgm-label">P图过度</div></div>
          <!-- 6 背影照 ✗ -->
          <div class="pgm-item">
            <div class="pgm-thumb">
              <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="14" fill="#ede7f6"/><ellipse cx="60" cy="40" rx="19" ry="21" fill="#b39ddb"/><path d="M33 128 Q60 88 87 128 L87 150 L33 150Z" fill="#9575cd"/><text x="60" y="46" text-anchor="middle" font-size="16" fill="#fff" font-weight="bold" opacity=".7">?</text><text x="60" y="143" text-anchor="middle" font-size="11" fill="#7b1fa2" font-weight="700">✗ 不通过</text></svg>
              <span class="pgm-status fail">背影照</span>
            </div><div class="pgm-label">背影照</div></div>
          <!-- 7 头像太小 ✗ -->
          <div class="pgm-item">
            <div class="pgm-thumb">
              <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="14" fill="#fbe9e7"/><circle cx="60" cy="68" r="12" fill="#ffab91"/><path d="M46 110 Q60 94 74 110 L74 126 L46 126Z" fill="#ff8a65"/><circle x1="56" cy="64" r="1.5" fill="#333"/><circle cx="64" cy="64" r="1.5" fill="#333"/><path d="M84 68 L108 68" stroke="#bdbdbd" stroke-width="1" stroke-dasharray="3,2"/><text x="96" y="62" font-size="9" fill="#9e9e9e">太小</text><path d="M82 74 Q102 74 106 90" stroke="#bdbdbd" stroke-width="1" fill="none" marker-end="url(#arrow)"/><text x="60" y="142" text-anchor="middle" font-size="11" fill="#d84315" font-weight="700">✗ 不通过</text></svg>
              <span class="pgm-status fail">头像太小</span>
            </div><div class="pgm-label">头像太小</div></div>
          <!-- 8 非人像照 ✗ -->
          <div class="pgm-item">
            <div class="pgm-thumb">
              <svg viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="150" rx="14" fill="#e0f2f1"/><ellipse cx="60" cy="70" rx="38" ry="28" fill="#a5d6a7"/><circle cx="45" cy="62" r="10" fill="#ffd54f"/><rect x="58" y="52" width="16" height="22" rx="3" fill="#81c784"/><path d="M52 76 Q60 86 68 76" stroke="#4caf50" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="78" cy="58" r="6" fill="#ffb74d"/><text x="60" y="116" text-anchor="middle" font-size="11" fill="#00796b" font-weight="500">风景/物品</text><text x="60" y="142" text-anchor="middle" font-size="11" fill="#00796b" font-weight="700">✗ 不通过</text></svg>
              <span class="pgm-status fail">非人像照</span>
            </div><div class="pgm-label">非人像照</div></div>
        </div>
        <div style="display:flex;gap:12px;margin-top:18px;">
          <button class="pgm-upload-btn" style="flex:1;background:#fff;color:var(--primary);border:1.5px solid var(--primary);" onclick="document.getElementById('photoGuideModal').remove();Pages._pickRegAvatar()">重新上传</button>
          <button class="pgm-upload-btn" style="flex:1;" onclick="document.getElementById('photoGuideModal').remove();Pages._renderRegisterStep()">知道了</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  _pickRegAvatar() {
    document.getElementById('photoGuideModal')?.remove();
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 8 * 1024 * 1024) { App.toast('图片不能超过 8MB'); return; }
      if (!App.token) { App.toast('请先完成邮箱验证'); return; }
      App.toast('正在上传头像...');
      try {
        const dataUrl = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = ev => resolve(ev.target.result);
          r.onerror = () => reject(new Error('读取图片失败'));
          r.readAsDataURL(f);
        });
        const res = await App.api('/api/upload/avatar', { method: 'POST', body: { image: dataUrl } });
        if (res.code === 0 && res.data && res.data.url) {
          this._regData.avatar = res.data.url;
          this._renderRegisterStep();
          App.toast('头像已上传');
        } else {
          App.toast(res.msg || '头像上传失败');
        }
      } catch (err) {
        App.toast('头像上传失败，请换一张');
      }
    };
    input.click();
  }
};

// ===== 聊天 =====
const Chat = {
  partnerId: null,
  partner: null,
  async open(partnerId) {
    if (!App.user) return Auth.openLogin();
    this.partnerId = partnerId;
    const res = await App.api('/api/users/' + partnerId);
    if (res.code !== 0) return App.toast('用户不存在');
    this.partner = res.data;
    const content = document.getElementById('content');
    content.innerHTML = `
      <div class="page active chat-window">
        <div class="header">
          <span class="back" onclick="Pages.renderMine()">‹</span>
          <img src="${this.partner.avatar}" style="width:32px;height:32px;border-radius:50%;">
          <span style="font-weight:600;">${this.partner.nickname}</span>
        </div>
        <div class="messages" id="msgList"></div>
        <div class="input-bar">
          <input id="msgInput" placeholder="说点什么..." onkeypress="if(event.key==='Enter') Chat.send()">
          <button onclick="Chat.send()">发送</button>
        </div>
      </div>
    `;
    this.loadMessages();
  },
  async loadMessages() {
    const res = await App.api('/api/messages?with=' + this.partnerId);
    if (res.code === 0) this.render(res.data);
  },
  render(msgs) {
    const list = document.getElementById('msgList');
    if (!list) return;
    if (!msgs.length) list.innerHTML = '<div class="empty"><div class="icon">👋</div>还没说过话，先打个招呼吧</div>';
    else list.innerHTML = msgs.map(m => `<div class="msg ${m.from === App.user.id ? 'mine' : 'theirs'}">${m.content}</div>`).join('');
    list.scrollTop = list.scrollHeight;
  },
  async send() {
    const input = document.getElementById('msgInput');
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    const res = await App.api('/api/messages', { method: 'POST', body: { to: this.partnerId, content } });
    if (res.code === 0) this.loadMessages();
  }
};

// ===== 活动/文章 =====
const Activity = {
  async show(id) {
    const res = await App.api('/api/activities/' + id);
    if (res.code !== 0) return App.toast(res.msg || '加载失败');
    this._data = res.data;
    this._render();
  },
  _statusClass(s) {
    return s === '报名中' ? 'st-ok' : s === '未开始' ? 'st-wait' : 'st-end';
  },
  _render() {
    const a = this._data;
    if (!a) return;
    const joiners = a.joiners || [];
    const status = a.status || '报名中';
    const isMember = App.user && joiners.some(j => j.userId === App.user.id);
    let btnText = '立即报名', btnDisabled = false, btnAction = "Activity.join()";
    if (status === '未开始') { btnText = '未开始报名'; btnDisabled = true; }
    else if (status === '报名截止' || status === '已结束') { btnText = '报名已截止'; btnDisabled = true; }
    else if (isMember) { btnText = '✓ 已报名'; btnDisabled = true; }

    // 格式化时间只显示年月日
    let timeStr = a.time || '';
    if (timeStr) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        timeStr = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      }
    }

    // 报名时间范围
    const signupStart = a.signupStart ? (new Date(a.signupStart)).toLocaleDateString() : '';
    const signupEnd = a.signupEnd ? (new Date(a.signupEnd)).toLocaleDateString() : '';

    // 倒计时截止时间戳
    const endIso = a.signupEnd || '';
    const endMs = endIso ? new Date(endIso).getTime() : 0;

    // 费用显示
    const isFree = !a.price || a.price === 0;
    const priceText = isFree ? '免费' : ('¥' + a.price);

    // 已报名人数
    const joinedCount = joiners.length;
    const limitCount = a.limit || a.maxUsers || 20;

    document.getElementById('content').innerHTML = `
      <div class="page active act-detail-v2">
        <!-- 返回按钮 -->
        <button class="adv2-back" onclick="Pages.renderActivity()">
          <i class="fas fa-chevron-left"></i>
        </button>

        <!-- 封面大图 -->
        <div class="adv2-cover">
          <img src="${a.cover || ''}" onerror="this.onerror=null;this.style.background='linear-gradient(135deg,#ff9aeb,#ff7eb3,#ff6b9d)'">
        </div>

        <div class="adv2-body">
          <!-- 状态标签 -->
          <span class="adv2-status ${this._statusClass(status)}">${status}</span>

          <!-- 标题 -->
          <h1 class="adv2-title">${a.title || ''}</h1>

          <!-- 时间 + 地点 -->
          <div class="adv2-meta">
            <div class="adv2-meta-row"><i class="far fa-clock"></i> ${timeStr || '待定'}</div>
            <div class="adv2-meta-row"><i class="fas fa-map-marker-alt"></i> ${a.place || '待定'}</div>
          </div>

          <!-- 费用行 -->
          <div class="adv2-price-row">
            <span class="adv2-price ${isFree ? 'free' : ''}">${priceText}</span>
            <span class="adv2-count">已报名 ${joinedCount}/${limitCount} 人</span>
          </div>

          <!-- 报名时间 -->
          ${signupStart || signupEnd ? `<div class="adv2-signup-time">报名时间：${signupStart || '--'} ~ ${signupEnd || '--'}</div>` : ''}

          <!-- 报名倒计时（两行布局） -->
          ${endMs > 0 && status !== '报名截止' && status !== '已结束' ? `
          <div class="adv2-cd-card" data-end="${endMs}">
            <div class="adv2-cd-row1">
              <span class="adv2-cd-text">报名倒计时</span>
              <i class="fas fa-clock adv2-cd-clock"></i>
            </div>
            <div class="adv2-cd-row2">
              <span class="adv2-cd-num"><b id="actCdDays">--</b></span> 天
              <span class="adv2-cd-num"><b id="actCdHours">--</b></span> 时
              <span class="adv2-cd-num"><b id="actCdMins">--</b></span> 分
              <span class="adv2-cd-num"><b id="actCdSecs">--</b></span> 秒
            </div>
          </div>` : ''}

          <!-- 活动描述 -->
          <div class="adv2-desc">${(a.desc || '').replace(/\n/g, '<br>') || '<span style="color:#999;">暂无描述</span>'}</div>

          <!-- 已报名会员 -->
          <div class="adv2-joiners-section">
            <div class="adv2-joiners-title">已报名会员 (${joinedCount}人)</div>
            ${joiners.length > 0 ? `
            <div class="adv2-joiner-list">
              ${joiners.slice(0, 10).map(j => `
                <div class="adv2-joiner-item">
                  <img src="${j.avatar || ''}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23ff6b9d%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2216%22>?</text></svg>'">
                  <span>${j.nickname || '用户'}</span>
                </div>
              `).join('')}
              ${joiners.length > 10 ? `<div class="adv2-joiner-more">+${joiners.length - 10}</div>` : ''}
            </div>` : `
            <div class="adv2-joiners-empty">还没有人报名，快来抢沙发~</div>`}
          </div>
        </div>

        <!-- 底部报名按钮 -->
        <div class="adv2-footer">
          <button class="adv2-join-btn ${btnDisabled ? 'disabled' : ''}" ${btnDisabled ? 'disabled' : ''} onclick="${btnAction}">${btnText}</button>
        </div>
      </div>
    `;

    // 启动倒计时
    if (endMs > 0 && status !== '报名截止' && status !== '已结束') {
      this._startCountdownV2();
    }
  },
  // 活动详情页倒计时 V2（截图2样式）
  _startCountdownV2() {
    const tick = () => {
      const card = document.querySelector('.adv2-cd-card');
      if (!card) { if(this._cdTimer){clearInterval(this._cdTimer);this._cdTimer=null;} return; }
      const end = parseInt(card.dataset.end || '0', 10);
      if (!end) return;
      const diff = end - Date.now();
      if (diff <= 0) {
        card.innerHTML = '<i class="fas fa-check-circle" style="color:#4caf50;font-size:18px;"></i><span style="color:#999;margin-left:8px;">报名已截止</span>';
        return;
      }
      const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
      const ds = document.getElementById('actCdDays'), hs = document.getElementById('actCdHours');
      const ms = document.getElementById('actCdMins'), ss = document.getElementById('actCdSecs');
      if(ds)ds.textContent=d;if(hs)hs.textContent=h;if(ms)ms.textContent=m;if(ss)ss.textContent=s;
    };
    tick();
    this._cdTimer = setInterval(tick, 1000);
  },
  async join() {
    if (!App.user) return Auth.openLogin();
    const id = this._data && this._data.id;
    if (!id) return;
    const res = await App.api('/api/activities/' + id + '/join', { method: 'POST' });
    if (res.code === 0) {
      App.toast('报名成功！');
      // 重新拉取详情
      const r = await App.api('/api/activities/' + id);
      if (r.code === 0) { this._data = r.data; this._render(); }
    } else {
      App.toast(res.msg || '报名失败');
    }
  }
};

const VipPay = {
  _plans: null,
  _selectedPlan: null,
  _currency: 'CNY', // CNY or USD
  _payMethod: '', // wechat / alipay / paypal

  async showUpgrade() {
    // 演示模式下直接弹出客服窗，不再进入选择套餐/支付流程
    const cfgRes = await App.api('/api/payment/config', { method: 'GET' });
    if (cfgRes.code === 0 && cfgRes.data && cfgRes.data.mockMode) {
      this._showServiceModal(cfgRes.data.serviceWechat, cfgRes.data.serviceQrcode);
      return;
    }

    // 1. 检测币种（根据性别，不用IP）
    if (App.user && App.user.gender) {
      // 男性使用人民币CNY，女性使用美元USD
      // 根据性别判断币种：男生美金USD，女生人民币CNY
      this._currency = App.user.gender === '男' ? 'USD' : 'CNY';
    } else {
      this._currency = 'CNY'; // 默认CNY
    }

    // 2. 加载套餐
    const res = await App.api('/api/vip/plans', { method: 'GET' });
    if (res.code === 0 && res.data.length) {
      this._plans = res.data.filter(p => p.enabled);
      this._selectedPlan = this._plans[0]?.id;
      this._payMethod = this._currency === 'CNY' ? 'wechat' : 'paypal';
      this.renderPlans();
      document.getElementById('vipUpgradeModal').style.display = 'block';
    } else {
      App.toast('暂无可用套餐');
    }
  },

  renderPlans() {
    const list = document.getElementById('vipPlanList');
    const symbol = this._currency === 'CNY' ? '¥' : '$';
    list.innerHTML = this._plans.map(p => {
      const price = p.prices?.[this._currency] || (this._currency === 'CNY' ? p.price : (p.price / 7).toFixed(2));
      return `
      <div onclick="VipPay.selectPlan('${p.id}')" style="border:2px solid ${this._selectedPlan === p.id ? 'var(--primary,#ff5a6e)' : '#eee'};border-radius:12px;padding:16px;margin-bottom:10px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:16px;font-weight:600;color:#333;margin-bottom:4px;">${p.name}</div>
          <div style="font-size:12px;color:#888;margin-bottom:8px;">${p.desc || (p.days + '天')}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${(p.features || []).map(f => `<span style="background:#f5f5f5;padding:2px 8px;border-radius:8px;font-size:11px;color:#666;">${f}</span>`).join('')}
          </div>
        </div>
        <div style="font-size:20px;font-weight:700;color:var(--primary,#ff5a6e);">${symbol}${price}</div>
      </div>`;
    }).join('');

    // 显示当前检测的币种信息（不可切换）
    const currencyBar = document.getElementById('vipCurrencyBar');
    if (currencyBar) {
      currencyBar.innerHTML = '';
    }

    // 渲染支付方式
    const methodBar = document.getElementById('vipPayMethodBar');
    if (methodBar) {
      let methods = [];
      if (this._currency === 'CNY') {
        methods = [
          { id: 'wechat', name: '微信支付', icon: '💚' },
          { id: 'alipay', name: '支付宝', icon: '💙' }
        ];
      } else {
        methods = [
          { id: 'paypal', name: 'PayPal', icon: '💛' }
        ];
      }
      methodBar.innerHTML = `
        <div style="margin-bottom:16px;">
          <div style="font-size:13px;color:#888;margin-bottom:8px;">选择支付方式</div>
          <div style="display:flex;gap:8px;">
            ${methods.map(m => `
              <button onclick="VipPay.selectMethod('${m.id}')" style="flex:1;padding:10px;border:2px solid ${this._payMethod===m.id?'var(--primary,#ff5a6e)':'#eee'};border-radius:8px;background:${this._payMethod===m.id?'#fff0f1':'#fff'};cursor:pointer;font-size:14px;">
                ${m.icon} ${m.name}
              </button>
            `).join('')}
          </div>
        </div>`;
    }
  },

  selectPlan(id) {
    this._selectedPlan = id;
    this.renderPlans();
  },

  selectMethod(method) {
    this._payMethod = method;
    this.renderPlans();
  },

  async submit() {
    if (!this._selectedPlan) {
      App.toast('请选择套餐');
      return;
    }
    if (!App.user) {
      Auth.openLogin();
      return;
    }

    const plan = this._plans.find(p => p.id === this._selectedPlan);
    if (!plan) {
      App.toast('套餐不存在');
      return;
    }

    // 检查是否演示模式：是则弹出客服微信弹窗，不再发起真实支付
    const cfgRes = await App.api('/api/payment/config', { method: 'GET' });
    if (cfgRes.code === 0 && cfgRes.data && cfgRes.data.mockMode) {
      document.getElementById('vipUpgradeModal').style.display = 'none';
      this._showServiceModal(cfgRes.data.serviceWechat, cfgRes.data.serviceQrcode);
      return;
    }

    // 显示支付中
    document.getElementById('vipUpgradeModal').style.display = 'none';
    document.getElementById('vipPayingModal').style.display = 'block';

    // 根据支付方式调用不同接口
    if (this._payMethod === 'wechat') {
      await this._payWechat(plan);
    } else if (this._payMethod === 'alipay') {
      await this._payAlipay(plan);
    } else if (this._payMethod === 'paypal') {
      await this._payPaypal(plan);
    } else {
      // 模拟支付（开发测试用）
      await this._payMock(plan);
    }
  },

  _showServiceModal(wechat, qrcode) {
    const account = wechat || 'StarMeet_Official';
    const qr = qrcode || ('https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent('wechat://' + account));
    const modal = document.getElementById('vipServiceModal') || (() => {
      const m = document.createElement('div');
      m.id = 'vipServiceModal';
      m.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9999;';
      m.innerHTML = `<div style="background:#fff;border-radius:18px;padding:28px 24px 22px;max-width:320px;width:85%;margin:90px auto;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.2);"><div style="font-size:17px;font-weight:600;color:#333;margin-bottom:16px;">请联系客服开通</div><div style="width:170px;height:170px;border-radius:16px;background:#f8f9fa;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;box-shadow:0 2px 12px rgba(0,0,0,.08);border:1px solid #eee;"><img id="vipServiceQr" style="width:148px;height:148px;border-radius:12px;" src=""></div><button id="vipServiceCopyBtn" style="display:flex;align-items:center;width:100%;padding:13px 18px;background:#fff;border:1.5px solid #e8e8e8;border-radius:14px;font-size:15px;color:#333;cursor:pointer;margin-bottom:8px;"><span style="color:#07c160;font-size:18px;margin-right:8px;">💬</span><span id="vipServiceAccount" style="-webkit-user-select:text;user-select:text;"></span><span style="margin-left:auto;color:#999;font-size:15px;">📋</span></button><div style="font-size:12.5px;color:#aaa;margin-bottom:18px;">扫描二维码或复制客服微信号添加客服</div><button onclick="document.getElementById('vipServiceModal').style.display='none'" style="width:100%;padding:13px;border:none;border-radius:24px;background:linear-gradient(135deg,#ff7eb3,#ff6b9d);color:#fff;font-size:16px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(255,107,157,.3);">关闭</button></div>`;
      document.body.appendChild(m);
      m.addEventListener('click', e => { if (e.target === m) m.style.display = 'none'; });
      return m;
    })();
    document.getElementById('vipServiceQr').src = qr;
    document.getElementById('vipServiceAccount').textContent = '客服微信号：' + account;
    document.getElementById('vipServiceCopyBtn').onclick = () => Pages._copyText(account, '客服微信号已复制');
    modal.style.display = 'block';
  },

  async _payMock(plan) {
    setTimeout(async () => {
      const res = await App.api('/api/vip/pay', {
        method: 'POST',
        body: {
          userId: App.user.userId || App.user.id,
          planId: this._selectedPlan,
          currency: this._currency
        }
      });

      document.getElementById('vipPayingModal').style.display = 'none';

      if (res.code === 0) {
        App.user.vip_type = res.data.vip_type;
        App.user.vip_expire = res.data.vip_expire;
        App.user.vip = true;
        localStorage.setItem('user', JSON.stringify(App.user));
        App.toast('<i class="fas fa-party-horn"></i> 支付成功！VIP已开通');
        setTimeout(() => { App.switchPage('home'); }, 1500);
      } else {
        App.toast(res.msg || '支付失败');
        document.getElementById('vipUpgradeModal').style.display = 'block';
      }
    }, 3000);
  },

  async _payWechat(plan) {
    // 调用微信支付接口
    const res = await App.api('/api/vip/pay/wechat', {
      method: 'POST',
      body: {
        userId: App.user.userId || App.user.id,
        planId: this._selectedPlan,
        currency: this._currency
      }
    });

    document.getElementById('vipPayingModal').style.display = 'none';

    if (res.code === 0) {
      // 微信支付需要跳转或展示二维码
      // H5支付：跳转微信支付页面
      if (res.data.pay_url) {
        window.location.href = res.data.pay_url;
      } else if (res.data.qrcode) {
        // 展示二维码供用户扫码
        this._showQrcode(res.data.qrcode, '微信支付');
      } else {
        App.toast('支付参数错误');
        document.getElementById('vipUpgradeModal').style.display = 'block';
      }
    } else {
      App.toast(res.msg || '支付失败');
      document.getElementById('vipUpgradeModal').style.display = 'block';
    }
  },

  async _payAlipay(plan) {
    const res = await App.api('/api/vip/pay/alipay', {
      method: 'POST',
      body: {
        userId: App.user.userId || App.user.id,
        planId: this._selectedPlan,
        currency: this._currency
      }
    });

    document.getElementById('vipPayingModal').style.display = 'none';

    if (res.code === 0 && res.data.pay_url) {
      // 支付宝H5支付：跳转支付页面
      window.location.href = res.data.pay_url;
    } else {
      App.toast(res.msg || '支付失败');
      document.getElementById('vipUpgradeModal').style.display = 'block';
    }
  },

  async _payPaypal(plan) {
    const res = await App.api('/api/vip/pay/paypal', {
      method: 'POST',
      body: {
        userId: App.user.userId || App.user.id,
        planId: this._selectedPlan,
        currency: this._currency
      }
    });

    document.getElementById('vipPayingModal').style.display = 'none';

    if (res.code === 0 && res.data.pay_url) {
      // PayPal支付：跳转PayPal页面
      window.location.href = res.data.pay_url;
    } else {
      App.toast(res.msg || '支付失败');
      document.getElementById('vipUpgradeModal').style.display = 'block';
    }
  },

  _showQrcode(qrcodeUrl, title) {
    // 展示支付二维码
    const modal = document.getElementById('vipQrcodeModal') || (() => {
      const m = document.createElement('div');
      m.id = 'vipQrcodeModal';
      m.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:9999;';
      m.innerHTML = '<div style="background:#fff;border-radius:16px;padding:28px 24px 20px;max-width:320px;width:85%;margin:100px auto;text-align:center;"><div id="qrcodeContainer"></div><p style="margin-top:12px;font-size:14px;color:#333;" id="qrcodeTitle"></p><button onclick="this.closest(\'.qrcodeModal\').style.display=\'none\'" style="margin-top:16px;width:100%;padding:10px;border:none;border-radius:24px;background:var(--primary,#ff5a6e);color:#fff;font-size:15px;cursor:pointer;">关闭</button></div>';
      m.className = 'qrcodeModal';
      document.body.appendChild(m);
      return m;
    })();
    document.getElementById('qrcodeContainer').innerHTML = `<img src="${qrcodeUrl}" style="width:200px;height:200px;">`;
    document.getElementById('qrcodeTitle').textContent = title + ' - 请使用' + title + '扫码支付';
    modal.style.display = 'block';
  }
};

// 替换原来的 _showVipUpgradePopup 方法
Pages._showVipUpgradePopup = function() {
  VipPay.showUpgrade();
};

const Article = {
  async show(id) {
    window.scrollTo(0, 0);
    const res = await App.api('/api/articles/' + id);
    if (res.code !== 0) return;
    const a = res.data;
    const contentEl = document.getElementById('content');
    contentEl.classList.add('article-view');
    contentEl.innerHTML = `
      <div class="page active article-page">
        <h1>${a.title}</h1>
        <div class="meta"><i class="fas fa-pen"></i> ${a.author} · <i class="fas fa-eye"></i> ${a.views} · ${a.category || ''}</div>
        <div class="content">${a.content}</div>
      </div>
    `;
  }
};

// VIP权限检查工具
Pages._checkVipPermission = async function(permissionId, callback) {
  // 1. 先检查本地VIP状态
  if (App.user && App.user.vip_type !== 'none') {
    // 已开通VIP，检查是否过期
    if (App.user.vip_expire && new Date(App.user.vip_expire) > new Date()) {
      // 已登录VIP，检查权限配置
      const res = await App.api('/api/vip/permissions', { method: 'GET' });
      if (res.code === 0) {
        const perm = res.data.permissions.find(p => p.id === permissionId);
        if (perm) {
          const level = App.user.vip_type === 'svip' ? 'svip' : 'vip';
          if (perm[level]) {
            callback();
            return;
          }
        }
      }
    } else {
      // VIP已过期，清除本地状态
      App.user.vip_type = 'none';
      App.user.vip_expire = null;
      App.user.vip = false;
      localStorage.setItem('user', JSON.stringify(App.user));
    }
  }

  // 2. 未开通VIP或权限不足，显示升级弹窗
  VipPay.showUpgrade();
};

App.init();
// 动态生成底部导航栏
App.renderBottomBar();
