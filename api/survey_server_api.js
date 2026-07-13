/**
 * ============================================
 * SM婚恋系统 v1.0.2 - 问卷管理后端API
 * 
 * 使用方法：将此文件全部内容复制，粘贴到 zeai_server.js 文件末尾即可
 * 前置条件：需要先执行 data/survey_schema.sql 创建数据表
 * ============================================
 */

// ====== 问卷管理 - 数据库表初始化 ======
const SURVEY_DB_INIT_SQL = `
CREATE TABLE IF NOT EXISTS surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT DEFAULT 'custom' CHECK(type IN ('male','female','custom')),
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft','published','closed')),
  password TEXT DEFAULT '',
  allowAnonymous INTEGER DEFAULT 0,
  collectName INTEGER DEFAULT 0,
  collectPhone INTEGER DEFAULT 0,
  viewCount INTEGER DEFAULT 0,
  responseCount INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS survey_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surveyId INTEGER NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'radio',
  options TEXT,           -- JSON array for radio/checkbox
  required INTEGER DEFAULT 1,
  sortOrder INTEGER DEFAULT 0,
  extraSettings TEXT,     -- JSON: {maxScore, scoreLabel, placeholder, maxLength}
  FOREIGN KEY (surveyId) REFERENCES surveys(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  surveyId INTEGER NOT NULL,
  submitterName TEXT DEFAULT '',
  submitterPhone TEXT DEFAULT '',
  ipAddress TEXT,
  userAgent TEXT,
  submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (surveyId) REFERENCES surveys(id)
);

CREATE TABLE IF NOT EXISTS survey_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  responseId INTEGER NOT NULL,
  questionId INTEGER NOT NULL,
  answer TEXT,
  FOREIGN KEY (responseId) REFERENCES survey_responses(id) ON DELETE CASCADE
);
`;

// ====== 初始化数据库表 ======
function initSurveyDB() {
  try {
    db.exec(SURVEY_DB_INIT_SQL);
    console.log('[问卷模块] 数据库表初始化完成');
    return true;
  } catch(e) {
    console.error('[问卷模块] 数据库初始化失败:', e.message);
    return false;
  }
}

// 在服务启动时自动调用一次（放在路由注册之前）
initSurveyDB();

