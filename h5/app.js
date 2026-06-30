// 择爱V11仿站 - 前端H5主逻辑
const App = {
  token: localStorage.getItem('zeai_token') || '',
  user: null,
  currentPage: 'home',
  init() {
    if (this.token) this.fetchMe();
    this.loadSiteConfig();
    this.bindNav();
    this.switchPage('home');
    this.renderBottomBar();
    this.showSplashAd();
    this.checkUnreadMessages();
  },
  async loadSiteConfig() {
    // 站点配置（logo / 副标题）+ 系统设置（站点名）合并加载
    const [cfgRes, setRes] = await Promise.all([this.api('/api/site-config'), this.api('/api/settings')]);
    const c = cfgRes.code === 0 ? cfgRes.data : {};
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
        logoEl.innerHTML = `<span style="font-size:22px;vertical-align:middle;">${c.logoEmoji || '💕'}</span>`;
      }
    }
    // 站点名：优先用 settings.siteName（后台「系统设置」是主入口），回退 siteConfig.siteName
    const nameEl = document.getElementById('siteName');
    if (nameEl) nameEl.textContent = s.siteName || c.siteName || 'StarMeet';
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
      overlay.innerHTML = '<img src="'+ad.image+'" style="max-width:100%;max-height:100%;object-fit:contain;">'
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
          <div class="nav-icon">${isImage ? `<img src="${n.icon}">` : (n.icon || '💖')}</div>
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
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(r => r.json());
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
    this.renderBottomBar();
    // 离开文章详情页时恢复 content 的 min-height
    const contentEl = document.getElementById('content');
    if (contentEl) { contentEl.style.minHeight = ''; contentEl.classList.remove('article-view'); }
    document.querySelectorAll('[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page && el.classList.contains('tab') || el.dataset.page === page && el.classList.contains('btm-btn'));
    });
    const renderers = {
      home: Pages.renderHome,
      match: Pages.renderMatch,
      activity: Pages.renderActivity,
      school: Pages.renderSchool,
      mine: Pages.renderMine,
      contact: Pages.renderContact,
      survey: Pages.renderSurvey,
      psychtest: Pages.renderPsychTests,
      vip: Pages.renderVipService
    };
    if (renderers[page]) renderers[page]();
  },
  toast(msg, duration = 1800) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.style.display = 'none', duration);
  }
};

