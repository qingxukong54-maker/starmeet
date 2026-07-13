// admin/system-config.js
// 合并配置页面（站点配置 + 系统设置 + 邮箱配置）
(function() {
  function mount() {
    if (typeof Admin === 'undefined') { setTimeout(mount, 50); return; }

    Admin.renderSystemConfig = async function() {
      const content = document.getElementById('pageContent');
      content.innerHTML = '<div class="loading">加载中...</div>';
      try {
        const [siteRes, setRes, mailRes] = await Promise.all([
          this.api('/api/site-config'),
          this.api('/api/admin/settings'),
          this.api('/api/admin/mail-config')
        ]);
        const c = (siteRes.code === 0 && siteRes.data) ? siteRes.data : {};
        const s = (setRes.code === 0 && setRes.data) ? setRes.data : {};
        const m = (mailRes.code === 0 && mailRes.data) ? mailRes.data : {};
        const esc = (v) => String(v || '').replace(/"/g, '&quot;');
        const nav = c.navConfig || [
          { icon: '🏠', title: '首页', page: 'home', enabled: true },
          { icon: '💖', title: '找缘分', page: 'match', enabled: true },
          { icon: '🎉', title: '活动', page: 'activity', enabled: true },
          { icon: '📚', title: '学堂', page: 'school', enabled: true },
          { icon: '👤', title: '我的', page: 'mine', enabled: true }
        ];
        this._sysNav = nav;

        let navRows = '';
        for (let i = 0; i < nav.length; i++) {
          const n = nav[i];
          const isImg = n.icon && (n.icon.startsWith('http') || n.icon.startsWith('/'));
          const ih = isImg ? '<img src="' + n.icon + '" style="width:100%;height:100%;object-fit:cover;">' : (n.icon || '💖');
          navRows += '<tr><td><div style="display:flex;flex-direction:column;gap:6px;align-items:center;"><div style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;border-radius:8px;font-size:28px;overflow:hidden;">' + ih + '</div></div></td>'
            + '<td><input id="sys_nc_title_' + i + '" value="' + esc(n.title) + '" style="min-width:100px;"></td>'
            + '<td><select id="sys_nc_page_' + i + '"><option value="home"' + (n.page === 'home' ? ' selected' : '') + '>首页</option><option value="match"' + (n.page === 'match' ? ' selected' : '') + '>找缘分</option><option value="activity"' + (n.page === 'activity' ? ' selected' : '') + '>活动</option><option value="school"' + (n.page === 'school' ? ' selected' : '') + '>学堂</option><option value="circle"' + (n.page === 'circle' ? ' selected' : '') + '>圈子</option><option value="mine"' + (n.page === 'mine' ? ' selected' : '') + '>我的</option></select></td>'
            + '<td><button id="sys_nc_en_' + i + '" class="btn ' + (n.enabled !== false ? 'btn-primary' : '') + '" onclick="Admin._sysToggleNav(' + i + ')">' + (n.enabled !== false ? '已启用' : '已禁用') + '</button></td></tr>';
        }

        const fp = s.favicon ? '<img src="' + esc(s.favicon) + '?v=' + Date.now() + '" style="width:64px;height:64px;border-radius:12px;object-fit:cover;border:2px solid var(--border);vertical-align:middle;">' : '<span style="color:var(--text-3);font-size:13px;">未设置</span>';

        content.innerHTML = '<div style="display:flex;flex-direction:column;gap:20px;">'
          + '<div class="panel"><div class="panel-header"><h3>🌐 站点配置</h3></div><div class="panel-body" style="max-width:700px;">'
          + '<div class="form-group"><label>Logo 模式</label><select id="sys_logoType"><option value="emoji"' + (c.logoType === 'emoji' ? ' selected' : '') + '>Emoji</option><option value="image"' + (c.logoType === 'image' ? ' selected' : '') + '>图片</option></select></div>'
          + '<div class="form-group"><label>Logo Emoji</label><input id="sys_logoEmoji" value="' + esc(c.logoEmoji) + '"></div>'
          + '<div class="form-group"><label>首页副标题</label><input id="sys_siteSlogan" value="' + esc(c.siteSlogan) + '"></div>'
          + '<hr style="margin:20px 0;border:none;border-top:1px solid var(--border);"><h4 style="margin:16px 0 8px;">🧭 导航配置（同时控制顶部导航栏和底部导航栏）</h4>'
          + '<table style="margin-bottom:14px;width:100%;"><thead><tr><th>图标</th><th>文案</th><th>跳转</th><th>启用</th></tr></thead><tbody>' + navRows + '</tbody></table>'
          + '<button class="btn btn-primary" onclick="Admin._sysSaveSite()">💾 保存站点配置</button>'
          + '</div></div>'

          + '<div class="panel"><div class="panel-header"><h3>⚙️ 系统设置</h3></div><div class="panel-body" style="max-width:700px;">'
          + '<div class="form-group"><label>站点名称</label><input id="sys_siteName" value="' + esc(s.siteName) + '"></div>'
          + '<hr style="margin:20px 0;border:none;border-top:1px solid var(--border);">'
          + '<div class="form-group"><label>🌐 网站图标</label><div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;padding:14px;background:#f8f9fa;border-radius:10px;border:1px dashed var(--border);">' + fp
          + '<div style="flex:1;"><input type="file" id="sys_favFile" accept="image/*" style="display:none;" onchange="Admin._sysUploadFavicon(this)">'
          + '<button class="btn btn-sm" id="sys_favBtn">📤 上传</button>'
          + (s.favicon ? '<button class="btn btn-sm" style="margin-left:6px;color:var(--danger);" onclick="Admin._sysClearFavicon()">🗑️ 清除</button>' : '')
          + '</div></div></div>'
          + '<div class="form-group"><label>客服电话</label><input id="sys_servicePhone" value="' + esc(s.servicePhone) + '"></div>'
          + '<div class="form-group"><label>客服微信</label><input id="sys_serviceWechat" value="' + esc(s.serviceWechat) + '"></div>'
          + '<button class="btn btn-primary" onclick="Admin._sysSaveSettings()">💾 保存系统设置</button>'
          + '</div></div>'

          + '<div class="panel"><div class="panel-header"><h3>📧 邮箱配置</h3><button class="btn" onclick="Admin._sysTestMail()">📤 测试</button></div><div class="panel-body" style="max-width:700px;">'
          + '<div style="background:#fffbe6;border:1px solid #ffe58f;padding:12px 14px;border-radius:8px;margin-bottom:16px;color:#7a5b00;font-size:13px;">💡 配置 QQ 邮箱 SMTP 发送注册验证码</div>'
          + '<div class="form-group"><label>SMTP 服务器</label><input id="sys_mail_smtpHost" value="' + esc(m.smtpHost) + '" placeholder="smtp.qq.com"></div>'
          + '<div class="form-group"><label>SMTP 端口</label><input id="sys_mail_smtpPort" value="' + esc(m.smtpPort) + '" placeholder="465"></div>'
          + '<div class="form-group"><label>发件人邮箱</label><input id="sys_mail_user" value="' + esc(m.user) + '" placeholder="123456@qq.com"></div>'
          + '<div class="form-group"><label>授权码（16位）</label><input id="sys_mail_pass" value="' + esc(m.pass) + '" type="password" placeholder="留空保持原值"></div>'
          + '<div class="form-group"><label>发件人昵称</label><input id="sys_mail_fromName" value="' + esc(m.fromName) + '" placeholder="StarMeet"></div>'
          + '<button class="btn btn-primary" onclick="Admin._sysSaveMail()">💾 保存邮箱配置</button>'
          + '</div></div>'
          + '</div>';

        // 绑定上传按钮（不用 onclick 转义）
        setTimeout(() => {
          const btn = document.getElementById('sys_favBtn');
          if (btn) btn.onclick = () => document.getElementById('sys_favFile').click();
        }, 100);
      } catch(e) {
        content.innerHTML = '<div class="empty">加载失败：' + (e.message || '') + '</div>';
      }
    };

    Admin._sysToggleNav = function(i) {
      const nav = this._sysNav || [];
      if (nav[i]) nav[i].enabled = !nav[i].enabled;
      this.renderSystemConfig();
    };

    Admin._sysSaveSite = async function() {
      const nav = this._sysNav || [];
      for (let i = 0; i < nav.length; i++) {
        nav[i].title = document.getElementById('sys_nc_title_' + i).value;
        nav[i].page = document.getElementById('sys_nc_page_' + i).value;
      }
      const body = { navConfig: nav, logoType: document.getElementById('sys_logoType').value, logoEmoji: document.getElementById('sys_logoEmoji').value, siteSlogan: document.getElementById('sys_siteSlogan').value };
      const r = await this.api('/api/admin/site-config', { method: 'POST', body });
      if (r.code === 0) this.toast('站点配置保存成功'); else this.toast(r.msg || '保存失败');
    };

    Admin._sysUploadFavicon = async function(input) {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { this.toast('图标不能超过 2MB'); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const r = await this.api('/api/admin/upload', { method: 'POST', body: { image: reader.result, subdir: 'uploads' } });
        if (r.code === 0) {
          const sr = await this.api('/api/admin/settings', { method: 'POST', body: { favicon: r.data.url } });
          if (sr.code === 0) { this.toast('图标已更新'); this.renderSystemConfig(); } else this.toast(sr.msg || '保存失败');
        } else this.toast(r.msg || '上传失败');
      };
      reader.readAsDataURL(file);
    };

    Admin._sysClearFavicon = async function() {
      const sr = await this.api('/api/admin/settings', { method: 'POST', body: { favicon: '' } });
      if (sr.code === 0) { this.toast('已清除'); this.renderSystemConfig(); } else this.toast(sr.msg || '操作失败');
    };

    Admin._sysSaveSettings = async function() {
      const body = { siteName: document.getElementById('sys_siteName').value, servicePhone: document.getElementById('sys_servicePhone').value, serviceWechat: document.getElementById('sys_serviceWechat').value };
      const r = await this.api('/api/admin/settings', { method: 'POST', body });
      if (r.code === 0) this.toast('系统设置保存成功'); else this.toast(r.msg || '保存失败');
    };

    Admin._sysSaveMail = async function() {
      const body = { smtpHost: document.getElementById('sys_mail_smtpHost').value, smtpPort: document.getElementById('sys_mail_smtpPort').value, user: document.getElementById('sys_mail_user').value, pass: document.getElementById('sys_mail_pass').value, fromName: document.getElementById('sys_mail_fromName').value };
      const r = await this.api('/api/admin/mail-config', { method: 'POST', body });
      if (r.code === 0) this.toast('邮箱配置保存成功'); else this.toast(r.msg || '保存失败');
    };

    Admin._sysTestMail = async function() {
      const email = prompt('输入接收测试邮件的邮箱：');
      if (!email) return;
      const r = await this.api('/api/admin/mail-test', { method: 'POST', body: { email } });
      if (r.code === 0) this.toast(r.msg); else this.toast(r.msg || '发送失败');
    };

    console.log('[system-config.js] renderSystemConfig 已挂载');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