// ====== 预置模板数据 ======
const SURVEY_TEMPLATES = {
  male: {
    title: 'StarMeet个人信息收集表（男性客户）',
    description: '男性客户匹配申请表 - 用于了解您的择偶需求和基本信息',
    type: 'male',
    questions: [
      { title: '您的姓名/昵称', type: 'text', required: true, sortOrder: 0 },
      { title: '您的年龄', type: 'number', required: true, sortOrder: 1 },
      { title: '您所在的国家/地区', type: 'text', required: true, sortOrder: 2 },
      { title: '您所在的城市', type: 'text', required: true, sortOrder: 3 },
      { title: '您的身高(cm)', type: 'number', required: true, sortOrder: 4 },
      { title: '您的职业', type: 'text', required: true, sortOrder: 5 },
      { title: '您的年收入范围(万元)', type: 'text', required: false, options: ['10万以下','10-20万','20-50万','50-100万','100万以上'], sortOrder: 6 },
      { title: '您的微信(选填)', type: 'text', required: false, sortOrder: 7 },
      { title: '您的主要交友目标是什么？', type: 'radio', required: true, options: ['认真交往/结婚','恋爱/长期伴侣','交朋友/扩大社交圈','其他'], sortOrder: 8 },
      { title: '您希望的发展节奏是？', type: 'radio', required: true, options: ['先从朋友开始慢慢了解','较快进入正式关系','看感觉顺其自然'], sortOrder: 9 },
      { title: '您是否接受以结婚为目的的交往？', type: 'radio', required: true, options: ['是，我认真考虑结婚','目前不确定，看情况发展','暂时不考虑结婚'], sortOrder: 10 },
      { title: '您期望对方的年龄范围？', type: 'checkbox', required: true, options: ['18-22岁','23-26岁','27-30岁','31-35岁','36岁以上'], sortOrder: 11 },
      { title: '对方是否可以有孩子？', type: 'radio', required: true, options: ['接受有孩子的','不接受','视情况而定'], sortOrder: 12 },
      { title: '您对外貌的偏好？（可多选）', type: 'checkbox', required: false, options: ['身材匀称','皮肤白皙','五官精致','气质优雅','可爱型','成熟型','运动健美型'], sortOrder: 13 },
      { title: '您最看重对方的性格特质？（可多选）', type: 'checkbox', required: true, options: ['温柔体贴','善良真诚','独立自信','幽默风趣','孝顺顾家','聪明睿智','积极上进','善解人意'], sortOrder: 14 },
      { title: '语言沟通方面？', type: 'checkbox', required: false, options: ['中文流利','会一些英文','只会本国语言','愿意学习中文'], sortOrder: 15 },
      { title: '您是否愿意来中国生活/工作？', type: 'radio', required: true, options: ['非常愿意','可以考虑','需要时间适应','不太确定','不愿意'], sortOrder: 16 },
      { title: '如果对方需要签证帮助，您是否愿意提供支持？', type: 'radio', required: true, options: ['可以全力支持','可以提供部分帮助','需要具体了解后再决定','比较困难'], sortOrder: 17 },
      { title: '您对未来生活的期望？', type: 'textarea', required: false, sortOrder: 18 },
      { title: '请描述一下自己的性格和生活方式', type: 'textarea', required: true, sortOrder: 19 },
      { title: '您的兴趣爱好有哪些？(可多选)', type: 'checkbox', required: false, options: ['运动健身','阅读旅行','音乐电影','美食烹饪','电子游戏','户外探险','艺术文化','其他'], sortOrder: 20 },
      { title: '您是否有跨国恋或跨文化交往的经验？', type: 'radio', required: false, options: ['有丰富经验','有一些经验','完全没有但很期待'], sortOrder: 21 },
      { title: '您是否同意进行视频验证？', type: 'radio', required: true, options: ['同意','不同意','需要先了解详情'], sortOrder: 22 },
      { title: '请上传您的真实照片(至少2张)', type: 'image', required: true, sortOrder: 23 },
      { title: '您对付费匹配服务的意愿如何？', type: 'radio', required: false, options: ['非常愿意付费获得优质服务','可以考虑付费','倾向于免费服务','暂不考虑'], sortOrder: 24 },
      { title: '您希望的预算范围是多少？', type: 'radio', required: false, options: ['1000元以下','1000-5000元','5000-10000元','10000元以上','不限'], sortOrder: 25 },
      { title: '补充说明或其他想告诉我们的信息', type: 'textarea', required: false, sortOrder: 26 }
    ]
  },

  female: {
    title: 'StarMeet个人信息收集表（女性用户）',
    description: '女性用户信息收集表 - 帮助我们为您匹配合适的对象',
    type: 'female',
    questions: [
      { title: '您的姓名/昵称', type: 'text', required: true, sortOrder: 0 },
      { title: '您的年龄', type: 'number', required: true, sortOrder: 1 },
      { title: '您所在的城市', type: 'text', required: true, sortOrder: 2 },
      { title: '您的身高(cm)', type: 'number', required: true, sortOrder: 3 },
      { title: '您的体重(kg)(选填)', type: 'number', required: false, sortOrder: 4 },
      { title: '您的职业', type: 'text', required: true, sortOrder: 5 },
      { title: '您的最高学历', type: 'radio', required: true, options: ['高中及以下','大专','本科','硕士','博士'], sortOrder: 6 },
      { title: '您的微信(选填)', type: 'text', required: false, sortOrder: 7 },
      { title: '请上传至少5张近期生活照', type: 'image', required: true, sortOrder: 8 },
      { title: '您是否同意视频验证真实性？', type: 'radio', required: true, options: ['同意','不同意','需要了解更多'], sortOrder: 9 },
      { title: '您如何评价自己的外貌？', type: 'radio', required: false, options: ['非常满意','比较满意','一般','不太好评价'], sortOrder: 10 },
      { title: '是否允许公开展示照片？', type: 'radio', required: true, options: ['完全公开','仅对认证会员可见','仅对管理员可见','不公开'], sortOrder: 11 },
      { title: '您的交友目标是什么？', type: 'radio', required: true, options: ['认真交往/结婚','长期稳定关系','交朋友扩大社交','其他'], sortOrder: 12 },
      { title: '您是否接受外国男生作为交往对象？', type: 'radio', required: true, options: ['非常欢迎','可以考虑','只接受本国人','不确定'], sortOrder: 13 },
      { title: '您是否愿意进行长期稳定的交往？', type: 'radio', required: true, options: ['是的，我很认真','看缘分','先接触看看再说','暂时不想太严肃的关系'], sortOrder: 14 },
      { title: '您是否愿意通过视频聊天与潜在对象交流？', type: 'radio', required: true, options: ['非常愿意','可以考虑','需要一定了解后','不太习惯视频聊天'], sortOrder: 15 },
      { title: '您是否考虑未来出国生活？', type: 'radio', required: true, options: ['非常愿意','可以考虑','需要时间和机会','暂时不考虑'], sortOrder: 16 },
      { title: '您期望对方的年龄范围？', type: 'checkbox', required: true, options: ['22-28岁','29-35岁','36-42岁','43-50岁','50岁以上'], sortOrder: 17 },
      { title: '您最看重对方哪些品质？(最多选3个)', type: 'checkbox', required: true, options: ['经济实力','外貌气质','性格温和','责任心','幽默感','学历背景','家庭背景','共同兴趣'], sortOrder: 18 },
      { title: '请简单介绍一下自己', type: 'textarea', required: true, sortOrder: 19 },
      { title: '您的兴趣爱好？(可多选)', type: 'checkbox', required: false, options: ['音乐舞蹈','绘画艺术','运动健身','旅行摄影','美食烹饪','阅读写作','时尚美容','其他'], sortOrder: 20 },
      { title: '补充说明', type: 'textarea', required: false, sortOrder: 21 }
    ]
  }
};

