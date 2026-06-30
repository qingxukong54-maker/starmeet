// 择爱V11仿站 - PC后台主逻辑
const Admin = {
  token: localStorage.getItem('zeai_admin_token') || '',
  editingUser: null,
  // ISO 时间 -> datetime-local 需要的 YYYY-MM-DDTHH:MM
  toLocal(s) { if (!s) return ''; return s.slice(0, 16); },
  toggleUserPassword() {
    const inp = document.getElementById('e_password');
    const btn = document.getElementById('e_pw_toggle');
    if (!inp || !btn) return;
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; btn.classList.add('showing'); }
    else { inp.type = 'password'; btn.textContent = '👁'; btn.classList.remove('showing'); }
  },
  init() {
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);
    if (this.token) { this.verifyToken(); } else { document.getElementById('loginPage').style.display = 'flex'; }
    this.bindMenu();
  },
  updateClock() {
    const d = new Date();
    const w = ['日','一','二','三','四','五','六'][d.getDay()];
    document.getElementById('currentTime').textContent = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} 周${w} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },
  async api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    try {
      const res = await fetch(path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
      const data = await res.json();
      if (data.code === 401) {
        this.toast('登录已过期，请重新登录');
        this.logout();
        return data;
      }
      return data;
    } catch (e) {
      console.error('API请求失败:', path, e);
      this.toast('网络错误，请稍后重试');
      return { code: -1, msg: '网络错误' };
    }
  },
  async verifyToken() {
    const res = await this.api('/api/admin/users');
    if (res.code === 0) { this.showAdmin(); }
    else { document.getElementById('loginPage').style.display = 'flex'; }
  },
  async login() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPwd').value;
    if (!username || !password) { this.toast('请输入账号和密码'); return; }
    const loginBtn = document.querySelector('#loginPage .primary-btn');
    if (loginBtn) { loginBtn.textContent = '登录中...'; loginBtn.disabled = true; }
    try {
      const res = await this.api('/api/admin/login', { method: 'POST', body: { username, password } });
      if (res.code === 0) {
        this.token = res.data.token; localStorage.setItem('zeai_admin_token', this.token);
        document.getElementById('adminName').textContent = res.data.admin.username;
        this.toast('登录成功');
        this.showAdmin();
      } else { this.toast(res.msg || '登录失败'); }
    } catch(e) {
      this.toast('网络错误：' + e.message);
      console.error('登录失败', e);
    } finally {
      if (loginBtn) { loginBtn.textContent = '登录'; loginBtn.disabled = false; }
    }
  },
  showAdmin() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('adminPage').style.display = 'flex';
    this.switchPage('dashboard');
  },
  logout() {
    this.token = ''; localStorage.removeItem('zeai_admin_token');
    document.getElementById('adminPage').style.display = 'none';
    document.getElementById('loginPage').style.display = 'flex';
  },
  bindMenu() {
    document.querySelectorAll('.menu-item').forEach(el => {
      el.addEventListener('click', () => this.switchPage(el.dataset.page));
    });
  },
  switchPage(page) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
    const titles = {
      dashboard: '数据看板', users: '会员管理', star: '今日之星配置', banners: '首页轮播管理',
      topNav: '顶部导航管理', quickEntries: '快捷入口管理', surveys: '问卷调查管理', splashAds: '开屏广告管理',
      siteConfig: '站点配置', contact: '联系我们设置', settings: '系统设置', mailConfig: '邮箱配置',
      vip: 'VIP等级管理', agreements: '协议管理',
      articles: '资讯广场', activities: '活动管理', messages: '消息记录', broadcast: '群发消息'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    const renderers = {
      dashboard: this.renderDashboard, users: this.renderUsers, star: this.renderStarConfig,
      banners: this.renderBanners, topNav: this.renderTopNav, quickEntries: this.renderQuickEntries,
      surveys: this.renderSurveys, splashAds: this.renderSplashAds,
      siteConfig: this.renderSiteConfig, contact: this.renderContact,
      settings: this.renderSettings, mailConfig: this.renderMailConfig,
      vip: this.renderVip, agreements: this.renderAgreements,
      articles: this.renderArticles, activities: this.renderActivities, messages: this.renderMessages,
      broadcast: this.renderBroadcast
    };
    if (renderers[page]) {
      try {
        const r = renderers[page].call(this);
        if (r && typeof r.catch === 'function') r.catch(e => { this.toast('页面加载失败: ' + (e.message || e)); console.error('[render ' + page + ']', e); });
      } catch (e) { this.toast('页面加载失败: ' + (e.message || e)); console.error('[render ' + page + ']', e); }
    }
  },

  // 通用：弹 modal 时复用 #userEditModal 容器，但允许每个模块自定义标题/底部按钮
  _openModal(title, bodyHtml, onSave) {
    document.getElementById('userEditForm').innerHTML = bodyHtml;
    document.querySelector('#userEditModal .modal-title').textContent = title;
    const oldBtn = document.querySelector('#userEditModal .primary-btn');
    if (oldBtn) {
      oldBtn.textContent = '保存';
      oldBtn.onclick = onSave;
      oldBtn.style.display = '';
    }
    document.getElementById('userEditModal').style.display = 'flex';
  },
  _closeModal() {
    document.getElementById('userEditModal').style.display = 'none';
    const pb = document.getElementById('a_preview_btn'); if (pb) pb.remove();
  },

  toast(msg, dur = 1800) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.style.display = 'none', dur);
  },

  async renderDashboard() {
    const content = document.getElementById('pageContent');
    content.innerHTML = '<div class="loading">加载中...</div>';
    const res = await this.api('/api/admin/stats');
    if (res.code === 0) {
      const s = res.data;
      content.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card"><div class="label">总会员数</div><div class="value">${s.totalUsers}</div><div class="extra">男生 ${s.maleUsers} · 女生 ${s.femaleUsers}</div></div>
          <div class="stat-card blue"><div class="label">VIP会员</div><div class="value">${s.vipUsers}</div><div class="extra">占比 ${s.totalUsers ? (s.vipUsers/s.totalUsers*100).toFixed(1) : 0}%</div></div>
          <div class="stat-card green"><div class="label">已认证会员</div><div class="value">${s.verifiedUsers}</div><div class="extra">${s.totalUsers ? (s.verifiedUsers/s.totalUsers*100).toFixed(1) : 0}% 认证率</div></div>
          <div class="stat-card gold"><div class="label">当前在线</div><div class="value">${s.onlineUsers}</div><div class="extra">实时数据</div></div>
        </div>
        <div class="stats-grid">
          <div class="stat-card blue"><div class="label">资讯广场文章</div><div class="value">${s.totalArticles}</div><div class="extra">可发表学习内容</div></div>
          <div class="stat-card"><div class="label">相亲活动</div><div class="value">${s.totalActivities}</div><div class="extra">线下活动</div></div>
          <div class="stat-card green"><div class="label">站内消息</div><div class="value">${s.totalMessages}</div><div class="extra">累计消息数</div></div>
          <div class="stat-card gold"><div class="label">系统状态</div><div class="value" style="color:var(--green);font-size:20px;">运行中</div><div class="extra">Node.js 22 · JSON DB</div></div>
        </div>
        <div class="panel">
          <div class="panel-header"><h3>💡 系统说明</h3></div>
          <div class="panel-body" style="line-height: 1.8; color: var(--text-2);">
            <p>🎉 欢迎使用择爱V11仿站演示版！这是一套<strong>零依赖、开箱即用</strong>的婚恋H5系统。</p>
            <p>📦 技术栈：Node.js 22 (内置HTTP) + JSON文件存储 + 移动端H5 + PC管理后台</p>
            <p>✅ 已实现：注册/登录、会员列表/详情/筛选、即时聊天、活动/文章、VIP等级、后台改会员等级</p>
            <p>🚧 待完善：支付接入（可接微信/支付宝）、实名认证API、短信验证码、推送服务</p>
            <p>📊 上线运营建议：域名备案 + 短信平台 + 微信支付 + 实名认证服务 + SSL证书</p>
            <p style="margin-top: 12px; color: var(--primary);">👉 主人可以点左侧「会员管理」给会员改VIP等级看看效果</p>
          </div>
        </div>
      `;
    }
  },

  async renderUsers() {
    const content = document.getElementById('pageContent');
    content.innerHTML = `<div class="panel">
      <div class="panel-header"><h3>会员列表</h3><span>共 <b id="userCount">0</b> 人 · 已选 <b id="userSelCount">0</b> 人</span></div>
      <div class="panel-body">
        <div class="search-bar">
          <input id="userKw" placeholder="搜索昵称/注册邮箱/城市..." style="flex:1; min-width:200px;">
          <div class="form-group-inline"><label>性别</label>
            <select id="userGender"><option value="">全部</option><option value="男">男</option><option value="女">女</option></select>
          </div>
          <div class="form-group-inline"><label>VIP</label>
            <select id="userVip"><option value="">全部</option><option value="true">VIP</option><option value="false">普通</option></select>
          </div>
          <div class="form-group-inline"><label>审核状态</label>
            <select id="userAuditStatus">
              <option value="">全部</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="Admin.searchUsers()">查询</button>
          <button class="btn" style="background:#2eb872;color:#fff;border-color:#2eb872;" onclick="Admin.exportUsers()">📥 导出 Excel</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 8px 0;">
          <div>每页显示
            <select id="userPageSize" onchange="Admin.goPage(1)">
              <option value="10" selected>10 条</option>
              <option value="30">30 条</option>
              <option value="50">50 条</option>
              <option value="100">100 条</option>
            </select>
          </div>
          <div id="userPagination"></div>
        </div>
        <div id="usersTable">加载中...</div>
      </div>
    </div>`;
    this._userPage = 1;
    this.loadUsers();
  },
  async loadUsers(keyword = '', gender = '', vip = '', auditStatus = '') {
    const pageSize = parseInt(document.getElementById('userPageSize')?.value) || 10;
    const page = this._userPage || 1;
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (gender) params.set('gender', gender);
    if (vip) params.set('vip', vip);
    if (auditStatus) params.set('auditStatus', auditStatus);
    params.set('page', page);
    params.set('pageSize', pageSize);
    const res = await this.api('/api/admin/users?' + params.toString());
    if (res.code === 0) {
      const { list, total, totalPages } = res.data;
      document.getElementById('userCount').textContent = total;
      document.getElementById('userSelCount').textContent = '0';
      // 渲染分页
      let pgHtml = '';
      if (totalPages > 1) {
        pgHtml = `<div class="pagination" data-total-pages="${totalPages}">`;
        pgHtml += `<button class="btn btn-sm" onclick="Admin.goPage(${page-1})" ${page<=1?'disabled':''}>上一页</button>`;
        pgHtml += `<span style="margin:0 8px;">第 ${page}/${totalPages} 页（共 ${total} 条）</span>`;
        pgHtml += `<button class="btn btn-sm" onclick="Admin.goPage(${page+1})" ${page>=totalPages?'disabled':''}>下一页</button>`;
        pgHtml += `</div>`;
      }
      const pgEl = document.getElementById('userPagination');
      pgEl.innerHTML = pgHtml;
      pgEl.dataset.totalPages = totalPages;
      document.getElementById('usersTable').innerHTML = `
        <div class="table-scroll">
        <table>
          <thead><tr>
            <th style="width:32px;"><input type="checkbox" id="userSelAll" onchange="Admin._toggleSelAll(this)"></th>
            <th>头像</th><th>昵称/ID</th><th>注册邮箱</th><th>微信号</th><th>性别</th>
            <th>年龄</th><th>城市</th><th>学历</th><th>职业</th>
            <th>身高</th><th>体重</th><th>收入</th><th>婚况</th>
            <th>等级</th><th>VIP</th><th>认证</th><th>审核状态</th><th>注册时间</th><th>操作</th>
          </tr></thead>
          <tbody>${list.map(u => {
            const dt = u.createdAt ? new Date(u.createdAt) : null;
            const reg = dt ? `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}` : '-';
            const height = u.height || (u.form && u.form.height) || '';
            const weight = u.weight || (u.form && u.form.weight) || '';
            const income = u.income || (u.form && u.form.income) || '';
            const bio = u.bio || (u.form && u.form.bio) || '';
            const safeBio = (bio || '').toString().replace(/[<>&"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
            const auditMap = { pending: '<span class="tag" style="background:#fff7e6;color:#fa8c16;">待审核</span>', approved: '<span class="tag vip">已通过</span>', rejected: '<span class="tag" style="background:#fff1f0;color:#f5222d;">已拒绝</span>' };
            const auditTag = auditMap[u.auditStatus] || '<span class="tag" style="background:#f0f0f0;">未设置</span>';
            return `
            <tr>
              <td><input type="checkbox" class="user-sel" data-id="${u.id}" onchange="Admin._updateSelCount()"></td>
              <td><img class="avatar" src="${u.avatar}"></td>
              <td>${u.nickname} <span style="color:var(--text-3); font-size:11px;">(${u.userId||''})</span></td>
              <td>${u.email || '-'}</td>
              <td>${u.wechat || (u.form && u.form.wechat) || '<span style="color:var(--text-3);">-</span>'}</td>
              <td>${u.gender}</td>
              <td>${u.age || u.form?.age || '-'}</td>
              <td>${u.city || u.form?.currentCity || '-'}</td>
              <td>${u.education || u.form?.education || '-'}</td>
              <td>${u.job || u.form?.job || '-'}</td>
              <td>${height ? height + 'cm' : '-'}</td>
              <td>${weight ? weight + 'kg' : '-'}</td>
              <td>${income || '-'}</td>
              <td>${u.marriage || u.form?.maritalStatus || '-'}</td>
              <td><b style="color:var(--primary);">LV${u.level || 1}</b></td>
              <td>${u.vip ? '<span class="tag vip">VIP</span>' : '<span class="tag">普通</span>'}</td>
              <td>${u.verified ? '<span class="tag verified">✓已认证</span>' : '<span class="tag">未认证</span>'}</td>
              <td>${auditTag}</td>
              <td style="font-size:12px; color:var(--text-2);">${reg}</td>
              <td>
                <button class="btn btn-primary" onclick="Admin.editUser('${u.id}')">编辑</button>
                <button class="btn" style="background:#722ed1;color:#fff;" onclick="Admin.showRelations('${u.id}')">关系</button>
                <button class="btn btn-danger" onclick="Admin.deleteUser('${u.id}')">删除</button>
                ${u.auditStatus === 'pending' ? `<button class="btn btn-primary" onclick="Admin.approveUser('${u.userId||u.id}')">通过</button><button class="btn" style="background:#ff4d4f;color:#fff;" onclick="Admin.rejectUser('${u.userId||u.id}')">拒绝</button>` : ''}
              </td>
            </tr>`;}).join('')}</tbody>
        </table>
        </div>
        ${list.length === 0 ? '<div class="empty"><div class="icon">👥</div>暂无数据</div>' : ''}
      `;
    }
  },
  goPage(p) {
    const totalPages = parseInt(document.getElementById('userPagination')?.dataset.totalPages) || 1;
    if (p < 1 || p > totalPages) return;
    this._userPage = p;
    this.loadUsers(
      document.getElementById('userKw')?.value || '',
      document.getElementById('userGender')?.value || '',
      document.getElementById('userVip')?.value || '',
      document.getElementById('userAuditStatus')?.value || ''
    );
  },
  _toggleSelAll(cb) {
    document.querySelectorAll('.user-sel').forEach(el => { el.checked = cb.checked; });
    this._updateSelCount();
  },
  _updateSelCount() {
    const n = document.querySelectorAll('.user-sel:checked').length;
    const el = document.getElementById('userSelCount');
    if (el) el.textContent = n;
  },
  _getSelectedIds() {
    return Array.from(document.querySelectorAll('.user-sel:checked')).map(el => el.dataset.id);
  },

  // 审核通过
  async approveUser(userId) {
    if (!confirm('确认通过审核？')) return;
    const res = await this.api('/api/admin/user/approve', { method: 'POST', body: { userId } });
    if (res.code === 0) { this.toast('审核通过'); this.loadUsers(); }
    else this.toast(res.msg || '操作失败');
  },

  // 审核拒绝
  async rejectUser(userId) {
    const reason = prompt('请填写拒绝原因：');
    if (!reason) return;
    const res = await this.api('/api/admin/user/reject', { method: 'POST', body: { userId, reason } });
    if (res.code === 0) { this.toast('已拒绝'); this.loadUsers(); }
    else this.toast(res.msg || '操作失败');
  },

  // 从编辑弹窗中审核通过
  async approveUserFromEdit(userId) {
    if (!confirm('确认通过审核？')) return;
    const res = await this.api('/api/admin/user/approve', { method: 'POST', body: { userId } });
    if (res.code === 0) {
      this.toast('审核通过');
      // 刷新编辑弹窗
      const u = await this.api('/api/admin/users').then(r => r.data.list.find(x => x.id === userId || x.userId === userId));
      if (u) this.editUser(u.id);
    } else this.toast(res.msg || '操作失败');
  },

  // 从编辑弹窗中审核拒绝
  async rejectUserFromEdit(userId) {
    const reason = prompt('请填写拒绝原因：');
    if (!reason) return;
    const res = await this.api('/api/admin/user/reject', { method: 'POST', body: { userId, reason } });
    if (res.code === 0) {
      this.toast('已拒绝');
      // 刷新编辑弹窗
      const u = await this.api('/api/admin/users').then(r => r.data.list.find(x => x.id === userId || x.userId === userId));
      if (u) this.editUser(u.id);
    } else this.toast(res.msg || '操作失败');
  },

  async exportUsers() {
    const ids = this._getSelectedIds();
    if (ids.length === 0) {
      // 全部导出
      if (!confirm('当前未选择任何用户，将导出全部会员，确认？')) return;
    } else {
      if (!confirm(`确认导出已选中的 ${ids.length} 位用户？`)) return;
    }
    this.toast('正在生成 Excel...');
    const res = await fetch('/api/admin/users/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token },
      body: JSON.stringify({ ids })
    });
    if (!res.ok) { this.toast('导出失败：HTTP ' + res.status); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `会员列表_${new Date().toLocaleDateString('zh-CN').replace(/\//g,'-')}.xlsx`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    this.toast('已下载，共 ' + ids.length + ' 位用户');
  },
  searchUsers() {
    this._userPage = 1;
    this.loadUsers(
      document.getElementById('userKw').value,
      document.getElementById('userGender').value,
      document.getElementById('userVip').value,
      document.getElementById('userAuditStatus').value
    );
  },
  async editUser(id) {
    // 获取所有用户（pageSize 设大，确保能找到目标用户）
    const res = await this.api('/api/admin/users?pageSize=99999');
    const u = (res.data && res.data.list) ? res.data.list.find(x => x.id === id) : null;
    if (!u) return this.toast('用户不存在');
    this.editingUser = u;
    document.getElementById('userEditForm').innerHTML = `
      <div class="form-row">
        <div class="form-group" style="flex:0 0 120px;">
          <label>头像（点击上传）</label>
          <img id="e_avatar_preview" src="${u.avatar || ''}" style="width:100px;height:100px;border-radius:10px;object-fit:cover;cursor:pointer;background:#eee;border:1px dashed var(--border);">
          <input id="e_avatar_file" type="file" accept="image/*" style="display:none">
          <input id="e_avatar" type="hidden" value="${u.avatar || ''}">
          <small style="color:var(--text-3);">点击图片上传新头像</small>
        </div>
        <div class="form-group" style="flex:1;">
          <label>昵称</label><input id="e_nickname" value="${u.nickname || ''}">
        </div>
        <div class="form-group"><label>注册邮箱</label><input id="e_phone" value="${u.email || ''}"></div>
      </div>
      <div class="form-row">
        <div class="form-group password-group" style="flex:1;">
          <label>登录密码（点击眼睛切换可见）</label>
          <input id="e_password" type="password" value="${u.password || ''}" autocomplete="new-password">
          <span class="pw-toggle" id="e_pw_toggle" onclick="Admin.toggleUserPassword()" title="显示/隐藏密码">👁</span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>性别</label><select id="e_gender"><option ${u.gender==='男'?'selected':''}>男</option><option ${u.gender==='女'?'selected':''}>女</option></select></div>
        <div class="form-group"><label>年龄</label><input id="e_age" type="number" value="${u.age || u.form?.age || ''}"></div>
        <div class="form-group"><label>城市</label><input id="e_city" value="${u.city || u.form?.currentCity || ''}"></div>
        <div class="form-group"><label>身高(cm)</label><input id="e_height" type="number" value="${u.height || u.form?.height || ''}"></div>
        <div class="form-group"><label>体重(kg)</label><input id="e_weight" type="number" value="${u.weight || u.form?.weight || ''}"></div>
        <div class="form-group"><label>学历</label><input id="e_education" value="${u.education || u.form?.education || ''}"></div>
        <div class="form-group"><label>职业</label><input id="e_job" value="${u.job || u.form?.job || ''}"></div>
        <div class="form-group"><label>婚况</label><input id="e_marriage" value="${u.marriage || u.form?.maritalStatus || ''}"></div>
        <div class="form-group"><label>年收入</label><input id="e_income" value="${u.income || u.form?.income || ''}" placeholder="例：10-20万"></div>
        <div class="form-group"><label>收入货币</label><select id="e_incomeCurrency"><option value="CNY" ${(u.incomeCurrency||'CNY')==='CNY'?'selected':''}>人民币</option><option value="USD" ${u.incomeCurrency==='USD'?'selected':''}>美元</option></select></div>
        <div class="form-group"><label>微信号</label><input id="e_wechat" value="${u.wechat || u.form?.wechat || ''}" placeholder="例：wx_abc123"></div>
        <div class="form-group"><label>微信号(注册)</label><input id="e_wechatId" value="${u.wechatId || ''}" placeholder="用户注册时填写的微信号"></div>
        <div class="form-group"><label>星座</label><select id="e_zodiac"><option value="" ${!u.zodiac?'selected':''}>请选择</option><option ${u.zodiac==='白羊座'?'selected':''}>白羊座</option><option ${u.zodiac==='金牛座'?'selected':''}>金牛座</option><option ${u.zodiac==='双子座'?'selected':''}>双子座</option><option ${u.zodiac==='巨蟹座'?'selected':''}>巨蟹座</option><option ${u.zodiac==='狮子座'?'selected':''}>狮子座</option><option ${u.zodiac==='处女座'?'selected':''}>处女座</option><option ${u.zodiac==='天秤座'?'selected':''}>天秤座</option><option ${u.zodiac==='天蝎座'?'selected':''}>天蝎座</option><option ${u.zodiac==='射手座'?'selected':''}>射手座</option><option ${u.zodiac==='摩羯座'?'selected':''}>摩羯座</option><option ${u.zodiac==='水瓶座'?'selected':''}>水瓶座</option><option ${u.zodiac==='双鱼座'?'selected':''}>双鱼座</option></select></div>
        <div class="form-group"><label>出生日期</label><input id="e_birthday" type="date" value="${u.birthday || ''}"></div>
        <div class="form-group"><label>血型</label><select id="e_bloodType"><option value="" ${!u.bloodType?'selected':''}>请选择</option><option ${u.bloodType==='A型'?'selected':''}>A型</option><option ${u.bloodType==='B型'?'selected':''}>B型</option><option ${u.bloodType==='AB型'?'selected':''}>AB型</option><option ${u.bloodType==='O型'?'selected':''}>O型</option><option ${u.bloodType==='其他'?'selected':''}>其他</option></select></div>
        <div class="form-group"><label>体重(kg)</label><input id="e_weight" type="number" value="${u.weight || u.form?.weight || ''}"></div>
        ${u.gender === '男' ? `
        <div class="form-group"><label>是否有房产</label><select id="e_hasHouse"><option value="" ${!u.hasHouse?'selected':''}>请选择</option><option ${u.hasHouse==='有(无贷款)'?'selected':''}>有(无贷款)</option><option ${u.hasHouse==='有(有贷款)'?'selected':''}>有(有贷款)</option><option ${u.hasHouse==='无'?'selected':''}>无</option><option ${u.hasHouse==='与父母同住'?'selected':''}>与父母同住</option></select></div>
        <div class="form-group"><label>是否有车子</label><select id="e_hasCar"><option value="" ${!u.hasCar?'selected':''}>请选择</option><option ${u.hasCar==='有'?'selected':''}>有</option><option ${u.hasCar==='无'?'selected':''}>无</option></select></div>
        ` : ''}
      </div>
      <div class="form-group">
        <label>相册照片（3 张，可拖入或点击上传）</label>
        <div id="e_photos_grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-width: 360px;">
          ${[0,1,2].map(i => {
            const p = (u.photos && u.photos[i]) || '';
            return `<div class="photo-slot" data-i="${i}" style="position:relative; aspect-ratio:1; background:#f0f0f0; border:1px dashed var(--border); border-radius: 8px; overflow: hidden; cursor:pointer;">
              <input type="hidden" id="e_photo_${i}" value="${p}">
              <input type="file" accept="image/*" data-i="${i}" style="display:none;" onchange="Admin._uploadPhotoSlot(this)">
              ${p ? `<img src="${p}" style="width:100%; height:100%; object-fit:cover;">` : '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-3); font-size:24px;">+</div>'}
              ${p ? '<div style="position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(0,0,0,0.5); color:#fff; border-radius:50%; text-align:center; line-height:18px; font-size:12px; cursor:pointer;" onclick="event.stopPropagation(); Admin._clearPhotoSlot(' + i + ')">×</div>' : ''}
            </div>`;
          }).join('')}
        </div>
        <small style="color:var(--text-3);">第 1 张为主相册展示图，建议全部上传</small>
      </div>
      <div class="form-group"><label>个人介绍</label><textarea id="e_bio" style="min-height:60px;">${(u.bio || '').replace(/</g,'&lt;')}</textarea></div>
      <div class="form-row" style="margin-top:12px;">
        <div class="form-group">
          <label>会员等级 (1-9)</label>
          <select id="e_level">
            ${[1,2,3,4,5,6,7,8,9].map(l => `<option value="${l}" ${(u.level||1)===l?'selected':''}>LV${l} ${l>=4?'· 至尊会员':l>=3?'· 高级VIP':l>=2?'· 普通VIP':'· 基础会员'}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>VIP标识</label>
          <div style="padding:8px 0;">
            <span class="switch ${u.vip ? 'on' : ''}" id="e_vip" onclick="this.classList.toggle('on'); document.getElementById('e_vip_text').textContent = this.classList.contains('on')?'已开通':'未开通';"></span>
            <span style="margin-left:8px; color:var(--text-2); font-size:12px;" id="e_vip_text">${u.vip ? '已开通' : '未开通'}</span>
          </div>
        </div>
        <div class="form-group">
          <label>实名认证</label>
          <div style="padding:8px 0;">
            <span class="switch ${u.verified ? 'on' : ''}" id="e_verified" onclick="this.classList.toggle('on')"></span>
            <span style="margin-left:8px; color:var(--text-2); font-size:12px;">${u.verified ? '已认证' : '未认证'}</span>
          </div>
        </div>
        <div class="form-group">
          <label>会员ID</label>
          <input value="${u.userId || u.id}" disabled style="font-weight:bold; color:var(--primary);">
        </div>
        <div class="form-group">
          <label>审核状态</label>
          <span id="e_audit_status" style="font-size:13px;">${u.auditStatus === 'approved' ? '✅ 已通过' : u.auditStatus === 'rejected' ? '❌ 已拒绝（原因：' + (u.auditReason||'无') + '）' : '⏳ 待审核'}</span>
        </div>
        <div class="form-group">
          <label>注册时间</label>
          <input value="${u.createdAt || '-'}" disabled>
        </div>
      </div>
      <div style="margin-top:16px; border-top:1px solid var(--border); padding-top:16px;">
        <h4 style="margin:0 0 12px;">🔗 关系图谱</h4>
        <div id="relationsGraph" style="display:flex; gap:16px; flex-wrap:wrap;">
          <div style="color:var(--text-3); font-size:13px;">加载中...</div>
        </div>
      </div>
      <div style="display:flex; gap:12px; margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
        ${u.auditStatus === 'pending' || u.auditStatus === 'rejected' ? `<button class="btn btn-primary" onclick="Admin.approveUserFromEdit('${u.id}')">✅ 审核通过</button>` : ''}
        ${u.auditStatus === 'pending' || u.auditStatus === 'approved' ? `<button class="btn" style="background:#ff4d4f;color:#fff;" onclick="Admin.rejectUserFromEdit('${u.id}')">❌ 审核拒绝</button>` : ''}
      </div>
    `;
    document.getElementById('userEditModal').style.display = 'flex';
    // 加载关系图谱
    this._loadRelations(u.id);
    // 头像上传
    const fileInput = document.getElementById('e_avatar_file');
    document.getElementById('e_avatar_preview').onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const res = await Admin.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'avatars' } });
        if (res.code === 0) {
          document.getElementById('e_avatar_preview').src = res.data.url;
          document.getElementById('e_avatar').value = res.data.url;
          Admin.toast('头像已上传');
        } else Admin.toast(res.msg);
      };
      reader.readAsDataURL(f);
    };
    // 3 张照片 slot 点击触发
    document.querySelectorAll('#e_photos_grid .photo-slot').forEach(slot => {
      slot.onclick = () => slot.querySelector('input[type=file]').click();
    });
  },
  _clearPhotoSlot(i) {
    const inp = document.getElementById('e_photo_' + i);
    if (inp) inp.value = '';
    const slot = document.querySelector(`#e_photos_grid .photo-slot[data-i="${i}"]`);
    if (!slot) return;
    slot.innerHTML = `<input type="hidden" id="e_photo_${i}" value="">
      <input type="file" accept="image/*" data-i="${i}" style="display:none;" onchange="Admin._uploadPhotoSlot(this)">
      <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-3); font-size:24px;">+</div>`;
    slot.onclick = () => slot.querySelector('input[type=file]').click();
  },
  async _uploadPhotoSlot(input) {
    const i = input.dataset.i;
    const f = input.files[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { Admin.toast('图片不能超过 3MB'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await Admin.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
      if (res.code === 0) {
        const url = res.data.url;
        const hidden = document.getElementById('e_photo_' + i);
        if (hidden) hidden.value = url;
        const slot = document.querySelector(`#e_photos_grid .photo-slot[data-i="${i}"]`);
        if (slot) {
          slot.innerHTML = `<input type="hidden" id="e_photo_${i}" value="${url}">
            <input type="file" accept="image/*" data-i="${i}" style="display:none;" onchange="Admin._uploadPhotoSlot(this)">
            <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
            <div style="position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(0,0,0,0.5); color:#fff; border-radius:50%; text-align:center; line-height:18px; font-size:12px; cursor:pointer;" onclick="event.stopPropagation(); Admin._clearPhotoSlot(${i})">×</div>`;
          slot.onclick = () => slot.querySelector('input[type=file]').click();
        }
        Admin.toast(`第 ${Number(i)+1} 张已上传`);
      } else Admin.toast(res.msg);
    };
    reader.readAsDataURL(f);
  },
  async saveUser() {
    if (!this.editingUser) return;
    const photos = [];
    for (let i = 0; i < 3; i++) {
      const v = document.getElementById('e_photo_' + i);
      if (v && v.value) photos.push(v.value);
    }
    const patch = {
      userId: this.editingUser.id,
      avatar: document.getElementById('e_avatar').value,
      nickname: document.getElementById('e_nickname').value,
      phone: document.getElementById('e_phone').value,
      password: document.getElementById('e_password').value,
      gender: document.getElementById('e_gender').value,
      age: parseInt(document.getElementById('e_age').value) || 0,
      city: document.getElementById('e_city').value,
      height: parseInt(document.getElementById('e_height').value) || 0,
      weight: parseFloat(document.getElementById('e_weight').value) || 0,
      education: document.getElementById('e_education').value,
      job: document.getElementById('e_job').value,
      income: document.getElementById('e_income').value,
      incomeCurrency: document.getElementById('e_incomeCurrency').value,
      marriage: document.getElementById('e_marriage').value,
      wechat: document.getElementById('e_wechat').value,
      wechatId: document.getElementById('e_wechatId')?.value || '',
      zodiac: document.getElementById('e_zodiac')?.value || '',
      birthday: document.getElementById('e_birthday')?.value || '',
      bloodType: document.getElementById('e_bloodType')?.value || '',
      hasHouse: document.getElementById('e_hasHouse')?.value || '',
      hasCar: document.getElementById('e_hasCar')?.value || '',
      photos: photos,
      bio: document.getElementById('e_bio').value,
      level: parseInt(document.getElementById('e_level').value),
      vip: document.getElementById('e_vip').classList.contains('on'),
      verified: document.getElementById('e_verified').classList.contains('on')
    };
    const res = await this.api('/api/admin/user/update', { method: 'POST', body: patch });
    if (res.code === 0) {
      this.toast('保存成功');
      this.closeEditUser();
      this.loadUsers();
    } else { this.toast(res.msg); }
  },
  closeEditUser() {
    document.getElementById('userEditModal').style.display = 'none';
    this.editingUser = null;
    const pb = document.getElementById('a_preview_btn'); if (pb) pb.remove();
    const main = document.querySelector('#userEditModal .primary-btn');
    if (main) { main.style.display = ''; main.textContent = '保存'; }
  },
  showRelations(userId) {
    const modal = document.getElementById('relationsModal');
    const content = document.getElementById('relationsContent');
    if (!modal || !content) return;
    modal.style.display = 'flex';
    content.innerHTML = '<div class="loading">加载中...</div>';
    // 加载用户昵称
    this.api('/api/admin/user/' + userId).then(res => {
      const name = (res.code === 0 && res.data && res.data.user) ? res.data.user.nickname : userId;
      const titleEl = document.getElementById('relationsTitle');
      if (titleEl) titleEl.textContent = name + ' 的关系';
    });
    this._loadRelations(userId, content);
  },
  closeRelations() {
    document.getElementById('relationsModal').style.display = 'none';
  },
  async _loadRelations(userId, container) {
    container = container || document.getElementById('relationsGraph');
    if (!container) return;
    try {
      const res = await this.api('/api/admin/user/relations?userId=' + userId);
      if (res.code !== 0 || !res.data) {
        container.innerHTML = '<div style="color:var(--text-3); font-size:13px; padding:16px; text-align:center;">' + (res.msg || '加载失败') + '</div>';
        return;
      }
      const { iLike, likesMe, mutual } = res.data;

      // 如果是独立关系弹窗，使用筛选模式渲染
      if (container.id === 'relationsContent') {
        this._renderRelationWithFilter(container, { iLike, likesMe, mutual });
        return;
      }

      // 编辑弹窗内的兼容模式
      const renderList = (list, title, color) => {
        if (!list || !list.length) return `<div style="flex:1; min-width:200px;"><div style="font-weight:600; margin-bottom:8px; color:${color};">${title} (${list.length})</div><div style="color:var(--text-3); font-size:13px;">暂无</div></div>`;
        return `<div style="flex:1; min-width:200px;">
          <div style="font-weight:600; margin-bottom:8px; color:${color};">${title} (${list.length})</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${list.map(u => `<div style="display:flex; align-items:center; gap:6px; background:#f5f5f5; padding:4px 8px; border-radius:6px; cursor:pointer;" onclick="Admin.editUser('${u.id}')" title="点击查看该用户">
              <img src="${u.avatar || ''}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;" onerror="this.src='https://via.placeholder.com/24/ff5a6e/ffffff?text=?'">
              <span style="font-size:12px;">${u.nickname || '未命名'} (${u.userId || u.id})</span>
            </div>`).join('')}
          </div>
        </div>`;
      };
      container.innerHTML = `
        ${renderList(iLike, '❤ 该用户喜欢的', '#ff5a6e')}
        ${renderList(likesMe, '💌 喜欢该用户的', '#1890ff')}
        ${mutual && mutual.length ? `<div style="flex:1; min-width:100%; border-top:1px dashed var(--border); padding-top:8px; margin-top:4px;"><div style="font-weight:600; margin-bottom:8px; color:#52c41a;">💕 互相喜欢 (${mutual.length})</div><div style="display:flex; flex-wrap:wrap; gap:8px;">${mutual.map(u => `<div style="display:flex; align-items:center; gap:6px; background:#f6ffed; padding:4px 8px; border-radius:6px; border:1px solid #b7eb8f; cursor:pointer;" onclick="Admin.editUser('${u.id}')" title="点击查看该用户"><img src="${u.avatar || ''}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;" onerror="this.src='https://via.placeholder.com/24/ff5a6e/ffffff?text=?'"><span style="font-size:12px;">${u.nickname || '未命名'} (${u.userId || u.id})</span></div>`).join('')}</div></div>` : ''}
      `;
    } catch(e) {
      container.innerHTML = '<div style="color:var(--text-3); font-size:13px; padding:16px; text-align:center;">加载失败：' + e.message + '</div>';
    }
  },
  _renderRelationWithFilter(container, data) {
    const { iLike = [], likesMe = [], mutual = [] } = data;
    window.__relationData = data;

    const renderUserRow = (u, isMutual) => `
      <tr class="${isMutual ? 'style=\"background:#f6ffed;\"' : ''}">
        <td><img src="${u.avatar || ''}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" onerror="this.src='https://via.placeholder.com/36/ff5a6e/ffffff?text=?'"></td>
        <td><b>${u.nickname || '未命名'}</b><br><small style="color:var(--text-3);">${u.userId || u.id}</small></td>
        <td>${u.gender || '-'}</td>
        <td>${u.age || '-'}</td>
        <td>${isMutual ? '<span style="color:#52c41a;font-weight:600;">💕 互相喜欢</span>' : '-'}</td>
        <td><button class="btn btn-primary" onclick="Admin.closeRelations(); Admin.editUser('${u.id}');">查看详情</button></td>
      </tr>`;

    const doRender = (filter) => {
      let rows = '';
      let count = 0;
      if (filter === 'iLike') {
        rows = iLike.map(u => renderUserRow(u)).join(''); count = iLike.length;
      } else if (filter === 'likesMe') {
        rows = likesMe.map(u => renderUserRow(u)).join(''); count = likesMe.length;
      } else {
        // 全部：先显示互相喜欢的，再显示单向的
        const allMap = new Map();
        iLike.forEach(u => allMap.set(String(u.id), { ...u, type: 'iLike' }));
        likesMe.forEach(u => {
          const key = String(u.id);
          if (allMap.has(key)) allMap.set(key, { ...allMap.get(key), type: 'mutual' });
          else allMap.set(key, { ...u, type: 'likesMe' });
        });
        const sorted = [...allMap.values()].sort((a, b) => (a.type === 'mutual' ? -1 : b.type === 'mutual' ? 1 : 0));
        rows = sorted.map(u => renderUserRow(u, u.type === 'mutual')).join('');
        count = sorted.length;
      }
      document.getElementById('relTableBody').innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:20px;">暂无数据</td></tr>';
      document.getElementById('relCount').textContent = `共 ${count} 人`;
    };

    container.innerHTML = `
      <style>
        .rel-filter-bar { display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;}
        .rel-filter-chip { padding:6px 14px; border-radius:20px; font-size:13px; cursor:pointer; background:#f0f0f0; color:var(--text-2); border:none; transition:all .2s; }
        .rel-filter-chip.active { background:var(--primary); color:#fff; }
        .rel-table { width:100%; border-collapse:collapse; font-size:13px; }
        .rel-table th { background:#fafafa; padding:10px 8px; text-align:left; font-weight:600; border-bottom:2px solid var(--border); color:var(--text-2); white-space:nowrap; }
        .rel-table td { padding:10px 8px; border-bottom:1px solid var(--border); vertical-align:middle; }
        .rel-table tr:hover td { background:#fafafa; }
        .rel-count-hint { font-size:12px; color:var(--text-3); margin-bottom:8px; }
      </style>
      <div class="rel-filter-bar">
        <button class="rel-filter-chip active" data-rel-f="all" onclick="document.querySelectorAll('.rel-filter-chip').forEach(c=>c.classList.remove('active')); this.classList.add('active'); window.__doRelFilter('all')">全部</button>
        <button class="rel-filter-chip" data-rel-f="iLike" onclick="document.querySelectorAll('.rel-filter-chip').forEach(c=>c.classList.remove('active')); this.classList.add('active'); window.__doRelFilter('iLike')">❤ TA喜欢的</button>
        <button class="rel-filter-chip" data-rel-f="likesMe" onclick="document.querySelectorAll('.rel-filter-chip').forEach(c=>c.classList.remove('active')); this.classList.add('active'); window.__doRelFilter('likesMe')">💌 喜欢TA的</button>
      </div>
      <div class="rel-count-hint" id="relCount"></div>
      <table class="rel-table">
        <thead><tr><th>头像</th><th>昵称 / ID</th><th>性别</th><th>年龄</th><th>状态</th><th>操作</th></tr></thead>
        <tbody id="relTableBody"><tr><td colspan="6" style="text-align:center;color:var(--text-3);padding:20px;">加载中...</td></tr></tbody>
      </table>
    `;
    window.__doRelFilter = doRender;
    doRender('all');
  },
  async deleteUser(id) {
    if (!confirm('确定删除该会员吗？此操作不可恢复')) return;
    const res = await this.api('/api/admin/user/delete', { method: 'POST', body: { userId: id } });
    if (res.code === 0) { this.toast('删除成功'); this.loadUsers(); }
  },

  async renderArticles() {
    const content = document.getElementById('pageContent');
    const res = await this.api('/api/articles');
    if (res.code !== 0) return;
    content.innerHTML = `<div class="panel">
      <div class="panel-header">
        <h3>资讯广场文章</h3>
        <div>
          <button class="btn" style="background:#fff;color:var(--primary);border:1px solid var(--primary);" onclick="Admin.manageCategories()">⚙ 分类管理</button>
          <button class="btn btn-primary" onclick="Admin.editArticle()">+ 新建文章</button>
        </div>
      </div>
      <div class="panel-body">
        <table>
          <thead><tr><th>封面</th><th>标题</th><th>作者</th><th>分类</th><th>阅读</th><th>点赞</th><th>操作</th></tr></thead>
          <tbody>${res.data.list.map(a => `
            <tr>
              <td><img src="${a.cover}" style="width:60px;height:40px;object-fit:cover;border-radius:4px;"></td>
              <td>${a.title}</td>
              <td>${a.author}</td>
              <td><span class="tag">${a.category || '-'}</span></td>
              <td>${a.views}</td>
              <td>${a.likes}</td>
              <td>
                <button class="btn btn-primary" onclick="Admin.editArticle('${a.id}')">编辑</button>
                <button class="btn btn-danger" onclick="Admin.deleteArticle('${a.id}')">删除</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    </div>`;
  },
  async manageCategories() {
    const res = await this.api('/api/article-categories');
    if (res.code !== 0) return;
    const cats = res.data.list || res.data || [];
    const html = `<div id="catManager" style="max-width:500px;">
      <div style="margin-bottom:14px;color:#666;font-size:13px;">对文章分类进行增删改，删除前请确保该分类下没有文章。</div>
      <div id="catList">${cats.map(c => `
        <div class="cat-row" data-id="${c.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid #eee;border-radius:6px;margin-bottom:6px;background:#fafafa;">
          <input class="cat-name" value="${c.name}" style="flex:1;padding:6px 8px;border:1px solid #ddd;border-radius:4px;">
          <input class="cat-order" type="number" value="${c.order||0}" style="width:60px;padding:6px 8px;border:1px solid #ddd;border-radius:4px;" title="排序">
          <button class="btn btn-primary" onclick="Admin._saveCategory('${c.id}')">保存</button>
          <button class="btn btn-danger" onclick="Admin._deleteCategory('${c.id}')">删除</button>
        </div>
      `).join('') || '<div class="empty"><div class="icon">📂</div>暂无分类</div>'}</div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid #eee;">
        <div style="font-size:13px;color:#666;margin-bottom:6px;">新增分类</div>
        <div style="display:flex;gap:8px;">
          <input id="new_cat_name" placeholder="分类名称，如：相亲攻略" style="flex:1;padding:6px 8px;border:1px solid #ddd;border-radius:4px;">
          <input id="new_cat_order" type="number" placeholder="排序" value="99" style="width:60px;padding:6px 8px;border:1px solid #ddd;border-radius:4px;">
          <button class="btn btn-primary" onclick="Admin._addCategory()">+ 新增</button>
        </div>
      </div>
    </div>`;
    document.getElementById('userEditForm').innerHTML = html;
    document.querySelector('#userEditModal .modal-title').textContent = '分类管理';
    // 隐藏底部保存按钮（分类管理不需要）
    const oldBtn = document.querySelector('#userEditModal .primary-btn');
    if (oldBtn) oldBtn.style.display = 'none';
    document.getElementById('userEditModal').style.display = 'flex';
  },
  async _saveCategory(id) {
    const row = document.querySelector(`.cat-row[data-id="${id}"]`);
    if (!row) return;
    const name = row.querySelector('.cat-name').value.trim();
    const order = parseInt(row.querySelector('.cat-order').value) || 0;
    if (!name) return this.toast('名称不能为空');
    const res = await this.api('/api/admin/article-category/save', { method: 'POST', body: { id, name, order } });
    if (res.code === 0) { this.toast('保存成功'); this.manageCategories(); }
    else this.toast(res.msg || '保存失败');
  },
  async _deleteCategory(id) {
    if (!confirm('确定删除该分类？')) return;
    const res = await this.api('/api/admin/article-category/delete', { method: 'POST', body: { id } });
    if (res.code === 0) { this.toast('删除成功'); this.manageCategories(); }
    else this.toast(res.msg || '删除失败');
  },
  async _addCategory() {
    const name = document.getElementById('new_cat_name').value.trim();
    const order = parseInt(document.getElementById('new_cat_order').value) || 99;
    if (!name) return this.toast('请填写分类名');
    const res = await this.api('/api/admin/article-category/save', { method: 'POST', body: { name, order } });
    if (res.code === 0) {
      this.toast('新增成功');
      document.getElementById('new_cat_name').value = '';
      this.manageCategories();
    } else this.toast(res.msg || '新增失败');
  },
  async editArticle(id) {
    let a = { title: '', author: '官方', category: '脱单指南', cover: 'https://picsum.photos/400/250', content: '', views: 0, likes: 0, categoryId: '' };
    if (id) {
      const res = await this.api('/api/articles/' + id);
      if (res.code === 0) a = res.data;
    }
    // 拉取分类列表
    const catRes = await this.api('/api/article-categories');
    const cats = catRes.code === 0 ? (catRes.data.list || catRes.data || []) : [];
    const catOptions = cats.map(c => `<option value="${c.id}" data-name="${c.name}" ${a.categoryId===c.id||a.category===c.name?'selected':''}>${c.name}</option>`).join('');

    const html = `<div id="articleEditForm">
      <div class="form-group"><label>标题</label><input id="a_title" value="${(a.title||'').replace(/"/g,'&quot;')}"></div>
      <div class="form-row">
        <div class="form-group"><label>作者</label><input id="a_author" value="${(a.author||'').replace(/"/g,'&quot;')}"></div>
        <div class="form-group"><label>分类</label>
          <select id="a_category">${catOptions}</select>
        </div>
      </div>
      <div class="form-group">
        <label>封面图（点击上传）</label>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <img id="a_cover_preview" src="${a.cover || ''}" style="width:120px;height:80px;object-fit:cover;border-radius:6px;cursor:pointer;background:#eee;border:1px dashed var(--border);" onerror="this.style.background='#eee';this.src='';">
          <input id="a_cover_file" type="file" accept="image/*" style="display:none">
          <input id="a_cover" type="hidden" value="${a.cover || ''}">
          <div style="display:flex;flex-direction:column;gap:6px;">
            <button type="button" class="btn" style="font-size:12px;padding:4px 10px;" onclick="document.getElementById('a_cover_file').click()">选择图片</button>
            <button type="button" class="btn" style="font-size:12px;padding:4px 10px;" onclick="Admin._clearArticleCover()">清除</button>
          </div>
          <small style="color:var(--text-3);">建议尺寸 400×250，PNG/JPG，&lt;2MB</small>
        </div>
      </div>
      <div class="form-group ae-editor-wrap">
        <label>正文</label>
        <div class="rt-toolbar">
          <button type="button" class="rt-btn" data-cmd="bold" title="加粗"><b>B</b></button>
          <button type="button" class="rt-btn" data-cmd="italic" title="斜体"><i>I</i></button>
          <button type="button" class="rt-btn" data-cmd="underline" title="下划线"><u>U</u></button>
          <span class="rt-sep"></span>
          <button type="button" class="rt-btn" data-cmd="justifyLeft" title="左对齐">左</button>
          <button type="button" class="rt-btn" data-cmd="justifyCenter" title="居中">中</button>
          <button type="button" class="rt-btn" data-cmd="justifyRight" title="右对齐">右</button>
          <span class="rt-sep"></span>
          <select class="rt-sel" data-cmd="formatBlock">
            <option value="p">正文</option>
            <option value="h2">标题</option>
            <option value="h3">小标题</option>
            <option value="blockquote">引用</option>
          </select>
          <span class="rt-sep"></span>
          <button type="button" class="rt-btn" data-cmd="insertUnorderedList" title="无序列表">• 列表</button>
          <button type="button" class="rt-btn" data-cmd="insertOrderedList" title="有序列表">1. 列表</button>
          <span class="rt-sep"></span>
          <input type="color" id="rt_color" value="#222222" title="字体颜色" style="width:28px;height:28px;border:1px solid #ddd;border-radius:4px;cursor:pointer;padding:1px;vertical-align:middle;">
          <span class="rt-sep"></span>
          <button type="button" class="rt-btn" data-cmd="createLink" title="插入链接">🔗 链接</button>
          <button type="button" class="rt-btn" data-cmd="insertImage" title="插入图片">🖼️ 图片</button>
          <button type="button" class="rt-btn" data-cmd="insertVideo" title="插入视频">🎬 视频</button>
          <button type="button" class="rt-btn" data-cmd="insertTable" title="插入表格">📊 表格</button>
          <span class="rt-sep"></span>
          <button type="button" class="rt-btn" data-cmd="removeFormat" title="清除格式">✕ 清除</button>
        </div>
        <div id="a_content" class="rt-editor" contenteditable="true" placeholder="开始编辑文章正文...">${a.content || ''}</div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>阅读量</label><input id="a_views" type="number" value="${a.views || 0}"></div>
        <div class="form-group"><label>点赞数</label><input id="a_likes" type="number" value="${a.likes || 0}"></div>
      </div>
    </div>
    <style>
      .ae-editor-wrap { position: sticky; top: 0; z-index: 100; background: var(--bg, #f5f6fa); padding: 10px 0; border-radius: 8px; }
      .ae-editor-wrap label { display: block; font-weight: 600; margin-bottom: 6px; }
      .rt-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 6px; border: 1px solid #ddd; border-bottom: none; border-radius: 8px 8px 0 0; background: #fafafa; position: sticky; top: 40px; z-index: 101; }
      .rt-btn { padding: 4px 10px; border: 1px solid transparent; border-radius: 4px; background: transparent; cursor: pointer; font-size: 13px; }
      .rt-btn:hover { background: #fff; border-color: #ddd; }
      .rt-sep { width: 1px; height: 18px; background: #ddd; margin: 0 4px; }
      .rt-sel { padding: 3px 6px; border: 1px solid #ddd; border-radius: 4px; background: #fff; font-size: 12px; }
      .rt-editor { min-height: 360px; max-height: 60vh; overflow-y: auto; padding: 12px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; font-size: 14px; line-height: 1.7; outline: none; background: #fff; }
      .rt-editor:focus { border-color: var(--primary, #ff3860); }
      .rt-editor h2 { font-size: 18px; margin: 12px 0 6px; }
      .rt-editor h3 { font-size: 16px; margin: 10px 0 4px; }
      .rt-editor blockquote { border-left: 3px solid #ddd; padding-left: 10px; color: #666; margin: 8px 0; }
      .rt-editor p { margin: 6px 0; }
      .rt-editor:empty::before { content: attr(placeholder); color: #bbb; }
    </style>`;
    document.getElementById('userEditForm').innerHTML = html;
    // 改造底部按钮区：保存 + 预览
    const btnArea = document.querySelector('#userEditModal .modal-footer') || document.querySelector('#userEditModal .primary-btn')?.parentNode;
    const oldBtn = document.querySelector('#userEditModal .primary-btn');
    if (oldBtn) {
      oldBtn.style.display = '';  // 恢复按钮显示（manageCategories 可能隐藏了它）
      oldBtn.textContent = '保存';
      oldBtn.onclick = () => this._saveArticle();
    }
    // 在保存按钮旁插入预览按钮（用兄弟节点实现，modal-footer 不存在则创建）
    let previewBtn = document.getElementById('a_preview_btn');
    if (previewBtn) previewBtn.remove();
    previewBtn = document.createElement('button');
    previewBtn.id = 'a_preview_btn';
    previewBtn.className = 'btn';
    previewBtn.textContent = '预览';
    previewBtn.style.cssText = 'margin-left:8px;background:#fff;color:var(--primary,#ff3860);border:1px solid var(--primary,#ff3860);border-radius:22px;padding:11px 24px;font-size:14px;cursor:pointer;';
    previewBtn.onclick = () => this._previewArticle();
    if (oldBtn && oldBtn.parentNode) oldBtn.parentNode.insertBefore(previewBtn, oldBtn.nextSibling);

    // 绑定封面图上传
    const coverFileInput = document.getElementById('a_cover_file');
    const coverPreview = document.getElementById('a_cover_preview');
    if (coverPreview) coverPreview.onclick = () => coverFileInput && coverFileInput.click();
    if (coverFileInput) {
      coverFileInput.onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) { Admin.toast('封面图不能超过 2MB'); return; }
        const reader = new FileReader();
        reader.onload = async () => {
          const res = await Admin.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
          if (res.code === 0) {
            document.getElementById('a_cover_preview').src = res.data.url;
            document.getElementById('a_cover').value = res.data.url;
            Admin.toast('封面图已上传');
          } else Admin.toast(res.msg || '上传失败');
        };
        reader.readAsDataURL(f);
      };
    }

    // 绑定富文本工具栏
    document.querySelectorAll('#articleEditForm .rt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const cmd = btn.dataset.cmd;
        const editor = document.getElementById('a_content');
        editor.focus();
        // 文本对齐
        if (['justifyLeft','justifyCenter','justifyRight'].includes(cmd)) {
          document.execCommand(cmd, false, null);
          return;
        }
        // 插入图片：弹窗选择 URL 或上传
        if (cmd === 'insertImage') {
          Admin._rtInsertImage();
          return;
        }
        // 插入视频
        if (cmd === 'insertVideo') {
          const url = prompt('请输入视频 URL（支持 mp4 直链或优酷/腾讯视频分享地址）', 'https://');
          if (!url) return;
          const videoHtml = url.includes('<iframe')
            ? url
            : `<video controls style="max-width:100%;" src="${url}">您的浏览器不支持视频播放</video>`;
          document.execCommand('insertHTML', false, videoHtml);
          return;
        }
        // 插入表格
        if (cmd === 'insertTable') {
          const rows = parseInt(prompt('行数', '3')) || 3;
          const cols = parseInt(prompt('列数', '3')) || 3;
          let table = '<table style="border-collapse:collapse;width:100%;margin:10px 0;"><tbody>';
          for (let r = 0; r < rows; r++) {
            table += '<tr>';
            for (let c = 0; c < cols; c++) {
              if (r === 0) {
                table += `<th style="border:1px solid #ddd;padding:6px 10px;background:#f5f5f5;font-weight:600;">表头${c+1}</th>`;
              } else {
                table += `<td style="border:1px solid #ddd;padding:6px 10px;min-width:60px;">内容${r}-${c+1}</td>`;
              }
            }
            table += '</tr>';
          }
          table += '</tbody></table>';
          document.execCommand('insertHTML', false, table);
          return;
        }
        // 插入链接
        if (cmd === 'createLink') {
          const url = prompt('请输入链接URL', 'https://');
          if (url) document.execCommand('createLink', false, url);
          return;
        }
        // 其他标准命令
        document.execCommand(cmd, false, null);
      });
    });
    // 字体颜色
    const colorInput = document.getElementById('rt_color');
    if (colorInput) {
      colorInput.addEventListener('input', () => {
        const editor = document.getElementById('a_content');
        editor.focus();
        document.execCommand('foreColor', false, colorInput.value);
      });
    }
    document.querySelectorAll('#articleEditForm .rt-sel').forEach(sel => {
      sel.addEventListener('change', () => {
        const editor = document.getElementById('a_content');
        editor.focus();
        document.execCommand(sel.dataset.cmd, false, sel.value);
      });
    });

    document.querySelector('#userEditModal .modal-title').textContent = id ? '编辑文章' : '新建文章';
    const mc = document.querySelector('#userEditModal .modal-card');
    if (mc) mc.style.maxWidth = '1520px';
    document.getElementById('userEditModal').style.display = 'flex';
    this._articleId = id;
  },
  _clearArticleCover() {
    document.getElementById('a_cover').value = '';
    const prev = document.getElementById('a_cover_preview');
    if (prev) prev.src = '';
    const fi = document.getElementById('a_cover_file');
    if (fi) fi.value = '';
  },
  // 编辑器插入图片：支持 URL 或上传
  _rtInsertImage() {
    const useUrl = confirm('点击「确定」粘贴图片URL\n点击「取消」上传本地图片');
    if (useUrl) {
      const url = prompt('请输入图片URL', 'https://');
      if (url) document.execCommand('insertImage', false, url);
      return;
    }
    // 上传本地图片
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) { Admin.toast('图片不能超过 3MB'); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const res = await Admin.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
        if (res.code === 0) {
          document.execCommand('insertImage', false, res.data.url);
          Admin.toast('图片已插入');
        } else Admin.toast(res.msg || '上传失败');
      };
      reader.readAsDataURL(f);
    };
    input.click();
  },
  _collectArticle() {
    const catSel = document.getElementById('a_category');
    const sel = catSel.options[catSel.selectedIndex];
    return {
      id: this._articleId,
      title: document.getElementById('a_title').value,
      author: document.getElementById('a_author').value,
      category: sel ? sel.dataset.name || sel.textContent : '',
      categoryId: catSel.value,
      cover: document.getElementById('a_cover').value,
      content: document.getElementById('a_content').innerHTML,
      views: parseInt(document.getElementById('a_views').value) || 0,
      likes: parseInt(document.getElementById('a_likes').value) || 0
    };
  },
  _previewArticle() {
    const data = this._collectArticle();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${data.title || '预览'}</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;max-width:680px;margin:0 auto;padding:18px;background:#fff;color:#222;}
      h1{font-size:22px;} .meta{color:#888;font-size:12px;margin:6px 0 18px;}
      .cover{width:100%;border-radius:8px;margin-bottom:18px;}
      .content{font-size:15px;line-height:1.85;}
      .content p{margin:8px 0;} .content h2{font-size:18px;margin:14px 0 6px;}
      .content h3{font-size:16px;margin:10px 0 4px;}
      .content blockquote{border-left:3px solid #ddd;padding-left:10px;color:#666;margin:8px 0;}
      .content img{max-width:100%;}
      </style></head><body>
      <h1>${data.title || '（未命名）'}</h1>
      <div class="meta">✍️ ${data.author} · 👁️ ${data.views} · ❤ ${data.likes} · ${data.category || '未分类'}</div>
      ${data.cover ? `<img class="cover" src="${data.cover}">` : ''}
      <div class="content">${data.content || '<p style="color:#bbb;">（空内容）</p>'}</div>
      </body></html>`;
    // 写到 server 提供给预览窗口
    this._previewHtml = html;
    const w = window.open('', '_blank', 'width=420,height=720');
    if (!w) return App.toast('请允许弹出窗口');
    w.document.write(html);
  },
  async _saveArticle() {
    const patch = this._collectArticle();
    const res = await this.api('/api/admin/article/save', { method: 'POST', body: patch });
    if (res.code === 0) { this.toast('保存成功'); this.closeEditUser(); this.renderArticles(); }
  },
  async deleteArticle(id) {
    if (!confirm('确定删除该文章吗？')) return;
    const res = await this.api('/api/admin/article/delete', { method: 'POST', body: { id } });
    if (res.code === 0) { this.toast('删除成功'); this.renderArticles(); }
  },

  async renderActivities() {
    const content = document.getElementById('pageContent');
    const res = await this.api('/api/activities');
    if (res.code !== 0) return;
    const statusColor = s => s === '未开始' ? '#999' : s === '报名中' ? 'var(--green)' : 'var(--text-3)';
    content.innerHTML = `<div class="panel">
      <div class="panel-header"><h3>活动管理</h3><button class="btn btn-primary" onclick="Admin.editActivity()">+ 新建活动</button></div>
      <div class="panel-body">
        <table>
          <thead><tr><th>封面</th><th>标题</th><th>时间</th><th>地点</th><th>价格</th><th>报名区间</th><th>已报/名额</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${res.data.list.map(a => `
            <tr>
              <td><img src="${a.cover}" style="width:60px;height:40px;object-fit:cover;border-radius:4px;"></td>
              <td>${a.title}</td>
              <td>${a.time}</td>
              <td>${a.place}</td>
              <td><b style="color:${a.price===0?'var(--green)':'var(--primary)'};">${a.price===0?'免费':'¥'+a.price}</b></td>
              <td style="font-size:11px;color:#888;">${a.signupStart || '-'} <br>~ ${a.signupEnd || '-'}</td>
              <td>${a.joined}/${a.total}</td>
              <td><span class="tag" style="color:${statusColor(a.status)};border-color:${statusColor(a.status)};">${a.status}</span></td>
              <td>
                <button class="btn btn-primary" onclick="Admin.editActivity('${a.id}')">编辑</button>
                <button class="btn btn-danger" onclick="Admin.deleteActivity('${a.id}')">删除</button>
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    </div>`;
  },
  async editActivity(id) {
    let a = { title: '', time: '2026-12-31 19:00', city: '福州', place: '', price: 0, total: 20, cover: 'https://picsum.photos/600/300', desc: '', status: '报名中', signupStart: '', signupEnd: '' };
    const res = await this.api('/api/activities');
    if (id) a = res.data.list.find(x => x.id === id) || a;
    // datetime-local 需要把 ISO 字符串转成 YYYY-MM-DDTHH:MM (this.toLocal 已在 Admin 顶层)
    const toLocal = this.toLocal.bind(this);
    document.getElementById('userEditForm').innerHTML = `
      <div class="form-group"><label>活动标题</label><input id="act_title" value="${a.title}"></div>
      <div class="form-row">
        <div class="form-group"><label>活动开始时间</label><input id="act_time" value="${a.time}"></div>
        <div class="form-group"><label>城市</label><input id="act_city" value="${a.city}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>地点</label><input id="act_place" value="${a.place}"></div>
        <div class="form-group"><label>价格(0=免费)</label><input id="act_price" type="number" value="${a.price}"></div>
        <div class="form-group"><label>名额</label><input id="act_total" type="number" value="${a.total}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>报名开始时间</label><input id="act_sstart" type="datetime-local" value="${toLocal(a.signupStart)}"></div>
        <div class="form-group"><label>报名截止时间</label><input id="act_send" type="datetime-local" value="${toLocal(a.signupEnd)}"></div>
        <div class="form-group"><label>已报名人数</label><input id="act_joined" type="number" value="${a.joined || 0}"></div>
      </div>
      <div class="form-group"><label>封面URL</label><input id="act_cover" value="${a.cover}"></div>
      <div class="form-group"><label>活动介绍</label><textarea id="act_desc" style="min-height:100px;">${a.desc}</textarea></div>
      <div style="background:#fffbe6;border:1px solid #ffe58f;border-radius:6px;padding:8px 12px;font-size:12px;color:#876800;margin-bottom:12px;">
        💡 状态由「报名时间区间 + 已报名人数 vs 名额」自动计算：未开始 / 报名中 / 报名截止
      </div>
    `;
    document.querySelector('#userEditModal .modal-title').textContent = id ? '编辑活动' : '新建活动';
    this._activityId = id;
    this._saveActivity = async () => {
      const patch = {
        id: this._activityId,
        title: document.getElementById('act_title').value,
        time: document.getElementById('act_time').value,
        city: document.getElementById('act_city').value,
        place: document.getElementById('act_place').value,
        price: parseInt(document.getElementById('act_price').value) || 0,
        total: parseInt(document.getElementById('act_total').value) || 20,
        joined: parseInt(document.getElementById('act_joined').value) || 0,
        signupStart: document.getElementById('act_sstart').value,
        signupEnd: document.getElementById('act_send').value,
        cover: document.getElementById('act_cover').value,
        desc: document.getElementById('act_desc').value
      };
      const res = await this.api('/api/admin/activity/save', { method: 'POST', body: patch });
      if (res.code === 0) { this.toast('保存成功，状态：' + res.data.status); this.closeEditUser(); this.renderActivities(); }
    };
    document.querySelector('#userEditModal .primary-btn').onclick = this._saveActivity;
    document.getElementById('userEditModal').style.display = 'flex';
  },
  async deleteActivity(id) {
    if (!confirm('确定删除该活动吗？')) return;
    const res = await this.api('/api/admin/activity/delete', { method: 'POST', body: { id } });
    if (res.code === 0) { this.toast('删除成功'); this.renderActivities(); }
  },

  async renderMessages() {
    // 简单展示前50条消息
    const res = await this.api('/api/users');
    if (res.code !== 0) return;
    const allUsers = res.data.list;
    const content = document.getElementById('pageContent');
    let html = '<div class="panel"><div class="panel-header"><h3>消息总览</h3></div><div class="panel-body">';
    html += `<p style="color:var(--text-2); margin-bottom: 16px;">共 ${allUsers.length} 个会员。聊天功能在H5端运行（用户登录后可互发消息）。</p>`;
    html += '<table><thead><tr><th>会员</th><th>性别/年龄</th><th>城市</th><th>注册邮箱</th><th>状态</th></tr></thead><tbody>';
    allUsers.slice(0, 20).forEach(u => {
      html += `<tr><td>${u.nickname}</td><td>${u.gender} · ${u.age}岁</td><td>${u.city}</td><td>${u.email||'-'}</td><td>${u.online?'<span class="tag online">在线</span>':'<span class="tag">离线</span>'}</td></tr>`;
    });
    html += '</tbody></table></div></div>';
    content.innerHTML = html;
  },

  // ===== 群发消息 =====
  async renderBroadcast() {
    const content = document.getElementById('pageContent');
    // 拿用户列表、城市清单
    const ur = await this.api('/api/admin/users');
    const users = (ur.code === 0) ? ur.data.list : [];
    const citySet = new Set();
    users.forEach(u => {
      const c = (u.form && u.form.currentCity) || u.city;
      if (c) citySet.add(c);
    });
    const cities = Array.from(citySet).sort();
    const total = users.length;
    const male = users.filter(u => u.gender === '男').length;
    const female = users.filter(u => u.gender === '女').length;
    const ages = users.map(u => u.age || 0).filter(Boolean);
    const ageMin = ages.length ? Math.min(...ages) : 18;
    const ageMax = ages.length ? Math.max(...ages) : 60;

    content.innerHTML = `
      <div class="panel">
        <div class="panel-header"><h3>📣 群发消息</h3><span>当前用户 <b>${total}</b> 人（男 ${male} · 女 ${female}）</span></div>
        <div class="panel-body">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <h4 style="margin-bottom: 12px; color: var(--text-2);">① 撰写消息</h4>
              <div class="form-group"><label>消息标题（可选）</label><input id="bc_title" placeholder="如：本周线下相亲活动"></div>
              <div class="form-group"><label>消息内容（必填）</label><textarea id="bc_content" style="width:100%; min-height: 140px; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px;" placeholder="请输入消息正文..."></textarea></div>
              <div style="display:flex; gap: 8px; margin-top: 12px;">
                <button class="btn btn-primary" style="flex:1;" onclick="Admin.broadcastSend()">📤 立即发送</button>
                <button class="btn" style="background:#fff;color:var(--text-2);border:1px solid var(--border);" onclick="Admin.broadcastClear()">清空</button>
              </div>
            </div>
            <div>
              <h4 style="margin-bottom: 12px; color: var(--text-2);">② 筛选目标用户</h4>
              <div class="form-group"><label>性别</label>
                <select id="bc_gender"><option value="">不限</option><option value="男">仅男</option><option value="女">仅女</option></select>
              </div>
              <div class="form-group"><label>年龄段</label>
                <div style="display:flex; gap: 8px; align-items: center;">
                  <input id="bc_ageMin" type="number" placeholder="最小" min="18" max="80" style="flex:1;" value="${ageMin}">
                  <span>~</span>
                  <input id="bc_ageMax" type="number" placeholder="最大" min="18" max="80" style="flex:1;" value="${ageMax}">
                </div>
              </div>
              <div class="form-group"><label>所在地</label>
                <select id="bc_city"><option value="">不限</option>${cities.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
              </div>
              <div class="form-group"><label>指定用户ID（多个用英文逗号分隔）</label>
                <input id="bc_userIds" placeholder="如：U00001, U00003 或留空走筛选">
              </div>
              <div class="form-group"><label>实时匹配预览</label>
                <div id="bc_preview" style="padding: 10px; background: var(--primary-light); border-radius: 8px; font-size: 13px; color: var(--primary);">点击下方按钮预览</div>
                <button class="btn" style="margin-top: 8px; background:#fff;color:var(--primary);border:1px solid var(--primary);" onclick="Admin.broadcastPreview()">🔍 预览匹配人数</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="panel" style="margin-top: 16px;">
        <div class="panel-header"><h3>📜 群发历史</h3></div>
        <div class="panel-body"><div id="bc_history">加载中...</div></div>
      </div>
    `;
    this._loadBroadcastHistory();
  },
  _broadcastCollect() {
    const filter = {};
    const g = document.getElementById('bc_gender').value; if (g) filter.gender = g;
    const aMin = document.getElementById('bc_ageMin').value; if (aMin) filter.ageMin = Number(aMin);
    const aMax = document.getElementById('bc_ageMax').value; if (aMax) filter.ageMax = Number(aMax);
    const c = document.getElementById('bc_city').value; if (c) filter.city = c;
    const ids = document.getElementById('bc_userIds').value.trim();
    if (ids) filter.userIds = ids.split(/[,,、\s]+/).filter(Boolean);
    return {
      title: document.getElementById('bc_title').value.trim(),
      content: document.getElementById('bc_content').value.trim(),
      filter
    };
  },
  async broadcastPreview() {
    const d = this._broadcastCollect();
    if (!d.content) return this.toast('请先填写消息内容');
    const r = await this.api('/api/admin/message/broadcast', { method: 'POST', body: { title: d.title, content: d.content, filter: d.filter, dryRun: true } });
    if (r.code === 0) document.getElementById('bc_preview').innerHTML = `✅ 当前筛选条件将匹配 <b style="font-size:16px;">${r.data.count}</b> 位用户`;
    else document.getElementById('bc_preview').innerHTML = '❌ ' + r.msg;
  },
  async broadcastSend() {
    const d = this._broadcastCollect();
    if (!d.content) return this.toast('请填写消息内容');
    const tip = d.filter.userIds ? `已选 ${d.filter.userIds.length} 位用户` :
      `筛选条件：${d.filter.gender || '不限性别'} · ${d.filter.ageMin || ageMin}-${d.filter.ageMax || ageMax}岁 · ${d.filter.city || '不限城市'}`;
    if (!confirm(`确认发送？${tip}\n\n预览人数请先点「🔍 预览匹配人数」`)) return;
    const r = await this.api('/api/admin/message/broadcast', { method: 'POST', body: { title: d.title, content: d.content, filter: d.filter } });
    if (r.code === 0) {
      this.toast(r.data.msg);
      document.getElementById('bc_content').value = '';
      this._loadBroadcastHistory();
    } else this.toast(r.msg);
  },
  broadcastClear() {
    document.getElementById('bc_title').value = '';
    document.getElementById('bc_content').value = '';
  },
  async _loadBroadcastHistory() {
    const r = await this.api('/api/admin/message/broadcast/history');
    const list = (r.code === 0 && r.data) ? r.data.list : [];
    const html = list.length ? `<table>
      <thead><tr><th>时间</th><th>标题</th><th>内容</th><th>筛选</th><th>触达</th></tr></thead>
      <tbody>${list.map(b => {
        const dt = new Date(b.createdAt);
        const t = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
        const f = b.filter || {};
        const fc = [
          f.gender ? '性别=' + f.gender : '',
          (f.ageMin || f.ageMax) ? `年龄${f.ageMin||''}-${f.ageMax||''}` : '',
          f.city ? '城市=' + f.city : '',
          (f.userIds && f.userIds.length) ? `指定${f.userIds.length}人` : ''
        ].filter(Boolean).join(' · ') || '全部';
        return `<tr>
          <td style="font-size:12px; color:var(--text-2);">${t}</td>
          <td><b>${b.title || '系统通知'}</b></td>
          <td style="max-width:300px; font-size:12px;">${(b.content || '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])).slice(0, 80)}${b.content && b.content.length > 80 ? '...' : ''}</td>
          <td style="font-size:12px; color:var(--text-2);">${fc}</td>
          <td><b style="color:var(--primary);">${b.count}</b> 人</td>
        </tr>`;
      }).join('')}</tbody>
    </table>` : '<div class="empty"><div class="icon">📜</div>暂无群发记录</div>';
    const el = document.getElementById('bc_history');
    if (el) el.innerHTML = html;
  },

  async renderSettings() {
    const content = document.getElementById('pageContent');
    content.innerHTML = '<div class="loading">加载中...</div>';
    const r = await this.api('/api/admin/settings');
    const s = (r.code === 0 && r.data) ? r.data : {};
    const esc = (v) => String(v == null ? '' : v).replace(/"/g, '&quot;');
    content.innerHTML = `
      <div class="panel">
        <div class="panel-header"><h3>系统设置</h3><button class="btn btn-primary" onclick="Admin.saveSettings()">💾 保存</button></div>
        <div class="panel-body" style="max-width: 600px;">
          <div class="form-group">
            <label>站点名称</label>
            <input id="set_siteName" value="${esc(s.siteName)}" placeholder="如：StarMeet-跨界交友">
            <small style="color:var(--text-3);">显示在 H5 顶部 logo 旁、登录页等位置</small>
          </div>
          <div class="form-group">
            <label>站点图标（favicon / 添加到主屏幕图标）</label>
            <div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
              <img id="siteIconPreview" src="${s.favicon || '/uploads/icons/favicon.png'}" style="width:48px;height:48px;border-radius:10px;border:1px solid var(--border);object-fit:cover;" onerror="this.style.display='none'">
              <div>
                <input id="site_icon_file" type="file" accept="image/png,image/jpeg,image/x-icon" style="display:none" onchange="Admin._uploadSiteIcon(event)">
                <button class="btn btn-sm" onclick="document.getElementById('site_icon_file').click()">📷 上传图标</button>
                <small style="color:var(--text-3);display:block;margin-top:4px;">建议 180×180 PNG，iOS/Android 主屏幕图标自动裁剪圆角</small>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label>客服电话</label>
            <input id="set_servicePhone" value="${esc(s.servicePhone)}" placeholder="如 400-888-8888 或 13900000000">
            <small style="color:var(--text-3);">用于 H5 联系我们页面、注册页底部等</small>
          </div>
          <div class="form-group">
            <label>客服微信</label>
            <input id="set_serviceWechat" value="${esc(s.serviceWechat)}" placeholder="如 starmeet_cs">
            <small style="color:var(--text-3);">用于 H5 联系我们页面"复制微信号"功能</small>
          </div>
          <div class="form-group">
            <label>短信签名（付费短信平台）</label>
            <input id="set_smsSign" value="${esc(s.smsSign)}" placeholder="如 【StarMeet】" disabled>
            <small style="color:var(--text-3);">👉 上线接短信平台后再用，演示版锁定</small>
          </div>
          <hr style="margin:20px 0; border:none; border-top:1px solid var(--border);">
          <div class="form-group"><label>支付配置</label><select disabled><option>未配置（演示版未接支付）</option></select></div>
          <div class="form-group"><label>短信平台</label><select disabled><option>未配置（演示版未接短信）</option></select></div>
          <p style="color: var(--text-3); font-size: 12px; margin-top: 12px;">💡 上线前需要配置：短信平台、支付、微信开放平台、备案域名</p>
        </div>
      </div>
    `;
  },
  async saveSettings() {
    const body = {
      siteName: document.getElementById('set_siteName').value,
      servicePhone: document.getElementById('set_servicePhone').value,
      serviceWechat: document.getElementById('set_serviceWechat').value,
      favicon: document.getElementById('set_favicon')?.value || ''
    };
    if (!body.siteName.trim()) return this.toast('站点名称不能为空');
    const r = await this.api('/api/admin/settings', { method: 'POST', body });
    if (r.code === 0) this.toast('保存成功');
    else this.toast(r.msg || '保存失败');
  },

  async renderMailConfig() {
    const content = document.getElementById('pageContent');
    content.innerHTML = '<div class="loading">加载中...</div>';
    const r = await this.api('/api/admin/mail-config');
    if (r.code !== 0) { content.innerHTML = '<div class="empty">加载失败：' + (r.msg || '') + '</div>'; return; }
    const s = r.data || {};
    const esc = (v) => String(v == null ? '' : v).replace(/"/g, '&quot;');
    content.innerHTML = `
      <div class="panel">
        <div class="panel-header">
          <h3>📧 邮箱验证码配置</h3>
          <div>
            <button class="btn" onclick="Admin.testMail()">📤 发送测试邮件</button>
            <button class="btn btn-primary" onclick="Admin.saveMailConfig()">💾 保存</button>
          </div>
        </div>
        <div class="panel-body" style="max-width: 760px;">
          <div style="background:#fffbe6; border:1px solid #ffe58f; padding:12px 14px; border-radius:8px; margin-bottom:16px; color:#7a5b00; font-size:13px; line-height:1.6;">
            💡 <b>使用说明</b>：配置 QQ 邮箱 SMTP 用来发送注册验证码。<br>
            1. 登录 QQ 邮箱 → 设置 → 账户 → 开启 <b>SMTP服务</b><br>
            2. 复制授权码（16位）填到下方"授权码"字段<br>
            3. 保存后可用"发送测试邮件"验证配置是否正确
          </div>
          <div class="form-group">
            <label>SMTP 服务器</label>
            <input id="mail_smtpHost" value="${esc(s.smtpHost)}" placeholder="如 smtp.qq.com">
            <small style="color:var(--text-3);">QQ邮箱用 smtp.qq.com；163邮箱用 smtp.163.com；Gmail用 smtp.gmail.com</small>
          </div>
          <div class="form-group">
            <label>SMTP 端口</label>
            <input id="mail_smtpPort" value="${esc(s.smtpPort)}" placeholder="465（SSL）或 25（TLS）">
          </div>
          <div class="form-group">
            <label>发件人邮箱（QQ号）</label>
            <input id="mail_user" value="${esc(s.user)}" placeholder="如 123456@qq.com">
          </div>
          <div class="form-group">
            <label>授权码（不是QQ密码）</label>
            <input id="mail_pass" value="${esc(s.pass)}" placeholder="16位授权码，留空则保持原值">
            <small style="color:var(--text-3);">显示为 ******xxxx 格式；如需修改请直接输入新授权码</small>
          </div>
          <div class="form-group">
            <label>发件人昵称</label>
            <input id="mail_fromName" value="${esc(s.fromName)}" placeholder="如 StarMeet">
          </div>
          <div class="form-group">
            <label>邮件主题</label>
            <input id="mail_codeSubject" value="${esc(s.codeSubject)}" placeholder="如 【StarMeet】您的注册验证码">
          </div>
          <div class="form-group">
            <label>邮件内容模板</label>
            <textarea id="mail_codeTemplate" rows="4" placeholder="如 您的验证码是：{code}，10分钟内有效">${esc(s.codeTemplate)}</textarea>
            <small style="color:var(--text-3);">支持变量：{code} 替换为6位验证码</small>
          </div>
        </div>
      </div>
    `;
  },
  async saveMailConfig() {
    const body = {
      smtpHost: document.getElementById('mail_smtpHost').value.trim(),
      smtpPort: document.getElementById('mail_smtpPort').value.trim() || 465,
      secure: true,
      user: document.getElementById('mail_user').value.trim(),
      pass: document.getElementById('mail_pass').value.trim(),
      fromName: document.getElementById('mail_fromName').value.trim(),
      codeSubject: document.getElementById('mail_codeSubject').value.trim(),
      codeTemplate: document.getElementById('mail_codeTemplate').value
    };
    if (!body.user) return this.toast('请填写发件人邮箱');
    const r = await this.api('/api/admin/mail-config', { method: 'POST', body });
    if (r.code === 0) this.toast('保存成功');
    else this.toast(r.msg || '保存失败');
  },
  async testMail() {
    const email = prompt('请输入接收测试邮件的邮箱：');
    if (!email) return;
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return this.toast('邮箱格式不正确');
    const r = await this.api('/api/admin/mail-test', { method: 'POST', body: { email } });
    if (r.code === 0) this.toast(r.msg);
    else this.toast(r.msg || '发送失败');
  },

  // ===== 站点配置 =====
  async renderSiteConfig() {
    const content = document.getElementById('pageContent');
    const res = await this.api('/api/site-config');
    if (res.code !== 0) return;
    const c = res.data;
    const nav = c.navConfig || [
      { icon: '🏠', title: '首页', page: 'home', enabled: true },
      { icon: '💖', title: '找缘分', page: 'match', enabled: true },
      { icon: '🎉', title: '活动', page: 'activity', enabled: true },
      { icon: '📖', title: '学堂', page: 'school', enabled: true },
      { icon: '👤', title: '我的', page: 'mine', enabled: true }
    ];
    this._navConfig = nav;

    let navHtml = `<table style="margin-bottom:14px;">
      <thead><tr><th>图标</th><th>文案</th><th>跳转页面</th><th>启用</th></tr></thead>
      <tbody id="nc_tbody">`;
    nav.forEach((n, i) => {
      const isImage = n.icon && (n.icon.startsWith('http') || n.icon.startsWith('/'));
      navHtml += `<tr id="nc_row_${i}">
        <td style="min-width:120px;">
          <div style="display:flex; flex-direction:column; gap:6px; align-items:center;">
            <div id="nc_icon_preview_${i}" style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border-radius:8px;font-size:28px;overflow:hidden;">
              ${isImage ? `<img src="${n.icon}" style="width:100%;height:100%;object-fit:cover;">` : (n.icon || '💖')}
            </div>
            <div style="display:flex; gap:4px;">
              <input id="nc_icon_file_${i}" type="file" accept="image/*" style="display:none" onchange="Admin._uploadNavIcon(${i})">
              <button class="btn" style="font-size:11px;padding:4px 8px;" onclick="document.getElementById('nc_icon_file_${i}').click()">上传</button>
              <button class="btn" style="font-size:11px;padding:4px 8px;" onclick="Admin._clearNavIcon(${i})">清除</button>
            </div>
            <input id="nc_icon_${i}" type="hidden" value="${n.icon || '💖'}">
          </div>
        </td>
        <td><input id="nc_title_${i}" value="${n.title || ''}" placeholder="文案" style="min-width:100px;"></td>
        <td>
          <select id="nc_page_${i}">
            <option value="home" ${n.page==='home'?'selected':''}>首页</option>
            <option value="match" ${n.page==='match'?'selected':''}>找缘分</option>
            <option value="activity" ${n.page==='activity'?'selected':''}>活动</option>
            <option value="school" ${n.page==='school'?'selected':''}>学堂</option>
            <option value="mine" ${n.page==='mine'?'selected':''}>我的</option>
          </select>
        </td>
        <td><button id="nc_enabled_${i}" class="btn ${n.enabled !== false?'btn-primary':''}" onclick="Admin._toggleNavEnabled(${i})">${n.enabled !== false?'已启用':'已禁用'}</button></td>
      </tr>`;
    });
    navHtml += `</tbody></table>`;
    content.innerHTML = `<div class="panel">
      <div class="panel-header"><h3>站点配置（顶部 logo + 文字）</h3></div>
      <div class="panel-body" style="max-width: 600px;">
        <div class="form-group">
          <label>Logo 模式</label>
          <select id="sc_logoType">
            <option value="emoji" ${c.logoType==='emoji'?'selected':''}>Emoji 表情（推荐，无需上传）</option>
            <option value="image" ${c.logoType==='image'?'selected':''}>上传图片</option>
          </select>
        </div>
        <div class="form-group"><label>Logo Emoji</label><input id="sc_logoEmoji" value="${c.logoEmoji || '💕'}"></div>
        <div class="form-group">
          <label>Logo 图片（仅图片模式）</label>
          <div style="display:flex; gap:8px; align-items:center;">
            <img id="sc_logoImage_preview" src="${c.logoImage || ''}" style="width:60px;height:60px;border-radius:10px;object-fit:cover;background:#eee;border:1px dashed var(--border);">
            <input id="sc_logoImage_file" type="file" accept="image/*" style="display:none">
            <input id="sc_logoImage" type="hidden" value="${c.logoImage || ''}">
            <button class="btn" onclick="document.getElementById('sc_logoImage_file').click()">上传图片</button>
            <button class="btn" onclick="document.getElementById('sc_logoImage').value=''; document.getElementById('sc_logoImage_preview').src='';">清除</button>
          </div>
        </div>
        <div class="form-group">
          <label>顶部文字（站点名称）</label>
          <input value="👉 请到「系统设置」修改" disabled>
          <small style="color:var(--text-3);">站点名称、客服电话、客服微信统一在「系统设置」中管理</small>
        </div>
        <div class="form-group"><label>首页副标题（用于轮播/SEO）</label><input id="sc_siteSlogan" value="${c.siteSlogan || ''}"></div>

        <hr style="margin:20px 0;border:none;border-top:1px solid var(--border);">
        <h4 style="margin:16px 0 8px;">底部导航栏配置</h4>
        <p style="color:var(--text-2);margin-bottom:12px;">配置底部导航栏：图标（emoji/图片）、文案、跳转页面、启用。<b>建议 4-5 个</b>。</p>
        ${navHtml}
        <div class="form-row">
          <button class="primary-btn" onclick="Admin.saveSiteConfig()">保存配置</button>
          <button class="btn" onclick="Admin.previewSite()">预览效果</button>
        </div>
        <div id="sc_preview" style="margin-top:14px;"></div>
      </div>
    </div>`;
    document.getElementById('sc_logoImage_file').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const r = await Admin.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
        if (r.code === 0) {
          document.getElementById('sc_logoImage').value = r.data.url;
          document.getElementById('sc_logoImage_preview').src = r.data.url;
          Admin.toast('已上传');
        } else Admin.toast(r.msg);
      };
      reader.readAsDataURL(f);
    };
  },
  async saveSiteConfig() {
    // 收集底部导航栏数据
    const nav = [];
    const navCount = (this._navConfig || []).length;
    for (let i = 0; i < navCount; i++) {
      nav.push({
        icon: document.getElementById('nc_icon_' + i).value || '💖',
        title: document.getElementById('nc_title_' + i).value || '导航',
        page: document.getElementById('nc_page_' + i).value || 'home',
        enabled: document.getElementById('nc_enabled_' + i).classList.contains('btn-primary')
      });
    }
    const body = {
      logoType: document.getElementById('sc_logoType').value,
      logoEmoji: document.getElementById('sc_logoEmoji').value,
      logoImage: document.getElementById('sc_logoImage').value,
      siteSlogan: document.getElementById('sc_siteSlogan').value,
      navConfig: nav
    };
    const r = await this.api('/api/admin/site-config', { method: 'POST', body });
    if (r.code === 0) this.toast('保存成功');
    else this.toast(r.msg);
  },
  async previewSite() {
    const r = await this.api('/api/site-config');
    const c = r.data;
    const logo = c.logoType === 'image' && c.logoImage ? `<img src="${c.logoImage}" style="width:24px;height:24px;border-radius:6px;vertical-align:middle;">` : `<span style="font-size:22px;vertical-align:middle;">${c.logoEmoji || '💕'}</span>`;
    document.getElementById('sc_preview').innerHTML = `<div style="padding:10px 14px;background:#fff;border-radius:8px;border:1px solid var(--border);display:inline-block;">${logo} <span style="font-weight:600;margin-left:6px;">${c.siteName}</span></div>`;
  },
  // 底部导航栏图标上传
  async _uploadNavIcon(idx) {
    const fileInput = document.getElementById('nc_icon_file_' + idx);
    const f = fileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
        if (r.code === 0) {
          const url = r.data.url;
          document.getElementById('nc_icon_' + idx).value = url;
          const preview = document.getElementById('nc_icon_preview_' + idx);
          preview.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;">`;
          this.toast('图标已上传');
        } else {
          this.toast(r.msg || '上传失败');
        }
      } catch (e) {
        this.toast('上传失败: ' + e.message);
      }
    };
    reader.readAsDataURL(f);
    // 清除文件输入，允许再次选择同一个文件
    fileInput.value = '';
  },
  // 清除底部导航栏图标
  _clearNavIcon(idx) {
    document.getElementById('nc_icon_' + idx).value = '💖';
    const preview = document.getElementById('nc_icon_preview_' + idx);
    preview.innerHTML = '💖';
    this.toast('已清除图标，使用默认emoji');
  },
  // 站点图标上传（favicon / apple-touch-icon）
  async _uploadSiteIcon(event) {
    const f = event.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return this.toast('图标不能超过 2MB');
    // 验证尺寸建议
    const img = new Image();
    img.onload = async () => {
      if (img.width < 100 || img.height < 100) {
        this.toast('图标太小，建议至少 180×180');
        return;
      }
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'icons' } });
            if (r.code === 0) {
              const url = r.data.url;
              // 更新预览
              const preview = document.getElementById('siteIconPreview');
              preview.src = url;
              preview.style.display = '';
              // 同时更新 settings 的 favicon 字段（暂存到 input 中）
              let faviconInput = document.getElementById('set_favicon');
              if (!faviconInput) {
                faviconInput = document.createElement('input');
                faviconInput.type = 'hidden';
                faviconInput.id = 'set_favicon';
                faviconInput.value = url;
                document.querySelector('.panel-body').appendChild(faviconInput);
              } else {
                faviconInput.value = url;
              }
              this.toast('图标已上传 ✅ 保存设置后生效');
            } else {
              this.toast(r.msg || '上传失败');
            }
          } catch (e2) { this.toast('上传失败: ' + e2.message); }
        };
        reader.readAsDataURL(f);
      } catch (e) { this.toast('处理图片失败'); }
    };
    img.src = URL.createObjectURL(f);
    event.target.value = '';
  },

  // ===== 顶部导航管理（列表+点编辑弹 modal，参照轮播模式） =====
  async renderTopNav() {
    const content = document.getElementById('pageContent');
    const res = await this.api('/api/site-config');
    if (res.code !== 0) return;
    const list = res.data.topNavConfig || [
      { title: '首页', page: 'home', icon: '' },
      { title: '找缘分', page: 'match', icon: '' },
      { title: '活动', page: 'activity', icon: '' },
      { title: '学堂', page: 'school', icon: '' },
      { title: '我的', page: 'mine', icon: '' }
    ];
    this._topNavList = list;
    const linkMap = { home: '首页', match: '找缘分', activity: '活动', school: '学堂', psychtest: '心理测试', mine: '我的', contact: '联系我们', survey: '问卷填写' };
    content.innerHTML = `<div class="panel">
      <div class="panel-header"><h3>顶部导航管理</h3><button class="btn btn-primary" onclick="Admin.editTopNav()">+ 新增导航项</button></div>
      <div class="panel-body">
        <p style="color:var(--text-2);margin-bottom:12px;">配置 H5 前端顶部 Tab 导航栏。支持设置文案、跳转页面和图标。<b>建议 3-6 个</b>。点「编辑」修改单条，点「删除」移除。</p>
        <table>
          <thead><tr><th style="width:60px;">图标</th><th>文案</th><th>跳转页面</th><th style="width:120px;">操作</th></tr></thead>
          <tbody>${list.map((n, i) => {
            const iconPreview = n.icon && (n.icon.startsWith('http') || n.icon.startsWith('/'))
              ? `<img src="${n.icon}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;">`
              : (n.icon ? `<span style="font-size:24px;">${n.icon}</span>` : '<span style="color:var(--text-3);">—</span>');
            return `<tr>
              <td style="text-align:center;">${iconPreview}</td>
              <td>${n.title || '-'}</td>
              <td>${linkMap[n.page] || n.page || '-'}</td>
              <td>
                <button class="btn btn-primary" onclick="Admin.editTopNav('${n.id || i}')">编辑</button>
                <button class="btn btn-danger" onclick="Admin.deleteTopNav('${n.id || i}')">删除</button>
              </td>
            </tr>`;
          }).join('') || '<tr><td colspan="4"><div class="empty"><div class="icon">🧭</div>暂无导航项，点击右上角"新增导航项"开始</div></td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  },
  async editTopNav(id) {
    const list = this._topNavList || [];
    let n = { title: '', page: 'home', icon: '' };
    if (id !== undefined && id !== null) {
      n = list.find(x => (x.id || list.indexOf(x)) == id) || n;
    }
    const linkOptions = [
      { v: 'home', t: '首页' }, { v: 'match', t: '找缘分' }, { v: 'activity', t: '活动' },
      { v: 'school', t: '学堂' }, { v: 'psychtest', t: '心理测试' }, { v: 'mine', t: '我的' },
      { v: 'contact', t: '联系我们' }, { v: 'survey', t: '问卷填写' }
    ];
    const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');
    const isImage = n.icon && (n.icon.startsWith('http') || n.icon.startsWith('/'));
    const body = `
      <div class="form-group"><label>导航文案</label><input id="tn_title" value="${esc(n.title)}" placeholder="如：首页"></div>
      <div class="form-group"><label>跳转页面</label>
        <select id="tn_page">
          ${linkOptions.map(o => `<option value="${o.v}" ${n.page===o.v?'selected':''}>${o.t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>图标（可选，支持 emoji 或上传图片）</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <div id="tn_icon_preview" style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border-radius:8px;font-size:28px;overflow:hidden;">
            ${isImage ? `<img src="${n.icon}" style="width:100%;height:100%;object-fit:cover;">` : (n.icon ? n.icon : '—')}
          </div>
          <input id="tn_icon" type="text" value="${esc(n.icon)}" placeholder="emoji 或留空" style="width:60px;text-align:center;font-size:20px;">
          <input id="tn_icon_file" type="file" accept="image/*" style="display:none">
          <button class="btn" id="tn_upload_btn">上传图片</button>
          <button class="btn" id="tn_clear_btn">清除</button>
        </div>
        <small style="color:var(--text-3);">填 emoji 如 🏠 则显示 emoji；上传图片则显示图片；留空则仅显示文案</small>
      </div>
    `;
    this._openModal(id ? '编辑顶部导航项' : '新增顶部导航项', body, () => this._saveTopNav(id, list));
    // 绑定上传事件
    const fileInput = document.getElementById('tn_icon_file');
    document.getElementById('tn_upload_btn').onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
        if (r.code === 0) {
          document.getElementById('tn_icon').value = r.data.url;
          document.getElementById('tn_icon_preview').innerHTML = `<img src="${r.data.url}" style="width:100%;height:100%;object-fit:cover;">`;
          this.toast('已上传');
        } else this.toast(r.msg);
      };
      reader.readAsDataURL(f);
    };
    document.getElementById('tn_clear_btn').onclick = () => {
      document.getElementById('tn_icon').value = '';
      document.getElementById('tn_icon_preview').innerHTML = '—';
    };
    // emoji输入实时更新预览
    document.getElementById('tn_icon').addEventListener('input', function() {
      const v = this.value;
      if (!v || v.startsWith('http') || v.startsWith('/')) return;
      document.getElementById('tn_icon_preview').innerHTML = v;
    });
  },
  async _saveTopNav(id, list) {
    const title = document.getElementById('tn_title').value.trim();
    if (!title) return this.toast('请填写导航文案');
    const item = {
      id: id || ('tn_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)),
      title,
      page: document.getElementById('tn_page').value,
      icon: document.getElementById('tn_icon').value
    };
    const newList = list.filter(x => (x.id || list.indexOf(x)) != id);
    // 找到原项位置并插入，如果是新增则追加
    const origIdx = id ? list.findIndex(x => (x.id || list.indexOf(x)) == id) : -1;
    if (origIdx >= 0) newList.splice(origIdx, 0, item);
    else newList.push(item);
    const r = await this.api('/api/admin/site-config', { method: 'POST', body: { topNavConfig: newList } });
    if (r.code === 0) { this.toast('保存成功'); this._closeModal(); this.renderTopNav(); }
    else this.toast(r.msg || '保存失败');
  },
  async deleteTopNav(id) {
    if (!confirm('确定删除该导航项吗？')) return;
    const list = (this._topNavList || []).filter(x => (x.id || this._topNavList.indexOf(x)) != id);
    const r = await this.api('/api/admin/site-config', { method: 'POST', body: { topNavConfig: list } });
    if (r.code === 0) { this.toast('删除成功'); this.renderTopNav(); }
    else this.toast(r.msg || '删除失败');
  },

  // ===== 底部导航栏配置 =====
  async renderNavConfig() {
    const res = await this.api('/api/site-config');
    if (res.code !== 0) return;
    const nav = res.data.navConfig || [
      { icon: '🏠', title: '首页', page: 'home', enabled: true },
      { icon: '💖', title: '找缘分', page: 'match', enabled: true },
      { icon: '🎉', title: '活动', page: 'activity', enabled: true },
      { icon: '📖', title: '学堂', page: 'school', enabled: true },
      { icon: '👤', title: '我的', page: 'mine', enabled: true }
    ];
    this._navConfig = nav;
    const pageMap = { home: '首页', match: '找缘分', activity: '活动', school: '学堂', mine: '我的' };
    let html = `<div class="modal-mask" onclick="Admin._closeModal()"></div>
      <div class="modal">
        <div class="modal-header">底部导航栏配置<span class="modal-close" onclick="Admin._closeModal()">×</span></div>
        <div class="modal-body">
          <p style="color:var(--text-2);margin-bottom:12px;">配置底部导航栏：图标（emoji）、文案、跳转页面、启用。<b>建议 4-5 个</b>。</p>
          <table>
            <thead><tr><th>图标</th><th>文案</th><th>跳转页面</th><th>启用</th><th>操作</th></tr></thead>
          <tbody id="nc_tbody">`;
    nav.forEach((n, i) => {
      html += `<tr id="nc_row_${i}">
        <td><input id="nc_icon_${i}" value="${n.icon || '💖'}" style="width:50px;font-size:18px;text-align:center;"></td>
        <td><input id="nc_title_${i}" value="${n.title || ''}" placeholder="文案"></td>
        <td>
          <select id="nc_page_${i}">
            <option value="home" ${n.page==='home'?'selected':''}>首页</option>
            <option value="match" ${n.page==='match'?'selected':''}>找缘分</option>
            <option value="activity" ${n.page==='activity'?'selected':''}>活动</option>
            <option value="school" ${n.page==='school'?'selected':''}>学堂</option>
            <option value="mine" ${n.page==='mine'?'selected':''}>我的</option>
          </select>
        </td>
        <td><button id="nc_enabled_${i}" class="btn ${n.enabled !== false?'btn-primary':''}" onclick="Admin._toggleNavEnabled(${i})">${n.enabled !== false?'已启用':'已禁用'}</button></td>
        <td><button class="btn btn-danger" onclick="Admin._removeNavItem(${i})">删除</button></td>
      </tr>`;
    });
    html += `</tbody></table>
          <button class="btn btn-primary" onclick="Admin._addNavItem()">+ 添加导航项</button>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="Admin._closeModal()">取消</button>
          <button class="btn btn-primary" onclick="Admin.saveNavConfig()">保存</button>
        </div>
      </div>`;
    document.getElementById('modalContainer').innerHTML = html;
  },
  _addNavItem() {
    (this._navConfig = this._navConfig || []).push({ icon: '💖', title: '新导航', page: 'home', enabled: true });
    this.renderNavConfig();
  },
  _removeNavItem(i) {
    this._navConfig.splice(i, 1);
    this.renderNavConfig();
  },
  _toggleNavEnabled(i) {
    this._navConfig[i].enabled = !(this._navConfig[i].enabled !== false);
    this.renderNavConfig();
  },
  async saveNavConfig() {
    const list = (this._navConfig || []).map((n, i) => ({
      icon: (document.getElementById('nc_icon_' + i) || {}).value || '💖',
      title: (document.getElementById('nc_title_' + i) || {}).value || '导航',
      page: (document.getElementById('nc_page_' + i) || {}).value || 'home',
      enabled: n.enabled
    }));
    this._navConfig = list;
    this.toast('已暂存，点击"保存配置"后生效');
    this._closeModal();
  },

  // ===== 联系我们设置 =====
  async renderContact() {
    const content = document.getElementById('pageContent');
    content.innerHTML = '<div class="loading">加载中...</div>';
    const r = await this.api('/api/admin/contact');
    const c = (r.code === 0 && r.data) ? r.data : {};
    const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');
    content.innerHTML = `
      <div class="panel">
        <div class="panel-header"><h3>联系我们设置</h3><button class="btn btn-primary" onclick="Admin.saveContact()">💾 保存</button></div>
        <div class="form-grid">
          <div style="font-weight:600;color:var(--primary);padding:8px 0 4px;border-bottom:1px solid var(--border);margin-bottom:8px;">🎨 页面样式</div>
          <div class="form-row">
            <label>顶部背景图片（留空则用渐变色）</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input id="c_heroBgImage" value="${esc(c.heroBgImage)}" placeholder="/uploads/contact_bg.jpg" style="flex:1;">
              <button class="btn" onclick="Admin.uploadContactHeroBg()">📤 上传</button>
              ${c.heroBgImage ? `<img src="${esc(c.heroBgImage)}" style="width:42px;height:42px;border-radius:6px;border:1px solid var(--border);object-fit:cover;" id="c_heroBgPreview">` : '<div id="c_heroBgPreview" style="width:42px;height:42px;border-radius:6px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;color:#ccc;font-size:12px;">预览</div>'}
            </div>
            <input type="file" id="c_heroBgFile" accept="image/*" style="display:none;" onchange="Admin._uploadContactHeroBgFile(this)">
            <small style="color:var(--text-3);">建议尺寸 750×400，将作为联系我们页面顶部背景图</small>
          </div>
          <div class="form-row">
            <label>顶部大标题</label>
            <input id="c_heroTitle" value="${esc(c.heroTitle || '联系我们')}">
          </div>
          <div class="form-row">
            <label>顶部副标题/描述</label>
            <input id="c_heroDesc" value="${esc(c.heroDesc || '7×24 小时为您提供真诚服务')}">
          </div>

          <div style="font-weight:600;color:var(--primary);padding:8px 0 4px;border-bottom:1px solid var(--border);margin:12px 0 8px;">📞 联系信息</div>
          <div class="form-row">
            <label>客服电话（拨号用）</label>
            <input id="c_phone" value="${esc(c.phone)}" placeholder="如 400-888-8888 或 13900000000">
          </div>
          <div class="form-row">
            <label>电话显示文案（可加空格/分机）</label>
            <input id="c_phoneDisplay" value="${esc(c.phoneDisplay)}" placeholder="如 400-888-8888 转 1">
          </div>
          <div class="form-row">
            <label>电话卡片标签名</label>
            <input id="c_phoneLabel" value="${esc(c.phoneLabel || '客服电话')}">
          </div>
          <div class="form-row">
            <label>微信号（点击可复制）</label>
            <input id="c_wechat" value="${esc(c.wechat)}" placeholder="如 starmeet_cs">
          </div>
          <div class="form-row">
            <label>微信卡片标签名</label>
            <input id="c_wechatLabel" value="${esc(c.wechatLabel || '客服微信号（点击复制）')}">
          </div>
          <div class="form-row">
            <label>客服微信号二维码（VIP升级弹窗也用此图）</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input id="c_wechatQrcode" value="${esc(c.wechatQrcode || '')}" placeholder="/uploads/xxx.png" style="flex:1;">
              <button class="btn" onclick="Admin.uploadWechatQrcode()">📤 上传</button>
              ${c.wechatQrcode ? `<img src="${esc(c.wechatQrcode)}" style="width:42px;height:42px;border-radius:6px;border:1px solid var(--border);object-fit:cover;" id="c_wechatQrcodePreview">` : '<div id="c_wechatQrcodePreview" style="width:42px;height:42px;border-radius:6px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;color:#ccc;font-size:12px;">预览</div>'}
            </div>
            <input type="file" id="c_wechatQrcodeFile" accept="image/*" style="display:none;" onchange="Admin._uploadWechatQrcodeFile(this)">
          </div>
          <div class="form-row">
            <label>联系邮箱</label>
            <input id="c_email" type="email" value="${esc(c.email)}" placeholder="如 service@starmeet.com">
          </div>
          <div class="form-row">
            <label>邮箱卡片标签名</label>
            <input id="c_emailLabel" value="${esc(c.emailLabel || '联系邮箱')}">
          </div>
          <div class="form-row">
            <label>公司地址</label>
            <textarea id="c_address" rows="2" placeholder="如 福建省福州市鼓楼区...">${esc(c.address)}</textarea>
          </div>
          <div class="form-row">
            <label>地址卡片标签名</label>
            <input id="c_addressLabel" value="${esc(c.addressLabel || '公司地址')}">
          </div>
          <div class="form-row">
            <label>工作时间</label>
            <input id="c_workTime" value="${esc(c.workTime)}" placeholder="如 周一至周日 09:00 - 21:00">
          </div>
          <div class="form-row">
            <label>工作时间卡片标签名</label>
            <input id="c_workTimeLabel" value="${esc(c.workTimeLabel || '工作时间')}">
          </div>
          <div class="form-row">
            <label>在线客服链接（留空则不显示）</label>
            <input id="c_serviceUrl" value="${esc(c.serviceUrl)}" placeholder="如 https://chat.example.com">
          </div>
          <div class="form-row">
            <label>在线客服按钮文字</label>
            <input id="c_serviceUrlLabel" value="${esc(c.serviceUrlLabel || '在线客服')}">
          </div>
          <div class="form-row">
            <label>企业微信客服链接（留空则不显示）</label>
            <input id="c_wecomLink" value="${esc(c.wecomLink || '')}" placeholder="如 https://work.weixin.qq.com/...">
            <small style="color:var(--text-3);">填写后联系我们页面显示「企业微信客服」按钮，点击直接跳转聊天窗口</small>
          </div>
          <div class="form-row">
            <label>企业微信按钮文字</label>
            <input id="c_wecomLinkLabel" value="${esc(c.wecomLinkLabel || '企业微信客服')}">
          </div>

          <div style="font-weight:600;color:var(--primary);padding:8px 0 4px;border-bottom:1px solid var(--border);margin:12px 0 8px;">🖼️ 二维码区域</div>
          <div class="form-row">
            <label>公众号二维码图片（可选）</label>
            <div style="display:flex;gap:8px;align-items:center;">
              <input id="c_qrcodeImage" value="${esc(c.qrcodeImage)}" placeholder="/uploads/xxx.png" style="flex:1;">
              <button class="btn" onclick="Admin.uploadContactQrcode()">📤 上传</button>
              ${c.qrcodeImage ? `<img src="${esc(c.qrcodeImage)}" style="width:42px;height:42px;border-radius:6px;border:1px solid var(--border);object-fit:cover;" id="c_qrcodeImagePreview">` : '<div id="c_qrcodeImagePreview" style="width:42px;height:42px;border-radius:6px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;color:#ccc;font-size:12px;">预览</div>'}
            </div>
            <input type="file" id="c_qrcodeFile" accept="image/*" style="display:none;" onchange="Admin._uploadContactQrcodeFile(this)">
          </div>
          <div class="form-row">
            <label>微信二维码区域标题</label>
            <input id="c_qrcodeSectionTitle" value="${esc(c.qrcodeSectionTitle || '客服微信号二维码')}">
          </div>
          <div class="form-row">
            <label>微信二维码下方提示文字</label>
            <input id="c_qrcodeHint" value="${esc(c.qrcodeHint || '扫码添加客服微信，获取专属服务')}">
          </div>

          <div style="font-weight:600;color:var(--primary);padding:8px 0 4px;border-bottom:1px solid var(--border);margin:12px 0 8px;">📝 关于我们</div>
          <div class="form-row">
            <label>「关于我们」区域标题</label>
            <input id="c_introSectionTitle" value="${esc(c.introSectionTitle || '关于我们')}">
          </div>
          <div class="form-row">
            <label>关于我们介绍</label>
            <textarea id="c_intro" rows="4" placeholder="介绍平台的优势、特色、服务理念">${esc(c.intro)}</textarea>
          </div>
        </div>
        <div class="panel-footer">
          <button class="btn btn-primary" onclick="Admin.saveContact()">💾 保存设置</button>
        </div>
      </div>
    `;
  },
  async saveContact() {
    const fields = ['phone','phoneDisplay','wechat','wechatQrcode','email','address','workTime','serviceUrl','wecomLink','qrcodeImage','intro',
      'heroBgImage','heroTitle','heroDesc','phoneLabel','wechatLabel','emailLabel','addressLabel','workTimeLabel','serviceUrlLabel','wecomLinkLabel','qrcodeSectionTitle','qrcodeHint','introSectionTitle'];
    const body = {};
    for (const f of fields) {
      const el = document.getElementById('c_' + f);
      if (el) body[f] = el.value;
    }
    const r = await this.api('/api/admin/contact', { method: 'POST', body });
    if (r.code === 0) this.toast('保存成功');
    else this.toast(r.msg || '保存失败');
  },
  uploadWechatQrcode() { document.getElementById('c_wechatQrcodeFile').click(); },
  _uploadWechatQrcodeFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//i.test(file.type)) return this.toast('请选择图片文件');
    if (file.size > 5 * 1024 * 1024) return this.toast('图片不能超过 5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
      if (r.code === 0) {
        const inp = document.getElementById('c_wechatQrcode');
        if (inp) inp.value = r.data.url;
        // 更新预览图片
        let preview = document.getElementById('c_wechatQrcodePreview');
        if (preview) {
          if (preview.tagName === 'IMG') {
            preview.src = r.data.url + '?t=' + Date.now(); // 防止缓存
          } else {
            // 如果预览区域是 div，替换为 img
            const newPreview = document.createElement('img');
            newPreview.id = 'c_wechatQrcodePreview';
            newPreview.src = r.data.url;
            newPreview.style.cssText = 'width:42px;height:42px;border-radius:6px;border:1px solid var(--border);object-fit:cover;';
            preview.parentElement.replaceChild(newPreview, preview);
          }
        }
        this.toast('上传成功');
      } else { this.toast(r.msg || '上传失败'); }
    };
    reader.readAsDataURL(file);
  },
  uploadContactQrcode() { document.getElementById('c_qrcodeFile').click(); },
  _uploadContactQrcodeFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//i.test(file.type)) return this.toast('请选择图片文件');
    if (file.size > 5 * 1024 * 1024) return this.toast('图片不能超过 5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
      if (r.code === 0) {
        const inp = document.getElementById('c_qrcodeImage');
        if (inp) inp.value = r.data.url;
        // 更新预览图片
        let preview = document.getElementById('c_qrcodeImagePreview');
        if (preview) {
          if (preview.tagName === 'IMG') {
            preview.src = r.data.url + '?t=' + Date.now();
          } else {
            const newPreview = document.createElement('img');
            newPreview.id = 'c_qrcodeImagePreview';
            newPreview.src = r.data.url;
            newPreview.style.cssText = 'width:42px;height:42px;border-radius:6px;border:1px solid var(--border);object-fit:cover;';
            preview.parentElement.replaceChild(newPreview, preview);
          }
        }
        this.toast('上传成功');
      } else { this.toast(r.msg || '上传失败'); }
    };
    reader.readAsDataURL(file);
  },
  uploadContactHeroBg() { document.getElementById('c_heroBgFile').click(); },
  _uploadContactHeroBgFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//i.test(file.type)) return this.toast('请选择图片文件');
    if (file.size > 5 * 1024 * 1024) return this.toast('图片不能超过 5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
      if (r.code === 0) {
        const inp = document.getElementById('c_heroBgImage');
        if (inp) inp.value = r.data.url;
        // 更新预览图片
        let preview = document.getElementById('c_heroBgPreview');
        if (preview) {
          if (preview.tagName === 'IMG') {
            preview.src = r.data.url + '?t=' + Date.now();
          } else {
            const newPreview = document.createElement('img');
            newPreview.id = 'c_heroBgPreview';
            newPreview.src = r.data.url;
            newPreview.style.cssText = 'width:42px;height:42px;border-radius:6px;border:1px solid var(--border);object-fit:cover;';
            preview.parentElement.replaceChild(newPreview, preview);
          }
        }
        this.toast('上传成功');
      } else { this.toast(r.msg || '上传失败'); }
    };
    reader.readAsDataURL(file);
  },

  // ===== 首页轮播（列表+点编辑弹 modal） =====
  async renderBanners() {
    const content = document.getElementById('pageContent');
    const res = await this.api('/api/banners');
    if (res.code !== 0) return;
    const list = res.data;
    // 为没有id的轮播分配id（修复编辑/删除bug）
    list.forEach((b, i) => { if (!b.id) b.id = 'bn_' + i + '_' + Date.now().toString(36); });
    this._bannerList = list;
    const linkMap = { home: '首页', match: '找缘分', activity: '活动', school: '学堂', mine: '我的', contact: '联系我们' };
    const now = Date.now();
    content.innerHTML = `<div class="panel">
      <div class="panel-header"><h3>首页轮播 Banner</h3><button class="btn btn-primary" onclick="Admin.editBanner()">+ 新增轮播</button></div>
      <div class="panel-body">
        <p style="color:var(--text-2);margin-bottom:12px;">支持图片 / 渐变背景 / 文字标题 / CTA 跳转。可设置展示时间，过期自动下架。</p>
        <table>
          <thead><tr><th style="width:60px;">预览</th><th>标题</th><th>副标题</th><th>展示时间</th><th>状态</th><th style="width:160px;">操作</th></tr></thead>
          <tbody>${list.map((b, i) => {
            const preview = b.image
              ? `<img src="${b.image}" style="width:50px;height:36px;object-fit:cover;border-radius:4px;">`
              : `<div style="width:50px;height:36px;border-radius:4px;background:${b.bgColor || '#ff5a5f'};"></div>`;
            const bId = b.id || i;
            let timeDisplay = '永久展示';
            let statusBadge = '<span style="color:#52c41a;">✅ 展示中</span>';
            if (b.startTime && b.endTime) {
              const st = new Date(b.startTime).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
              const et = new Date(b.endTime).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
              timeDisplay = st + ' ~ ' + et;
              const sTime = new Date(b.startTime).getTime();
              const eTime = new Date(b.endTime).getTime();
              if (now < sTime) statusBadge = '<span style="color:#fa8c16;">⏳ 待展示</span>';
              else if (now > eTime) statusBadge = '<span style="color:#999;">⏹ 已下架</span>';
            } else if (b.endTime) {
              const et = new Date(b.endTime).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
              timeDisplay = '即日起 ~ ' + et;
              if (now > new Date(b.endTime).getTime()) statusBadge = '<span style="color:#999;">⏹ 已下架</span>';
            }
            return `<tr>
              <td>${preview}</td>
              <td>${b.title || '-'}</td>
              <td>${b.subtitle || '-'}</td>
              <td><small>${timeDisplay}</small></td>
              <td>${statusBadge}</td>
              <td>
                <button class="btn btn-primary" onclick="Admin.editBanner('${bId}')">编辑</button>
                <button class="btn btn-danger" onclick="Admin.deleteBanner('${bId}')">删除</button>
              </td>
            </tr>`;
          }).join('') || '<tr><td colspan="6"><div class="empty"><div class="icon">🎠</div>暂无轮播，点击右上角"新增轮播"开始</div></td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  },
  async editBanner(id) {
    const list = this._bannerList || [];
    let b = { title:'', subtitle:'', ctaText:'立即了解', ctaLink:'match', bgColor:'#ff5a5f', image:'', startTime:'', endTime:'' };
    if (id !== undefined && id !== null) {
      b = list.find(x => (x.id || list.indexOf(x)) == id) || b;
    }
    const linkOptions = [
      { v: 'home', t: '首页' }, { v: 'match', t: '找缘分' }, { v: 'activity', t: '活动' },
      { v: 'school', t: '学堂' }, { v: 'psychtest', t: '心理测试' }, { v: 'mine', t: '我的' }, { v: 'contact', t: '联系我们' }
    ];
    const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');
    const body = `
      <div class="form-row">
        <div class="form-group" style="flex:0 0 110px;"><label>背景色</label><input type="color" id="bn_bgColor" value="${b.bgColor || '#ff5a5f'}"></div>
        <div class="form-group" style="flex:1;"><label>标题</label><input id="bn_title" value="${esc(b.title)}" placeholder="如：遇见对的人"></div>
      </div>
      <div class="form-group"><label>副标题</label><input id="bn_subtitle" value="${esc(b.subtitle)}" placeholder="如：本地真实单身 · 严选认证 · 1对1红娘牵线"></div>
      <div class="form-row">
        <div class="form-group" style="flex:1;"><label>CTA 文字（按钮文案）</label><input id="bn_ctaText" value="${esc(b.ctaText)}" placeholder="如：立即找缘分"></div>
        <div class="form-group" style="flex:1;"><label>CTA 跳转（站内页面）</label>
          <select id="bn_ctaLink">
            ${linkOptions.map(o => `<option value="${o.v}" ${b.ctaLink===o.v?'selected':''}>${o.t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>展示时间（可选，留空=永久展示）</label>
        <div class="form-row">
          <div class="form-group" style="flex:1;"><label>开始时间</label><input type="datetime-local" id="bn_startTime" value="${esc(b.startTime)}"></div>
          <div class="form-group" style="flex:1;"><label>结束时间</label><input type="datetime-local" id="bn_endTime" value="${esc(b.endTime)}"></div>
        </div>
        <small style="color:var(--text-3);">设置后，超出结束时间自动下架（不在前端展示）。留空表示永久展示。</small>
      </div>
      <div class="form-group">
        <label>背景图片（可选，留空用渐变色）</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <img id="bn_image_preview" src="${esc(b.image)}" style="width:80px;height:56px;object-fit:cover;border-radius:6px;background:#eee;border:1px dashed var(--border);">
          <input id="bn_image" type="hidden" value="${esc(b.image)}">
          <input id="bn_image_file" type="file" accept="image/*" style="display:none">
          <button class="btn" id="bn_upload_btn">📤 上传图片</button>
          <button class="btn" id="bn_clear_btn">清除</button>
        </div>
        <small style="color:var(--text-3);">建议尺寸 750×420，PNG/JPG，&lt;2MB</small>
      </div>
    `;
    this._openModal(id ? '编辑轮播' : '新增轮播', body, () => this._saveBanner(id));
    // 绑定上传事件
    const fileInput = document.getElementById('bn_image_file');
    document.getElementById('bn_upload_btn').onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
        if (r.code === 0) {
          document.getElementById('bn_image').value = r.data.url;
          document.getElementById('bn_image_preview').src = r.data.url;
          this.toast('已上传');
        } else this.toast(r.msg);
      };
      reader.readAsDataURL(f);
    };
    document.getElementById('bn_clear_btn').onclick = () => {
      document.getElementById('bn_image').value = '';
      document.getElementById('bn_image_preview').src = '';
    };
  },
  async _saveBanner(id) {
    const body = {
      id: id || ('bn_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)),
      title: document.getElementById('bn_title').value,
      subtitle: document.getElementById('bn_subtitle').value,
      ctaText: document.getElementById('bn_ctaText').value,
      ctaLink: document.getElementById('bn_ctaLink').value,
      bgColor: document.getElementById('bn_bgColor').value,
      image: document.getElementById('bn_image').value,
      startTime: document.getElementById('bn_startTime').value,
      endTime: document.getElementById('bn_endTime').value
    };
    if (!body.title.trim()) return this.toast('请填写标题');
    // 单条保存：找到原始位置替换，新增则追加
    const list = this._bannerList || [];
    const origIdx = list.findIndex(x => (x.id || list.indexOf(x)) == id);
    list.forEach((b, i) => { if (!b.id) b.id = 'bn_' + i + '_' + Date.now().toString(36); });
    const newList = list.filter(b => (b.id || list.indexOf(b)) != id);
    if (origIdx >= 0 && origIdx < newList.length + 1) newList.splice(origIdx, 0, body);
    else newList.push(body);
    const r = await this.api('/api/admin/banners', { method: 'POST', body: { list: newList } });
    if (r.code === 0) { this.toast('保存成功'); this._closeModal(); this.renderBanners(); }
    else this.toast(r.msg || '保存失败');
  },
  async deleteBanner(id) {
    if (!confirm('确定删除该轮播吗？')) return;
    const list = this._bannerList || [];
    list.forEach((b, i) => { if (!b.id) b.id = 'bn_' + i + '_' + Date.now().toString(36); });
    const newList = list.filter(b => (b.id || list.indexOf(b)) != id);
    const r = await this.api('/api/admin/banners', { method: 'POST', body: { list: newList } });
    if (r.code === 0) { this.toast('删除成功'); this.renderBanners(); }
    else this.toast(r.msg || '删除失败');
  },

  async renderQuickEntries() {
    const content = document.getElementById('pageContent');
    const res = await this.api('/api/admin/match-banners');
    if (res.code !== 0) return;
    const list = (res.data || []).sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));
    this._quickList = list;
    const linkMap = { home: '首页', match: '找缘分', activity: '活动', school: '学堂', mine: '我的', contact: '联系我们' };
    content.innerHTML = `<div class="panel">
      <div class="panel-header"><h3>快捷入口管理（首页 4 列图标）</h3><button class="btn btn-primary" onclick="Admin.editQuickEntry()">+ 新增入口</button></div>
      <div class="panel-body">
        <p style="color:var(--text-2);margin-bottom:12px;">配置首页"快捷入口"区：图标（emoji）、主题色、标题、副标题、跳转（站内页面 / 外部链接）、启用。建议 4-12 条，按 4 列自动换行。</p>
        <table>
          <thead><tr><th style="width:60px;">图标</th><th>标题</th><th>副标题</th><th>跳转</th><th style="width:80px;">排序</th><th>启用</th><th style="width:160px;">操作</th></tr></thead>
          <tbody>${list.map((b, i) => {
            const light = (b.color || '#ff5a6e') + '22';
            const jumpLabel = b.linkType === 'url' ? '🔗 外部' : '📄 ' + (linkMap[b.link] || b.link || '-');
            const jumpDetail = b.linkType === 'url' ? `<br><small style="color:var(--text-3);">${(b.link || '').slice(0,30)}</small>` : '';
            return `<tr>
              <td><div style="width:36px;height:36px;border-radius:50%;background:${light};color:${b.color || '#ff5a6e'};display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden;">${(b.icon && /^\//.test(b.icon)) ? `<img src="${b.icon}" style="width:100%;height:100%;object-fit:contain;">` : (b.icon || '💖')}</div></td>
              <td>${b.title || '-'}</td>
              <td>${b.subtitle || '-'}</td>
              <td>${jumpLabel}${jumpDetail}</td>
              <td style="text-align:center;font-weight:bold;color:var(--primary);">${b.sortOrder || 0}</td>
              <td>${b.enabled !== false ? '<span class="tag vip">已启用</span>' : '<span class="tag">已禁用</span>'}</td>
              <td>
                <button class="btn btn-primary" onclick="Admin.editQuickEntry('${b.id}')">编辑</button>
                <button class="btn btn-danger" onclick="Admin.deleteQuickEntry('${b.id}')">删除</button>
              </td>
            </tr>`;
          }).join('') || '<tr><td colspan="6"><div class="empty"><div class="icon">🧭</div>暂无快捷入口，点击右上角"新增入口"开始</div></td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  },
  async editQuickEntry(id) {
    const list = this._quickList || [];
    let b = { icon:'💖', color:'#ff5a6e', title:'', subtitle:'', linkType:'page', link:'match', filter:'', enabled:true };
    if (id) b = list.find(x => x.id === id) || b;
    const linkOptions = [
      { v: 'home', t: '首页' }, { v: 'match', t: '找缘分' }, { v: 'activity', t: '活动' },
      { v: 'school', t: '学堂' }, { v: 'psychtest', t: '心理测试' }, { v: 'mine', t: '我的' }, { v: 'contact', t: '联系我们' }, { v: 'vip', t: 'VIP服务' }
    ];
    const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');
    const linkType = b.linkType || 'page';
    // 图标当前是 emoji 还是 URL（/uploads/ 开头）？
    const isUrl = b.icon && /^\//.test(b.icon);
    const iconPreview = isUrl
      ? `<img src="${esc(b.icon)}" style="width:42px;height:42px;object-fit:contain;border-radius:8px;background:#f5f5f5;">`
      : `<span style="font-size:30px;line-height:1;">${esc(b.icon || '💖')}</span>`;
    const body = `
      <div class="form-row">
        <div class="form-group" style="flex:0 0 90px;"><label>图标</label>
          <input id="qe_icon" value="${esc(b.icon)}" placeholder="💖" style="font-size:24px;text-align:center;padding:6px;">
          <small style="color:var(--text-3);">emoji 字符</small>
        </div>
        <div class="form-group" style="flex:0 0 130px;"><label>或上传图片</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <div id="qe_iconPreview" style="width:42px;height:42px;border-radius:8px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px dashed var(--border);">${iconPreview}</div>
            <button type="button" class="btn" onclick="document.getElementById('qe_iconFile').click()">📁 选择</button>
            <button type="button" class="btn" onclick="Admin._clearQeIcon()">清空</button>
            <input type="file" id="qe_iconFile" accept="image/*" style="display:none;">
          </div>
          <small style="color:var(--text-3);">png/jpg/svg &lt; 1MB</small>
        </div>
        <div class="form-group" style="flex:0 0 100px;"><label>主题色</label><input type="color" id="qe_color" value="${b.color || '#ff5a6e'}"></div>
        <div class="form-group" style="flex:1;"><label>标题</label><input id="qe_title" value="${esc(b.title)}" placeholder="如：找缘分"></div>
        <div class="form-group" style="flex:1;"><label>副标题</label><input id="qe_subtitle" value="${esc(b.subtitle)}" placeholder="如：海量本地优质会员"></div>
        <div class="form-group" style="flex:0 0 100px;"><label>排序（数字越小越靠前）</label><input id="qe_sortOrder" type="number" value="${b.sortOrder || 0}" placeholder="0"></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:0 0 140px;"><label>跳转类型</label>
          <select id="qe_linkType" onchange="Admin._toggleQeLinkType()">
            <option value="page" ${linkType==='page'?'selected':''}>站内页面</option>
            <option value="url"  ${linkType==='url' ?'selected':''}>外部链接</option>
          </select>
        </div>
        <div class="form-group" id="qe_linkPageBox" style="flex:1;${linkType==='url'?'display:none;':''}"><label>选择页面</label>
          <select id="qe_link" onchange="Admin._toggleQeFilter()">
            ${linkOptions.map(o => `<option value="${o.v}" ${b.link===o.v?'selected':''}>${o.t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="qe_filterBox" style="flex:0 0 120px;${b.link!=='match'?'display:none;':''}"><label>筛选条件</label>
          <select id="qe_filter">
            <option value="">无</option>
            <option value="男" ${b.filter==='男'?'selected':''}>找男生</option>
            <option value="女" ${b.filter==='女'?'selected':''}>找女生</option>
          </select>
        </div>
        <div class="form-group" id="qe_articleBox" style="flex:1;${b.link!=='school'?'display:none;':''}"><label>选择文章（学堂类型时可选）</label>
          <select id="qe_articleId">
            <option value="">请选择文章</option>
          </select>
        </div>
        <div class="form-group" id="qe_linkUrlBox" style="flex:1;${linkType==='page'?'display:none;':''}"><label>外部链接</label>
          <input id="qe_linkUrl" value="${esc(linkType==='url' ? b.link : '')}" placeholder="https://example.com">
        </div>
        <div class="form-group" style="flex:0 0 90px;"><label>启用</label>
          <div style="padding:9px 0;">
            <span id="qe_enabled" class="switch ${b.enabled !== false ? 'on' : ''}" onclick="this.classList.toggle('on')"></span>
            <span style="margin-left:6px; color:var(--text-2); font-size:12px;" id="qe_enabled_text">${b.enabled !== false ? '已启用' : '已禁用'}</span>
          </div>
        </div>
      </div>
    `;
    this._openModal(id ? '编辑快捷入口' : '新增快捷入口', body, () => this._saveQuickEntry(id));
    // 绑定文件选择
    const fileInput = document.getElementById('qe_iconFile');
    if (fileInput) fileInput.onchange = (e) => this._uploadQeIcon(e.target.files[0]);

    // 加载文章列表（用于学堂类型选择具体文章）
    this._loadArticleListForQuickEntry(b);
  },
  // 加载文章列表（用于快捷入口配置中选择具体文章）
  async _loadArticleListForQuickEntry(currentEntry) {
    try {
      const res = await this.api('/api/articles?pageSize=100');
      const select = document.getElementById('qe_articleId');
      if (!select) return;

      if (res.code === 0 && res.data && res.data.list) {
        const articles = res.data.list;
        select.innerHTML = '<option value="">请选择文章</option>' +
          articles.map(a => `<option value="${a.id}" ${(currentEntry && currentEntry.articleId === a.id) ? 'selected' : ''}>${a.title || '（无标题）'}</option>`).join('');
      } else {
        select.innerHTML = '<option value="">加载失败</option>';
      }
    } catch (e) {
      console.error('加载文章列表失败', e);
      const select = document.getElementById('qe_articleId');
      if (select) select.innerHTML = '<option value="">加载失败</option>';
    }
  },
  async _uploadQeIcon(file) {
    if (!file) return;
    if (!/^image\//i.test(file.type)) return this.toast('请选择图片文件');
    if (file.size > 1 * 1024 * 1024) return this.toast('图标不能超过 1MB');
    const reader = new FileReader();
    reader.onload = async () => {
      // 复用现有 /api/admin/upload 端点（base64 → /uploads/）
      const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
      if (r.code === 0) {
        const url = r.data.url;
        document.getElementById('qe_icon').value = url;
        document.getElementById('qe_iconPreview').innerHTML = `<img src="${url}" style="width:42px;height:42px;object-fit:contain;border-radius:8px;">`;
        this.toast('图标已上传');
      } else {
        this.toast(r.msg || '上传失败');
      }
    };
    reader.readAsDataURL(file);
  },
  _clearQeIcon() {
    document.getElementById('qe_icon').value = '';
    document.getElementById('qe_iconPreview').innerHTML = '<span style="color:var(--text-3);font-size:12px;">无</span>';
  },
  _toggleQeLinkType() {
    const isUrl = document.getElementById('qe_linkType').value === 'url';
    document.getElementById('qe_linkPageBox').style.display = isUrl ? 'none' : '';
    document.getElementById('qe_linkUrlBox').style.display  = isUrl ? '' : 'none';
  },
  _toggleQeFilter() {
    const page = document.getElementById('qe_link').value;
    document.getElementById('qe_filterBox').style.display = page === 'match' ? '' : 'none';
    document.getElementById('qe_articleBox').style.display = page === 'school' ? '' : 'none';
  },
  async _saveQuickEntry(id) {
    const linkType = document.getElementById('qe_linkType').value;
    const link = linkType === 'url'
      ? (document.getElementById('qe_linkUrl').value || '').trim()
      : document.getElementById('qe_link').value;
    const body = {
      id: id || ('mb_' + Date.now().toString(36) + Math.random().toString(36).slice(2,6)),
      icon: document.getElementById('qe_icon').value || '💖',
      color: document.getElementById('qe_color').value || '#ff5a6e',
      title: (document.getElementById('qe_title').value || '').trim(),
      subtitle: (document.getElementById('qe_subtitle').value || '').trim(),
      linkType,
      link,
      filter: document.getElementById('qe_filter') ? (document.getElementById('qe_filter').value || '') : '',
      articleId: (link === 'school') ? (document.getElementById('qe_articleId') ? (document.getElementById('qe_articleId').value || '') : '') : '',
      enabled: document.getElementById('qe_enabled').classList.contains('on'),
      sortOrder: parseInt(document.getElementById('qe_sortOrder').value) || 0
    };
    if (!body.title) return this.toast('请填写标题');
    if (linkType === 'url' && !body.link) return this.toast('请填写外部链接 URL');
    // 单条保存：合并到现有列表
    const list = (this._quickList || []).filter(b => b.id !== body.id);
    list.push(body);
    const r = await this.api('/api/admin/match-banners', { method: 'POST', body: { list } });
    if (r.code === 0) { this.toast('保存成功'); this._closeModal(); this.renderQuickEntries(); }
    else this.toast(r.msg || '保存失败');
  },
  async deleteQuickEntry(id) {
    if (!confirm('确定删除该快捷入口吗？')) return;
    const r = await this.api('/api/admin/match-banners', { method: 'POST', body: { list: (this._quickList || []).filter(b => b.id !== id) } });
    if (r.code === 0) { this.toast('删除成功'); this.renderQuickEntries(); }
    else this.toast(r.msg || '删除失败');
  },

  // ===== 今日之星（列表+点编辑弹 modal） =====
  async renderStarConfig() {
    const content = document.getElementById('pageContent');
    if (content) content.innerHTML = '<div class="loading">加载中...</div>';
    try {
    // 拉全量配置（含已下架的，便于后台管理查看）
    const [star, allUsers] = await Promise.all([this.api('/api/admin/star/full'), this.api('/api/admin/users')]);
    if (star.code !== 0) { if (content) content.innerHTML = '<div class="empty-tip">加载失败：' + (star.msg || '未知错误') + '</div>'; return; }
    const cfg = star.data;
    const userList = allUsers.data.list;
    this._starUserList = userList;
    this._starItems = JSON.parse(JSON.stringify(cfg.items || []));
    this._starFilterStatus = this._starFilterStatus || 'all'; // 默认显示全部

    const now = Date.now();
    // 根据筛选状态过滤
    const filteredItems = (this._starItems || []).filter((it, i) => {
      if (this._starFilterStatus === 'all') return true;
      const start = it.timeStart ? new Date(it.timeStart).getTime() : 0;
      const end = it.timeEnd ? new Date(it.timeEnd).getTime() : 0;
      if (this._starFilterStatus === 'pending') return now < start;
      if (this._starFilterStatus === 'active') return now >= start && now < end;
      if (this._starFilterStatus === 'expired') return now >= end;
      return true;
    });

    const rows = filteredItems.map((it, i) => {
      const u = it.userId ? userList.find(x => x.id === it.userId) : null;
      const start = it.timeStart ? new Date(it.timeStart).getTime() : 0;
      const end = it.timeEnd ? new Date(it.timeEnd).getTime() : 0;
      let statusLabel = '⏳ 待开始', statusColor = '#999';
      if (now >= end) { statusLabel = '已下架'; statusColor = '#999'; }
      else if (now >= start) { statusLabel = '展示中'; statusColor = 'var(--green)'; }
      const fmt = (s) => { if (!s) return '-'; const d = new Date(s); return d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g,'-').slice(0,16); };
      return `<tr>
        <td><img src="${u ? u.avatar : ''}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;background:#eee;"></td>
        <td>${u ? u.nickname : '<span style="color:#e74c3c;">已删除</span>'}</td>
        <td>${u ? u.gender + ' · ' + (u.age || '-') + '岁' : '-'}</td>
        <td>${u ? (u.city || '-') : '-'}</td>
        <td style="font-size:12px;">${fmt(it.timeStart)}<br>~ ${fmt(it.timeEnd)}</td>
        <td><span class="tag" style="color:${statusColor};border-color:${statusColor};">${statusLabel}</span></td>
        <td>
          <button class="btn btn-primary" onclick="Admin.editStarItem(${i})">编辑</button>
          <button class="btn btn-danger" onclick="Admin.removeStarItem(${i})">删除</button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="7"><div class="empty"><div class="icon">⭐</div>暂无配置，点击右上角"+ 添加会员"开始</div></td></tr>';

    const statusFilter = [
      { v: 'all', t: '全部' },
      { v: 'pending', t: '待开始' },
      { v: 'active', t: '展示中' },
      { v: 'expired', t: '已下架' }
    ];

    content.innerHTML = `<div class="panel">
      <div class="panel-header"><h3>今日之星配置</h3>
        <button class="btn btn-primary" onclick="Admin.addStarItem()">+ 添加会员</button>
      </div>
      <div class="panel-body">
        <div class="form-row">
          <div class="form-group" style="flex:1;"><label>区块标题</label><input id="st_title" value="${(cfg.title || '今日之星').replace(/"/g,'&quot;')}"></div>
          <div class="form-group" style="flex:1;"><label>区块副标题</label><input id="st_subtitle" value="${(cfg.subtitle || '').replace(/"/g,'&quot;')}"></div>
          <div class="form-group" style="flex:0 0 200px;"><label>状态筛选</label>
            <select id="st_statusFilter" onchange="Admin._changeStarFilter(this.value)">
              ${statusFilter.map(o => `<option value="${o.v}" ${this._starFilterStatus===o.v?'selected':''}>${o.t}</option>`).join('')}
            </select>
          </div>
        </div>
        <table>
          <thead><tr><th style="width:50px;">头像</th><th>昵称</th><th>性别/年龄</th><th>城市</th><th>展示时间</th><th>状态</th><th style="width:160px;">操作</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <button class="primary-btn" style="margin-top: 14px;" onclick="Admin.saveStarConfig()">保存全部配置</button>
        <p style="color:var(--text-3); margin-top: 10px; font-size: 12px;">
          提示：每条配置包含一位会员和一段展示时间，超出结束时间会自动从前端下架；保存时若任意两条记录的时间区间重叠，将报错要求修改。
        </p>
      </div>
    </div>
    <div id="starPickerModal" class="modal" style="display:none;">
      <div class="modal-mask" onclick="document.getElementById('starPickerModal').style.display='none'"></div>
      <div class="modal-card" style="max-width:520px;max-height:80vh;overflow-y:auto;">
        <div class="modal-title">选择会员</div>
        <div style="display:flex; gap:8px; margin-bottom: 10px;">
          <input id="st_search_kw" placeholder="输入用户ID / 昵称 / 注册邮箱" style="flex:1; padding:9px 12px; border:1px solid var(--border); border-radius:8px;" onkeydown="if(event.key==='Enter'){Admin.searchStarUser()}">
          <button class="btn btn-primary" onclick="Admin.searchStarUser()">搜索</button>
        </div>
        <div id="starPickerList" class="user-list-pick"><div style="color:var(--text-3); padding:20px; text-align:center;">请输入关键词搜索</div></div>
        <div class="modal-close" onclick="document.getElementById('starPickerModal').style.display='none'">×</div>
      </div>
    </div>`;
    } catch (e) {
      console.error('[renderStarConfig]', e);
      if (content) content.innerHTML = '<div class="empty-tip" style="color:#e74c3c;">加载今日之星失败：' + (e.message || e) + '<br><small>' + (e.stack || '').split('\n').slice(0,3).join('<br>') + '</small></div>';
      this.toast('加载失败: ' + e.message);
    }
  },
  _changeStarFilter(status) {
    this._starFilterStatus = status;
    this.renderStarConfig();
  },
  // 选择会员后调用 → 弹出 modal 让填时间
  addStarItem() {
    this._starItems = this._starItems || [];
    this._starPickIdx = this._starItems.length;
    this._starItems.push({ id: '', userId: '', timeStart: '', timeEnd: '' });
    // 先选会员
    this.pickStarUser(this._starPickIdx);
  },
  async editStarItem(idx) {
    this._starPickIdx = idx;
    const it = (this._starItems || [])[idx] || { userId: '', timeStart: '', timeEnd: '' };
    const u = it.userId ? this._starUserList.find(x => x.id === it.userId) : null;
    const toLocal = this.toLocal.bind(this);
    const body = `
      <div style="display:flex; gap:14px; align-items:center; margin-bottom: 14px;">
        <div id="st-slot" data-idx="${idx}" style="text-align:center;cursor:pointer;flex:0 0 90px;" onclick="Admin.pickStarUser(${idx})">
          <div style="width:64px;height:64px;border-radius:50%;margin:0 auto 4px;overflow:hidden;background:#eee;">${u ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;">` : '<div style="line-height:64px;color:#aaa;">+</div>'}</div>
          <div style="font-size:12px;">${u ? u.nickname : '点击选择会员'}</div>
          <input type="hidden" id="st_userId" value="${u ? u.id : ''}">
        </div>
        <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
          <div class="form-group" style="margin:0;"><label>展示开始时间</label><input type="datetime-local" id="st_start" value="${toLocal(it.timeStart)}"></div>
          <div class="form-group" style="margin:0;"><label>展示结束时间（超过则自动下架）</label><input type="datetime-local" id="st_end" value="${toLocal(it.timeEnd)}"></div>
        </div>
      </div>
    `;
    this._openModal('编辑今日之星', body, () => this._saveStarItem());
  },
  async _saveStarItem() {
    const idx = this._starPickIdx;
    const userId = document.getElementById('st_userId').value;
    const start = document.getElementById('st_start').value;
    const end = document.getElementById('st_end').value;
    if (!userId) return this.toast('请选择会员');
    if (!start || !end) return this.toast('请填写完整的展示时间区间');
    this._starItems[idx] = {
      ...(this._starItems[idx] || {}),
      userId,
      timeStart: start,
      timeEnd: end
    };
    // 用 saveStarConfig 走全套保存
    await this.saveStarConfig();
  },
  async removeStarItem(idx) {
    if (!confirm('确定删除该条吗？')) return;
    this._starItems = (this._starItems || []);
    this._starItems.splice(idx, 1);
    // 通过 star DELETE API 删除已保存的
    const it = (this._starItems && this._starItems[idx]) || null;
    await this.saveStarConfig();
  },
  _starPickIdx: null,
  pickStarUser(idx) {
    this._starPickIdx = idx;
    document.getElementById('starPickerModal').style.display = 'flex';
    document.getElementById('st_search_kw').value = '';
    document.getElementById('st_search_kw').focus();
    // 默认显示前 10 个
    this._renderStarPickerList(this._starUserList.slice(0, 10));
  },
  async searchStarUser() {
    const kw = document.getElementById('st_search_kw').value.trim();
    if (!kw) { this._renderStarPickerList(this._starUserList.slice(0, 10)); return; }
    const r = await this.api('/api/admin/star/search-users?keyword=' + encodeURIComponent(kw));
    if (r.code === 0) this._renderStarPickerList(r.data);
    else this.toast(r.msg);
  },
  _renderStarPickerList(list) {
    const box = document.getElementById('starPickerList');
    if (!list.length) { box.innerHTML = '<div style="color:var(--text-3); padding:20px; text-align:center;">没有匹配的用户</div>'; return; }
    box.innerHTML = list.map(u => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer;" onclick="Admin.confirmStarUser('${u.id}')">
        <img src="${u.avatar}" style="width:40px;height:40px;border-radius:50%;">
        <div style="flex:1;">
          <div>${u.nickname || '(未设置昵称)'}</div>
          <div style="font-size:12px;color:var(--text-3);">ID: ${u.userId || u.id} · ${u.gender} · ${u.age || (u.form && u.form.age) || ''}岁 · ${u.city || (u.form && u.form.currentCity) || ''}</div>
        </div>
      </div>
    `).join('');
  },
  confirmStarUser(id) {
    const u = this._starUserList.find(x => x.id === id);
    if (!u) return this.toast('用户不存在');
    this._starItems = this._starItems || [];
    this._starItems[this._starPickIdx] = this._starItems[this._starPickIdx] || {};
    this._starItems[this._starPickIdx].userId = u.id;
    this._starItems[this._starPickIdx].id = this._starItems[this._starPickIdx].id || '';
    
    // 关闭用户选择modal
    document.getElementById('starPickerModal').style.display = 'none';
    
    // 重新打开编辑modal，显示已选择的用户
    this.editStarItem(this._starPickIdx);
  },
  async saveStarConfig() {
    // 直接从 this._starItems 获取数据，而不是从 DOM 读取
    const items = (this._starItems || []).map(it => ({
      id: it.id || '',
      userId: it.userId || '',
      timeStart: it.timeStart || '',
      timeEnd: it.timeEnd || ''
    }));
    if (items.length === 0) return this.toast('请至少添加一条会员配置');
    // 基础校验
    for (let i = 0; i < items.length; i++) {
      if (!items[i].userId) return this.toast('第 ' + (i + 1) + ' 条未选择会员');
      if (!items[i].timeStart || !items[i].timeEnd) return this.toast('第 ' + (i + 1) + ' 条请填写完整的展示时间区间');
    }
    const body = {
      title: document.getElementById('st_title').value,
      subtitle: document.getElementById('st_subtitle').value,
      items
    };
    const r = await this.api('/api/admin/star', { method: 'POST', body });
    if (r.code === 0) { this.toast('保存成功'); this.renderStarConfig(); }
    else this.toast(r.msg);
  },
  async removeStarConfigItem(itemId) {
    if (!itemId) { this.toast('该条还未保存，请直接点"删除"按钮移除'); return; }
    if (!confirm('确认删除该条配置？')) return;
    const r = await this.api('/api/admin/star/item/' + itemId, { method: 'DELETE' });
    if (r.code === 0) { this.toast('已删除'); this.renderStarConfig(); }
    else this.toast(r.msg);
  },

  // ===== VIP 等级管理（列表+点编辑弹 modal） =====
  async renderVip() {
    const content = document.getElementById('pageContent');
    content.innerHTML = `<div class="panel">
      <div class="panel-header">
        <div style="display:flex;gap:12px;">
          <button class="btn btn-primary" id="vipTabLevels" onclick="Admin._switchVipTab('levels')">📋 等级管理</button>
          <button class="btn" id="vipTabPage" onclick="Admin._switchVipTab('page')">🎨 服务页面</button>
        </div>
      </div>
      <div id="vipLevelsPanel"></div>
      <div id="vipPagePanel" style="display:none;"></div>
    </div>`;
    this._renderVipLevels();
    this._renderVipServicePage();
  },
  _switchVipTab(tab) {
    document.getElementById('vipLevelsPanel').style.display = tab === 'levels' ? '' : 'none';
    document.getElementById('vipPagePanel').style.display = tab === 'page' ? '' : 'none';
    document.getElementById('vipTabLevels').className = tab === 'levels' ? 'btn btn-primary' : 'btn';
    document.getElementById('vipTabPage').className = tab === 'page' ? 'btn btn-primary' : 'btn';
  },
  async _renderVipLevels() {
    const res = await this.api('/api/admin/vip/levels');
    if (res.code !== 0) return;
    const list = res.data;
    this._vipList = list;
    document.getElementById('vipLevelsPanel').innerHTML = `
      <div class="panel-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <p style="color:var(--text-2);margin:0;">设置每个 VIP 等级的名字、颜色、价格、权益。</p>
          <button class="btn btn-primary" onclick="Admin.editVip()">+ 新增等级</button>
        </div>
        <table>
          <thead><tr><th style="width:60px;">等级</th><th style="width:50px;">色卡</th><th>名称</th><th>价格</th><th>权益条数</th><th style="width:160px;">操作</th></tr></thead>
          <tbody>${list.map(v => `
            <tr>
              <td><b>LV${v.level}</b></td>
              <td><div style="width:28px;height:28px;border-radius:6px;background:${v.color || '#999'};"></div></td>
              <td>${v.name || '-'}</td>
              <td><b style="color:${v.price > 0 ? 'var(--primary)' : 'var(--green)'};">${v.price > 0 ? '¥' + v.price : '免费'}</b></td>
              <td><span class="tag">${(v.privileges || []).length} 条</span></td>
              <td>
                <button class="btn btn-primary" onclick="Admin.editVip(${v.level})">编辑</button>
                <button class="btn btn-danger" onclick="Admin.deleteVip(${v.level})">删除</button>
              </td>
            </tr>
          `).join('') || '<tr><td colspan="6"><div class="empty"><div class="icon">👑</div>暂无等级，点击右上角"新增等级"开始</div></td></tr>'}</tbody>
        </table>
      </div>`;
  },
  // ===== VIP服务页面编辑器 =====
  async _renderVipServicePage() {
    const res = await this.api('/api/admin/vip/service-config');
    if (res.code !== 0) return;
    const c = res.data || {};
    const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');
    const jstr = (v) => JSON.stringify(v || '');
    const panel = document.getElementById('vipPagePanel');
    panel.innerHTML = `
      <div class="panel-body">
        <p style="color:var(--text-2);margin-bottom:16px;font-size:13px;">
          编辑「定制会员」页面的所有内容：文案、图标、Banner图片等。修改后保存即可在前端生效。
        </p>

        <!-- 基础信息 -->
        <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px;"><legend style="padding:0 8px;font-size:13px;font-weight:600;color:var(--primary);">基础信息</legend>
          <div class="form-row">
            <div class="form-group"><label>页面标题（导航栏显示）</label><input id="vs_pageTitle" value="${esc(c.pageTitle)}" placeholder="如：定制会员"></div>
            <div class="form-group"><label>Tab1名称</label><input id="vs_tab1Name" value="${esc(c.tab1Name)}" placeholder="如：定制会员"></div>
            <div class="form-group"><label>Tab2名称</label><input id="vs_tab2Name" value="${esc(c.tab2Name)}" placeholder="如：关于我们"></div>
          </div>
        </fieldset>

        <!-- Banner -->
        <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px;"><legend style="padding:0 8px;font-size:13px;font-weight:600;color:var(--primary);">顶部Banner</legend>
          <div class="form-row">
            <div class="form-group"><label>Banner图片（留空用渐变背景）</label>
              <div style="display:flex;gap:8px;align-items:center;">
                <input id="vs_bannerImage" value="${esc(c.bannerImage)}" placeholder="/uploads/xxx.jpg" style="flex:1;">
                <button class="btn" onclick="Admin._uploadVipBanner()">📤 上传</button>
                ${c.bannerImage ? '<img src="'+esc(c.bannerImage)+'" id="vs_bannerPreview" style="height:36px;border-radius:6px;border:1px solid var(--border);">' : '<img id="vs_bannerPreview" style="height:36px;border-radius:6px;border:1px solid var(--border);display:none;">'}
              </div>
              <input type="file" id="vs_bannerFile" accept="image/*" style="display:none;" onchange="Admin._uploadVipBannerFile(this)">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Banner主标题（支持\\n换行）</label><input id="vs_bannerTitle" value="${esc(c.bannerTitle)}" placeholder="爱只能定制&#10;不可复制"></div>
            <div class="form-group"><label>Banner副标题</label><input id="vs_bannerSubtitle" value="${esc(c.bannerSubtitle)}" placeholder="可选，留空不显示"></div>
          </div>
        </fieldset>

        <!-- 适合人群 -->
        <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px;"><legend style="padding:0 8px;font-size:13px;font-weight:600;color:var(--primary);">适合人群（4宫格）</legend>
          <div class="form-group"><label>区域标题</label><input id="vs_section1Title" value="${esc(c.section1Title)}" placeholder="哪些人适合1对1定制服务"></div>
          <div id="vs_crowdItems">${this._buildCrowdEditor(c.crowdItems)}</div>
          <button class="btn" style="font-size:12px;margin-top:8px;" onclick="Admin._addCrowdItem()">+ 添加一项</button>
        </fieldset>

        <!-- 专属服务列表 -->
        <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px;"><legend style="padding:0 8px;font-size:13px;font-weight:600;color:var(--primary);">专属服务列表</legend>
          <div class="form-group"><label>区域标题</label><input id="vs_section2Title" value="${esc(c.section2Title)}" placeholder="专属服务 祝你脱单"></div>
          <div id="vs_serviceItems">${this._buildServiceEditor(c.serviceItems)}</div>
          <button class="btn" style="font-size:12px;margin-top:8px;" onclick="Admin._addServiceItem()">+ 添加一项</button>
        </fieldset>

        <!-- Tab2 页面内容（与Tab1结构一致） -->
        <fieldset style="border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px;"><legend style="padding:0 8px;font-size:13px;font-weight:600;color:var(--primary);">Tab2 页面内容</legend>

          <!-- Tab2 Banner -->
          <fieldset style="border:1px dashed #bbb;border-radius:8px;padding:12px;margin-bottom:12px;"><legend style="padding:0 6px;font-size:12px;color:var(--text-2);">Tab2 Banner</legend>
            <div class="form-row">
              <div class="form-group"><label>Banner图片（留空用渐变背景）</label>
                <div style="display:flex;gap:8px;align-items:center;">
                  <input id="vs_tab2BannerImage" value="${esc(c.tab2BannerImage)}" placeholder="/uploads/xxx.jpg" style="flex:1;">
                  <button class="btn" onclick="Admin._uploadTab2Banner()">📤 上传</button>
                  ${c.tab2BannerImage ? '<img src="'+esc(c.tab2BannerImage)+'" id="vs_tab2BannerPreview" style="height:36px;border-radius:6px;border:1px solid var(--border);">' : '<img id="vs_tab2BannerPreview" style="height:36px;border-radius:6px;border:1px solid var(--border);display:none;">'}
                </div>
                <input type="file" id="vs_tab2BannerFile" accept="image/*" style="display:none;" onchange="Admin._uploadTab2BannerFile(this)">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group"><label>Banner主标题（支持\\n换行）</label><input id="vs_tab2BannerTitle" value="${esc(c.tab2BannerTitle)}" placeholder="Tab2主标题"></div>
              <div class="form-group"><label>Banner副标题</label><input id="vs_tab2BannerSubtitle" value="${esc(c.tab2BannerSubtitle)}" placeholder="可选"></div>
            </div>
          </fieldset>

          <!-- Tab2 适合人群 -->
          <fieldset style="border:1px dashed #bbb;border-radius:8px;padding:12px;margin-bottom:12px;"><legend style="padding:0 6px;font-size:12px;color:var(--text-2);">Tab2 适合人群</legend>
            <div class="form-group"><label>区域标题</label><input id="vs_tab2Section1Title" value="${esc(c.tab2Section1Title)}" placeholder="哪些人适合Tab2服务"></div>
            <div id="vs_tab2CrowdItems">${this._buildTab2CrowdEditor(c.tab2CrowdItems)}</div>
            <button class="btn" style="font-size:12px;margin-top:8px;" onclick="Admin._addTab2CrowdItem()">+ 添加一项</button>
          </fieldset>

          <!-- Tab2 专属服务 -->
          <fieldset style="border:1px dashed #bbb;border-radius:8px;padding:12px;margin-bottom:12px;"><legend style="padding:0 6px;font-size:12px;color:var(--text-2);">Tab2 专属服务列表</legend>
            <div class="form-group"><label>区域标题</label><input id="vs_tab2Section2Title" value="${esc(c.tab2Section2Title)}" placeholder="Tab2专属服务"></div>
            <div id="vs_tab2ServiceItems">${this._buildTab2ServiceEditor(c.tab2ServiceItems)}</div>
            <button class="btn" style="font-size:12px;margin-top:8px;" onclick="Admin._addTab2ServiceItem()">+ 添加一项</button>
          </fieldset>

        </fieldset>

        <div class="panel-footer">
          <button class="btn btn-primary" onclick="Admin.saveVipServiceConfig()">💾 保存所有配置</button>
        </div>
      </div>`;
  },
  _buildCrowdEditor(items) {
    const list = Array.isArray(items) ? items : [];
    return list.map((it, i) => `
      <div class="form-row vs-crowd-row" data-idx="${i}" style="background:#fafafa;padding:10px;border-radius:8px;margin-bottom:8px;position:relative;">
        <span style="position:absolute;top:4px;right:6px;color:#ff4d4f;cursor:pointer;font-size:16px;line-height:1;" onclick="this.parentElement.remove()">✕</span>
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <div style="flex:1;">
            <label style="font-size:11px;color:var(--text-3);">图标</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input name="crowd_icon_${i}" value="${(it.icon||'').replace(/"/g,'&quot;')}" style="font-size:12px;flex:1;">
              <button class="btn" onclick="Admin._uploadCrowdIcon(${i})">📤</button>
            </div>
          </div>
          <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">标题</label><input name="crowd_title_${i}" value="${(it.title||'').replace(/"/g,'&quot;')}"></div>
          <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">描述</label><input name="crowd_desc_${i}" value="${(it.desc||'').replace(/"/g,'&quot;')}"></div>
        </div>
        <input type="file" id="crowd_icon_file_${i}" accept="image/*" style="display:none;" onchange="Admin._uploadCrowdIconFile(${i}, this)">
      </div>`).join('');
  },
  _addCrowdItem() {
    const container = document.getElementById('vs_crowdItems');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'form-row vs-crowd-row';
    div.dataset.idx = idx;
    div.style.cssText = 'background:#fafafa;padding:10px;border-radius:8px;margin-bottom:8px;position:relative;';
    div.innerHTML = `<span style="position:absolute;top:4px;right:6px;color:#ff4d4f;cursor:pointer;font-size:16px;line-height:1;" onclick="this.parentElement.remove()">✕</span>
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="flex:1;">
          <label style="font-size:11px;color:var(--text-3);">图标</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input name="crowd_icon_${idx}" value="" style="font-size:12px;flex:1;">
            <button class="btn" onclick="Admin._uploadCrowdIcon(${idx})">📤</button>
          </div>
        </div>
        <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">标题</label><input name="crowd_title_${idx}" value=""></div>
        <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">描述</label><input name="crowd_desc_${idx}" value=""></div>
      </div>
      <input type="file" id="crowd_icon_file_${idx}" accept="image/*" style="display:none;" onchange="Admin._uploadCrowdIconFile(${idx}, this)">`;
    container.appendChild(div);
  },
  _buildServiceEditor(items) {
    const list = Array.isArray(items) ? items : [];
    return list.map((it, i) => `
      <div class="form-row vs-svc-row" data-idx="${i}" style="background:#fafafa;padding:10px;border-radius:8px;margin-bottom:8px;position:relative;">
        <span style="position:absolute;top:4px;right:6px;color:#ff4d4f;cursor:pointer;font-size:16px;line-height:1;" onclick="this.parentElement.remove()">✕</span>
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <div style="flex:1;">
            <label style="font-size:11px;color:var(--text-3);">图标</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input name="svc_icon_${i}" value="${(it.icon||'').replace(/"/g,'&quot;')}" style="font-size:12px;flex:1;">
              <button class="btn" onclick="Admin._uploadSvcIcon(${i})">📤</button>
            </div>
          </div>
          <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">标题</label><input name="svc_title_${i}" value="${(it.title||'').replace(/"/g,'&quot;')}"></div>
          <div style="flex:1.5;"><label style="font-size:11px;color:var(--text-3);">描述</label><input name="svc_desc_${i}" value="${(it.desc||'').replace(/"/g,'&quot;')}"></div>
        </div>
        <input type="file" id="svc_icon_file_${i}" accept="image/*" style="display:none;" onchange="Admin._uploadSvcIconFile(${i}, this)">
      </div>`).join('');
  },
  _addServiceItem() {
    const container = document.getElementById('vs_serviceItems');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'form-row vs-svc-row';
    div.dataset.idx = idx;
    div.style.cssText = 'background:#fafafa;padding:10px;border-radius:8px;margin-bottom:8px;position:relative;';
    div.innerHTML = `<span style="position:absolute;top:4px;right:6px;color:#ff4d4f;cursor:pointer;font-size:16px;line-height:1;" onclick="this.parentElement.remove()">✕</span>
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">图标</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input name="svc_icon_${idx}" value="" style="font-size:12px;flex:1;">
            <button class="btn" onclick="Admin._uploadSvcIcon(${idx})">📤</button>
          </div>
        </div>
        <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">标题</label><input name="svc_title_${idx}" value=""></div>
        <div style="flex:1.5;"><label style="font-size:11px;color:var(--text-3);">描述</label><input name="svc_desc_${idx}" value=""></div>
      </div>
      <input type="file" id="svc_icon_file_${idx}" accept="image/*" style="display:none;" onchange="Admin._uploadSvcIconFile(${idx}, this)">`;
    container.appendChild(div);
  },
  // ===== Tab2 助手函数（与Tab1结构一致）=====
  _uploadTab2Banner() { document.getElementById('vs_tab2BannerFile').click(); },
  _uploadTab2BannerFile(input) {
    const file = input.files && input.files[0]; if (!file) return;
    if (!/^image\//i.test(file.type)) return this.toast('请选择图片文件');
    if (file.size > 5*1024*1024) return this.toast('图片不能超过5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', { method:'POST', body:{ image:reader.result, subdir:'uploads' }});
      if (r.code===0) { document.getElementById('vs_tab2BannerImage').value = r.data.url;
        const prev = document.getElementById('vs_tab2BannerPreview'); if(prev){ prev.src=r.data.url; prev.style.display=''; } this.toast('上传成功'); }
      else this.toast(r.msg||'上传失败');
    };
    reader.readAsDataURL(file);
  },
  _buildTab2CrowdEditor(items) {
    const list = Array.isArray(items) ? items : [];
    return list.map((it,i) => `
      <div class="form-row vs-crowd-row" data-idx="${i}" style="background:#fafafa;padding:10px;border-radius:8px;margin-bottom:8px;position:relative;">
        <span style="position:absolute;top:4px;right:6px;color:#ff4d4f;cursor:pointer;font-size:16px;line-height:1;" onclick="this.parentElement.remove()">✕</span>
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <div style="flex:1;">
            <label style="font-size:11px;color:var(--text-3);">图标</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input name="tab2_crowd_icon_${i}" value="${(it.icon||'').replace(/"/g,'&quot;')}" style="font-size:12px;flex:1;">
              <button class="btn" onclick="Admin._uploadTab2CrowdIcon(${i})">📤</button>
            </div>
          </div>
          <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">标题</label><input name="tab2_crowd_title_${i}" value="${(it.title||'').replace(/"/g,'&quot;')}"></div>
          <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">描述</label><input name="tab2_crowd_desc_${i}" value="${(it.desc||'').replace(/"/g,'&quot;')}"></div>
        </div>
        <input type="file" id="tab2_crowd_icon_file_${i}" accept="image/*" style="display:none;" onchange="Admin._uploadTab2CrowdIconFile(${i},this)">
      </div>`).join('');
  },
  _addTab2CrowdItem() {
    const container = document.getElementById('vs_tab2CrowdItems');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'form-row vs-crowd-row';
    div.dataset.idx = idx;
    div.style.cssText = 'background:#fafafa;padding:10px;border-radius:8px;margin-bottom:8px;position:relative;';
    div.innerHTML = `<span style="position:absolute;top:4px;right:6px;color:#ff4d4f;cursor:pointer;font-size:16px;line-height:1;" onclick="this.parentElement.remove()">✕</span>
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="flex:1;">
          <label style="font-size:11px;color:var(--text-3);">图标</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input name="tab2_crowd_icon_${idx}" value="" style="font-size:12px;flex:1;">
            <button class="btn" onclick="Admin._uploadTab2CrowdIcon(${idx})">📤</button>
          </div>
        </div>
        <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">标题</label><input name="tab2_crowd_title_${idx}" value=""></div>
        <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">描述</label><input name="tab2_crowd_desc_${idx}" value=""></div>
      </div>
      <input type="file" id="tab2_crowd_icon_file_${idx}" accept="image/*" style="display:none;" onchange="Admin._uploadTab2CrowdIconFile(${idx},this)">`;
    container.appendChild(div);
  },
  _buildTab2ServiceEditor(items) {
    const list = Array.isArray(items) ? items : [];
    return list.map((it,i) => `
      <div class="form-row vs-svc-row" data-idx="${i}" style="background:#fafafa;padding:10px;border-radius:8px;margin-bottom:8px;position:relative;">
        <span style="position:absolute;top:4px;right:6px;color:#ff4d4f;cursor:pointer;font-size:16px;line-height:1;" onclick="this.parentElement.remove()">✕</span>
        <div style="display:flex;gap:10px;align-items:flex-start;">
          <div style="flex:1;">
            <label style="font-size:11px;color:var(--text-3);">图标</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input name="tab2_svc_icon_${i}" value="${(it.icon||'').replace(/"/g,'&quot;')}" style="font-size:12px;flex:1;">
              <button class="btn" onclick="Admin._uploadTab2SvcIcon(${i})">📤</button>
            </div>
          </div>
          <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">标题</label><input name="tab2_svc_title_${i}" value="${(it.title||'').replace(/"/g,'&quot;')}"></div>
          <div style="flex:1.5;"><label style="font-size:11px;color:var(--text-3);">描述</label><input name="tab2_svc_desc_${i}" value="${(it.desc||'').replace(/"/g,'&quot;')}"></div>
        </div>
        <input type="file" id="tab2_svc_icon_file_${i}" accept="image/*" style="display:none;" onchange="Admin._uploadTab2SvcIconFile(${i},this)">
      </div>`).join('');
  },
  _addTab2ServiceItem() {
    const container = document.getElementById('vs_tab2ServiceItems');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'form-row vs-svc-row';
    div.dataset.idx = idx;
    div.style.cssText = 'background:#fafafa;padding:10px;border-radius:8px;margin-bottom:8px;position:relative;';
    div.innerHTML = `<span style="position:absolute;top:4px;right:6px;color:#ff4d4f;cursor:pointer;font-size:16px;line-height:1;" onclick="this.parentElement.remove()">✕</span>
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="flex:1;">
          <label style="font-size:11px;color:var(--text-3);">图标</label>
          <div style="display:flex;gap:6px;align-items:center;">
            <input name="tab2_svc_icon_${idx}" value="" style="font-size:12px;flex:1;">
            <button class="btn" onclick="Admin._uploadTab2SvcIcon(${idx})">📤</button>
          </div>
        </div>
        <div style="flex:1;"><label style="font-size:11px;color:var(--text-3);">标题</label><input name="tab2_svc_title_${idx}" value=""></div>
        <div style="flex:1.5;"><label style="font-size:11px;color:var(--text-3);">描述</label><input name="tab2_svc_desc_${idx}" value=""></div>
      </div>
      <input type="file" id="tab2_svc_icon_file_${idx}" accept="image/*" style="display:none;" onchange="Admin._uploadTab2SvcIconFile(${idx},this)">`;
    container.appendChild(div);
  },
  async saveVipServiceConfig() {
    const body = {
      pageTitle: document.getElementById('vs_pageTitle').value,
      tab1Name: document.getElementById('vs_tab1Name').value,
      tab2Name: document.getElementById('vs_tab2Name').value,
      bannerImage: document.getElementById('vs_bannerImage').value,
      bannerTitle: document.getElementById('vs_bannerTitle').value,
      bannerSubtitle: document.getElementById('vs_bannerSubtitle').value,
      section1Title: document.getElementById('vs_section1Title').value,
      section2Title: document.getElementById('vs_section2Title').value,
      // Tab2 配置（与Tab1结构一致）
      tab2BannerImage: document.getElementById('vs_tab2BannerImage').value,
      tab2BannerTitle: document.getElementById('vs_tab2BannerTitle').value,
      tab2BannerSubtitle: document.getElementById('vs_tab2BannerSubtitle').value,
      tab2Section1Title: document.getElementById('vs_tab2Section1Title').value,
      tab2Section2Title: document.getElementById('vs_tab2Section2Title').value,
      crowdItems: [],
      serviceItems: [],
      tab2CrowdItems: [],
      tab2ServiceItems: []
    };
    // 收集Tab1人群项
    document.querySelectorAll('#vs_crowdItems .vs-crowd-row').forEach(row => {
      const i = row.dataset.idx;
      body.crowdItems.push({
        icon: document.querySelector('[name="crowd_icon_' + i + '"]')?.value || '',
        title: document.querySelector('[name="crowd_title_' + i + '"]')?.value || '',
        desc: document.querySelector('[name="crowd_desc_' + i + '"]')?.value || ''
      });
    });
    // 收集Tab1服务项
    document.querySelectorAll('#vs_serviceItems .vs-svc-row').forEach(row => {
      const i = row.dataset.idx;
      body.serviceItems.push({
        icon: document.querySelector('[name="svc_icon_' + i + '"]')?.value || '',
        title: document.querySelector('[name="svc_title_' + i + '"]')?.value || '',
        desc: document.querySelector('[name="svc_desc_' + i + '"]')?.value || ''
      });
    });
    // 收集Tab2人群项
    document.querySelectorAll('#vs_tab2CrowdItems .vs-crowd-row').forEach(row => {
      const i = row.dataset.idx;
      body.tab2CrowdItems.push({
        icon: document.querySelector('[name="tab2_crowd_icon_' + i + '"]')?.value || '',
        title: document.querySelector('[name="tab2_crowd_title_' + i + '"]')?.value || '',
        desc: document.querySelector('[name="tab2_crowd_desc_' + i + '"]')?.value || ''
      });
    });
    // 收集Tab2服务项
    document.querySelectorAll('#vs_tab2ServiceItems .vs-svc-row').forEach(row => {
      const i = row.dataset.idx;
      body.tab2ServiceItems.push({
        icon: document.querySelector('[name="tab2_svc_icon_' + i + '"]')?.value || '',
        title: document.querySelector('[name="tab2_svc_title_' + i + '"]')?.value || '',
        desc: document.querySelector('[name="tab2_svc_desc_' + i + '"]')?.value || ''
      });
    });
    const r = await this.api('/api/admin/vip/service-config', { method: 'POST', body });
    if (r.code === 0) { this.toast('VIP服务页面配置已保存'); }
    else this.toast(r.msg || '保存失败');
  },
  async editVip(level) {
    const list = this._vipList || [];
    let v = { level: (Math.max(0, ...list.map(x => x.level || 0)) + 1), name: '新等级', color: '#999', price: 0, privileges: [''] };
    if (level != null) v = list.find(x => x.level === level) || v;
    const esc = (s) => String(s == null ? '' : s).replace(/"/g, '&quot;');
    const privText = Array.isArray(v.privileges) ? v.privileges.join('\n') : '';
    const body = `
      <div class="form-row">
        <div class="form-group" style="flex:0 0 120px;"><label>等级 (1-99)</label><input type="number" id="vp_level" value="${v.level}" min="1" max="99" ${level != null ? 'disabled' : ''}><small style="color:var(--text-3);">${level != null ? '等级不可修改' : '新建时指定'}</small></div>
        <div class="form-group" style="flex:0 0 120px;"><label>主题色</label><input type="color" id="vp_color" value="${v.color || '#999'}"></div>
        <div class="form-group" style="flex:1;"><label>名称</label><input id="vp_name" value="${esc(v.name)}" placeholder="如：金卡VIP"></div>
        <div class="form-group" style="flex:0 0 150px;"><label>价格(¥，0=免费)</label><input type="number" id="vp_price" value="${v.price}" min="0"></div>
      </div>
      <div class="form-group">
        <label>权益（每行一条）</label>
        <textarea id="vp_priv" style="min-height:140px;" placeholder="如：&#10;无限消息&#10;查看全国访客&#10;高级筛选">${esc(privText)}</textarea>
        <small style="color:var(--text-3);">按行拆分，会员详情页会逐条展示</small>
      </div>
    `;
    this._openModal(level != null ? '编辑 VIP 等级' : '新增 VIP 等级', body, () => this._saveVip(level));
  },
  async _saveVip(level) {
    const body = {
      level: parseInt(document.getElementById('vp_level').value) || 1,
      name: (document.getElementById('vp_name').value || '').trim(),
      color: document.getElementById('vp_color').value || '#999',
      price: parseFloat(document.getElementById('vp_price').value) || 0,
      privileges: (document.getElementById('vp_priv').value || '').split('\n').map(s => s.trim()).filter(Boolean)
    };
    if (!body.name) return this.toast('请填写名称');
    const r = await this.api('/api/admin/vip/level/save', { method: 'POST', body });
    if (r.code === 0) { this.toast('保存成功'); this._closeModal(); this.renderVip(); }
    else this.toast(r.msg || '保存失败');
  },
  async deleteVip(level) {
    if (!confirm(`确定删除 LV${level} 吗？此操作不可恢复`)) return;
    const r = await this.api('/api/admin/vip/level/delete', { method: 'POST', body: { level } });
    if (r.code === 0) { this.toast('删除成功'); this.renderVip(); }
    else this.toast(r.msg || '删除失败');
  },

  // ===== VIP 服务页面图片上传 =====
  _uploadVipBanner() {
    document.getElementById('vs_bannerFile').click();
  },
  _uploadVipBannerFile(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) return this.toast('请选择图片文件');
    if (file.size > 5 * 1024 * 1024) return this.toast('图片不能超过 5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
      if (r.code === 0) {
        document.getElementById('vs_bannerImage').value = r.data.url;
        const preview = document.getElementById('vs_bannerPreview');
        preview.src = r.data.url;
        preview.style.display = '';
        this.toast('上传成功');
      } else { this.toast(r.msg || '上传失败'); }
    };
    reader.readAsDataURL(file);
  },
  _uploadCrowdIcon(idx) {
    document.getElementById('crowd_icon_file_' + idx).click();
  },
  _uploadCrowdIconFile(idx, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) return this.toast('请选择图片文件');
    if (file.size > 5 * 1024 * 1024) return this.toast('图片不能超过 5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
      if (r.code === 0) {
        const inp = document.querySelector(`input[name="crowd_icon_${idx}"]`);
        if (inp) inp.value = r.data.url;
        this.toast('上传成功');
      } else { this.toast(r.msg || '上传失败'); }
    };
    reader.readAsDataURL(file);
  },
  _uploadSvcIcon(idx) {
    document.getElementById('svc_icon_file_' + idx).click();
  },
  _uploadSvcIconFile(idx, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) return this.toast('请选择图片文件');
    if (file.size > 5 * 1024 * 1024) return this.toast('图片不能超过 5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
      if (r.code === 0) {
        const inp = document.querySelector(`input[name="svc_icon_${idx}"]`);
        if (inp) inp.value = r.data.url;
        this.toast('上传成功');
      } else { this.toast(r.msg || '上传失败'); }
    };
    reader.readAsDataURL(file);
  },
  // ===== Tab2 上传助手 =====
  _uploadTab2CrowdIcon(idx) { document.getElementById('tab2_crowd_icon_file_' + idx).click(); },
  _uploadTab2CrowdIconFile(idx, input) {
    const file = input.files && input.files[0]; if (!file) return;
    if (!/^image\//.test(file.type)) return this.toast('请选择图片文件');
    if (file.size > 5*1024*1024) return this.toast('图片不能超过 5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', { method:'POST', body:{ image:reader.result, subdir:'uploads' }});
      if (r.code===0) { const inp = document.querySelector('input[name="tab2_crowd_icon_'+idx+'"]'); if(inp) inp.value = r.data.url; this.toast('上传成功'); }
      else this.toast(r.msg||'上传失败');
    };
    reader.readAsDataURL(file);
  },
  _uploadTab2SvcIcon(idx) { document.getElementById('tab2_svc_icon_file_' + idx).click(); },
  _uploadTab2SvcIconFile(idx, input) {
    const file = input.files && input.files[0]; if (!file) return;
    if (!/^image\//.test(file.type)) return this.toast('请选择图片文件');
    if (file.size > 5*1024*1024) return this.toast('图片不能超过 5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', { method:'POST', body:{ image:reader.result, subdir:'uploads' }});
      if (r.code===0) { const inp = document.querySelector('input[name="tab2_svc_icon_'+idx+'"]'); if(inp) inp.value = r.data.url; this.toast('上传成功'); }
      else this.toast(r.msg||'上传失败');
    };
    reader.readAsDataURL(file);
  },

  // ===== 协议管理 =====
  async renderAgreements() {
    const content = document.getElementById('pageContent');
    const res = await this.api('/api/admin/agreements');
    if (res.code !== 0) return;
    const ag = res.data;
    content.innerHTML = `<div class="panel">
      <div class="panel-header"><h3>协议管理</h3></div>
      <div class="panel-body">
        <div class="form-group"><label>VIP 协议标题</label><input id="ag_vip_title" value="${(ag.vip.title||'').replace(/"/g,'&quot;')}"></div>
        <div class="form-group"><label>VIP 协议内容</label><textarea id="ag_vip_content" style="min-height:200px;">${ag.vip.content||''}</textarea></div>
        <button class="primary-btn" onclick="Admin.saveAgreement('vip')">保存 VIP 协议</button>
        <hr style="margin:24px 0;">
        <div class="form-group"><label>用户协议标题</label><input id="ag_user_title" value="${(ag.user.title||'').replace(/"/g,'&quot;')}"></div>
        <div class="form-group"><label>用户协议内容</label><textarea id="ag_user_content" style="min-height:200px;">${ag.user.content||''}</textarea></div>
        <button class="primary-btn" onclick="Admin.saveAgreement('user')">保存用户协议</button>
      </div>
    </div>`;
  },
  async saveAgreement(type) {
    const title = document.getElementById('ag_' + type + '_title').value;
    const content = document.getElementById('ag_' + type + '_content').value;
    const r = await this.api('/api/admin/agreement/save', { method: 'POST', body: { type, title, content } });
    if (r.code === 0) this.toast('保存成功'); else this.toast(r.msg);
  },

  // ===== 问卷调查管理 =====
  async renderSurveys() {
    const c = document.getElementById('pageContent');
    c.innerHTML = '<div class="panel"><div class="panel-header"><h3>📋 问卷列表</h3><div style="display:flex;gap:8px;"><button class="btn btn-primary" onclick="Admin._editSurveyPage()">+ 新建问卷</button><button class="btn" style="background:#2eb872;color:#fff;border-color:#2eb872;" onclick="Admin._exportSelectedSurveys()">📥 导出勾选问卷</button></div></div><div class="panel-body">'
      + '<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px;padding:10px;background:#f0f7ff;border-radius:8px;">'
      + '<span style="font-weight:600;">🔍 按用户搜索：</span>'
      + '<input id="sv_userSearch" placeholder="输入用户昵称或ID" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;flex:0 0 200px;">'
      + '<button class="btn btn-sm btn-primary" onclick="Admin._searchByUser()">搜索</button>'
      + '<div id="sv_userSearchResult" style="flex:1;color:var(--text-2);font-size:13px;"></div>'
      + '</div>'
      + '<div id="surveyList" style="display:flex;flex-direction:column;gap:12px;"><div class="loading">加载中...</div></div></div></div>';
    const r = await this.api('/api/admin/surveys');
    if (r.code !== 0) return this.toast(r.msg);
    const surveys = r.data || [];
    this._allSurveys = surveys;
    const list = document.getElementById('surveyList');
    const statusMap = { active: '已发布', draft: '草稿', closed: '已关闭' };
    const statusCls = { active: 'btn-primary', draft: '', closed: '' };
    if (!surveys.length) { list.innerHTML = '<div class="empty">暂无问卷，点击上方按钮创建</div>'; return; }
    list.innerHTML = surveys.map(s => `
      <div style="display:flex;align-items:center;padding:14px;background:#fafafa;border-radius:10px;border:1px solid var(--border);gap:12px;">
        <input type="checkbox" class="sv_chk" data-id="${s.id}" style="flex:0 0 20px;transform:scale(1.2);">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:15px;">${s.title || '（无标题）'}</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px;">题目数：${(s.questions || []).length} | 类型：${s.type === 'interpretation' ? '解读型' : '普通型'} | 填写人数：${s._count || 0} | 状态：<span class="btn btn-sm ${statusCls[s.status]||''}">${statusMap[s.status]||s.status}</span></div>
        </div>
        <button class="btn btn-sm" onclick="Admin._viewSurveyStats('${s.id}')">📊 统计</button>
        <button class="btn btn-sm" onclick="Admin._editSurveyPage('${s.id}')">编辑</button>
        <button class="btn btn-sm" onclick="Admin._deleteSurvey('${s.id}')">删除</button>
      </div>`).join('');
  },
  _currentSurveyQuestions: [],
  _editingSurveyId: null,
  async _editSurveyPage(id) {
    let survey = null;
    if (id) {
      const r = await this.api('/api/admin/surveys');
      survey = (r.data || []).find(s => s.id === id);
    }
    survey = survey || { title: '', description: '', type: 'normal', status: 'draft', thankYouMessage: '感谢填写，我们会根据具体情况为您提供服务。', interpretation: '', questions: [], cover: '' };
    this._editingSurveyId = id || null;
    this._currentSurveyQuestions = survey.questions || [];
    const esc = v => String(v||'').replace(/"/g,'&quot;');
    const c = document.getElementById('pageContent');
    c.innerHTML = `<style>
.sv-edit-page{max-width:720px;}
.sv-edit-page .sv-section-title{font-size:16px;font-weight:700;margin:24px 0 12px;padding-bottom:8px;border-bottom:2px solid var(--primary);color:#333;display:flex;justify-content:space-between;align-items:center;}
.sv-edit-page .question-card{border:1px solid #e8e8e8;border-radius:12px;padding:20px;margin-bottom:16px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.04);}
.sv-edit-page .q-num{color:var(--primary);font-weight:700;font-size:18px;margin-bottom:4px;}
.sv-edit-page .q-input{width:100%;padding:10px 14px;border:1px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box;margin-bottom:10px;background:#fafafa;}
.sv-edit-page .q-input:focus{outline:none;border-color:var(--primary);background:#fff;}
.sv-edit-page .option-item{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:8px 12px;background:#f9f9f9;border-radius:8px;border:1px solid transparent;transition:border .15s;}
.sv-edit-page .option-item:hover{border-color:#ddd;}
.sv-edit-page .option-input{flex:1;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;background:#fff;}
.sv-edit-page .option-input:focus{outline:none;border-color:var(--primary);}
.sv-edit-page .opt-radio,.sv-edit-page .opt-check{width:20px;height:20px;flex-shrink:0;accent-color:var(--primary);}
.sv-edit-page .opt-del{color:#999;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;border-radius:4px;transition:all .15s;}
.sv-edit-page .opt-del:hover{background:#fee;color:var(--danger);color:var(--danger);}
.sv-edit-page .add-opt-btn{display:inline-flex;align-items:center;gap:4px;color:var(--primary);cursor:pointer;font-size:14px;padding:6px 12px;border:1px dashed var(--primary);border-radius:6px;background:rgba(255,90,95,0.04);transition:all .15s;}
.sv-edit-page .add-opt-btn:hover{background:rgba(255,90,95,0.08);}
.sv-q-actions{display:flex;gap:6px;margin-top:10px;align-items:center;}
.sv-q-type-sel{padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;background:#fff;cursor:pointer;}
.sv-q-delete{color:var(--danger);cursor:pointer;font-size:13px;padding:4px 10px;border-radius:6px;transition:background .15s;}
.sv-q-delete:hover{background:#fee;}
.sv-toolbar{position:sticky;top:0;background:#fff;z-index:10;padding:12px 0;margin-bottom:8px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;}
.sv-toolbar .back-btn{cursor:pointer;color:var(--primary);font-size:15px;display:flex;align-items:center;gap:4px;}
.sv-save-bar{position:sticky;bottom:0;background:#fff;padding:16px 0;border-top:1px solid #eee;display:flex;gap:10px;box-shadow:0 -2px 8px rgba(0,0,0,0.06);}
</style>
<div class="sv-edit-page">
<div class="sv-toolbar">
  <span class="back-btn" onclick="Admin.renderSurveys()">← 返回列表</span>
  <strong style="font-size:17px;">${id ? '编辑问卷' : '新建问卷'}</strong>
</div>

<!-- 基础信息 -->
<div class="sv-section-title">基础信息</div>
<div class="form-group"><label>问卷标题 <span style="color:var(--danger)">*</span></label><input id="sv_title" value="${esc(survey.title)}" placeholder="如：恋爱偏好调查" class="q-input"></div>
<div class="form-group"><label>问卷描述</label><textarea id="sv_desc" rows=2 placeholder="简单介绍问卷目的" class="q-input">${esc(survey.description)}</textarea></div>
<div class="form-row">
<div class="form-group" style="flex:0 0 180px;"><label>问卷类型</label><select id="sv_type" onchange="Admin._svToggleType()" style="padding:10px;border:1px solid #ddd;border-radius:8px;"><option value="normal"${survey.type==='normal'?' selected':''}>普通型（感谢语）</option><option value="interpretation"${survey.type==='interpretation'?' selected':''}>解读型（显示解读结果）</option></select></div>
<div class="form-group" style="flex:0 0 140px;"><label>状态</label><select id="sv_status" style="padding:10px;border:1px solid #ddd;border-radius:8px;"><option value="draft"${survey.status!=='active'&&survey.status!=='closed'?' selected':''}>草稿</option><option value="active"${survey.status==='active'?' selected':''}>已发布</option><option value="closed"${survey.status==='closed'?' selected':''}>已关闭</option></select></div>
</div>
<div id="sv_thankYouBox"${survey.type!=='normal'?' style="display:none;"':''}><div class="form-group"><label>感谢文案（普通型提交后显示）</label><input id="sv_thankYouMsg" value="${esc(survey.thankYouMessage)}" class="q-input" placeholder="感谢填写，我们会根据具体情况为您提供服务。"></div></div>
<div id="sv_interpBox"${survey.type!=='interpretation'?' style="display:none;"':''}><div class="form-group"><label>解读内容（解读型提交后显示）</label><textarea id="sv_interpretation" rows=4 class="q-input" placeholder="根据您的选择，我们建议...">${esc(survey.interpretation)}</textarea></div></div>
<div class="form-group"><label>封面图（建议正方形）</label>${survey.cover?`<img src="${survey.cover}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;border:1px solid var(--border);margin-bottom:8px;display:block;">`:''}<input type="file" id="sv_coverFile" accept="image/*" onchange="Admin._uploadSurveyCover(this)"><input type="hidden" id="sv_cover" value="${esc(survey.cover||'')}"></div>

<!-- 题目区域 -->
<div class="sv-section-title"><span>题目列表</span><button class="btn btn-primary btn-sm" onclick="Admin._addQuestionInline()">+ 添加题目</button></div>
<div id="sv_questionsArea"></div>

<div class="sv-save-bar">
  <button class="btn" onclick="Admin.renderSurveys()">取消</button>
  <button class="primary-btn" onclick="Admin._saveSurvey()" style="min-width:120px;">💾 保存问卷</button>
</div>
</div>`;
    setTimeout(() => this._renderQuestionsFull(), 50);
  },
  _renderQuestionsFull() {
    const el = document.getElementById('sv_questionsArea');
    if (!el) return;
    if (!this._currentSurveyQuestions.length) {
      el.innerHTML = '<div class="empty" style="padding:30px;">暂无题目，点击上方「+ 添加题目」开始创建</div>';
      return;
    }
    const esc = v => String(v||'').replace(/"/g,'&quot;');
    el.innerHTML = this._currentSurveyQuestions.map((q, i) => {
      const qType = q.type || 'single';
      let optsHtml = '';
      if (qType === 'single') {
        optsHtml = (q.options || []).map((opt, oi) => `
          <div class="option-item">
            <input type="radio" name="preview_q_${i}" disabled class="opt-radio">
            <input type="text" class="option-input" value="${esc(opt)}" data-qi="${i}" data-oi="${oi}" oninput="Admin._updateOption(${i},${oi},this.value)">
            <span class="opt-del" onclick="Admin._removeOption(${i},${oi})">×</span>
          </div>`).join('');
        optsHtml += `<div class="add-opt-btn" onclick="Admin._addOption(${i})">+ 添加选项</div>`;
      } else if (qType === 'multiple') {
        optsHtml = (q.options || []).map((opt, oi) => `
          <div class="option-item">
            <input type="checkbox" disabled class="opt-check">
            <input type="text" class="option-input" value="${esc(opt)}" data-qi="${i}" data-oi="${oi}" oninput="Admin._updateOption(${i},${oi},this.value)">
            <span class="opt-del" onclick="Admin._removeOption(${i},${oi})">×</span>
          </div>`).join('');
        optsHtml += `<div class="add-opt-btn" onclick="Admin._addOption(${i})">+ 添加选项</div>`;
      } else {
        optsHtml = `<textarea class="q-input" rows=2 placeholder="用户填写的答案会以文本形式提交" disabled style="opacity:.6;"></textarea>`;
      }
      return `
      <div class="question-card" data-qidx="${i}">
        <div class="q-num">${i + 1}. 题目${i + 1} <span style="color:var(--danger);font-size:13px;">*</span></div>
        <input type="text" class="q-input" id="sv_q_text_${i}" value="${esc(q.text)}" placeholder="输入题目标题..." oninput="Admin._updateQText(${i},this.value)">
        ${qType !== 'text' ? `
        <div style="margin-top:10px;">
          ${optsHtml}
        </div>` : ''}
        <div class="q-qctions" style="display:flex;gap:8px;align-items:center;">
          <select class="sv-q-type-sel" onchange="Admin._changeQType(${i},this.value)" value="${qType}">
            <option value="single"${qType==='single'?' selected':''}>单选</option>
            <option value="multiple"${qType==='multiple'?' selected':''}>多选</option>
            <option value="text"${qType==='text'?' selected':''}>填空</option>
          </select>
          <span class="sv-q-delete" onclick="Admin._removeSurveyQ(${i})">🗑 删除此题</span>
        </div>
      </div>`;
    }).join('');
  },
  _addQuestionInline() {
    this._currentSurveyQuestions.push({ id: 'q_' + Date.now().toString(36), text: '', type: 'single', options: [''] });
    this._renderQuestionsFull();
    // Scroll to the last question
    const cards = document.querySelectorAll('.question-card');
    if (cards.length) cards[cards.length-1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Focus the new question's text input
    const idx = this._currentSurveyQuestions.length - 1;
    setTimeout(() => { const inp = document.getElementById('sv_q_text_' + idx); if(inp) inp.focus(); }, 100);
  },
  _updateQText(idx, val) {
    if (this._currentSurveyQuestions[idx]) this._currentSurveyQuestions[idx].text = val;
  },
  _changeQType(idx, newType) {
    if (!this._currentSurveyQuestions[idx]) return;
    const q = this._currentSurveyQuestions[idx];
    q.type = newType;
    if (newType !== 'text') {
      if (!q.options || !q.options.length) q.options = [''];
    } else {
      delete q.options;
    }
    this._renderQuestionsFull();
  },
  _addOption(qIdx) {
    const q = this._currentSurveyQuestions[qIdx];
    if (!q) return;
    if (!q.options) q.options = [];
    q.options.push('');
    this._renderQuestionsFull();
    // Focus the new option input
    const inputs = document.querySelectorAll(`[data-qi="${qIdx}"].option-input`);
    if (inputs && inputs.length) {
      inputs[inputs.length-1].focus();
    }
  },
  _updateOption(qIdx, optIdx, val) {
    const q = this._currentSurveyQuestions[qIdx];
    if (!q || !q.options) return;
    q.options[optIdx] = val;
  },
  _removeOption(qIdx, optIdx) {
    const q = this._currentSurveyQuestions[qIdx];
    if (!q || !q.options) return;
    q.options.splice(optIdx, 1);
    if (q.options.length === 0) q.options = [''];
    this._renderQuestionsFull();
  },
  async _saveSurvey() {
    const id = this._editingSurveyId;
    const body = {
      id, title: document.getElementById('sv_title').value.trim(),
      description: document.getElementById('sv_desc').value.trim(),
      type: document.getElementById('sv_type').value,
      status: document.getElementById('sv_status').value,
      thankYouMessage: document.getElementById('sv_thankYouMsg').value.trim(),
      interpretation: document.getElementById('sv_interpretation').value.trim(),
      cover: document.getElementById('sv_cover').value.trim(),
      questions: this._currentSurveyQuestions
    };
    if (!body.title) return this.toast('请输入标题');
    // Filter out empty questions (no text)
    body.questions = body.questions.filter(q => q.text && q.text.trim());
    if (!body.questions.length) return this.toast('请至少添加一道题');
    const r = await this.api('/api/admin/survey/save', { method:'POST', body });
    if (r.code === 0) { this.toast('保存成功'); this.renderSurveys(); } else this.toast(r.msg);
  },
  async _deleteSurvey(id) {
    if(!confirm('确定删除该问卷？所有填写数据也会丢失！')) return;
    const r = await this.api('/api/admin/survey/delete', { method:'POST', body:{id} });
    if (r.code===0) this.renderSurveys(); else this.toast(r.msg);
  },
  async _viewSurveyStats(surveyId) {
    const r = await this.api('/api/admin/survey/stats?surveyId=' + surveyId);
    if(r.code!==0) return this.toast(r.msg);
    const d=r.data,s=d.survey,st=d.stats;
    const esc=v=>String(v||'').replace(/"/g,'&quot;');
    let html='<div style="max-width:700px;">'
      +'<h4>'+esc(s.title)+' — 统计分析</h4>'
      +'<p>总填写人数：'+st.totalResponses+'</p>';
    Object.keys(st.questions).forEach(qid=>{
      const q=st.questions[qid];
      html+='<div style="margin:16px 0;padding:14px;background:#f9f9f9;border-radius:8px;">'
        +'<strong>'+esc(q.text)+'</strong>（'+q.total+'人回答）<br>';
      if(q.type!=='text'){
        const opts=Object.entries(q.options);
        opts.forEach(([opt,count])=>{
          const pct=q.total>0?((count/q.total)*100).toFixed(1):0;
          html+='<div style="margin:6px 0;display:flex;align-items:center;gap:8px;">'
            +'<span style="width:60px;text-align:right;">'+opt+'</span>'
            +'<div style="flex:1;height:20px;background:#eee;border-radius:4px;overflow:hidden;">'
            +'<div style="height:100%;background:linear-gradient(90deg,var(--primary),#ff8a3d);width:'+pct+'%;transition:width .3s;"></div>'
            +'</div>'
            +'<span style="width:48px;color:var(--text-2);">'+count+'('+pct+'%)</span>';
        });
      } else { html+='<em>填空题，需查看具体回答</em>'; }
      html+='</div>';
    });
    html+='<hr style="margin:16px 0;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong>用户填写记录</strong>'
      +'<input id="sv_searchUser" placeholder="搜索昵称/ID" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;" onkeyup="if(event.key==\'Enter\')Admin._searchUserResponses(\''+surveyId+'\')"></div>'
      +'<div id="sv_userList" style="max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">加载中...</div>'
      +'<button class="btn btn-sm" style="margin-top:8px;" onclick="Admin._closeModal()">关闭</button></div>';
    this._openModal('统计 - '+s.title, html, null);
    // 加载用户列表
    this._loadUserResponses(surveyId);
  },
  async _loadUserResponses(surveyId, keyword) {
    let url='/api/admin/survey/user-responses?surveyId='+surveyId;
    if(keyword) url+='&keyword='+encodeURIComponent(keyword);
    const r=await this.api(url);
    const el=document.getElementById('sv_userList');
    if(!el)return;
    if(r.code!==0){el.innerHTML='加载失败';return;}
    if(!r.data.length){el.innerHTML='<div class="empty">暂无记录</div>';return;}
    el.innerHTML=r.data.map(resp=>{
      const ansEntries=resp.answers?Object.entries(resp.answers):[];
      return`<div style="padding:10px;background:#fff;border:1px solid var(--border);border-radius:6px;font-size:13px;">
        <div style="display:flex;justify-content:space-between;"><strong>${resp.nickname||resp.userId||'匿名'}</strong><span style="color:var(--text-3);">${new Date(resp.submittedAt).toLocaleString()}</span></div>
        <div style="margin-top:6px;color:var(--text-2);">${ansEntries.map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(','):v}`).join('<br>')}</div>
      </div>`;
    }).join('');
  },
  async _searchUserResponses(surveyId){
    const kw=document.getElementById('sv_searchUser');
    this._loadUserResponses(surveyId,kw?kw.value.trim():'');
  },

  // ===== 按用户搜索问卷填写记录 =====
  async _searchByUser() {
    const keyword = (document.getElementById('sv_userSearch') || {}).value?.trim();
    if (!keyword) return this.toast('请输入用户昵称或ID');
    const r = await this.api('/api/admin/survey/user-responses?keyword=' + encodeURIComponent(keyword));
    const resultEl = document.getElementById('sv_userSearchResult');
    if (r.code !== 0) { resultEl.innerHTML = '<span style="color:red;">搜索失败</span>'; return; }
    if (!r.data.length) { resultEl.innerHTML = '未找到该用户的填写记录'; return; }
    // 找出该用户填过的问卷ID列表
    const surveyIds = [...new Set(r.data.map(resp => resp.surveyId))];
    const surveyTitles = {};
    (this._allSurveys || []).forEach(s => { surveyTitles[s.id] = s.title || '（无标题）'; });
    resultEl.innerHTML = `找到 <b>${r.data.length}</b> 条记录，涉及 <b>${surveyIds.length}</b> 个问卷：<br>`
      + surveyIds.map(sid => {
        const count = r.data.filter(d => d.surveyId === sid).length;
        return `<span style="margin-right:12px;">${surveyTitles[sid] || sid} (${count}次) <input type="checkbox" class="sv_userExport_chk" data-surveyid="${sid}" checked></span>`;
      }).join('')
      + `<br><button class="btn btn-sm" style="background:#2eb872;color:#fff;border-color:#2eb872;margin-top:6px;" onclick="Admin._exportUserSurveyResponses()">📥 导出勾选的问卷结果</button>`;
  },

  // ===== 导出勾选问卷结果（按问卷维度） =====
  _getSelectedSurveyIds() {
    const checkboxes = document.querySelectorAll('.sv_chk:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.id);
  },
  async _exportSelectedSurveys() {
    const ids = this._getSelectedSurveyIds();
    if (!ids.length) return this.toast('请先勾选要导出的问卷');
    this.toast('正在生成 Excel...');
    const res = await fetch('/api/admin/survey/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token },
      body: JSON.stringify({ surveyIds: ids })
    });
    if (!res.ok) { this.toast('导出失败：HTTP ' + res.status); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `问卷结果_${new Date().toLocaleDateString('zh-CN').replace(/\//g,'-')}.xlsx`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    this.toast('已下载');
  },

  // ===== 导出某用户填写的问卷结果 =====
  async _exportUserSurveyResponses() {
    const checkboxes = document.querySelectorAll('.sv_userExport_chk:checked');
    const surveyIds = Array.from(checkboxes).map(cb => cb.dataset.surveyid);
    const keyword = (document.getElementById('sv_userSearch') || {}).value?.trim() || '';
    if (!surveyIds.length) return this.toast('请勾选要导出的问卷');
    this.toast('正在生成 Excel...');
    const res = await fetch('/api/admin/survey/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token },
      body: JSON.stringify({ surveyIds, userKeyword: keyword })
    });
    if (!res.ok) { this.toast('导出失败：HTTP ' + res.status); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `用户问卷结果_${keyword}_${new Date().toLocaleDateString('zh-CN').replace(/\//g,'-')}.xlsx`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    this.toast('已下载');
  },

  // ===== 开屏广告管理 =====
  async renderSplashAds() {
    const c = document.getElementById('pageContent');
    c.innerHTML = '<div class="panel"><div class="panel-header"><h3>🎬 开屏广告管理</h3><button class="btn btn-primary" onclick="Admin._editSplashAd()">+ 新建广告</button></div><div class="panel-body"><div id="splashAdList"><div class="loading">加载中...</div></div></div></div>';
    const r = await this.api('/api/admin/splash-ads');
    if (r.code !== 0) return this.toast(r.msg);
    const list = document.getElementById('splashAdList');
    const esc = v => String(v||'').replace(/"/g,'&quot;');
    if (!r.data.length) { list.innerHTML = '<div class="empty">暂无开屏广告</div>'; return; }
    list.innerHTML = r.data.map(a => `
      <div style="display:flex;align-items:center;padding:14px;background:#fafafa;border-radius:10px;border:1px solid var(--border);gap:12px;">
        <img src="${a.image}" style="width:80px;height:120px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:15px;">展示时长：${a.duration || 3}秒</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:4px;">跳转：${a.linkType==='url'?(a.link||'无'):(a.page||'首页')} | 时间范围：${a.startTime?a.startTime.slice(0,16):'-'} ~ ${a.endTime?a.endTime.slice(0,16):'-'} | 状态：${a.enabled===false?'禁用':'启用'}</div>
        </div>
        <button class="btn btn-sm" onclick="Admin._editSplashAd('${a.id}')">编辑</button>
        <button class="btn btn-sm" onclick="Admin._deleteSplashAd('${a.id}')">删除</button>
      </div>`).join('');
  },
  async _editSplashAd(id) {
    let ad = null;
    if (id) {
      const r = await this.api('/api/admin/splash-ads');
      ad = (r.data || []).find(a => a.id === id);
    }
    ad = ad || { image: '', duration: 3, linkType: 'page', page: 'home', link: '', enabled: true };
    const esc = v => String(v||'').replace(/"/g,'&quot;');
    const body = '<div style="max-width:600px;">'
      + (ad.image ? '<img src="' + ad.image + '" style="width:200px;height:auto;object-fit:contain;border:1px solid var(--border);border-radius:8px;margin-bottom:12px;"><br>' : '')
      + '<div class="form-group"><label>广告图片 *（建议尺寸 750x1334）</label><input type="file" id="sp_imgFile" accept="image/*" onchange="Admin._uploadSpImg(this)"><input type="hidden" id="sp_image" value="' + esc(ad.image) + '"></div>'
      + '<div class="form-row"><div class="form-group" style="flex:0 0 140px;"><label>展示秒数</label><input id="sp_duration" value="' + (ad.duration || 3) + '" type="number" min="1" max="10"></div>'
      + '<div class="form-group" style="flex:0 0 100px;"><label>是否启用</label><select id="sp_enabled"><option value="true"' + (ad.enabled !== false ? ' selected' : '') + '>启用</option><option value="false"' + (ad.enabled === false ? ' selected' : '') + '>禁用</option></select></div></div>'
      + '<div class="form-row"><div class="form-group" style="flex:0 0 130px;"><label>跳转类型</label><select id="sp_linkType" onchange="document.getElementById(\'sp_pageBox\').style.display=this.value===\'url\'?\'none\':\'\';document.getElementById(\'sp_urlBox\').style.display=this.value===\'url\'?\'\':\'none\';"><option value="page"' + (ad.linkType === 'page' ? ' selected' : '') + '>站内页面</option><option value="url"' + (ad.linkType === 'url' ? ' selected' : '') + '>外部链接</option></select></div>'
      + '<div class="form-group" id="sp_pageBox" style="flex:1;' + ((ad.linkType === 'url') ? 'display:none;' : '') + '"><label>选择页面</label><select id="sp_page"><option value="home"' + (ad.page === 'home' ? ' selected' : '') + '>首页</option><option value="match"' + (ad.page === 'match' ? ' selected' : '') + '>找缘分</option><option value="activity"' + (ad.page === 'activity' ? ' selected' : '') + '>活动</option><option value="school"' + (ad.page === 'school' ? ' selected' : '') + '>学堂</option><option value="psychtest"' + (ad.page === 'psychtest' ? ' selected' : '') + '>心理测试</option></select></div>'
      + '<div class="form-group" id="sp_urlBox" style="flex:1;' + ((ad.linkType !== 'url') ? 'display:none;' : '') + '"><label>外部链接</label><input id="sp_link" value="' + esc(ad.link) + '" placeholder="https://..."></div></div>'
      + '<div class="form-row"><div class="form-group" style="flex:1;"><label>开始时间（留空不限）</label><input id="sp_startTime" type="datetime-local" value="' + (ad.startTime ? ad.startTime.slice(0,16) : '') + '"></div>'
      + '<div class="form-group" style="flex:1;"><label>结束时间（留空不限）</label><input id="sp_endTime" type="datetime-local" value="' + (ad.endTime ? ad.endTime.slice(0,16) : '') + '"></div></div>'
      + '</div>';
    this._openModal(id ? '编辑开屏广告' : '新建开屏广告', body, () => this._saveSplashAd(id));
  },
  async _uploadSpImg(input) {
    const f = input.files[0]; if (!f) return;
    if (f.size > 5*1024*1024) return this.toast('图片不超过5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', {method:'POST',body:{image:reader.result,subdir:'uploads'}});
      if (r.code===0) {
        document.getElementById('sp_image').value = r.data.url;
        input.previousElementSibling ? input.previousElementSibling.remove() : null;
        const preview = document.createElement('img');
        preview.src = r.data.url; preview.style.cssText = 'width:200px;object-fit:contain;border:1px solid var(--border);border-radius:8px;margin:8px 0;';
        input.parentNode.insertBefore(preview, input);
        this.toast('图片上传成功');
      } else this.toast(r.msg);
    }; reader.readAsDataURL(f);
  },
  async _saveSplashAd(id) {
    const linkType = document.getElementById('sp_linkType').value;
    const body = {
      id,
      image: document.getElementById('sp_image').value,
      duration: parseInt(document.getElementById('sp_duration').value)||3,
      enabled: document.getElementById('sp_enabled').value === 'true',
      linkType,
      page: linkType === 'page' ? document.getElementById('sp_page').value : '',
      link: linkType === 'url' ? (document.getElementById('sp_link').value||'').trim() : '',
      startTime: document.getElementById('sp_startTime').value || '',
      endTime: document.getElementById('sp_endTime').value || ''
    };
    if (!body.image) return this.toast('请上传图片');
    const r = await this.api('/api/admin/splash-ad/save',{method:'POST',body});
    if(r.code===0){this._closeModal();this.renderSplashAds();}else this.toast(r.msg);
  },
  async _deleteSplashAd(id) {
    if(!confirm('确定删除？')) return;
    const r = await this.api('/api/admin/splash-ad/delete',{method:'POST',body:{id}});
    if(r.code===0)this.renderSplashAds();else this.toast(r.msg);
  },
  async _uploadSurveyCover(input) {
    const f = input.files[0]; if (!f) return;
    if (f.size > 5*1024*1024) return this.toast('图片不超过5MB');
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await this.api('/api/admin/upload', {method:'POST',body:{image:reader.result,subdir:'uploads'}});
      if (r.code===0) {
        document.getElementById('sv_cover').value = r.data.url;
        const preview = document.createElement('img');
        preview.src = r.data.url;
        preview.style.cssText = 'width:120px;height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--border);margin-bottom:8px;display:block;';
        input.parentNode.insertBefore(preview, input);
        this.toast('封面上传成功');
      } else this.toast(r.msg);
    }; reader.readAsDataURL(f);
  },
};

Admin.init();
