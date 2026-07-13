/**
 * SM婚恋系统 v1.0.2 - 问卷管理模块集成代码
 * 
 * 使用方法：将此文件内容追加到 /admin/admin.js 末尾即可
 * 或者单独保存为 /admin/admin.survey.js，然后在 index.html 中引入
 */

// ============================================
// 问卷管理模块 - 集成到 SM 婚恋系统 v1.0.2
// ============================================

const SurveyAdmin = {
  // 当前编辑中的问卷数据
  currentSurvey: null,
  currentQuestions: [],
  
  // DOM 准备就绪标志
  domReady: false,
  renderQueue: [],

  // ---- 安全的 DOM 操作包装 ----
  safeRender(callback, retryCount = 0) {
    const content = document.getElementById('pageContent');
    if (content && document.body.contains(content)) {
      // DOM 已就绪，直接执行
      try {
        callback();
        return true;
      } catch (e) {
        console.error('[问卷管理] 渲染失败:', e);
        return false;
      }
    }
    
    // DOM 未就绪，加入队列或重试
    if (retryCount < 10) {
      console.warn(`[问卷管理] DOM未就绪，100ms后重试...(${retryCount + 1}/10)`);
      setTimeout(() => this.safeRender(callback, retryCount + 1), 100);
    } else {
      console.error('[问卷管理] DOM重试次数用尽，放弃渲染');
    }
    return false;
  },

  // ---- 初始化：注册页面路由 ----
  init() {
    // 等待 DOM 就绪
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.domReady = true;
        this.processRenderQueue();
      });
    } else {
      this.domReady = true;
    }
    
    // 页面路由注册
    this.pageRoutes = {
      'surveyList': () => this.renderSurveyList(),
      'surveyEdit': () => this.renderSurveyEditor(),
      'surveyResults': () => this.renderSurveyResults()
    };
    console.log('[问卷管理] 模块已加载');
  },
  
  // 处理渲染队列
  processRenderQueue() {
    while (this.renderQueue.length > 0) {
      const callback = this.renderQueue.shift();
      callback();
    }
  },

  // ---- API 请求封装（复用现有 Admin 模式）----
  async api(action, data = {}) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      // 使用 Admin 的 token 进行认证
      if (typeof Admin !== 'undefined' && Admin.token) {
        headers['Authorization'] = 'Bearer ' + Admin.token;
      }
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ action, ...data })
      });
      return await res.json();
    } catch (e) {
      console.error('[问卷API] 请求失败:', e);
      return { success: false, message: '网络错误' };
    }
  },

  // ---- 页面1：问卷列表 ----
  renderSurveyList() {
    // 检查 pageContent 是否存在，如果不存在则延迟重试（最多10次）
    let retryCount = 0;
    const checkAndRender = () => {
      const content = document.getElementById('pageContent');
      if (!content) {
        retryCount++;
        if (retryCount <= 10) {
          console.warn(`[问卷管理] pageContent 未找到，${retryCount}/10 后重试...`);
          setTimeout(checkAndRender, 100);
        } else {
          console.error('[问卷管理] pageContent 不存在，无法渲染问卷列表');
        }
        return;
      }
      
      // 安全设置 innerHTML
      try {
        content.innerHTML = `
      <div class="page-header">
        <h3>📋 问卷管理</h3>
        <button class="primary-btn" onclick="SurveyAdmin.showCreateModal()">+ 新建问卷</button>
      </div>
      
      <!-- 搜索筛选 -->
      <div class="filter-bar" style="background:#f8f9fa; padding:12px 16px; border-radius:8px; margin-bottom:16px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <input type="text" id="surveySearchInput" placeholder="搜索问卷标题..." style="padding:6px 12px; border:1px solid #ddd; border-radius:4px; flex:1; min-width:150px;">
        <select id="surveyStatusFilter" style="padding:6px 12px; border:1px solid #ddd; border-radius:4px;">
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="closed">已关闭</option>
        </select>
        <select id="surveyTypeFilter" style="padding:6px 12px; border:1px solid #ddd; border-radius:4px;">
          <option value="">全部类型</option>
          <option value="male">男性客户表</option>
          <option value="female">女性用户表</option>
          <option value="custom">自定义</option>
        </select>
        <button class="primary-btn" onclick="SurveyAdmin.loadSurveyList()" style="padding:6px 16px;">搜索</button>
      </div>
      
      <!-- 统计卡片 -->
      <div class="stat-cards" id="surveyStats" style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px;">
        <div class="stat-card" style="background:linear-gradient(135deg,#667eea,#764ba2); color:white; padding:16px; border-radius:10px;">
          <div style="font-size:24px; font-weight:bold;" id="statTotal">-</div>
          <div style="opacity:0.85;">问卷总数</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#11998e,#38ef7d); color:white; padding:16px; border-radius:10px;">
          <div style="font-size:24px; font-weight:bold;" id="statPublished">-</div>
          <div style="opacity:0.85;">已发布</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#fc4a1a,#f7b733); color:white; padding:16px; border-radius:10px;">
          <div style="font-size:24px; font-weight:bold;" id="statResponses">-</div>
          <div style="opacity:0.85;">总提交数</div>
        </div>
        <div class="stat-card" style="background:linear-gradient(135deg,#ee0979,#ff6a00); color:white; padding:16px; border-radius:10px;">
          <div style="font-size:24px; font-weight:bold;" id="statToday">-</div>
          <div style="opacity:0.85;">今日提交</div>
        </div>
      </div>
      
      <!-- 问卷列表 -->
      <div class="data-table-wrapper" style="overflow-x:auto;">
        <table class="data-table" style="min-width:1100px;font-size:13px;">
          <thead>
            <tr>
              <th style="width:50px;">序号</th>
              <th style="width:30em;max-width:30em;">问卷标题</th>
              <th style="width:80px;">类型</th>
              <th style="width:60px;">题目数</th>
              <th style="width:70px;">状态</th>
              <th style="width:80px;">浏览/提交</th>
              <th style="width:130px;">创建时间</th>
              <th style="width:130px;">发布时间</th>
              <th style="width:130px;">结束时间</th>
              <th style="min-width:200px;">操作</th>
            </tr>
          </thead>
          <tbody id="surveyListBody"><tr><td colspan="10" style="text-align:center; padding:40px; color:#999;">加载中...</td></tr></tbody>
        </table>
      </div>
      
      <!-- 快捷操作：预置模板 -->
      <div style="margin-top:24px; padding:20px; background:#f0f7ff; border-radius:10px; border-left:4px solid #2196F3;">
        <h4 style="margin:0 0 12px 0; color:#1565C0;">📦 快速创建（预置模板）</h4>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button onclick="SurveyAdmin.createFromTemplate('male')" style="padding:10px 20px; border:1px dashed #2196F3; background:white; border-radius:6px; cursor:pointer; color:#2196F3; font-size:14px;">
            📝 男性客户匹配申请表
          </button>
          <button onclick="SurveyAdmin.createFromTemplate('female')" style="padding:10px 20px; border:1px dashed #E91E63; background:white; border-radius:6px; cursor:pointer; color:#E91E63; font-size:14px;">
            📝 女性用户信息收集表
          </button>
        </div>
      </div>
    `;
        
        // 加载列表数据
        setTimeout(() => this.loadSurveyList(), 50);
      } catch (e) {
        console.error('[问卷管理] 渲染问卷列表失败:', e);
      }
    };
    
    checkAndRender();
  },

  // 加载问卷列表
  async loadSurveyList() {
    const searchEl = document.getElementById('surveySearchInput');
    const statusEl = document.getElementById('surveyStatusFilter');
    const typeEl = document.getElementById('surveyTypeFilter');
    const listBody = document.getElementById('surveyListBody');

    // 如果关键元素不存在，说明页面还没完全渲染，稍后重试
    if (!listBody) {
      console.warn('[问卷管理] 列表容器未就绪，100ms后重试...');
      setTimeout(() => this.loadSurveyList(), 100);
      return;
    }

    const search = searchEl ? searchEl.value : '';
    const status = statusEl ? statusEl.value : '';
    const type = typeEl ? typeEl.value : '';

    try {
      const res = await this.api('list', { search, status, type });

      if (!res.success) {
        listBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#e74c3c;padding:30px;">${res.message || '加载失败'}</td></tr>`;
        return;
      }

      const surveys = res.data || [];

      // 更新统计
      const statTotal = document.getElementById('statTotal');
      if (statTotal) {
        statTotal.textContent = surveys.length;
        document.getElementById('statPublished').textContent = surveys.filter(s => s.status === 'published').length;
        document.getElementById('statResponses').textContent = surveys.reduce((sum, s) => sum + (s.responseCount || 0), 0);
        document.getElementById('statToday').textContent = surveys.reduce((sum, s) => sum + (s.todayCount || 0), 0);
      }

      if (surveys.length === 0) {
        listBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#999;">暂无问卷，点击右上角「+ 新建问卷」或使用下方预置模板快速创建</td></tr>`;
        return;
      }

      const typeLabels = { male: '男性客户', female: '女性用户', custom: '自定义' };
      const typeColors = { male: '#2196F3', female: '#E91E63', custom: '#9C27B0' };
      const statusLabels = { draft: '<span style="color:#999;">草稿</span>', published: '<span style="color:#4caf50;">已发布</span>', closed: '<span style="color:#f44336;">已关闭</span>' };

      listBody.innerHTML = surveys.map(s => {
        const displayId = s.displayId || s.id;
        const createdAt = s.createdAt ? new Date(s.createdAt).toLocaleString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-';
        const publishTime = s.publishTime ? new Date(s.publishTime).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '立即';
        const endTime = s.endTime ? new Date(s.endTime).toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '永不';
        
        // 检查状态
        const now = new Date();
        let timeStatus = '';
        if (s.publishTime && new Date(s.publishTime) > now) {
          timeStatus = '<span style="color:#ff9800;font-size:11px;">[未到发布时间]</span>';
        }
        if (s.endTime && new Date(s.endTime) < now) {
          timeStatus = '<span style="color:#f44336;font-size:11px;">[已结束]</span>';
        }
        
        return `<tr>
          <td>${displayId}</td>
          <td style="max-width:30em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this.escapeHtml(s.title)}"><strong>${this.escapeHtml(s.title)}</strong>${s.password ? ' 🔒' : ''} ${timeStatus}</td>
          <td><span style="color:${typeColors[s.type] || '#666'};">${typeLabels[s.type] || '自定义'}</span></td>
          <td>${(s.questions && s.questions.length) || 0}</td>
          <td>${statusLabels[s.status] || s.status}</td>
          <td>0 / ${s.responseCount || 0}</td>
          <td style="font-size:12px;color:#888;white-space:nowrap;">${createdAt}</td>
          <td style="font-size:12px;white-space:nowrap;">${publishTime}</td>
          <td style="font-size:12px;white-space:nowrap;">${endTime}</td>
          <td style="white-space:nowrap;">
            ${s.status === 'draft' ? `<button class="primary-btn" onclick="SurveyAdmin.publishSurvey('${s.id}')" style="width:44px;padding:2px 4px;font-size:12px;margin-right:4px;">发布</button>` : `<button class="primary-btn" onclick="SurveyAdmin.unpublishSurvey('${s.id}')" style="width:44px;padding:2px 4px;font-size:12px;margin-right:4px;background:#FF9800;">下架</button>`}
            <button class="primary-btn" onclick="SurveyAdmin.editSurvey('${s.id}')" style="width:44px;padding:2px 4px;font-size:12px;margin-right:4px;background:#2196F3;">编辑</button>
            <button class="primary-btn" onclick="SurveyAdmin.viewResults('${s.id}')" style="width:44px;padding:2px 4px;font-size:12px;margin-right:4px;background:#FF9800;">数据</button>
            <button class="primary-btn" onclick="SurveyAdmin.deleteSurvey('${s.id}', '${this.escapeHtml(s.title).replace(/'/g, "\\'")}')" style="width:44px;padding:2px 4px;font-size:12px;background:#f44336;">删除</button>
          </td>
        </tr>`;
      }).join('');
    } catch(e) {
      console.error('[问卷管理] 加载列表出错:', e);
      if (listBody) {
        listBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#e74c3c;padding:30px;">加载出错: ${e.message}</td></tr>`;
      }
    }
  },

  // ---- 新建/编辑问卷 ----
  showCreateModal() {
    const title = prompt('请输入问卷标题：');
    if (!title || !title.trim()) return;
    this.createSurvey(title.trim());
  },

  async createSurvey(title) {
    const res = await this.api('create', { 
      title, 
      description: '', 
      type: 'custom'
    });
    if (res.success) {
      this.showToast('✅ 创建成功，正在进入编辑器...');
      setTimeout(() => this.editSurvey(res.data.id), 500);
    } else {
      this.showToast('❌ 创建失败: ' + (res.message || '未知错误'));
    }
  },

  async createFromTemplate(templateType) {
    const res = await this.api('createFromTemplate', { templateType });
    if (res.success) {
      this.showToast('✅ 模板创建成功，正在进入编辑器...');
      setTimeout(() => this.editSurvey(res.data.id), 500);
    } else {
      this.showToast('❌ 创建失败: ' + (res.message || '未知错误'));
    }
  },

  // ---- 页面2：问卷编辑器 ----
  async renderSurveyEditor(surveyId) {
    const content = document.getElementById('pageContent');
    
    if (!surveyId && !this.currentSurvey) {
      content.innerHTML = '<div style="text-align:center;padding:60px;color:#999;">请先从问卷列表选择一个问卷进行编辑</div>';
      return;
    }

    if (surveyId) {
      const res = await this.api('get', { id: surveyId });
      if (!res.success) {
        content.innerHTML = `<div style="text-align:center;padding:60px;color:#e74c3c;">${res.message || '加载失败'}</div>`;
        return;
      }
      // API 返回 res.data 就是完整的 survey 对象
      this.currentSurvey = res.data || {};
      this.currentQuestions = (this.currentSurvey.questions || []).map(q => {
        // 兼容旧数据：把 text 字段迁移为 title
        if (q.text && !q.title) q.title = q.text;
        return q;
      });
    }

    const s = this.currentSurvey;
    const questions = this.currentQuestions;

    content.innerHTML = `
      <div class="page-header" style="flex-wrap:wrap;">
        <div>
          <h3>✏️ 编辑问卷：<span id="editorTitle">${this.escapeHtml(s.title)}</span></h3>
          <div style="margin-top:4px; font-size:13px; color:#888;">
            ID: ${s.id} | 状态: ${s.status === 'published' ? '<span style="color:#4caf50;">已发布</span>' : '<span style="color:#999;">草稿</span>'}
            | 浏览 ${s.viewCount || 0} | 提交 ${s.responseCount || 0}
            <a href="/h5/survey.html?id=${s.id}" target="_blank" style="margin-left:10px; color:#2196F3;">🔗 预览链接</a>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="primary-btn" style="background:#4caf50;" onclick="SurveyAdmin.saveSurvey()">💾 保存</button>
          ${s.status !== 'published' ? `<button class="primary-btn" style="background:#2196F3;" onclick="SurveyAdmin.publishSurvey(${s.id})">🚀 发布</button>` : `<button class="primary-btn" style="background:#FF9800;" onclick="SurveyAdmin.unpublishSurvey(${s.id})">⏸ 下架</button>`}
          <button class="primary-btn" style="background:#f5f5f5; color:#666;" onclick="SurveyAdmin.renderSurveyList()">← 返回列表</button>
        </div>
      </div>

      <!-- 基本设置折叠面板 -->
      <details style="margin-bottom:16px; border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;" open>
        <summary style="padding:12px 16px; background:#f8f9fa; cursor:pointer; font-weight:600;">📝 基本设置</summary>
        <div style="padding:16px; display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div>
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">问卷标题</label>
            <input id="editTitle" value="${this.escapeHtml(s.title)}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;" placeholder="输入问卷标题">
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">问卷描述</label>
            <input id="editDesc" value="${this.escapeHtml(s.description || '')}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;" placeholder="输入问卷描述">
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">类型（性别限制）</label>
            <select id="editType" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;">
              <option value="custom" ${s.type === 'custom' ? 'selected' : ''}>不限性别</option>
              <option value="male" ${s.type === 'male' ? 'selected' : ''}>仅限男性</option>
              <option value="female" ${s.type === 'female' ? 'selected' : ''}>仅限女性</option>
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">结果类型</label>
            <select id="editResultType" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;" onchange="SurveyAdmin.toggleInterpretation()">
              <option value="survey" ${(!s.resultType || s.resultType === 'survey') ? 'selected' : ''}>调查型（提交后显示"感谢填写"）</option>
              <option value="interpretation" ${s.resultType === 'interpretation' ? 'selected' : ''}>解答型（提交后显示解答内容）</option>
            </select>
          </div>
          <div id="interpretationSection" style="display:${(s.resultType === 'interpretation') ? 'block' : 'none'}; grid-column:1/-1;">
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">解答内容（用户提交后显示的内容）</label>
            <textarea id="editInterpretation" style="width:100%;min-height:120px;padding:8px 12px;border:1px solid #ddd;border-radius:4px;resize:vertical;" placeholder="输入用户提交问卷后看到的解答内容...">${(s.interpretation || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">展示图（前端卡片展示用）</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <input id="editCover" type="file" accept="image/*" style="flex:1;font-size:13px;" onchange="SurveyAdmin.uploadImage('editCover','coverPreview')">
              <button type="button" onclick="document.getElementById('editCover').value='';document.getElementById('coverPreview').style.display='none';document.getElementById('coverData').value='';" style="padding:4px 8px;font-size:12px;cursor:pointer;">清除</button>
            </div>
            <input id="coverData" type="hidden" value="${s.cover || ''}">
            <div id="coverPreview" style="margin-top:8px;${s.cover ? '' : 'display:none;'}">
              <img src="${s.cover || ''}" style="max-width:200px;max-height:120px;border-radius:6px;border:1px solid #ddd;">
            </div>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">问卷顶图（用户填写时顶部展示）</label>
            <div style="display:flex;align-items:center;gap:8px;">
              <input id="editTopImage" type="file" accept="image/*" style="flex:1;font-size:13px;" onchange="SurveyAdmin.uploadImage('editTopImage','topImagePreview')">
              <button type="button" onclick="document.getElementById('editTopImage').value='';document.getElementById('topImagePreview').style.display='none';document.getElementById('topImageData').value='';" style="padding:4px 8px;font-size:12px;cursor:pointer;">清除</button>
            </div>
            <input id="topImageData" type="hidden" value="${s.topImage || ''}">
            <div id="topImagePreview" style="margin-top:8px;${s.topImage ? '' : 'display:none;'}">
              <img src="${s.topImage || ''}" style="max-width:200px;max-height:120px;border-radius:6px;border:1px solid #ddd;">
            </div>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">发布时间（留空则立即发布）</label>
            <input id="editPublishTime" type="datetime-local" value="${s.publishTime ? s.publishTime.slice(0, 16) : ''}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;">
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:13px;color:#666;">结束时间（留空则永不结束）</label>
            <input id="editEndTime" type="datetime-local" value="${s.endTime ? s.endTime.slice(0, 16) : ''}" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;">
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="checkbox" id="editAnonymous" ${s.allowAnonymous ? 'checked' : ''}> 允许匿名提交
            </label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="checkbox" id="editCollectName" ${s.collectName ? 'checked' : ''}> 收集姓名
            </label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="checkbox" id="editCollectPhone" ${s.collectPhone ? 'checked' : ''}> 收集手机号
            </label>
          </div>
        </div>
      </details>

      <!-- 主编辑区：左右分栏 -->
      <div style="display:grid; grid-template-columns:1fr 380px; gap:16px; align-items:start;">
        
        <!-- 左侧：题目列表 -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <strong>📋 题目列表（${questions.length} 题）</strong>
            <div style="display:flex; gap:6px;">
              <select id="addQuestionType" style="padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
                <option value="radio">单选题</option>
                <option value="checkbox">多选题</option>
                <option value="text">文本题</option>
                <option value="textarea">多行文本</option>
                <option value="number">数字题</option>
                <option value="date">日期题</option>
                <option value="image">图片上传</option>
                <option value="rating">评分题</option>
              </select>
              <button class="primary-btn" onclick="SurveyAdmin.addQuestion()" style="padding:6px 14px;">+ 添加题目</button>
            </div>
          </div>

          <div id="questionList" style="border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;">
            ${questions.length === 0 ? '<div style="padding:40px;text-align:center;color:#999;">还没有题目，点击上方「添加题目」开始创建</div>' : ''}
            ${questions.map((q, i) => this.renderQuestionEditor(q, i)).join('')}
          </div>
        </div>

        <!-- 右侧：实时预览 -->
        <div style="position:sticky; top:80px;">
          <div style="background:#f8f9fa; border-radius:8px; overflow:hidden; border:1px solid #e0e0e0;">
            <div style="padding:10px 14px; background:#eee; font-weight:600; font-size:13px; text-align:center;">📱 手机预览</div>
            <div style="padding:12px; max-height:600px; overflow-y:auto; background:white;" id="previewPanel">
              ${this.renderPreview(s, questions)}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // 渲染单个题目编辑行
  renderQuestionEditor(q, index) {
    const typeNames = {
      radio: '单选', checkbox: '多选', text: '文本', textarea: '多行文本',
      number: '数字', date: '日期', image: '图片上传', rating: '评分'
    };

    let optionsHtml = '';
    if (q.type === 'radio' || q.type === 'checkbox') {
      optionsHtml = `
        <div style="margin-top:8px; padding-left:16px; background:#fafafa; padding:8px 12px; border-radius:4px;">
          <div style="font-size:12px; color:#888; margin-bottom:6px;">选项（每行一个）：</div>
          ${(q.options || []).map((opt, oi) => `
            <div style="display:flex; gap:4px; margin-bottom:4px; align-items:center;">
              <span style="color:#aaa;width:18px;font-size:12px;">${oi + 1}.</span>
              <input value="${this.escapeHtml(opt)}" onchange="SurveyAdmin.updateOption(${index},${oi},this.value)" style="flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:3px;font-size:13px;">
              <button onclick="SurveyAdmin.removeOption(${index},${oi})" style="border:none;background:none;color:#e74c3c;cursor:pointer;font-size:16px;padding:0 2px;">×</button>
            </div>
          `).join('')}
          <button onclick="SurveyAdmin.addOption(${index})" style="margin-top:4px;border:none;background:none;color:#2196F3;cursor:pointer;font-size:13px;">+ 添加选项</button>
        </div>
      `;
    } else if (q.type === 'rating') {
      optionsHtml = `
        <div style="margin-top:8px; padding-left:16px; display:flex; gap:12px; align-items:center; font-size:13px; color:#666;">
          <label>最高分: <input type="number" value="${q.maxScore || 5}" min="1" max="10" onchange="SurveyAdmin.updateQField(${index},'maxScore',this.value)" style="width:50px;padding:3px 6px;border:1px solid #ddd;"></label>
          <label>标签: <input value="${this.escapeHtml(q.scoreLabel || '非常满意')}" onchange="SurveyAdmin.updateQField(${index},'scoreLabel',this.value)" style="width:70px;padding:3px 6px;border:1px solid #ddd;"></label>
        </div>
      `;
    }

    return `
      <div class="question-item" data-index="${index}" style="padding:12px 16px; border-bottom:1px solid #eee; background:${q.required ? '#fffdf7' : '#fff'};" draggable="true"
           ondragstart="SurveyAdmin.dragStart(event,${index})"
           ondragover="event.preventDefault()"
           ondrop="SurveyAdmin.drop(event,${index})">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
              <span style="cursor:move; color:#ccc; font-size:16px;" title="拖拽排序">☰</span>
              <span style="background:${this.getTypeColor(q.type)}; color:white; padding:1px 8px; border-radius:3px; font-size:11px;">${typeNames[q.type] || q.type}</span>
              ${q.required ? '<span style="color:#e74c3c; font-size:11px;">* 必填</span>' : ''}
              ${index > 0 ? `<button onclick="SurveyAdmin.moveQuestion(${index},-1)" style="border:none;background:none;cursor:pointer;" title="上移">↑</button>` : ''}
              ${index < this.currentQuestions.length - 1 ? `<button onclick="SurveyAdmin.moveQuestion(${index},1)" style="border:none;background:none;cursor:pointer;" title="下移">↓</button>` : ''}
            </div>
            <input id="qTitle_${index}" value="${this.escapeHtml(q.title || q.text || '')}" oninput="SurveyAdmin.onQuestionInput(${index},'title',this.value)" onchange="SurveyAdmin.onQuestionInput(${index},'title',this.value)"
                   style="width:100%;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:14px;font-weight:500;"
                   placeholder="输入题目...">
            ${optionsHtml}
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; margin-left:8px;">
            <label style="font-size:12px; white-space:nowrap;"><input type="checkbox" id="qRequired_${index}" ${q.required ? 'checked' : ''} onchange="SurveyAdmin.onQuestionInput(${index},'required',this.checked)"> 必填</label>
            <button onclick="SurveyAdmin.duplicateQuestion(${index})" style="border:1px solid #ddd; background:white; border-radius:3px; padding:2px 8px; cursor:pointer; font-size:11px;">复制</button>
            <button onclick="SurveyAdmin.deleteQuestion(${index})" style="border:1px solid #f44336; background:white; color:#f44336; border-radius:3px; padding:2px 8px; cursor:pointer; font-size:11px;">删除</button>
          </div>
        </div>
      </div>
    `;
  },

  // 渲染手机预览
  renderPreview(survey, questions) {
    return `
      <div style="border:1px solid #e0e0e0; border-radius:12px; overflow:hidden; background:white;">
        <div style="padding:12px; background:linear-gradient(135deg,#667eea,#764ba2); color:white;">
          <div style="font-weight:bold; font-size:15px;">${this.escapeHtml(survey.title)}</div>
          ${survey.description ? `<div style="font-size:11px; opacity:0.85; margin-top:2px;">${this.escapeHtml(survey.description)}</div>` : ''}
        </div>
        <div style="padding:12px;">
          ${questions.length === 0 ? '<div style="text-align:center; color:#999; padding:20px;">暂无题目</div>' : questions.map(q => this.renderPreviewQuestion(q)).join('')}
        </div>
        <div style="padding:12px; border-top:1px solid #eee; text-align:center;">
          <div style="background:#eee; color:#999; padding:8px; border-radius:6px; font-size:13px;">提交按钮（预览不可提交）</div>
        </div>
      </div>
    `;
  },

  renderPreviewQuestion(q) {
    const requiredMark = q.required ? '<span style="color:#e74c3c;">*</span>' : '';

    switch (q.type) {
      case 'radio':
        return `
          <div style="margin-bottom:12px;">
            <div style="font-size:13px; margin-bottom:6px;">${requiredMark}${this.escapeHtml(q.title || q.text || '')}</div>
            ${(q.options || []).map(o => `
              <label style="display:flex; align-items:center; gap:6px; padding:4px 0; font-size:12px;">
                <span style="width:14px;height:14px;border:1.5px solid #667eea;border-radius:50%;display:inline-block;flex-shrink:0;"></span>
                ${this.escapeHtml(o)}
              </label>
            `).join('')}
          </div>`;
      case 'checkbox':
        return `
          <div style="margin-bottom:12px;">
            <div style="font-size:13px; margin-bottom:6px;">${requiredMark}${this.escapeHtml(q.title || q.text || '')}</div>
            ${(q.options || []).map(o => `
              <label style="display:flex; align-items:center; gap:6px; padding:4px 0; font-size:12px;">
                <span style="width:14px;height:14px;border:1.5px solid #667eea;border-radius:3px;display:inline-block;flex-shrink:0;"></span>
                ${this.escapeHtml(o)}
              </label>
            `).join('')}
          </div>`;
      case 'text':
      case 'number':
      case 'date':
        return `
          <div style="margin-bottom:12px;">
            <div style="font-size:13px; margin-bottom:6px;">${requiredMark}${this.escapeHtml(q.title || q.text || '')}</div>
            <div style="border:1px solid #ddd; border-radius:4px; padding:6px 10px; font-size:12px; color:#bbb;">输入内容...</div>
          </div>`;
      case 'textarea':
        return `
          <div style="margin-bottom:12px;">
            <div style="font-size:13px; margin-bottom:6px;">${requiredMark}${this.escapeHtml(q.title || q.text || '')}</div>
            <div style="border:1px solid #ddd; border-radius:4px; padding:8px 10px; font-size:12px; color:#bbb; height:50px;">输入详细内容...</div>
          </div>`;
      case 'image':
        return `
          <div style="margin-bottom:12px;">
            <div style="font-size:13px; margin-bottom:6px;">${requiredMark}${this.escapeHtml(q.title || q.text || '')}</div>
            <div style="border:2px dashed #ddd; border-radius:6px; padding:16px; text-align:center; color:#bbb; font-size:12px;">📷 点击上传图片</div>
          </div>`;
      case 'rating':
        return `
          <div style="margin-bottom:12px;">
            <div style="font-size:13px; margin-bottom:6px;">${requiredMark}${this.escapeHtml(q.title || q.text || '')}</div>
            <div style="color:#ffb400; letter-spacing:2px;">★★★★★</div>
            <div style="font-size:11px; color:#999; margin-top:2px;">${this.escapeHtml(q.scoreLabel || '非常满意')}</div>
          </div>`;
      default:
        return `<div style="margin-bottom:12px; font-size:13px;">${requiredMark}${this.escapeHtml(q.title || q.text || '')}</div>`;
    }
  },

  // ---- 题目操作 ----
  addQuestion() {
    const typeSelect = document.getElementById('addQuestionType');
    const type = typeSelect ? typeSelect.value : 'radio';
    const newQ = {
      id: Date.now(),
      type,
      title: `新题目${this.currentQuestions.length + 1}`,
      required: true,
      sortOrder: this.currentQuestions.length
    };
    if (type === 'radio' || type === 'checkbox') newQ.options = ['选项1', '选项2', '选项3'];
    if (type === 'rating') { newQ.maxScore = 5; newQ.scoreLabel = '非常满意'; }

    this.currentQuestions.push(newQ);
    this.refreshEditor();
  },

  deleteQuestion(index) {
    if (!confirm('确定删除这道题目？')) return;
    this.currentQuestions.splice(index, 1);
    this.refreshEditor();
  },

  duplicateQuestion(index) {
    const original = JSON.parse(JSON.stringify(this.currentQuestions[index]));
    original.id = Date.now();
    original.title += ' (副本)';
    this.currentQuestions.splice(index + 1, 0, original);
    this.refreshEditor();
  },

  moveQuestion(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.currentQuestions.length) return;
    [this.currentQuestions[index], this.currentQuestions[newIndex]] = [this.currentQuestions[newIndex], this.currentQuestions[index]];
    this.refreshEditor();
  },

  onQuestionInput(index, field, value) {
    if (this.currentQuestions[index]) {
      this.currentQuestions[index][field] = value;
      if (field === 'title') this.refreshPreview();
    }
  },

  // 保存前强制从DOM读取最新题目数据（防止oninput未触发导致数据不同步）
  toggleInterpretation() {
    const rt = document.getElementById('editResultType')?.value;
    const sec = document.getElementById('interpretationSection');
    if (sec) sec.style.display = (rt === 'interpretation') ? 'block' : 'none';
  },

  uploadImage(fileInputId, previewContainerId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
    const file = fileInput.files[0];
    if (file.size > 5 * 1024 * 1024) { this.showToast('图片不能超过5MB'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      // 存到对应的 hidden input
      let hiddenId = 'coverData';
      if (fileInputId === 'editTopImage') hiddenId = 'topImageData';
      const hiddenEl = document.getElementById(hiddenId);
      if (hiddenEl) hiddenEl.value = dataUrl;
      // 显示预览
      const previewSec = document.getElementById(previewContainerId);
      if (previewSec) {
        previewSec.innerHTML = `<img src="${dataUrl}" style="max-width:200px;max-height:120px;border-radius:6px;border:1px solid #ddd;">`;
        previewSec.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  },

  forceSyncQuestionsFromDOM() {
    if (!this.currentQuestions) return;
    this.currentQuestions.forEach((q, index) => {
      // 读取标题
      const titleEl = document.getElementById('qTitle_' + index);
      if (titleEl) q.title = titleEl.value;
      // 读取是否必填
      const reqEl = document.getElementById('qRequired_' + index);
      if (reqEl) q.required = reqEl.checked;
    });
  },

  addOption(index) {
    if (this.currentQuestions[index]?.options) {
      this.currentQuestions[index].options.push(`选项${this.currentQuestions[index].options.length + 1}`);
      this.refreshEditor();
    }
  },

  removeOption(questionIndex, optionIndex) {
    const q = this.currentQuestions[questionIndex];
    if (q?.options && q.options.length > 1) {
      q.options.splice(optionIndex, 1);
      this.refreshEditor();
    }
  },

  updateOption(questionIndex, optionIndex, value) {
    const q = this.currentQuestions[questionIndex];
    if (q?.options) q.options[optionIndex] = value;
  },

  // 拖拽排序
  dragStart(e, index) {
    e.dataTransfer.setData('text/plain', index);
  },
  drop(e, targetIndex) {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (sourceIndex !== targetIndex) {
      const [moved] = this.currentQuestions.splice(sourceIndex, 1);
      this.currentQuestions.splice(targetIndex, 0, moved);
      this.refreshEditor();
    }
  },

  // 刷新编辑器和预览
  refreshEditor() {
    const listEl = document.getElementById('questionList');
    if (listEl) {
      listEl.innerHTML = this.currentQuestions.map((q, i) => this.renderQuestionEditor(q, i)).join('');
    }
    this.refreshPreview();
  },

  refreshPreview() {
    const previewEl = document.getElementById('previewPanel');
    if (previewEl && this.currentSurvey) {
      previewEl.innerHTML = this.renderPreview(this.currentSurvey, this.currentQuestions);
    }
  },

  // ---- 保存、发布等操作 ----
  async saveSurvey() {
    if (!this.currentSurvey) return;

    // 关键：保存前强制从DOM读取最新题目数据，防止oninput未触发导致数据不同步
    this.forceSyncQuestionsFromDOM();

    console.log('[问卷保存] 准备保存，题目数量:', this.currentQuestions.length);
    console.log('[问卷保存] 题目列表:', this.currentQuestions.map(q => ({ id: q.id, title: q.title, type: q.type })));

    // 收集基本设置
    const titleEl = document.getElementById('editTitle');
    const descEl = document.getElementById('editDesc');
    const typeEl = document.getElementById('editType');
    const resultTypeEl = document.getElementById('editResultType');
    const pwdEl = document.getElementById('editPassword');
    const publishTimeEl = document.getElementById('editPublishTime');
    const endTimeEl = document.getElementById('editEndTime');
    const coverDataEl = document.getElementById('coverData');
    const topImageDataEl = document.getElementById('topImageData');
    const interpretationEl = document.getElementById('editInterpretation');

    this.currentSurvey.title = titleEl?.value?.trim() || this.currentSurvey.title;
    this.currentSurvey.description = descEl?.value || '';
    this.currentSurvey.type = typeEl?.value || this.currentSurvey.type;
    this.currentSurvey.resultType = resultTypeEl?.value || 'survey';
    this.currentSurvey.interpretation = (this.currentSurvey.resultType === 'interpretation') ? (interpretationEl?.value || '') : '';
    this.currentSurvey.password = pwdEl?.value || '';
    this.currentSurvey.publishTime = publishTimeEl?.value ? new Date(publishTimeEl.value).toISOString() : null;
    this.currentSurvey.endTime = endTimeEl?.value ? new Date(endTimeEl.value).toISOString() : null;
    this.currentSurvey.cover = coverDataEl?.value || '';
    this.currentSurvey.topImage = topImageDataEl?.value || '';
    this.currentSurvey.allowAnonymous = document.getElementById('editAnonymous')?.checked || false;
    this.currentSurvey.collectName = document.getElementById('editCollectName')?.checked || false;
    this.currentSurvey.collectPhone = document.getElementById('editCollectPhone')?.checked || false;

    const res = await this.api('update', {
      id: this.currentSurvey.id,
      ...this.currentSurvey,
      questions: this.currentQuestions
    });

    if (res.success) {
      this.showToast('✅ 保存成功！');
      // 刷新当前页面标题
      const titleEl2 = document.getElementById('editorTitle');
      if (titleEl2) titleEl2.textContent = this.currentSurvey.title;
    } else {
      this.showToast('❌ 保存失败: ' + (res.message || '未知错误'));
    }
  },

  async editSurvey(id) {
    await this.renderSurveyEditor(id);
  },

  async publishSurvey(id) {
    if (!confirm('确定发布该问卷？发布后用户即可访问填写。')) return;
    const res = await this.api('publish', { id });
    if (res.success) {
      this.showToast('✅ 发布成功！');
      if (this.currentSurvey) {
        this.currentSurvey.status = 'published';
        this.refreshEditor();
      } else {
        this.loadSurveyList();
      }
    } else {
      this.showToast('❌ 发布失败: ' + (res.message || '未知错误'));
    }
  },

  async unpublishSurvey(id) {
    if (!confirm('确定下架该问卷？下架后用户将无法访问。')) return;
    const res = await this.api('unpublish', { id });
    if (res.success) {
      this.showToast('✅ 已下架');
      // 刷新列表以更新按钮状态
      this.loadSurveyList();
      if (this.currentSurvey) {
        this.currentSurvey.status = 'draft';
        this.refreshEditor();
      }
    } else {
      this.showToast('❌ 操作失败: ' + (res.message || '未知错误'));
    }
  },

  async deleteSurvey(id, title) {
    if (!confirm(`确定删除问卷「${title}」？\n\n⚠️ 该操作不可恢复！`)) return;
    const res = await this.api('delete', { id });
    if (res.success) {
      this.showToast('✅ 已删除');
      this.loadSurveyList();
    } else {
      this.showToast('❌ 删除失败: ' + (res.message || '未知错误'));
    }
  },

  // ---- 页面3：数据统计结果 ----
  async viewResults(surveyId) {
    const content = document.getElementById('pageContent');
    if (!content) {
      console.error('[问卷管理] pageContent 元素不存在');
      this.showToast('❌ 页面加载失败');
      return;
    }

    try {
      const res = await this.api('get', { id: surveyId });
      if (!res.success) {
        content.innerHTML = `<div style="text-align:center;padding:60px;color:#e74c3c;">${res.message || '加载失败'}</div>`;
        return;
      }

      // 修复：API返回的是完整的survey对象，不是嵌套结构
      this.currentSurvey = res.data || {};
      // 统一字段：以 title 为准（用户最后编辑的值）
      // 如果数据库同时存在 text 和 title，优先使用 title
      this.currentQuestions = (this.currentSurvey.questions || []).map(q => {
        // 用 title 覆盖 text，确保编辑后的值生效
        if (q.title) {
          q.text = q.title;  // 向后兼容：同步到 text
        } else if (q.text) {
          q.title = q.text;  // 向前兼容：迁移旧数据
        }
        return q;
      });
      
      // 获取该问卷的提交数据
      const responsesRes = await fetch('/api/admin/survey/user-responses', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(typeof Admin !== 'undefined' && Admin.token ? {'Authorization': 'Bearer ' + Admin.token} : {})
        }
      });
      const responsesData = await responsesRes.json();
      const allResponses = (responsesData.data || []).filter(r => r.surveyId === surveyId);
      
      // 保存到实例变量供导出使用
      this.currentResponses = allResponses;
      
      this.renderSurveyResults({ survey: this.currentSurvey, questions: this.currentQuestions, responses: allResponses });
    } catch(e) {
      console.error('[问卷管理] 加载数据出错:', e);
      content.innerHTML = `<div style="text-align:center;padding:60px;color:#e74c3c;">加载数据出错: ${e.message}</div>`;
    }
  },

  renderSurveyResults(data) {
    const s = this.currentSurvey;
    const questions = this.currentQuestions;
    const responses = data.responses || [];
    const content = document.getElementById('pageContent');

    content.innerHTML = `
      <div class="page-header">
        <h3>📊 数据统计 - ${this.escapeHtml(s.title)}</h3>
        <div style="display:flex; gap:8px;">
          <button class="primary-btn" style="background:#4caf50;" onclick="SurveyAdmin.exportData('csv')">📥 导出CSV</button>
          <button class="primary-btn" style="background:#2196F3;" onclick="SurveyAdmin.exportData('json')">📥 导出JSON</button>
          <button class="primary-btn" style="background:#f5f5f5;color:#666;" onclick="SurveyAdmin.renderSurveyList()">← 返回列表</button>
        </div>
      </div>

      <!-- 概览统计 -->
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px;">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2); color:white; padding:16px; border-radius:10px;">
          <div style="font-size:28px; font-weight:bold;">${responses.length}</div>
          <div style="opacity:0.85;">总提交数</div>
        </div>
        <div style="background:linear-gradient(135deg,#11998e,#38ef7d); color:white; padding:16px; border-radius:10px;">
          <div style="font-size:28px; font-weight:bold;">${s.viewCount || 0}</div>
          <div style="opacity:0.85;">浏览量</div>
        </div>
        <div style="background:linear-gradient(135deg,#fc4a1a,#f7b733); color:white; padding:16px; border-radius:10px;">
          <div style="font-size:28px; font-weight:bold;">${responses.length > 0 ? ((responses.length / Math.max(parseInt(s.viewCount) || 1, 1)) * 100).toFixed(1) : 0}%</div>
          <div style="opacity:0.85;">完成率</div>
        </div>
        <div style="background:linear-gradient(135deg,#ee0979,#ff6a00); color:white; padding:16px; border-radius:10px;">
          <div style="font-size:28px; font-weight:bold;">${questions.length}</div>
          <div style="opacity:0.85;">题目数</div>
        </div>
      </div>

      <!-- 各题统计图表 -->
      <div id="statsContainer" style="display:flex; flex-direction:column; gap:20px;">
        ${questions.map(q => this.renderQuestionStats(q, responses)).join('')}
      </div>

      <!-- 详细答卷列表 -->
      <details style="margin-top:24px; border:1px solid #e0e0e0; border-radius:8px; overflow:hidden;" open>
        <summary style="padding:12px 16px; background:#f8f9fa; cursor:pointer; font-weight:600;">📋 详细答卷 (${responses.length} 条)</summary>
        <div style="overflow-x:auto;">
          <table class="data-table" style="min-width:1000px;font-size:13px;">
            <thead>
              <tr>
                <th style="width:40px;">#</th>
                <th style="width:60px;">用户</th>
                <th style="width:80px;">昵称</th>
                <th style="width:70px;">用户ID</th>
                <th style="width:140px;">提交时间</th>
                ${questions.map(q => `<th style="min-width:100px;">${(q.title || q.text || '').substring(0, 10)}</th>`).join('')}
                <th style="width:50px;">操作</th>
              </tr>
            </thead>
            <tbody>
              ${responses.length === 0 ? '<tr><td colspan="99" style="text-align:center;padding:30px;color:#999;">暂无提交记录</td></tr>' :
                responses.map((r, ri) => `
                  <tr style="${r.read ? '' : 'background:#fffde7;'}">
                    <td>${ri + 1}</td>
                    <td><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;margin:0 auto;">${(r.nickname || '?').charAt(0)}</div></td>
                    <td><strong>${this.escapeHtml(r.nickname || '匿名')}</strong></td>
                    <td style="font-size:12px;color:#888;">${r.userId || '-'}</td>
                    <td style="white-space:nowrap;font-size:12px;color:#888;">${new Date(r.submittedAt).toLocaleString('zh-CN')}</td>
                    ${questions.map(q => `<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this.getAnswerText(r.answers, q.id)}">${this.getAnswerText(r.answers, q.id) || '-'}</td>`).join('')}
                    <td><button onclick="SurveyAdmin.viewResponseDetail(${ri})" style="border:1px solid #ddd;background:white;border-radius:3px;padding:2px 8px;cursor:pointer;font-size:11px;color:#1890ff;">查看</button></td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        </div>
      </details>
    `;

    // 渲染柱状图（纯CSS实现）
    this.renderCharts(questions, responses);
  },

  // 单题统计渲染
  renderQuestionStats(question, responses) {
    // 使用统一的答案提取方法（兼容对象和数组格式）
    const answers = this.extractAnswersForQuestion(responses, question.id);

    let statsHtml = '';
    if (answers.length === 0) {
      statsHtml = '<div style="color:#999; font-size:13px;">暂无回答</div>';
    } else if (question.type === 'radio' || question.type === 'checkbox') {
      // 选择题统计
      const optionCounts = {};
      (question.options || []).forEach(opt => optionCounts[opt] = 0);
      answers.forEach(a => {
        if (Array.isArray(a)) {
          a.forEach(v => { optionCounts[v] = (optionCounts[v] || 0) + 1; });
        } else {
          optionCounts[a] = (optionCounts[a] || 0) + 1;
        }
      });

      const maxCount = Math.max(...Object.values(optionCounts), 1);
      const colors = ['#667eea', '#26D0CE', '#FF6B6B', '#4CAF50', '#FFB400', '#E91E63', '#9C27B0', '#FF5722'];

      statsHtml = Object.entries(optionCounts).map(([opt, count], i) => `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
          <span style="width:80px; font-size:12px; text-align:right; flex-shrink:0; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(opt)}</span>
          <div style="flex:1; height:22px; background:#f0f0f0; border-radius:4px; position:relative; overflow:hidden; min-width:60px;">
            <div style="height:100%; width:${(count/maxCount)*100}%; background:${colors[i % colors.length]}; border-radius:4px; transition:width 0.5s ease; display:flex; align-items:center; padding-right:6px; justify-content:flex-end;">
              <span style="font-size:11px; color:white; font-weight:bold; white-space:nowrap;">${count}</span>
            </div>
          </div>
          <span style="width:45px; font-size:11px; color:#888; text-align:right;">(${((count/answers.length)*100).toFixed(0)}%)</span>
        </div>
      `).join('');
    } else if (question.type === 'rating') {
      // 评分统计
      const scores = answers.map(a => Number(a)).filter(n => !isNaN(n));
      const avgScore = scores.length > 0 ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : '-';
      statsHtml = `<div style="font-size:18px; color:#ffb400; font-weight:bold;">平均分: ${avgScore} ⭐</div>`;
    } else if (question.type === 'image') {
      statsHtml = `<div style="font-size:13px color:#666;">${answers.length} 人上传了图片</div>`;
    } else {
      // 文本题 - 显示回答数和部分内容
      const sampleAnswers = answers.slice(0, 3).map(a =>
        typeof a === 'string' ? (a || '').substring(0, 50) : String(a || '').substring(0, 50)
      );
      statsHtml = `
        <div style="font-size:13px; color:#666;">共 ${answers.length} 条回答</div>
        ${sampleAnswers.map(a => `<div style="font-size:12px; color:#888; margin-top:4px; padding:4px 8px; background:#f9f9f9; border-radius:4px;">"${this.escapeHtml(a)}"</div>`).join('')}
        ${answers.length > 3 ? `<div style="font-size:12px; color:#2196F3; cursor:pointer;">... 还有 ${answers.length - 3} 条</div>` : ''}
      `;
    }

    return `
      <div style="border:1px solid #e8e8e8; border-radius:10px; padding:16px; background:white;">
        <div style="font-weight:600; margin-bottom:12px; font-size:14px;">
          ${this.escapeHtml(question.text || question.title || '未命名题目')}
          <span style="font-weight:normal; color:#999; font-size:12px; margin-left:6px;">[${{radio:'单选',checkbox:'多选',text:'文本',textarea:'多行文本',number:'数字',date:'日期',image:'图片',rating:'评分'}[question.type]}] · ${answers.length} 回答</span>
        </div>
        ${statsHtml}
      </div>
    `;
  },

  // ===== 统一答案获取方法（兼容对象和数组格式）=====
  // 获取某个问题的答案
  getAnswerValue(answers, questionId) {
    if (!answers) return '';
    // 数组格式: [{questionId: 'q1', answer: 'xxx'}]
    if (Array.isArray(answers)) {
      const item = answers.find(a => a.questionId === questionId);
      return item ? item.answer : '';
    }
    // 对象格式: {q1: 'xxx', q2: 'yyy'}
    return answers[questionId] || '';
  },

  // 获取答案文本（用于表格显示）
  getAnswerText(answers, questionId) {
    const val = this.getAnswerValue(answers, questionId);
    if (!val) return '';
    // 图片类型显示为[图片]
    if (typeof val === 'string' && val.startsWith('data:image')) return '[📷 图片]';
    if (typeof val === 'string') return val.substring(0, 50);
    if (Array.isArray(val)) return val.join(', ').substring(0, 50);
    return String(val).substring(0, 50);
  },

  // 将对象格式的answers转换为数组格式
  normalizeAnswers(answers) {
    if (!answers) return [];
    if (Array.isArray(answers)) return answers;
    return Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
  },

  // 从responses中提取某题的所有答案（用于统计）
  extractAnswersForQuestion(responses, questionId) {
    const result = [];
    responses.forEach(r => {
      if (!r.answers) return;
      if (Array.isArray(r.answers)) {
        const found = r.answers.find(a => a.questionId === questionId);
        if (found) result.push(found.answer);
      } else {
        // 对象格式
        if (r.answers[questionId] !== undefined) {
          result.push(r.answers[questionId]);
        }
      }
    });
    return result;
  },

  renderCharts(questions, responses) {
    // 图表已在 renderQuestionStats 中通过纯CSS柱状图实现
    // 此处可扩展为 Chart.js 或其他图表库
  },

  // 导出数据
  async exportData(format) {
    if (!this.currentSurvey) return;
    
    // 使用 fetch + token 认证，而不是直接 window.open（避免 401 错误）
    const token = localStorage.getItem('adminToken') || (typeof Admin !== 'undefined' && Admin.token ? Admin.token : '');
    
    if (format === 'csv') {
      // 导出 CSV
      const csvContent = this.generateCSV(this.currentSurvey, this.currentQuestions, this.currentResponses || []);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `问卷_${this.currentSurvey.title}_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
      this.showToast('✅ CSV导出成功');
    } else if (format === 'json') {
      // 导出 JSON
      const jsonContent = JSON.stringify({
        survey: this.currentSurvey,
        questions: this.currentQuestions,
        responses: this.currentResponses || []
      }, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `问卷_${this.currentSurvey.title}_${new Date().toISOString().slice(0,10)}.json`;
      link.click();
      this.showToast('✅ JSON导出成功');
    }
  },
  
  // 生成 CSV 内容
  generateCSV(survey, questions, responses) {
    // 表头：提交时间、用户昵称、用户ID（5位数），然后按题目顺序排
    const headers = ['提交时间', '用户昵称', '用户ID'];
    questions.forEach(q => headers.push(q.title || q.text || ''));
    let csv = headers.map(h => `"${h}"`).join(',') + '\n';
    
    // 数据行
    responses.forEach(r => {
      // 提取用户ID（5位数）
      let userId5 = '';
      if (r.userId) {
        // 如果是数字格式，直接使用；否则取最后5位
        if (/^\d{5}$/.test(String(r.userId))) {
          userId5 = r.userId;
        } else {
          const match = String(r.userId).match(/(\d{1,5})$/);
          userId5 = match ? match[1] : String(r.userId).slice(-5);
        }
      }
      
      const row = [
        r.submittedAt ? new Date(r.submittedAt).toLocaleString('zh-CN') : '',
        r.nickname || '',
        userId5 || r.userId || ''
      ];
      
      // 按题目顺序填入答案（使用统一的答案获取方法）
      questions.forEach(q => {
        const value = this.getAnswerText(r.answers, q.id);
        // CSV转义：双引号替换为两个双引号
        row.push(value.replace(/"/g, '""'));
      });
      
      csv += row.map(v => `"${v}"`).join(',') + '\n';
    });
    
    return csv;
  },

  // 查看单条答卷详情
  viewResponseDetail(index) {
    const responses = this.currentResponses || [];
    if (index < 0 || index >= responses.length) return;
    
    const r = responses[index];
    const questions = this.currentQuestions || [];
    
    // 构建详情HTML
    let detailHtml = `
      <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this)this.remove()" id="detailModal">
        <div style="background:white;border-radius:12px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;border-bottom:1px solid #eee;padding-bottom:16px;">
            <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#667eea,#764ba2);color:white;display:flex;align-items:center;justify-content:center;font-size:18px;">${(r.nickname || '?').charAt(0)}</div>
            <div>
              <div style="font-size:18px;font-weight:bold;color:#333;">${this.escapeHtml(r.nickname || '匿名')}</div>
              <div style="font-size:13px;color:#888;">用户ID: ${r.userId || '-'} &nbsp;|&nbsp; 提交时间: ${new Date(r.submittedAt).toLocaleString('zh-CN')}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:16px;">
    `;
    
    questions.forEach(q => {
      const answer = this.getAnswerText(r.answers, q.id);
      let displayAnswer = answer;
      
      // 对于长文本，显示完整内容
      const fullAnswer = this.getAnswerValue(r.answers, q.id);
      if (q.type === 'image' && fullAnswer) {
        displayAnswer = `<img src="${fullAnswer}" style="max-width:100%;max-height:300px;border-radius:8px;cursor:pointer;" onclick="window.open(this.src)">`;
        // 表格中也加个下载按钮提示
      } else if (q.type === 'textarea' && fullAnswer) {
        displayAnswer = String(fullAnswer).replace(/\n/g, '<br>');
      }
      
      detailHtml += `
        <div style="border-bottom:1px solid #f5f5f5;padding-bottom:12px;">
          <div style="font-weight:600;font-size:14px;color:#333;margin-bottom:6px;">${this.escapeHtml(q.text || q.title)}</div>
          <div style="font-size:14px;color:#555;background:#f9f9fb;padding:10px 12px;border-radius:6px;line-height:1.6;">
            ${displayAnswer || '<span style="color:#ccc">未填写</span>'}
          </div>
        </div>
      `;
    });
    
    detailHtml += `
          </div>
          <div style="text-align:right;margin-top:20px;padding-top:16px;border-top:1px solid #eee;">
            <button onclick="document.getElementById('detailModal').remove()" style="padding:8px 24px;border:none;background:#1890ff;color:white;border-radius:6px;cursor:pointer;font-size:14px;">关闭</button>
          </div>
        </div>
      </div>
    `;
    
    // 移除旧弹窗，添加新弹窗
    const oldModal = document.getElementById('detailModal');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', detailHtml);
  },

  // ---- 工具函数 ----
  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  getTypeColor(type) {
    const colors = { radio:'#2196F3', checkbox:'#9C27B0', text:'#607D8B', textarea:'#795548', number:'#FF9800', date:'#00BCD4', image:'#E91E63', rating:'#FFB400' };
    return colors[type] || '#666';
  },

  showToast(msg) {
    // 复用现有的 toast 或自行显示
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = msg;
      toast.style.display = 'block';
      toast.className = 'toast show';
      setTimeout(() => { toast.style.display = ''; toast.className = 'toast'; }, 2500);
    } else {
      alert(msg);
    }
  }
};

// ====== 自动初始化 ======
if (typeof SurveyAdmin !== 'undefined') {
  SurveyAdmin.init();
}