// ====== 路由：/api/survey ======
app.post('/api/survey', async (req, res) => {
  try {
    const { action } = req.body;
    
    switch(action) {

      // ---- 问卷 CRUD ----
      case 'list': {
        const { search = '', status = '', type = '' } = req.body;
        let sql = `SELECT s.*,
          (SELECT COUNT(*) FROM survey_responses WHERE surveyId=s.id) as responseCount,
          (SELECT COUNT(*) FROM survey_responses WHERE surveyId=s.id AND DATE(submittedAt)=DATE('now')) as todayCount
          FROM surveys s WHERE 1=1`;
        const params = [];
        if (search) { sql += ` AND s.title LIKE ?`; params.push(`%${search}%`); }
        if (status) { sql += ` AND s.status=?`; params.push(status); }
        if (type) { sql += ` AND s.type=?`; params.push(type); }
        sql += ` ORDER BY s.createdAt DESC`;

        const surveys = db.prepare(sql).all(...params).map(s => ({
          ...s,
          questionCount: getQuestionCount(s.id)
        }));
        
        return res.json({ success: true, data: surveys });
      }

      case 'get': {
        const { id } = req.body;
        const survey = db.prepare('SELECT * FROM surveys WHERE id=?').get(id);
        if (!survey) return res.json({ success: false, message: '问卷不存在' });
        
        const questions = db.prepare('SELECT * FROM survey_questions WHERE surveyId=? ORDER BY sortOrder ASC').all(id).map(q => ({
          ...q,
          options: q.options ? JSON.parse(q.options) : [],
          extraSettings: q.extraSettings ? JSON.parse(q.extraSettings) : {}
        }));

        return res.json({ success: true, data: { survey, questions } });
      }

      case 'create': {
        const { title, description = '', type = 'custom' } = req.body;
        if (!title || !title.trim()) return res.json({ success: false, message: '标题不能为空' });

        const result = db.prepare(
          'INSERT INTO surveys (title, description, type) VALUES (?, ?, ?)'
        ).run(title.trim(), description, type);

        return res.json({ success: true, message: '创建成功', data: { id: result.lastInsertRowid } });
      }

      case 'update': {
        const { id, title, description, type, password, allowAnonymous, collectName, collectPhone, questions } = req.body;
        
        db.prepare(`UPDATE surveys SET title=?, description=?, type=?, password=?, allowAnonymous=?, collectName=?, collectPhone=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?`)
          .run(title, description, type, password||'', allowAnonymous?1:0, collectName?1:0, collectPhone?1:0, id);

        // 更新题目
        if (Array.isArray(questions)) {
          db.prepare('DELETE FROM survey_questions WHERE surveyId=?').run(id);
          
          const insertQ = db.prepare(
            'INSERT INTO survey_questions (surveyId, title, type, options, required, sortOrder, extraSettings) VALUES (?,?,?,?,?,?,?)'
          );
          
          questions.forEach((q, i) => {
            insertQ.run(id, q.title, q.type,
              JSON.stringify(q.options || []),
              q.required ? 1 : 0,
              i,
              JSON.stringify({ maxScore: q.maxScore, scoreLabel: q.scoreLabel, placeholder: q.placeholder, maxLength: q.maxLength })
            );
          });
        }

        return res.json({ success: true, message: '保存成功' });
      }

      case 'delete': {
        const { id } = req.body;
        db.prepare('DELETE FROM survey_answers WHERE responseId IN (SELECT id FROM survey_responses WHERE surveyId=?)').run(id);
        db.prepare('DELETE FROM survey_responses WHERE surveyId=?').run(id);
        db.prepare('DELETE FROM survey_questions WHERE surveyId=?').run(id);
        db.prepare('DELETE FROM surveys WHERE id=?').run(id);
        return res.json({ success: true, message: '已删除' });
      }

      case 'publish': {
        const { id } = req.body;
        db.prepare("UPDATE surveys SET status='published', updatedAt=CURRENT_TIMESTAMP WHERE id=?").run(id);
        return res.json({ success: true, message: '发布成功' });
      }

      case 'unpublish': {
        const { id } = req.body;
        db.prepare("UPDATE surveys SET status='draft', updatedAt=CURRENT_TIMESTAMP WHERE id=?").run(id);
        return res.json({ success: true, message: '已下架' });
      }

      // ---- 从模板创建 ----
      case 'createFromTemplate': {
        const { templateType } = req.body;
        const template = SURVEY_TEMPLATES[templateType];
        if (!template) return res.json({ success: false, message: '模板不存在' });

        const result = db.prepare(
          'INSERT INTO surveys (title, description, type) VALUES (?, ?, ?)'
        ).run(template.title, template.description, template.type);

        const surveyId = result.lastInsertRowid;

        const insertQ = db.prepare(
          'INSERT INTO survey_questions (surveyId, title, type, options, required, sortOrder) VALUES (?,?,?,?,?,?)'
        );

        template.questions.forEach((q, i) => {
          insertQ.run(surveyId, q.title, q.type, JSON.stringify(q.options || []), q.required ? 1 : 0, i);
        });

        return res.json({ success: true, message: '模板创建成功', data: { id: surveyId } });
      }

      // ---- 数据统计 ----
      case 'stats': {
        const stats = db.prepare(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) as published,
            SUM(responseCount) as totalResponses
          FROM surveys
        `).get();

        return res.json({ success: true, data: stats });
      }

      // ---- 导出 ----
      case 'export': {
        const { id, format = 'csv' } = req.body;
        const survey = db.prepare('SELECT * FROM surveys WHERE id=?').get(id);
        if (!survey) return res.json({ success: false, message: '问卷不存在' });

        const questions = db.prepare('SELECT * FROM survey_questions WHERE surveyId=? ORDER BY sortOrder ASC').all(id);
        const responses = db.prepare('SELECT * FROM survey_responses WHERE surveyId=? ORDER BY submittedAt DESC').all(id);

        if (format === 'json') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Content-Disposition', `attachment; filename=survey_${id}_export.json`);
          return res.send(JSON.stringify({ survey, questions, responses }, null, 2));
        }

        // CSV 格式
        let csv = '\uFEFF'; // BOM for Excel UTF-8
        csv += '序号,提交时间,提交者姓名,手机号,' + questions.map((q,i)=>`Q${i+1}_${q.title.replace(/,/g,'，')}`).join(',') + '\n';

        responses.forEach((r, ri) => {
          const answers = db.prepare('SELECT questionId, answer FROM survey_answers WHERE responseId=?').all(r.id);
          csv += `${ri+1},${r.submittedAt},${r.submitterName||''},${r.submitterPhone||''}`;
          questions.forEach(q => {
            const ans = answers.find(a => a.questionId === q.id);
            let val = ans ? ans.answer : '';
            val = String(val).replace(/"/g, '""').replace(/\n/g, ' ');
            csv += `,"${val}"`;
          });
          csv += '\n';
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=survey_${id}_export.csv`);
        return res.send(csv);
      }

      default:
        return res.json({ success: false, message: '未知操作: ' + action });
    }

  } catch(e) {
    console.error('[问卷API] 错误:', e);
    return res.status(500).json({ success: false, message: '服务器内部错误: ' + e.message });
  }
});