// ===== 鉴权 =====
const Auth = {
  mode: 'login',
  _dragBound: false,
  open(mode = 'login') { this.mode = mode; this.switch(mode); document.getElementById('authModal').style.display = 'flex'; this._bindDrag(); this._bindAvatar(); this._prefillLogin(); },
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
            ? `<img src="${b.icon}" style="width:60%;height:60%;object-fit:contain;">`
            : (b.icon || '💖');
          const articleId = b.articleId || '';
          return `<div class="item" onclick="App.goLink('${(b.link||'home').replace(/'/g,"\\'")}', '${b.linkType || 'page'}', '${(b.filter||'').replace(/'/g,"\\'")}', '${articleId}')">
            <div class="icon" style="--icon-bg:${lighten(b.color)};--icon-color:${b.color || '#ff5a6e'};">${iconHtml}</div>
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
        <img src="${avatar}" onerror="this.onerror=null;this.src='https://via.placeholder.com/300/ff5a6e/ffffff?text=?'">
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
          <button class="apply-btn" onclick="event.stopPropagation(); App.toast('已喜欢TA，期待TA也喜欢你 💕')">喜欢TA</button>
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
          <div class="icon-box">💬</div>
          <div class="info"><div class="label">${wechatLabel}</div><div class="value">${wechat}</div></div>
          <div class="arrow">›</div>
        </div>` : ''}
        ${email ? `<div class="contact-card email" onclick="window.location.href='mailto:${email}'">
          <div class="icon-box">✉️</div>
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
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => App.toast(msg || '已复制')).catch(() => App.toast('复制失败'));
    } else {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); App.toast(msg || '已复制'); } catch (e) { App.toast('复制失败'); }
      document.body.removeChild(t);
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
    const content = document.getElementById('content');
    // 如果没有指定surveyId，先获取可用问卷列表
    if (!surveyId) {
      const listRes = await App.api('/api/surveys');
      if (listRes.code !== 0 || !listRes.data.length) { content.innerHTML = '<div class="page active"><div class="empty">暂无可用问卷</div></div>'; return; }
      surveyId = listRes.data[0].id;
    }
    content.innerHTML = '<div class="page active"><div class="loading">加载问卷中...</div></div>';
    const res = await App.api('/api/survey?id=' + surveyId);
    if (res.code !== 0 || !res.data) { content.innerHTML = '<div class="page active"><div class="empty">问卷不存在或已关闭</div></div>'; return; }
    const s = res.data;
    // 已填写过
    if (s.filled) { content.innerHTML = `<div class="page active" style="padding:40px 20px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">✅</div><h3>您已填写过此问卷</h3><p style="color:#999;margin-top:8px;">感谢您的参与</p><button class="primary-btn" style="margin-top:20px;" onclick="App.switchPage('home')">返回首页</button></div>`; return; }

    this._currentSurvey = s;
    let html = `<div class="page active"><div class="sv-container"><div class="sv-header"><span class="back" onclick="App.switchPage('home')">‹</span><h2>${s.title}</h2>`;
    if (s.description) html += `<p class="sv-desc">${s.description}</p>`;
    html += '</div><form id="svForm" onsubmit="return false;"><div class="sv-body">';
    (s.questions || []).forEach((q, i) => {
      html += `<div class="sv-question"><div class="sv-q-title">${i+1}. ${q.text}${q.type!=='text'?'<span style="color:var(--danger);">*</span>':''}</div>`;
      if (q.type === 'single') {
        html += '<div class="sv-options">' + (q.options||[]).map(o => `<label class="sv-opt"><input type="radio" name="${q.id}" value="${o}" required><span>${o}</span></label>`).join('') + '</div>';
      } else if (q.type === 'multiple') {
        html += '<div class="sv-options sv-options-multi">' + (q.options||[]).map(o => `<label class="sv-opt"><input type="checkbox" name="${q.id}" value="${o}"><span>${o}</span></label>`).join('') + '</div>';
      } else {
        html += `<textarea name="${q.id}" rows=3 placeholder="请填写..." style="width:100%;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:14px;"></textarea>`;
      }
      html += '</div>';
    });
    html += `</div><button class="primary-btn sv-submit" onclick="Pages._submitSurvey()">提交问卷</button></form></div>`;
    // 结果展示区（初始隐藏）
    html += `<div id="svResult" style="display:none;padding:30px 20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🎉</div>
      <h3 id="svResultTitle"></h3>
      <p id="svResultContent" style="color:#666;line-height:1.6;margin-top:10px;font-size:14px;"></p>
      <button class="primary-btn" style="margin-top:24px;" onclick="App.switchPage('home')">返回首页</button>
    </div></div>`;
    content.innerHTML = html;
  },
  async _submitSurvey() {
    if (!this._currentSurvey) return;
    if (!App.user) { Auth.openLogin(); return; }
    const form = document.getElementById('svForm');
    if (!form) return;
    const answers = {};
    for (const q of (this._currentSurvey.questions || [])) {
      if (q.type === 'single') { answers[q.id] = form.querySelector(`input[name="${q.id}"]:checked`)?.value || ''; if (!answers[q.id]) return App.toast(`请完成第${(this._currentSurvey.questions.indexOf(q)+1)}题`); }
      else if (q.type === 'multiple') { const checked = [...form.querySelectorAll(`input[name="${q.id}"]:checked`)].map(el => el.value); if (!checked.length) return App.toast(`请完成第${(this._currentSurvey.indexOf(q)+1)}题`); answers[q.id] = checked; }
      else { answers[q.id] = form[q.id]?.value.trim() || ''; }
    }
    const res = await App.api('/api/survey/submit', { method:'POST', body:{ surveyId: this._currentSurvey.id, answers }});
    if (res.code !== 0) return App.toast(res.msg);
    // 隐藏表单，显示结果
    form.parentElement.style.display = 'none';
    const resultEl = document.getElementById('svResult');
    resultEl.style.display = '';
    const d = res.data;
    if (d.type === 'interpretation' && d.interpretation) {
      document.getElementById('svResultTitle').textContent = '您的专属解读';
      document.getElementById('svResultContent').innerHTML = d.interpretation.replace(/\n/g, '<br>');
    } else {
      document.getElementById('svResultTitle').textContent = '感谢填写';
      document.getElementById('svResultContent').textContent = d.thankYouMessage || '感谢填写，我们会根据具体情况为您提供服务。';
    }
  },

  async renderPsychTests() {
    const content = document.getElementById('content');
    content.innerHTML = '<div class="loading">加载中...</div>';
    try {
      const surveys = await App.api('/api/surveys');
      if (!surveys || !surveys.length) {
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
    if (f.minWeight || f.maxWeight) tags.push(`⚖️ ${f.minWeight || 30}-${f.maxWeight || 200}kg`);
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
    // 渲染活动列表（根据筛选条件）
    window._renderActList = function(filter) {
      const filtered = !filter ? allActs : allActs.filter(a => {
        if (filter === 'signed') return !!a.userSigned;
        if (filter === 'unsigned') return !a.userSigned;
        return true;
      });
      document.getElementById('actListBox').innerHTML = filtered.length ? filtered.map(a => `
        <div class="act-card" onclick="Activity.show('${a.id}')">
          <img src="${a.cover}" onerror="this.onerror=null;this.src='https://via.placeholder.com/300/ff5a6e/ffffff?text=?'">
          <div class="body">
            <h3>${a.title}</h3>
            <div class="meta">🕒 ${a.time}<br>📍 ${a.place}</div>
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
      <div class="filter-bar" id="actFilterBar">
        <div class="chip active" data-filter="" onclick="window._actFilter(this, '')">全部</div>
        <div class="chip" data-filter="signed" onclick="window._actFilter(this, 'signed')">我已报名</div>
        <div class="chip" data-filter="unsigned" onclick="window._actFilter(this, 'unsigned')">我未报名</div>
      </div>
      <div id="actListBox"><div class="loading">加载中...</div></div>
    </div>`;
    // 定义筛选切换函数
    window._actFilter = function(el, filter) {
      document.querySelectorAll('#actFilterBar .chip').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      window._renderActList(filter);
    };
    // 默认渲染全部
    window._renderActList('');
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
              <img src="${a.cover}" onerror="this.onerror=null;this.src='https://via.placeholder.com/300/ff5a6e/ffffff?text=?'">
              <div class="body">
                <h3>${a.title}</h3>
                <div class="meta">✍️ ${a.author} · 👁️ ${a.views}</div>
                <div class="footer">
                  <span class="meta">${a.category || '资讯广场'}</span>
                  <span class="join-btn">阅读全文</span>
                </div>
              </div>
            </div>
          `).join('') : '<div class="empty"><div class="icon">📚</div>暂无文章</div>';
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
      u.height ? u.height + 'cm' : null,
      u.education ? u.education : null,
      u.job ? u.job : null,
      u.income ? Pages._formatIncome(u) : null,
    ].filter(Boolean);
    const extraItems = [];
    if (u.gender === '男') {
      if (u.hasHouse) extraItems.push('🏠 ' + u.hasHouse);
      if (u.hasCar) extraItems.push('🚗 ' + u.hasCar);
    }
    content.innerHTML = `
      <div class="page active">
        <div class="profile-header">
          <div class="profile-avatar-wrap" onclick="document.getElementById('avatarFileInput').click()">
            <img id="mineAvatar" src="${u.avatar}" onerror="this.onerror=null;this.src='https://via.placeholder.com/300/ff5a6e/ffffff?text=?'">
            <div class="profile-avatar-mask">📷 换头像</div>
          </div>
          <input type="file" id="avatarFileInput" accept="image/*" style="display:none;" onchange="Pages.uploadAvatar(this)">
          <div class="profile-info">
            <div class="name">${u.nickname || '未设置昵称'} <span style="font-size:15px;color:#fff;">ID: ${u.userId || u.id || ''}</span> ${u.vip ? '<span class="vip-badge">VIP' + (u.level || 1) + '</span>' : ''}</div>
            <div class="level">${[u.gender, u.age ? u.age + '岁' : '', u.city].filter(Boolean).join(' · ')} ${u.verified ? '· ✓ 已认证' : ''}</div>
            <div class="stats">
              <div><b>${u.likes ? u.likes.length : 0}</b>谁喜欢我</div>
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
        <div class="menu-grid">
          <div class="item" onclick="Pages.editProfile()"><div class="icon">📝</div><div class="label">编辑资料</div></div>
          <div class="item" onclick="Pages.showConversations()"><div class="icon">💬</div><div class="label">我的消息</div></div>
          <div class="item" onclick="Pages.showLikes()"><div class="icon">❤</div><div class="label">我喜欢的</div></div>
          <div class="item" onclick="Pages.showLikedBy()"><div class="icon">💌</div><div class="label">谁喜欢我</div></div>
          <div class="item" onclick="Pages.showMessages()"><div class="icon">📨</div><div class="label">站内信</div></div>
          <div class="item" onclick="App.switchPage('activity')"><div class="icon">🎉</div><div class="label">我的活动</div></div>
        </div>
        <div class="menu-list">
          <div class="item" onclick="Pages.showVip()">VIP特权 <span class="arrow">→</span></div>
          <div class="item" onclick="Pages.showSettings()">账号设置 <span class="arrow">→</span></div>
          <div class="item" onclick="Pages.logout()">退出登录 <span class="arrow">→</span></div>
        </div>
      </div>
    `;
  },

  async showMessages() {
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

  // 收入格式化：如果是美元，自动换算为人民币显示
  _formatIncome(u) {
    const income = u.income || (u.form && u.form.income) || '';
    if (!income) return '保密';
    const currency = u.incomeCurrency || 'CNY';
    if (currency === 'USD') {
      // 解析收入范围中的数字，按 1 USD = 7.2 CNY 换算
      const rate = 7.2;
      const nums = income.match(/[\d.]+/g);
      if (nums && nums.length > 0) {
        if (income.includes('-') && nums.length >= 2) {
          const min = (parseFloat(nums[0]) * rate).toFixed(0);
          const max = (parseFloat(nums[1]) * rate).toFixed(0);
          return `${income}美元/年 (约${min}-${max}万人民币/年)`;
        }
        const val = (parseFloat(nums[0]) * rate).toFixed(0);
        return `${income}美元/年 (约${val}万人民币/年)`;
      }
      return income + '美元/年';
    }
    return income + '/年';
  },

  userCard(u, mode) {
    const f = u.form || {};
    const age = u.age || f.age || '';
    const city = u.city || f.currentCity || '';
    const job = u.job || f.job || '';
    const isLiked = mode === 'liked';
    const btnText = isLiked ? '不喜欢了' : '喜欢TA';
    const btnClass = isLiked ? 'gc-like gc-liked' : 'gc-like';
    const btnAction = isLiked
      ? `event.stopPropagation();if(confirm('确定取消喜欢？'))Pages.unlikeUser('${u.id}',this)`
      : `event.stopPropagation();Pages.likeUser('${u.id}',this)`;
    return `<div class="grid-card" onclick="Pages.showUser('${u.id}')">
      <img src="${u.avatar}" onerror="this.onerror=null;this.src='https://via.placeholder.com/300/ff5a6e/ffffff?text=?'">
      ${u.vip ? '<div class="vip-tag">★ VIP' + (u.level || 1) + '</div>' : ''}
      <div class="info">
        <div class="name">${u.nickname}</div>
        <div class="meta">${age ? age + '岁' : ''}${age && city ? ' · ' : ''}${city}${job ? ' · ' + job : ''}</div>
        <button class="${btnClass}" onclick="${btnAction}">${btnText}</button>
      </div>
    </div>`;
  },

  async showUser(id) {
    const res = await App.api('/api/users/' + id);
    if (res.code !== 0) return App.toast('用户不存在');
    const u = res.data;
    const content = document.getElementById('content');
    // 底部导航栏始终置底展示，不隐藏
    // 照片：1 张大图 + 最多 3 张缩略图（共 4 张），底部 carousel 切换
    const allPhotos = (u.photos && u.photos.length) ? u.photos : (u.avatar ? [u.avatar] : []);
    const photos = allPhotos.slice(0, 4);
    // 当前用户是否已喜欢 TA
    const myLikes = (App.user && App.user.likes) || [];
    const liked = myLikes.includes(u.id);
    const f = u.form || {};
    const safeBio = (u.bio || '这个用户很懒，还没写自我介绍~').toString().replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    const safeNick = (u.nickname || '').replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
    content.innerHTML = `
      <div class="page active detail-page">
        <div class="dp-back" onclick="Pages.closeDetail()">‹ 返回</div>
        <div class="detail-photos">
          <div class="dp-main">
            <img id="dpMainImg" src="${photos[0] || ''}" onerror="this.onerror=null;this.src='https://via.placeholder.com/300/ff5a6e/ffffff?text=?'">
            ${u.vip ? `<div class="vip-corner">★ VIP${u.level || 1}</div>` : ''}
            ${u.verified ? '<div class="verified-corner">✓ 实名</div>' : ''}
          </div>
          ${photos.length > 1 ? `
            <div class="dp-thumbs">
              ${photos.map((p, i) => `<img class="${i===0?'active':''}" src="${p}" onclick="Pages._switchDetailPhoto(this, '${p}')" onerror="this.onerror=null;this.src='https://via.placeholder.com/300/ff5a6e/ffffff?text=?'">`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="detail-info">
          <div class="di-header">
            <h1>${safeNick} <span class="di-gender">${u.gender || ''}</span> <span class="di-age">${u.age || ''}岁</span></h1>
            ${u.userId ? `<span class="di-uid">ID: ${u.userId}</span>` : ''}
          </div>
          ${(u.tags && u.tags.length) ? `<div class="tags">${u.tags.map(t => '#' + t).join(' ')}</div>` : '<div class="tags muted">这个用户很懒，什么都没留下</div>'}
          <div class="attr-list">
            <div class="attr"><b>身高</b><span>${f.height || u.height || '保密'}cm</span></div>
            <div class="attr"><b>体重</b><span>${u.weight || f.weight || '保密'}${(u.weight||f.weight) ? 'kg' : ''}</span></div>
            <div class="attr"><b>城市</b><span>${f.currentCity || u.city || '保密'}</span></div>
            <div class="attr"><b>学历</b><span>${f.education || u.education || '保密'}</span></div>
            <div class="attr"><b>职业</b><span>${f.job || u.job || '保密'}</span></div>
            <div class="attr"><b>年收入</b><span>${Pages._formatIncome(u)}</span></div>
            <div class="attr"><b>婚况</b><span>${f.maritalStatus || u.marriage || '保密'}</span></div>
            <div class="attr"><b>星座</b><span>${u.zodiac || '保密'}</span></div>
            <div class="attr"><b>血型</b><span>${u.bloodType || '保密'}</span></div>
            <div class="attr"><b>出生日期</b><span>${u.birthday || '保密'}</span></div>
            ${u.gender === '男' ? `<div class="attr"><b>房产</b><span>${u.hasHouse || '保密'}</span></div><div class="attr"><b>车子</b><span>${u.hasCar || '保密'}</span></div>` : ''}
            <div class="attr"><b>认证</b><span>${u.verified ? '<b style="color:var(--green);">已认证</b>' : '未认证'}</span></div>
          </div>
          <div class="bio">${safeBio}</div>
        </div>
        <div class="detail-actions">
          <button id="likeBtn" class="like ${liked?'liked':''}" onclick="Pages.likeUser('${u.id}', this)">
            <span class="lb-icon">${liked ? '💔' : '❤'}</span>
            <span class="lb-text">${liked ? '不喜欢了' : '喜欢TA'}</span>
          </button>
          <button class="msg" onclick="Pages.checkVipChat('${u.id}')">💬 打招呼</button>
        </div>
      </div>
    `;
  },
  closeDetail() {
    const bar = document.querySelector('.bottombar');
    if (bar) bar.style.display = '';
    App.switchPage('home');
  },

  checkVipChat(partnerId) {
    if (!App.user) return Auth.openLogin();
    if (!App.user.vip) {
      Pages._showVipUpgradePopup();
      return;
    }
    Chat.open(partnerId);
  },

  async likeUser(id, btn) {
    if (!App.user) return Auth.openLogin();
    const res = await App.api('/api/like', { method: 'POST', body: { targetId: id } });
    if (res.code === 0) {
      if (!App.user.likes) App.user.likes = [];
      if (res.data.liked) {
        if (!App.user.likes.includes(id)) App.user.likes.push(id);
        App.toast(res.data.match ? '💕 互相喜欢！可以开始聊天了' : '已喜欢TA，期待TA也喜欢你 💕');
        if (btn) {
          btn.classList.add('liked');
          btn.querySelector('.lb-icon').textContent = '💔';
          btn.querySelector('.lb-text').textContent = '不喜欢了';
        }
      } else {
        App.user.likes = App.user.likes.filter(x => x !== id);
        App.toast('已取消喜欢');
        if (btn) {
          btn.classList.remove('liked');
          btn.querySelector('.lb-icon').textContent = '❤';
          btn.querySelector('.lb-text').textContent = '喜欢TA';
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
  _switchDetailPhoto(img, url) {
    const main = document.getElementById('dpMainImg');
    if (main) main.src = url;
    img.parentElement.querySelectorAll('img').forEach(i => i.classList.remove('active'));
    img.classList.add('active');
  },

  editProfile() {
    const u = App.user;
    const content = document.getElementById('content');
    const photos = u.photos || [];
    const isMale = u.gender === '男';
    content.innerHTML = `
      <div class="page active" style="background:#fff; padding:16px; margin:-10px -12px; min-height:100vh;">
        <h2 style="margin-bottom: 16px;">编辑资料</h2>
        <div class="form-group"><label>相册照片（1 张主图 + 2 张副图，详情页 carousel 展示）</label>
          <div id="f_photos_grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
            ${[0,1,2].map(i => {
              const p = photos[i] || '';
              return `<div class="photo-slot" data-i="${i}" style="position:relative; aspect-ratio:1; background:#f0f0f0; border:1px dashed var(--border); border-radius: 8px; overflow: hidden;">
                <input type="hidden" id="f_photo_${i}" value="${p}">
                <input type="file" accept="image/*" data-i="${i}" style="display:none;" onchange="Pages._uploadProfilePhoto(this)">
                ${p ? `<img src="${p}" style="width:100%; height:100%; object-fit:cover;">` : '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-3); font-size:24px;">+</div>'}
                ${p ? '<div style="position:absolute; top:4px; right:4px; width:20px; height:20px; background:rgba(0,0,0,0.5); color:#fff; border-radius:50%; text-align:center; line-height:20px; font-size:14px;" onclick="event.stopPropagation(); Pages._clearProfilePhoto(' + i + ')">×</div>' : ''}
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="form-group"><label>昵称</label><input id="f_nickname" value="${u.nickname || ''}" placeholder="请填写昵称"></div>
        <div class="form-group"><label>出生日期 <span style="color:var(--danger);">*</span>（系统自动计算年龄和星座）</label><input id="f_birthday" type="date" value="${u.birthday || ''}" onchange="Pages._calcAge(this.value); Pages._calcZodiac(); document.getElementById('f_age_hint').textContent = Pages._calcAge(this.value) ? '当前年龄：' + Pages._calcAge(this.value) + '岁' : ''"><small id="f_age_hint" style="color:var(--text-3);">${u.birthday ? '当前年龄：' + (Pages._calcAge(u.birthday) || '') + '岁' : ''}</small></div>
        <div class="form-group"><label>星座</label><span id="f_zodiac_display" style="display:inline-block; padding:8px 12px; background:#f5f5f5; border-radius:8px; color:var(--text-2);">${u.zodiac || '保密'}</span><input type="hidden" id="f_zodiac" value="${u.zodiac || ''}"></div>
        <div class="form-group"><label>血型 <span style="color:var(--danger);">*</span></label><select id="f_bloodType"><option value="" ${!u.bloodType?'selected':''}>请选择</option><option ${u.bloodType==='A型'?'selected':''}>A型</option><option ${u.bloodType==='B型'?'selected':''}>B型</option><option ${u.bloodType==='AB型'?'selected':''}>AB型</option><option ${u.bloodType==='O型'?'selected':''}>O型</option><option ${u.bloodType==='其他'?'selected':''}>其他</option></select></div>
        <div class="form-group"><label>体重(KG) <span style="color:var(--danger);">*</span></label><input id="f_weight" type="number" min="30" max="200" value="${u.weight || ''}" placeholder="请输入体重"></div>
        <div class="form-group"><label>所在地</label>
          <div style="display:flex; gap:8px;">
            <select id="f_country" onchange="Pages._onCountryChange()" style="flex:1;"><option value="">国家</option><option value="中国" ${u.country==='中国'?'selected':''}>中国</option><option value="美国" ${u.country==='美国'?'selected':''}>美国</option></select>
            <select id="f_state" onchange="Pages._onStateChange()" style="flex:1;"><option value="">州/省</option></select>
            <select id="f_city" style="flex:1;"><option value="">城市</option></select>
          </div>
        </div>
        <div class="form-group"><label>身高(cm)</label><input id="f_height" type="number" value="${u.height || ''}" placeholder="请填写身高"></div>
        <div class="form-group"><label>学历</label><select id="f_education"><option value="" ${!u.education?'selected':''}>请选择</option><option ${u.education==='本科'?'selected':''}>本科</option><option ${u.education==='大专'?'selected':''}>大专</option><option ${u.education==='硕士'?'selected':''}>硕士</option><option ${u.education==='博士'?'selected':''}>博士</option><option ${u.education==='高中'?'selected':''}>高中</option></select></div>
        <div class="form-group"><label>职业</label><input id="f_job" value="${u.job || ''}" placeholder="请填写职业"></div>
        <div class="form-group"><label>年收入</label>
          <div style="display:flex; gap:8px;">
            <select id="f_income" style="flex:1;"><option value="" ${!u.income?'selected':''}>请选择</option><option ${u.income==='5万以下'?'selected':''}>5万以下</option><option ${u.income==='5-10万'?'selected':''}>5-10万</option><option ${u.income==='10-20万'?'selected':''}>10-20万</option><option ${u.income==='20-30万'?'selected':''}>20-30万</option><option ${u.income==='30-50万'?'selected':''}>30-50万</option><option ${u.income==='50万以上'?'selected':''}>50万以上</option></select>
            <select id="f_incomeCurrency" style="width:100px;"><option value="CNY" ${(u.incomeCurrency||'CNY')==='CNY'?'selected':''}>人民币</option><option value="USD" ${u.incomeCurrency==='USD'?'selected':''}>美元</option></select>
          </div>
          <small style="color:var(--text-3);">如选择美元，前端将自动换算为人民币显示</small>
        </div>
        <div class="form-group"><label>婚况</label><select id="f_marriage"><option value="" ${!u.marriage?'selected':''}>请选择</option><option ${u.marriage==='未婚'?'selected':''}>未婚</option><option ${u.marriage==='离异'?'selected':''}>离异</option><option ${u.marriage==='丧偶'?'selected':''}>丧偶</option></select></div>
        ${isMale ? `
        <div class="form-group"><label>是否有房产</label><select id="f_hasHouse"><option value="" ${!u.hasHouse?'selected':''}>请选择</option><option ${u.hasHouse==='有(无贷款)'?'selected':''}>有(无贷款)</option><option ${u.hasHouse==='有(有贷款)'?'selected':''}>有(有贷款)</option><option ${u.hasHouse==='无'?'selected':''}>无</option><option ${u.hasHouse==='与父母同住'?'selected':''}>与父母同住</option></select></div>
        <div class="form-group"><label>是否有车子</label><select id="f_hasCar"><option value="" ${!u.hasCar?'selected':''}>请选择</option><option ${u.hasCar==='有'?'selected':''}>有</option><option ${u.hasCar==='无'?'selected':''}>无</option></select></div>
        ` : ''}
        <div class="form-group"><label>个人介绍</label><textarea id="f_bio" style="width:100%; padding:9px 12px; border:1px solid var(--border); border-radius:8px; min-height:80px;">${u.bio || ''}</textarea></div>
        <button class="primary-btn" onclick="Pages.saveProfile()">保存</button>
        <button class="primary-btn" style="background:#f5f5f5; color:#666; margin-top:8px;" onclick="Pages.renderMine()">取消</button>
      </div>
    `;
    document.querySelectorAll('#f_photos_grid .photo-slot').forEach(slot => {
      slot.onclick = () => slot.querySelector('input[type=file]').click();
    });
    // 初始化三级联动
    setTimeout(() => {
      const u = App.user;
      if (u.country) {
        Pages._onCountryChange();
        if (u.state) {
          document.getElementById('f_state').value = u.state;
          Pages._onStateChange();
          if (u.city) {
            document.getElementById('f_city').value = u.city;
          }
        }
      }
      // 初始化星座显示
      if (u.birthday) Pages._calcZodiac();
    }, 0);
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
    if (!App.user) return Auth.openLogin();
    const content = document.getElementById('content');
    content.innerHTML = '<div class="page active"><div class="loading">加载中...</div></div>';
    const res = await App.api('/api/conversations');
    if (res.code === 0) {
      // 过滤无效会话（对方用户可能被删除）
      const conversations = (res.data || []).filter(c => c && c.partner);
      content.innerHTML = `<div class="page active chat-page"><h2 style="padding: 0 4px 12px;">消息</h2><div class="chat-list">${conversations.length ? conversations.map(c => `
        <div class="item" onclick="Chat.open('${c.partner.id}')">
          <img src="${c.partner.avatar || ''}" onerror="this.onerror=null;this.src='https://via.placeholder.com/100/ff5a6e/ffffff?text=?'">
          <div class="info">
            <div style="display:flex; justify-content:space-between;">
              <span class="name">${c.partner.nickname || '未知用户'}</span>
              <span class="time">${c.lastMsg && c.lastMsg.createdAt ? new Date(c.lastMsg.createdAt).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'}) : ''}</span>
            </div>
            <div class="preview">${(c.lastMsg && c.lastMsg.content) || ''}</div>
          </div>
        </div>
      `).join('') : '<div class="empty"><div class="icon">💬</div>暂无消息<br><span style="font-size:12px;">去找个心仪的TA打招呼吧</span></div>'}</div></div>`;
    }
  },

  async showLikes() {
    if (!App.user) return Auth.openLogin();
    const content = document.getElementById('content');
    content.innerHTML = '<div class="page active"><div class="loading">加载中...</div></div>';
    const res = await App.api('/api/me/likes');
    const users = (res.code === 0 && res.data && res.data.list) ? res.data.list : [];
    // 同步本端 likes
    if (App.user) App.user.likes = users.map(u => u.id);
    content.innerHTML = `<div class="page active"><h2 style="padding: 4px 4px 12px;">我喜欢的 (${users.length})</h2><div class="user-grid">${users.length ? users.map(u => Pages.userCard(u, 'liked')).join('') : '<div class="empty"><div class="icon">❤</div>还没喜欢过谁<br><span style="font-size:12px;color:var(--text-3);">去首页点「喜欢TA」吧</span></div>'}</div></div>`;
  },

  async showLikedBy() {
    if (!App.user) return Auth.openLogin();
    // 普通用户弹窗引导升级VIP
    if (!App.user.vip) {
      Pages._showVipUpgradePopup();
      return;
    }
    // VIP用户显示谁喜欢我列表
    const content = document.getElementById('content');
    content.innerHTML = '<div class="page active"><div class="loading">加载中...</div></div>';
    const res = await App.api('/api/me/liked-by');
    const users = (res.code === 0 && res.data && res.data.list) ? res.data.list : [];
    content.innerHTML = `<div class="page active"><h2 style="padding: 4px 4px 12px;">谁喜欢我 (${users.length})</h2><div class="user-grid">${users.length ? users.map(Pages.userCard).join('') : '<div class="empty"><div class="icon">💌</div>还没有人喜欢你<br><span style="font-size:12px;color:var(--text-3);">完善资料让更多人看到你</span></div>'}</div></div>`;
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
    let cfg = {};
    try {
      const res = await App.api('/api/vip/service-config');
      if (res.code === 0 && res.data) cfg = res.data;
    } catch(e) { console.error('VIP config load error', e); }
    // 使用默认值兜底
    const c = cfg;
    const esc = (s) => String(s || '').replace(/[<>&"]/g, ch => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[ch]));
    const pageTitle = c.pageTitle || '定制会员';
    const tab1 = c.tab1Name || '定制会员';
    const tab2 = c.tab2Name || '关于我们';
    const bannerImg = c.bannerImage || '';
    const bannerTitle = c.bannerTitle || '爱只能定制\n不可复制';
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
    // Tab2 数据（与Tab1结构一致）
    const tab2BannerImg = c.tab2BannerImage || '';
    const tab2BannerTitle = c.tab2BannerTitle || '';
    const tab2BannerSubtitle = c.tab2BannerSubtitle || '';
    const tab2Section1Title = c.tab2Section1Title || '哪些人适合SVIP服务';
    const tab2Crowd = Array.isArray(c.tab2CrowdItems) ? c.tab2CrowdItems : [];
    const tab2Section2Title = c.tab2Section2Title || 'SVIP专属服务';
    const tab2Services = Array.isArray(c.tab2ServiceItems) ? c.tab2ServiceItems : [];

    content.innerHTML = `
    <div class="page active vip-service-page">
      <div class="vsp-tabs">
        <a class="vsp-tab active" data-tab="service" onclick="Pages._switchVipTab(this,'service')">${esc(tab1)}</a>
        <a class="vsp-tab" data-tab="about" onclick="Pages._switchVipTab(this,'about')">${esc(tab2)}</a>
      </div>
      <div id="vipTabService" class="vip-tab-content">
        ${bannerImg ? `<div class="vsp-banner" style="background-image:url('${esc(bannerImg)}')"><div class="vsp-banner-text">${esc(bannerTitle).replace(/\\n|\n/g,'<br>')}</div></div>` :
        `<div class="vsp-banner vsp-banner-default"><div class="vsp-banner-text">${esc(bannerTitle).replace(/\\n|\n/g,'<br>')}<br><small>${esc(bannerSubtitle)}</small></div></div>`}
        <div class="vsp-section">
          <h3 class="vsp-section-title">${esc(section1Title)}</h3>
          <div class="vsp-crowd-grid">
            ${crowd.map(item => `
              <div class="vsp-crowd-item">
                <div class="vsp-crowd-icon"><img src="${esc(item.icon)}" onerror="this.parentElement.style.display='none'"></div>
                <div class="vsp-crowd-title">${esc(item.title)}</div>
                <div class="vsp-crowd-desc">${esc(item.desc)}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="vsp-section">
          <h3 class="vsp-section-title">${esc(section2Title)}</h3>
          <div class="vsp-service-list">
            ${services.map(item => `
              <div class="vsp-svc-item">
                <div class="vsp-svc-icon"><img src="${esc(item.icon)}" onerror="this.parentElement.innerHTML='<span>✦</span>'"></div>
                <div class="vsp-svc-info">
                  <div class="vsp-svc-title">${esc(item.title)}</div>
                  <div class="vsp-svc-desc">${esc(item.desc)}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>
      <div id="vipTabAbout" class="vip-tab-content" style="display:none;">
        ${tab2BannerImg ? `<div class="vsp-banner" style="background-image:url('${esc(tab2BannerImg)}')"><div class="vsp-banner-text">${esc(tab2BannerTitle || '').replace(/\\n|\n/g,'<br>')}</div></div>` :
        `<div class="vsp-banner vsp-banner-default"><div class="vsp-banner-text">${(esc(tab2BannerTitle)||'SVIP会员').replace(/\\n|\n/g,'<br>')}<br><small>${esc(tab2BannerSubtitle||'')}</small></div></div>`}
        <div class="vsp-section">
          <h3 class="vsp-section-title">${esc(tab2Section1Title || '哪些人适合SVIP服务')}</h3>
          <div class="vsp-crowd-grid">
            ${tab2Crowd.map(item => `
              <div class="vsp-crowd-item">
                <div class="vsp-crowd-icon"><img src="${esc(item.icon)}" onerror="this.parentElement.style.display='none'"></div>
                <div class="vsp-crowd-title">${esc(item.title)}</div>
                <div class="vsp-crowd-desc">${esc(item.desc)}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="vsp-section">
          <h3 class="vsp-section-title">${esc(tab2Section2Title || 'SVIP专属服务')}</h3>
          <div class="vsp-service-list">
            ${tab2Services.map(item => `
              <div class="vsp-svc-item">
                <div class="vsp-svc-icon"><img src="${esc(item.icon)}" onerror="this.parentElement.innerHTML='<span>✦</span>'"></div>
                <div class="vsp-svc-info">
                  <div class="vsp-svc-title">${esc(item.title)}</div>
                  <div class="vsp-svc-desc">${esc(item.desc)}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
  },

  _switchVipTab(el, tabId) {
    document.querySelectorAll('.vsp-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('.vip-tab-content').forEach(c => c.style.display = 'none');
    const target = document.getElementById(tabId === 'service' ? 'vipTabService' : 'vipTabAbout');
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
    else if (status === '报名截止') { btnText = '报名已截止'; btnDisabled = true; }
    else if (isMember) { btnText = '✓ 已报名'; btnDisabled = true; }

    const joinerWall = joiners.length === 0
      ? '<div class="empty-mini">还没有人报名，快来抢沙发~</div>'
      : `
        <div class="joiner-wall">
          ${joiners.slice(0, 12).map(j => `<div class="joiner-chip"><img src="${j.avatar}" onerror="this.onerror=null;this.src='https://via.placeholder.com/300/ff5a6e/ffffff?text=?'"><span>${j.nickname}</span></div>`).join('')}
          ${joiners.length > 12 ? `<div class="joiner-more">+${joiners.length - 12}</div>` : ''}
        </div>
      `;

    document.getElementById('content').innerHTML = `
      <div class="page active article-page act-detail">
        <span class="back-btn" onclick="Pages.renderActivity()">‹ 返回</span>
        <img class="cover" src="${a.cover}">
        <div class="status-badge ${this._statusClass(status)}">${status}</div>
        <h1>${a.title}</h1>
        <div class="meta">🕒 ${a.time}<br>📍 ${a.city} · ${a.place}</div>
        <div class="act-price-row">
          <span class="act-price ${a.price === 0 ? 'free' : ''}">${a.price === 0 ? '免费' : '¥' + a.price}</span>
          <span class="act-progress">已报名 ${a.joined}/${a.total} 人</span>
        </div>
        ${a.signupStart ? `<div class="meta" style="font-size:11px;">报名时间：${a.signupStart} ~ ${a.signupEnd}</div>` : ''}
        <div class="content">${a.desc}</div>
        <div class="act-joiners">
          <div class="joiner-title">已报名会员 <span class="count">(${joiners.length}人)</span></div>
          ${joinerWall}
        </div>
        <button class="primary-btn act-join-btn ${btnDisabled ? 'disabled' : ''}" ${btnDisabled ? 'disabled' : ''} onclick="${btnAction}">${btnText}</button>
      </div>
    `;
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
        <div class="meta">✍️ ${a.author} · 👁️ ${a.views} · ${a.category || ''}</div>
        <div class="content">${a.content}</div>
      </div>
    `;
  }
};

App.init();
// 动态生成底部导航栏
App.renderBottomBar();