// ====== H5前端API：获取问卷信息 & 提交答案 ======

// GET /h5/api/survey/:id - 公开接口，H5页面获取问卷信息
app.get('/h5/api/survey/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const survey = db.prepare('SELECT id,title,description,status,password,allowAnonymous,collectName,collectPhone FROM surveys WHERE id=?').get(id);
    if (!survey) return res.json({ success: false, message: '问卷不存在' });
    
    if (survey.status !== 'published') return res.json({ success: false, message: '该问卷尚未发布' });

    const questions = db.prepare('SELECT id,title,type,options,required,extraSettings FROM survey_questions WHERE surveyId=? ORDER BY sortOrder ASC').all(id)
      .map(q => ({ ...q, options: q.options ? JSON.parse(q.options) : [], extraSettings: q.extraSettings ? JSON.parse(q.extraSettings) : {} }));

    return res.json({ success: true, data: { survey, questions } });
  } catch(e) {
    console.error('[问卷GET] 错误:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// POST /h5/api/survey/:id/submit - H5提交答案
app.post('/h5/api/survey/:id/submit', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const survey = db.prepare('SELECT id,status,password FROM surveys WHERE id=?').get(id);
    if (!survey) return res.json({ success: false, message: '问卷不存在' });
    if (survey.status !== 'published') return res.json({ success: false, message: '该问卷未开放提交' });
    if (survey.password && survey.password !== (req.body.password || '')) return res.json({ success: false, message: '密码不正确' });

    const { name, phone, answers } = req.body;
    if (!answers || !Array.isArray(answers)) return res.json({ success: false, message: '缺少答案数据' });

    // 记录浏览+1
    db.prepare('UPDATE surveys SET responseCount=responseCount+1 WHERE id=?').run(id);

    // 创建响应记录
    const result = db.prepare(
      'INSERT INTO survey_responses (surveyId, submitterName, submitterPhone, ipAddress, userAgent) VALUES (?,?,?,?,?)'
    ).run(id, name || '', phone || '', req.ip || '', req.headers['user-agent'] || '');

    const responseId = result.lastInsertRowid;

    // 保存每个答案
    const insertAns = db.prepare('INSERT INTO survey_answers (responseId, questionId, answer) VALUES (?,?,?)');
    answers.forEach(a => {
      insertAns.run(responseId, a.questionId, typeof a.answer === 'object' ? JSON.stringify(a.answer) : a.answer);
    });

    return res.json({ success: true, message: '提交成功！感谢您的参与 🎉' });
  } catch(e) {
    console.error('[问卷SUBMIT] 错误:', e);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// GET /h5/api/survey/:id/view - 记录浏览量
app.get('/h5/api/survey/:id/view', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    db.prepare('UPDATE surveys SET viewCount=viewCount+1 WHERE id=?').run(id);
    return res.json({ success: true });
  } catch(e) {
    return res.json({ success: true }); // 浏览计数失败不影响使用
  }
});

// ====== 辅助函数 ======
function getQuestionCount(surveyId) {
  const row = db.prepare('SELECT COUNT(*) as cnt FROM survey_questions WHERE surveyId=?').get(surveyId);
  return row ? row.cnt : 0;
}

console.log('[SM婚恋系统] ✅ 问卷管理模块 API 已加载');
