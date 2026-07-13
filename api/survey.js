/**
 * =====================================================
 * StarMeet 问卷管理 - 后端 API 模块
 * 文件: api/survey.js
 * 依赖: Node.js + SQLite3 (better-sqlite3 或 sqlite3)
 * 参考: 问卷星 (Wenjuanxing/SurveyStar) API 设计
 * =====================================================
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SurveyAPI {
    constructor(dbPath, app) {
        this.dbPath = dbPath || path.join(__dirname, '../data/starmeet.db');
        this.db = null;
        this.app = app;
        this.init();
    }

    init() {
        // 初始化数据库连接
        try {
            const Database = require('better-sqlite3') || require('sqlite3').verbose();
            if (Database.prototype && Database.prototype.prepare) {
                // better-sqlite3 (同步)
                this.db = new Database(this.dbPath);
                this.db.pragma('journal_mode = WAL');
                this.isAsync = false;
            } else {
                // sqlite3 (异步)
                this.db = new (require('sqlite3').Database)(this.dbPath);
                this.isAsync = true;
            }
            console.log('[Survey] 数据库连接成功:', this.dbPath);
        } catch(e) {
            console.error('[Survey] 数据库连接失败，尝试创建:', e.message);
        }
        this.registerRoutes();
    }

    /**
     * 注册所有 API 路由
     */
    registerRoutes() {
        const api = this.app || { get: () => {}, post: () => {}, put: () => {}, delete: () => {} };

        // ==================== 问卷 CRUD ====================

        // 获取问卷列表（支持分页、筛选）
        api.get('/api/surveys', (req, res) => this.getSurveyList(req, res));

        // 获取单个问卷详情（含题目）
        api.get('/api/surveys/:id', (req, res) => this.getSurveyDetail(req, res));

        // 创建问卷
        api.post('/api/surveys', (req, res) => this.createSurvey(req, res));

        // 更新问卷基本信息
        api.put('/api/surveys/:id', (req, res) => this.updateSurvey(req, res));

        // 删除/恢复问卷（软删除）
        api.delete('/api/surveys/:id', (req, res) => this.deleteSurvey(req, res));

        // 复制问卷
        api.post('/api/surveys/:id/copy', (req, res) => this.copySurvey(req, res));

        // 更新问卷状态（发布/关闭）
        api.put('/api/surveys/:id/status', (req, res) => this.updateSurveyStatus(req, res));

        // ==================== 题目管理 ====================

        // 获取问卷的所有题目
        api.get('/api/surveys/:id/questions', (req, res) => this.getQuestions(req, res));

        // 添加题目
        api.post('/api/surveys/:id/questions', (req, res) => this.addQuestion(req, res));

        // 批量保存题目排序和内容
        api.put('/api/surveys/:id/questions', (req, res) => this.saveQuestions(req, res));

        // 更新单个题目
        api.put('/api/questions/:qid', (req, res) => this.updateQuestion(req, res));

        // 删除题目
        api.delete('/api/questions/:qid', (req, res) => this.deleteQuestion(req, res));

        // 排序调整
        api.put('/api/surveys/:id/questions/reorder', (req, res) => this.reorderQuestions(req, res));

        // ==================== 提交与数据 ====================

        // H5端：获取可填写问卷信息（不含答案）
        api.get('/api/public/survey/:code', (req, res) => this.getPublicSurvey(req, res));

        // H5端：提交问卷回答
        api.post('/api/public/survey/:code/submit', (req, res) => this.submitResponse(req, res));

        // 获取提交记录列表
        api.get('/api/surveys/:id/responses', (req, res) => this.getResponseList(req, res));

        // 获取单条提交详情
        api.get('/api/responses/:rid', (req, res) => this.getResponseDetail(req, res));

        // 删除提交记录
        api.delete('/api/responses/:rid', (req, res) => this.deleteResponse(req, res));

        // 导出数据（Excel/CSV）
        api.get('/api/surveys/:id/export', (req, res) => this.exportData(req, res));

        // 统计概览
        api.get('/api/surveys/:id/stats', (req, res) => this.getSurveyStats(req, res));

        // ==================== 模板相关 ====================

        // 创建预设模板
        api.post('/api/surveys/templates/male', (req, res) => this.createMaleTemplate(req, res));
        api.post('/api/surveys/templates/female', (req, res) => this.createFemaleTemplate(req, res));
    }

    // ==================== 工具方法 ====================

    /** JSON 安全解析 */
    safeParse(str, fallback) {
        try { return JSON.parse(str); } catch(e) { return fallback || (Array.isArray(fallback) ? [] : {}); }
    }

    /** 生成分享链接标识码 */
    generateShareCode() {
        return crypto.randomBytes(6).toString('base64url').substring(0, 8).toLowerCase();
    }

    /** 统一响应格式 */
    success(res, data, message = 'success') {
        res.json({ code: 0, data, message });
    }

    error(res, message, code = -1) {
        res.json({ code, message, data: null });
    }

    /** 从请求获取参数 */
    getParams(req) {
        return req.method === 'GET' ? req.query : req.body;
    }

    // ==================== 问卷列表 API ====================
    async getSurveyList(req, res) {
        try {
            const params = this.getParams(req);
            const page = parseInt(params.page) || 1;
            const pageSize = parseInt(params.pageSize) || 10;
            const status = params.status;           // draft/published/closed
            const type = params.type;               // male/female/custom
            const keyword = params.keyword || '';   // 搜索关键词

            let where = "WHERE deleted_at IS NULL";
            const binds = [];

            if (status) { where += " AND status = ?"; binds.push(status); }
            if (type) { where += " AND type = ?"; binds.push(type); }
            if (keyword) { where += " AND title LIKE ?"; binds.push(`%${keyword}%`); }

            const countSql = `SELECT COUNT(*) as total FROM surveys ${where}`;
            const listSql = `${where} ORDER BY updated_at DESC LIMIT ${pageSize} OFFSET ${(page-1)*pageSize}`;

            let total, rows;
            if (!this.isAsync) {
                total = this.db.prepare(countSql).get(...binds)?.total || 0;
                rows = this.db.prepare(`SELECT * FROM surveys ${listSql}`).all(...binds);
            } else {
                total = await new Promise((resolve, reject) =>
                    this.db.get(countSql, ...binds, (err, row) => resolve(err ? 0 : row.total))
                );
                rows = await new Promise((resolve, reject) =>
                    this.db.all(`SELECT * FROM surveys ${listSql}`, ...binds, (err, rows) => resolve(rows || []))
                );
            }

            this.success(res, {
                list: rows,
                pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
            });
        } catch(e) {
            console.error('[Survey] getSurveyList error:', e);
            this.error(res, '获取问卷列表失败');
        }
    }

    // ==================== 问卷详情 API ====================
    async getSurveyDetail(req, res) {
        try {
            const id = req.params.id;
            let survey;

            if (!this.isAsync) {
                survey = this.db.prepare('SELECT * FROM surveys WHERE id=? AND deleted_at IS NULL').get(id);
                if (survey) {
                    survey.questions = this.db.prepare(
                        'SELECT * FROM survey_questions WHERE survey_id=? ORDER BY sort_order ASC'
                    ).all(id);
                }
            } else {
                survey = await new Promise((resolve, reject) =>
                    this.db.get('SELECT * FROM surveys WHERE id=? AND deleted_at IS NULL', [id], (err, row) => resolve(row))
                );
                if (survey) {
                    survey.questions = await new Promise((resolve, reject) =>
                        this.db.all('SELECT * FROM survey_questions WHERE survey_id=? ORDER BY sort_order ASC',
                            [id], (err, rows) => resolve(rows || []))
                    );
                }
            }

            if (!survey) return this.error(res, '问卷不存在');

            // 解析JSON字段
            survey.questions = (survey.questions || []).map(q => ({
                ...q,
                options: this.safeParse(q.options),
                settings: this.safeParse(q.settings),
                logic_rules: this.safeParse(q.logic_rules)
            }));

            this.success(res, survey);
        } catch(e) {
            console.error('[Survey] getSurveyDetail error:', e);
            this.error(res, '获取问卷详情失败');
        }
    }

    // ==================== 创建问卷 API ====================
    async createSurvey(req, res) {
        try {
            const body = req.body || {};
            const now = new Date().toISOString();

            const sql = `
                INSERT INTO surveys (title, description, type, cover_image, welcome_text, end_text,
                                     is_anonymous, password, share_url, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const params = [
                body.title || '未命名问卷',
                body.description || '',
                body.type || 'custom',
                body.cover_image || '',
                body.welcome_text || '欢迎填写问卷！',
                body.end_text || '感谢您的填写！',
                body.is_anonymous ? 1 : 0,
                body.password || '',
                this.generateShareCode(),
                now, now
            ];

            let result;
            if (!this.isAsync) {
                result = this.db.prepare(sql).run(...params);
            } else {
                result = await new Promise((resolve, reject) =>
                    this.db.run(sql, params, function(err) {
                        if (err) reject(err); else resolve({ lastInsertRowid: this.lastID });
                    })
                );
            }

            this.success(res, { id: result.lastInsertRowid }, '问卷创建成功');
        } catch(e) {
            console.error('[Survey] createSurvey error:', e);
            this.error(res, '创建问卷失败');
        }
    }

    // ==================== 更新问卷 API ====================
    async updateSurvey(req, res) {
        try {
            const id = req.params.id;
            const body = req.body || {};
            const allowedFields = ['title','description','type','cover_image','welcome_text','end_text',
                                   'is_anonymous','password'];

            // 构建动态更新SQL
            const sets = [];
            const values = [];
            for (const f of allowedFields) {
                if (body[f] !== undefined) {
                    sets.push(`${f} = ?`);
                    values.push(body[f]);
                }
            }
            if (sets.length === 0) return this.error(res, '没有需要更新的字段');

            sets.push('updated_at = ?');
            values.push(new Date().toISOString());
            values.push(id);

            const sql = `UPDATE surveys SET ${sets.join(', ')} WHERE id=? AND deleted_at IS NULL`;

            if (!this.isAsync) {
                this.db.prepare(sql).run(...values);
            } else {
                await new Promise((resolve, reject) =>
                    this.db.run(sql, values, err => err ? reject(err) : resolve())
                );
            }

            this.success(res, null, '更新成功');
        } catch(e) {
            console.error('[Survey] updateSurvey error:', e);
            this.error(res, '更新问卷失败');
        }
    }

    // ==================== 删除问卷 API ====================
    async deleteSurvey(req, res) {
        try {
            const id = req.params.id;
            const sql = "UPDATE surveys SET deleted_at=CURRENT_TIMESTAMP WHERE id=?";
            if (!this.isAsync) {
                this.db.prepare(sql).run(id);
            } else {
                await new Promise((resolve, reject) =>
                    this.db.run(sql, [id], err => err ? reject(err) : resolve())
                );
            }
            this.success(res, null, '删除成功');
        } catch(e) {
            this.error(res, '删除问卷失败');
        }
    }

    // ==================== 复制问卷 API ====================
    async copySurvey(req, res) {
        try {
            const id = req.params.id;
            let original;
            if (!this.isAsync) {
                original = this.db.prepare('SELECT * FROM surveys WHERE id=? AND deleted_at IS NULL').get(id);
            } else {
                original = await new Promise(resolve =>
                    this.db.get('SELECT * FROM surveys WHERE id=? AND deleted_at IS NULL', [id],
                        (err, row) => resolve(row))
                );
            }
            if (!original) return this.error(res, '原问卷不存在');

            // 复制问卷主体
            const now = new Date().toISOString();
            const copySql = `
                INSERT INTO surveys (title, description, type, cover_image, welcome_text, end_text,
                    is_anonymous, limit_count, password, share_url, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            const copyParams = [original.title+'(副本)', original.description, original.type,
                original.cover_image, original.welcome_text, original.end_text,
                original.is_anonymous, original.limit_count, '', this.generateShareCode(), now, now];

            let newId;
            if (!this.isAsync) {
                newId = this.db.prepare(copySql).run(...copyParams).lastInsertRowid;
            } else {
                newId = await new Promise(resolve =>
                    this.db.run(copySql, copyParams, function(err) { resolve(this.lastID); })
                );
            }

            // 复制所有题目
            let questions;
            if (!this.isAsync) {
                questions = this.db.prepare('SELECT * FROM survey_questions WHERE survey_id=?').all(id);
            } else {
                questions = await new Promise(resolve =>
                    this.db.all('SELECT * FROM survey_questions WHERE survey_id=?', [id], (err, r) => resolve(r||[]))
                );
            }

            for (const q of questions) {
                const qSql = `INSERT INTO survey_questions (survey_id, question_type, title, description,
                    is_required, sort_order, options, settings, logic_rules) VALUES (?,?,?,?,?,?,?,?,?)`;
                const qParams = [newId, q.question_type, q.title, q.description,
                    q.is_required, q.sort_order, q.options, q.settings, q.logic_rules];
                if (!this.isAsync) {
                    this.db.prepare(qSql).run(...qParams);
                } else {
                    await new Promise(resolve => this.db.run(qSql, qParams, () => resolve()));
                }
            }

            this.success(res, { id: newId }, '复制成功');
        } catch(e) {
            console.error('[Survey] copySurvey error:', e);
            this.error(res, '复制失败');
        }
    }

    // ==================== 更新状态 API ====================
    async updateSurveyStatus(req, res) {
        try {
            const id = req.params.id;
            const { status } = req.body || {};
            if (!['draft','published','closed'].includes(status)) return this.error(res, '无效的状态值');

            const sql = "UPDATE surveys SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?";
            if (!this.isAsync) {
                this.db.prepare(sql).run(status, id);
            } else {
                await new Promise(resolve => this.db.run(sql, [status, id], () => resolve()));
            }
            this.success(res, null, `已${status==='published'?'发布':status==='closed'?'关闭':'保存为草稿'}`);
        } catch(e) {
            this.error(res, '状态更新失败');
        }
    }

    // ==================== 获取题目列表 ====================
    async getQuestions(req, res) {
        try {
            const id = req.params.id;
            let questions;
            if (!this.isAsync) {
                questions = this.db.prepare(
                    'SELECT * FROM survey_questions WHERE survey_id=? ORDER BY sort_order ASC'
                ).all(id);
            } else {
                questions = await new Promise(resolve =>
                    this.db.all('SELECT * FROM survey_questions WHERE survey_id=? ORDER BY sort_order ASC',
                        [id], (err, r) => resolve(r || []))
                );
            }
            this.success(res, (questions||[]).map(q => ({...q, options:this.safeParse(q.options), settings:this.safeParse(q.settings)})));
        } catch(e) {
            this.error(res, '获取题目失败');
        }
    }

    // ==================== 添加题目 ====================
    async addQuestion(req, res) {
        try {
            const surveyId = req.params.id;
            const body = req.body || {};

            // 获取当前最大排序号
            let maxOrder = 0;
            if (!this.isAsync) {
                const row = this.db.prepare('SELECT MAX(sort_order) as m FROM survey_questions WHERE survey_id=?')
                    .get(surveyId);
                maxOrder = (row?.m || 0);
            } else {
                maxOrder = await new Promise(resolve =>
                    this.db.get('SELECT MAX(sort_order) as m FROM survey_questions WHERE survey_id=?',
                        [surveyId], (err, r) => resolve(r?.m || 0))
                );
            }

            const sql = `INSERT INTO survey_questions (survey_id, question_type, title, description,
                is_required, sort_order, options, settings) VALUES (?,?,?,?,?,?,?,?)`;
            const params = [surveyId, body.question_type||'single', body.title||'', body.description||'',
                body.is_required!==undefined?body.is_required:1, maxOrder+1,
                JSON.stringify(body.options||[]), JSON.stringify(body.settings||{})];

            let result;
            if (!this.isAsync) {
                result = this.db.prepare(sql).run(...params);
            } else {
                result = await new Promise(resolve =>
                    this.db.run(sql, params, function(err) { resolve({lastInsertRowid: this.lastID}); })
                );
            }
            this.success(res, { id: result.lastInsertRowid }, '题目添加成功');
        } catch(e) {
            console.error('[Survey] addQuestion error:', e);
            this.error(res, '添加题目失败');
        }
    }

    // ==================== 批量保存题目 ====================
    async saveQuestions(req, res) {
        try {
            const surveyId = req.params.id;
            const questions = req.body?.questions || [];

            if (!this.isAsync) {
                const delStmt = this.db.prepare('DELETE FROM survey_questions WHERE survey_id=?');
                const insStmt = this.db.prepare(
                    `INSERT INTO survey_questions (survey_id, question_type, title, description,
                     is_required, sort_order, options, settings, logic_rules)
                     VALUES (?,?,?,?,?,?,?,?,?)`
                );

                this.db.transaction(() => {
                    delStmt.run(surveyId);
                    for (const q of questions) {
                        insStmt.run(surveyId, q.question_type, q.title, q.description||'',
                            q.is_required!==undefined?q.is_required:1, q.sort_order||0,
                            JSON.stringify(q.options||[]), JSON.stringify(q.settings||{}),
                            JSON.stringify(q.logic_rules||[]));
                    }
                })();
            } else {
                await new Promise((resolve, reject) => {
                    this.db.serialize(() => {
                        this.db.run('DELETE FROM survey_questions WHERE survey_id=?', [surveyId]);
                        for (const q of questions) {
                            this.db.run(
                                `INSERT INTO survey_questions (survey_id, question_type, title, description,
                                 is_required, sort_order, options, settings, logic_rules)
                                 VALUES (?,?,?,?,?,?,?,?,?)`,
                                [surveyId, q.question_type, q.title, q.description||'',
                                 q.is_required!==undefined?q.is_required:1, q.sort_order||0,
                                 JSON.stringify(q.options||[]), JSON.stringify(q.settings||{}),
                                 JSON.stringify(q.logic_rules||[])], () => {}
                            );
                        }
                        resolve();
                    });
                });
            }

            this.success(res, null, '保存成功');
        } catch(e) {
            console.error('[Survey] saveQuestions error:', e);
            this.error(res, '保存题目失败');
        }
    }

    // ==================== 更新单个题目 ====================
    async updateQuestion(req, res) {
        try {
            const qid = req.params.qid;
            const body = req.body || {};
            const allowedFields = ['question_type','title','description','is_required','options','settings'];
            const sets = [], vals = [];
            for (const f of allowedFields) {
                if (body[f] !== undefined) {
                    if (['options','settings'].includes(f)) sets.push(`${f} = ?`), vals.push(JSON.stringify(body[f]));
                    else sets.push(`${f} = ?`), vals.push(body[f]);
                }
            }
            if (sets.length === 0) return this.error(res, '没有更新的内容');

            vals.push(qid);
            const sql = `UPDATE survey_questions SET ${sets.join(',')} WHERE id=?`;
            if (!this.isAsync) {
                this.db.prepare(sql).run(...vals);
            } else {
                await new Promise(resolve => this.db.run(sql, vals, () => resolve()));
            }
            this.success(res, null, '更新成功');
        } catch(e) {
            this.error(res, '更新题目失败');
        }
    }

    // ==================== 删除题目 ====================
    async deleteQuestion(req, res) {
        try {
            const qid = req.params.qid;
            if (!this.isAsync) {
                this.db.prepare('DELETE FROM survey_questions WHERE id=?').run(qid);
            } else {
                await new Promise(resolve => this.db.run('DELETE FROM survey_questions WHERE id=?', [qid], () => resolve()));
            }
            this.success(res, null, '删除成功');
        } catch(e) {
            this.error(res, '删除题目失败');
        }
    }

    // ==================== 公开访问：获取问卷（供H5填写）====================
    async getPublicSurvey(req, res) {
        try {
            const code = req.params.code;
            let survey;
            if (!this.isAsync) {
                survey = this.db.prepare(
                    'SELECT id,title,type,description,cover_image,welcome_text,end_text,is_anonymous,password,status,view_count,submit_count FROM surveys WHERE share_url=? AND status="published" AND deleted_at IS NULL'
                ).get(code);
            } else {
                survey = await new Promise(resolve =>
                    this.db.get(
                        `SELECT id,title,type,description,cover_image,welcome_text,end_text,is_anonymous,password,status,view_count,submit_count
                         FROM surveys WHERE share_url=? AND status='published' AND deleted_at IS NULL`,
                        [code], (err, row) => resolve(row))
                );
            }

            if (!survey) return this.error(res, '问卷不存在或未开放', 404);

            // 密码校验
            if (survey.password) {
                const inputPwd = req.query.password || req.headers['x-survey-password'] || '';
                if (inputPwd !== survey.password) {
                    return this.error(res, '需要访问密码', 403);
                }
            }

            // 增加浏览次数
            if (!this.isAsync) {
                this.db.prepare("UPDATE surveys SET view_count=view_count+1 WHERE id=?").run(survey.id);
            } else {
                await new Promise(resolve =>
                    this.db.run("UPDATE surveys SET view_count=view_count+1 WHERE id=?", [survey.id], () => resolve())
                );
            }

            // 获取题目（不包含答案）
            let questions;
            if (!this.isAsync) {
                questions = this.db.prepare(
                    'SELECT id, question_type, title, description, is_required, sort_order, options, settings FROM survey_questions WHERE survey_id=? ORDER BY sort_order ASC'
                ).all(survey.id);
            } else {
                questions = await new Promise(resolve =>
                    this.db.all(
                        `SELECT id, question_type, title, description, is_required, sort_order, options, settings
                         FROM survey_questions WHERE survey_id=? ORDER BY sort_order ASC`,
                        [survey.id], (err, r) => resolve(r||[])
                    )
                );
            }

            survey.questions = (questions||[]).map(q => ({
                ...q,
                options: this.safeParse(q.options),
                settings: this.safeParse(q.settings)
            }));
            // 移除密码字段
            delete survey.password;

            this.success(res, survey);
        } catch(e) {
            console.error('[Survey] getPublicSurvey error:', e);
            this.error(res, '获取问卷失败');
        }
    }

    // ==================== 公开访问：提交回答 ====================
    async submitResponse(req, res) {
        try {
            const code = req.params.code;
            const body = req.body || {};
            const answers = body.answers || [];  // [{question_id: 1, value: "xxx", images:[]}]

            // 查找问卷
            let survey;
            if (!this.isAsync) {
                survey = this.db.prepare('SELECT id,limit_count,submit_count,status FROM surveys WHERE share_url=? AND status="published" AND deleted_at IS NULL').get(code);
            } else {
                survey = await new Promise(resolve =>
                    this.db.get(
                        `SELECT id,limit_count,submit_count,status FROM surveys WHERE share_url=? AND status='published' AND deleted_at IS NULL`,
                        [code], (err, row) => resolve(row))
                );
            }

            if (!survey) return this.error(res, '问卷不存在或未开放');

            // 限制次数检查
            if (survey.limit_count > 0 && survey.submit_count >= survey.limit_count) {
                return this.error(res, '问卷已达到最大填写次数');
            }

            const now = Date.now();

            // 创建回答记录
            let responseId;
            const respSql = `INSERT INTO survey_responses (survey_id, respondent_name, ip_address, user_agent, submit_time, source)
                              VALUES (?, ?, ?, ?, ?, ?)`;
            const respParams = [survey.id, body.respondent_name || '',
                req.ip || req.connection?.remoteAddress || '',
                req.headers['user-agent'] || '', now, body.source || 'h5'];

            if (!this.isAsync) {
                responseId = this.db.prepare(respSql).run(...respParams).lastInsertRowid;
            } else {
                responseId = await new Promise(resolve =>
                    this.db.run(respSql, respParams, function(err) { resolve(this.lastID); })
                );
            }

            // 保存每道题的答案
            for (const a of answers) {
                const ansSql = `INSERT INTO survey_answers (response_id, question_id, answer_value, answer_images)
                                VALUES (?, ?, ?, ?)`;
                const ansParams = [responseId, a.question_id, a.value || '',
                    JSON.stringify(a.images || [])];

                if (!this.isAsync) {
                    this.db.prepare(ansSql).run(...ansParams);
                } else {
                    await new Promise(resolve => this.db.run(ansSql, ansParams, () => resolve()));
                }
            }

            // 更新提交计数
            if (!this.isAsync) {
                this.db.prepare('UPDATE surveys SET submit_count=submit_count+1 WHERE id=?').run(survey.id);
            } else {
                await new Promise(resolve =>
                    this.db.run('UPDATE surveys SET submit_count=submit_count+1 WHERE id=?', [survey.id], () => resolve())
                );
            }

            this.success(res, { responseId }, '提交成功！');
        } catch(e) {
            console.error('[Survey] submitResponse error:', e);
            this.error(res, '提交失败，请重试');
        }
    }

    // ==================== 获取提交记录列表 ====================
    async getResponseList(req, res) {
        try {
            const surveyId = req.params.id;
            const params = this.getParams(req);
            const page = parseInt(params.page) || 1;
            const pageSize = parseInt(params.pageSize) || 20;

            let where = 'WHERE survey_id=?';
            const binds = [surveyId];

            let total;
            if (!this.isAsync) {
                total = this.db.prepare(`SELECT COUNT(*) as t FROM survey_responses ${where}`).get(...binds)?.t || 0;
            } else {
                total = await new Promise(resolve =>
                    this.db.get(`SELECT COUNT(*) as t FROM survey_responses ${where}`, binds,
                        (err, r) => resolve(r?.t || 0))
                );
            }

            let responses;
            if (!this.isAsync) {
                responses = this.db.prepare(
                    `SELECT * FROM survey_responses ${where} ORDER BY submit_time DESC LIMIT ? OFFSET ?`
                ).all(...binds, pageSize, (page-1)*pageSize);
            } else {
                responses = await new Promise(resolve =>
                    this.db.all(
                        `SELECT * FROM survey_responses ${where} ORDER BY submit_time DESC LIMIT ? OFFSET ?`,
                        [...binds, pageSize, (page-1)*pageSize], (err, r) => resolve(r||[])
                    )
                );
            }

            this.success(res, {
                list: responses,
                pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
            });
        } catch(e) {
            this.error(res, '获取提交记录失败');
        }
    }

    // ==================== 获取单条提交详情（含所有答案）====================
    async getResponseDetail(req, res) {
        try {
            const rid = req.params.rid;
            let response, answers;
            if (!this.isAsync) {
                response = this.db.prepare('SELECT * FROM survey_responses WHERE id=?').get(rid);
                if (response) {
                    answers = this.db.prepare(`
                        SELECT sa.*, sq.title as question_title, sq.question_type, sq.options, sq.settings
                        FROM survey_answers sa
                        LEFT JOIN survey_questions sq ON sa.question_id = sq.id
                        WHERE sa.response_id=? ORDER BY sq.sort_order ASC
                    `).all(rid);
                }
            } else {
                response = await new Promise(resolve =>
                    this.db.get('SELECT * FROM survey_responses WHERE id=?', [rid], (err, r) => resolve(r))
                );
                if (response) {
                    answers = await new Promise(resolve =>
                        this.db.all(`
                            SELECT sa.*, sq.title as question_title, sq.question_type, sq.options, sq.settings
                            FROM survey_answers sa
                            LEFT JOIN survey_questions sq ON sa.question_id = sq.id
                            WHERE sa.response_id=? ORDER BY sq.sort_order ASC
                        `, [rid], (err, r) => resolve(r||[]))
                    );
                }
            }

            if (!response) return this.error(res, '提交记录不存在');

            response.answers = (answers||[]).map(a => ({
                ...a,
                options: this.safeParse(a.options),
                settings: this.safeParse(a.settings),
                answer_images: this.safeParse(a.answer_images)
            }));

            this.success(res, response);
        } catch(e) {
            this.error(res, '获取详情失败');
        }
    }

    // ==================== 删除提交记录 ====================
    async deleteResponse(req, res) {
        try {
            const rid = req.params.rid;
            // 先获取survey_id以更新计数
            let record;
            if (!this.isAsync) {
                record = this.db.prepare('SELECT survey_id FROM survey_responses WHERE id=?').get(rid);
                if (record) this.db.prepare('DELETE FROM survey_answers WHERE response_id=?').run(rid);
                this.db.prepare('DELETE FROM survey_responses WHERE id=?').run(rid);
                if (record) this.db.prepare('UPDATE surveys SET submit_count=MAX(0,submit_count-1) WHERE id=?').run(record.survey_id);
            } else {
                record = await new Promise(resolve =>
                    this.db.get('SELECT survey_id FROM survey_responses WHERE id=?', [rid], (err,r)=>resolve(r))
                );
                if (record) {
                    await new Promise(resolve => this.db.run('DELETE FROM survey_answers WHERE response_id=?',[rid],()=>resolve()));
                }
                await new Promise(resolve => this.db.run('DELETE FROM survey_responses WHERE id=?',[rid],()=>resolve()));
                if (record) await new Promise(resolve =>
                    this.db.run('UPDATE surveys SET submit_count=MAX(0,submit_count-1) WHERE id=?',[record.survey_id],()=>resolve())
                );
            }
            this.success(res, null, '删除成功');
        } catch(e) {
            this.error(res, '删除失败');
        }
    }

    // ==================== 导出数据 ====================
    async exportData(req, res) {
        try {
            const surveyId = req.params.id;
            const format = (req.query.format || 'csv').toLowerCase();

            // 获取问卷标题和题目
            let survey, questions;
            if (!this.isAsync) {
                survey = this.db.prepare('SELECT title FROM surveys WHERE id=?').get(surveyId);
                questions = this.db.prepare(
                    'SELECT * FROM survey_questions WHERE survey_id=? ORDER BY sort_order ASC'
                ).all(surveyId);
            } else {
                survey = await new Promise(resolve =>
                    this.db.get('SELECT title FROM surveys WHERE id=?', [surveyId], (err,r)=>resolve(r))
                );
                questions = await new Promise(resolve =>
                    this.db.all('SELECT * FROM survey_questions WHERE survey_id=? ORDER BY sort_order ASC',
                        [surveyId], (err,r)=>resolve(r||[]))
                );
            }

            if (!survey) return this.error(res, '问卷不存在');

            // 获取所有提交及答案
            let responses, allAnswers;
            if (!this.isAsync) {
                responses = this.db.prepare(
                    'SELECT id, respondent_name, datetime(submit_time/1000, \'unixepoch\',\'localtime\') as submit_time_str FROM survey_responses WHERE survey_id=? ORDER BY submit_time ASC'
                ).all(surveyId);
                if (responses.length > 0) {
                    const ids = responses.map(r => r.id).join(',');
                    allAnswers = this.db.prepare(
                        `SELECT * FROM survey_answers WHERE response_id IN (${ids})`
                    ).all();
                }
            } else {
                responses = await new Promise(resolve =>
                    this.db.all(
                        `SELECT id, respondent_name, datetime(submit_time/1000,'unixepoch','localtime') as submit_time_str
                         FROM survey_responses WHERE survey_id=? ORDER BY submit_time ASC`,
                        [surveyId], (err,r)=>resolve(r||[]))
                );
                if (responses.length > 0) {
                    const ids = responses.map(r=>r.id).join(',');
                    allAnswers = await new Promise(resolve =>
                        this.db.all(`SELECT * FROM survey_answers WHERE response_id IN (${ids})`, (err,r)=>resolve(r||[]))
                    );
                }
            }

            // 构建导出数据
            const header = ['序号', '提交人', '提交时间', ...(questions||[]).map(q => q.title)];
            const rows = (responses||[]).map((r, idx) => {
                const base = [idx+1, r.respondent_name||'', r.submit_time_str||''];
                const ansMap = {};
                (allAnswers||[]).filter(a => a.response_id === r.id).forEach(a => { ansMap[a.question_id] = a.answer_value; });

                for (const q of (questions||[])) {
                    let val = ansMap[q.id] || '';
                    // 如果是选择题，将value转为label显示
                    if (['single','multi'].includes(q.question_type)) {
                        const opts = this.safeParse(q.options);
                        if (q.question_type === 'multi') {
                            val = val.split(',').map(v => {
                                const opt = opts.find(o => o.value === v);
                                return opt ? opt.label : v;
                            }).join('; ');
                        } else {
                            const opt = opts.find(o => o.value === val);
                            val = opt ? opt.label : val;
                        }
                    }
                    base.push(val);
                }
                return base;
            });

            if (format === 'csv') {
                // CSV 格式
                const csvRows = [header, ...rows].map(row =>
                    row.map(cell => {
                        const str = String(cell == null ? '' : cell);
                        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                            return '"' + str.replace(/"/g, '""') + '"';
                        }
                        return str;
                    }).join(',')
                ).join('\n');
                const BOM = '\uFEFF'; // UTF-8 BOM for Excel
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(survey.title)}.csv"`);
                res.send(BOM + csvRows);
            } else {
                // JSON 格式
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(survey.title)}.json"`);
                this.success(res, { header, rows, surveyTitle: survey.title, exportTime: new Date().toISOString() });
            }
        } catch(e) {
            console.error('[Survey] exportData error:', e);
            this.error(res, '导出失败');
        }
    }

    // ==================== 统计概览 ====================
    async getSurveyStats(req, res) {
        try {
            const surveyId = req.params.id;
            let stats;
            if (!this.isAsync) {
                stats = this.db.prepare(`
                    SELECT
                        s.view_count, s.submit_count,
                        COUNT(DISTINCT r.id) as total_submissions,
                        COUNT(DISTINCT CASE WHEN r.status='submitted' THEN r.id END) as completed,
                        AVG(CASE WHEN r.duration>0 THEN r.duration END) as avg_duration
                    FROM surveys s LEFT JOIN survey_responses r ON s.id=r.survey_id
                    WHERE s.id=? GROUP BY s.id
                `).get(surveyId);

                // 各题选项统计
                const optionStats = this.db.prepare(`
                    SELECT sq.id as question_id, sq.title, sq.question_type, sq.options,
                           sa.answer_value, COUNT(*) as cnt
                    FROM survey_questions sq
                    JOIN survey_answers sa ON sq.id = sa.question_id
                    JOIN survey_responses sr ON sr.id = sa.response_id AND sr.survey_id = ?
                    WHERE sq.survey_id = ? AND sq.question_type IN ('single','multi')
                    GROUP BY sq.id, sa.answer_value
                    ORDER BY sq.sort_order ASC, cnt DESC
                `).all(surveyId, surveyId);

                stats.optionStats = (optionStats||[]).map(o => ({
                    ...o,
                    options: this.safeParse(o.options)
                }));
            } else {
                stats = await new Promise(resolve =>
                    this.db.get(`
                        SELECT s.view_count, s.submit_count, COUNT(DISTINCT r.id) as total_submissions,
                               COUNT(DISTINCT CASE WHEN r.status='submitted' THEN r.id END) as completed,
                               AVG(CASE WHEN r.duration>0 THEN r.duration END) as avg_duration
                        FROM surveys s LEFT JOIN survey_responses r ON s.id=r.survey_id
                        WHERE s.id=? GROUP BY s.id
                    `, [surveyId], (err, r) => resolve(r))
                );
                stats.optionStats = [];
            }

            this.success(res, stats);
        } catch(e) {
            this.error(res, '获取统计失败');
        }
    }

    // ==================== 创建男性客户模板 ====================
    createMaleTemplate(req, res) {
        const template = {
            title: 'StarMatch 匹配申请表（男性客户）',
            type: 'male',
            welcome_text: '感谢您选择 StarMatch！\n请认真填写以下信息，帮助我们为您匹配最合适的伴侣。',
            end_text: '提交成功！我们的红娘团队将在24小时内与您联系。',
            questions: [
                { question_type: 'text', title: '姓名 / 昵称', is_required: true },
                { question_type: 'number', title: '年龄', is_required: true, settings: {min:18,max:99,unit:'岁'} },
                { question_type: 'text', title: '国家', is_required: true },
                { question_type: 'text', title: '城市', is_required: true },
                { question_type: 'text', title: '身高', is_required: true, settings: {unit:'cm'} },
                { question_type: 'text', title: '职业', is_required: true },
                { question_type: 'text', title: '年收入范围', is_required: true },
                { question_type: 'text', title: '联系方式（微信）', is_required: true },

                { question_type: 'single', title: '您的婚恋目标是？', is_required: true,
                  options: [{label:'认真恋爱',value:'dating'},{label:'结婚',value:'marriage'},{label:'先了解看看',value:'explore'}] },
                { question_type: 'single', title: '您期望的发展节奏是？', is_required: true,
                  options: [{label:'尽快见面',value:'fast'},{label:'先聊一段时间',value:'normal'},{label:'不着急',value:'slow'}] },
                { question_type: 'single', title: '是否接受跨国婚姻？', is_required: true,
                  options: [{label:'完全接受',value:'yes'},{label:'可以接受',value:'maybe'},{label:'不太确定',value:'unsure'}] },

                { question_type: 'number', title: '择偶年龄范围', is_required: true, settings: {placeholder:'如 22-35', unit:''} },
                { question_type: 'single', title: '是否接受对方已有孩子？',
                  options: [{label:'可以接受',value:'yes'},{label:'不接受',value:'no'},{label:'视情况而定',value:'depends'}] },
                { question_type: 'multi', title: '外貌偏好（可多选）',
                  options: [{label:'清秀可爱',value:'cute'},{label:'气质优雅',value:'elegant'},
                           {label:'身材匀称',value:'fit'},{label:'高颜值',value:'beautiful'},{label:'看感觉',value:'vibe'}] },
                { question_type: 'multi', title: '性格偏好（可多选）',
                  options: [{label:'温柔体贴',value:'gentle'},{label:'活泼开朗',value:'cheerful'},
                           {label:'知性成熟',value:'mature'},{label:'独立自信',value:'independent'},{label:'善良真诚',value:'kind'}] },
                { question_type: 'textarea', title: '对语言沟通有什么要求或顾虑？', settings: {placeholder:'如：英语水平、学习意愿等...', maxLength:500} },

                { question_type: 'single', title: '是否愿意来中国发展？', is_required: true,
                  options: [{label:'愿意',value:'yes'},{label:'可以考虑',value:'maybe'},{label:'不愿意',value:'no'}] },
                { question_type: 'single', title: '能否帮助女方办理签证？',
                  options: [{label:'完全可以',value:'yes'},{label:'部分支持',value:'partial'},{label:'需要了解流程',value:'need_info'}] },
                { question_type: 'single', title: '未来生活地点倾向？',
                  options: [{label:'中国',value:'china'},{label:'男方国家',value:'his_country'},
                           {label:'双方商量',value:'discuss'},{label:'其他第三国',value:'third'}] },

                { question_type: 'textarea', title: '请用几句话描述自己的性格和兴趣爱好', is_required: true, settings: {maxLength:300} },
                { question_type: 'textarea', title: '您认为自己在感情中最大的优点是什么？', settings: {maxLength:200} },
                { question_type: 'single', title: '您是否有跨国恋/异国恋经验？',
                  options: [{label:'有丰富经验',value:'experienced'},{label:'有一些经历',value:'some'},
                           {label:'没有但很期待',value:'none_but_eager'},{label:'完全没有经验',value:'none'}] },

                { question_type: 'single', title: '是否愿意付费使用我们的服务？', is_required: true,
                  options: [{label:'愿意，希望VIP服务',value:'vip'},{label:'愿意，基础服务即可',value:'basic'},
                           {label:'想先免费了解一下',value:'free_first'},{label:'不确定',value:'unsure'}] },
                { question_type: 'multi', title: '您最需要哪些帮助？（可多选）',
                  options: [{label:'精准匹配推荐',value:'match'},{label:'语言翻译协助',value:'translate'},
                           {label:'签证办理指导',value:'visa'},{label:'文化差异指导',value:'culture'},
                           {label:'约会安排协调',value:'date_plan'},{label:'情感咨询',value:'consult'}] },

                { question_type: 'textarea', title: '补充说明（可选）', settings: {placeholder:'任何您想让我们知道的额外信息...', maxLength:500} },
                { question_type: 'image', title: '上传真实照片（至少2张）', is_required: true, settings: {maxCount:9} },
            ]
        };
        this.createFromTemplate(req, res, template);
    }

    // ==================== 创建女性用户模板 ====================
    createFemaleTemplate(req, res) {
        const template = {
            title: 'StarMatch 个人信息收集表（女性用户）',
            type: 'female',
            welcome_text: '欢迎加入 StarMatch！\n请放心填写以下信息，我们将严格保护您的隐私。\n您的信息仅用于匹配服务，不会对外公开。',
            end_text: '提交成功！我们会尽快为您匹配合适的对象。如有合适的男士，我们会先征得您的同意再进行介绍。',
            questions: [
                { question_type: 'text', title: '姓名 / 昵称', is_required: true },
                { question_type: 'number', title: '年龄', is_required: true, settings: {min:18,max:60,unit:'岁'} },
                { question_type: 'text', title: '城市', is_required: true },
                { question_type: 'text', title: '身高', is_required: true, settings: {unit:'cm'} },
                { question_type: 'text', title: '体重', is_required: true, settings: {unit:'kg'} },
                { question_type: 'text', title: '职业', is_required: true },
                { question_type: 'single', title: '学历',
                  options: [{label:'高中及以下',value:'highschool'},{label:'大专',value:'college'},
                           {label:'本科',value:'bachelor'},{label:'硕士及以上',value:'master'}] },
                { question_type: 'text', title: '联系方式（微信）', is_required: true },

                { question_type: 'image', title: '生活照（≥5张）', is_required: true, settings: {maxCount:9, minCount:5} },
                { question_type: 'image', title: '视频验证（可选）', settings: {maxCount:1} },
                { question_type: 'single', title: '外貌自评',
                  options: [{label:'普通',value:'average'},{label:'清秀',value:'pretty'},
                           {label:'好看',value:'beautiful'},{label:'高颜值',value:'stunning'}] },
                { question_type: 'single', title: '是否愿意公开展示照片？',
                  options: [{label:'是',value:'yes'},{label:'否',value:'no'}] },

                { question_type: 'single', title: '你目前的目标是？', is_required: true,
                  options: [{label:'认真恋爱',value:'dating'},{label:'结婚',value:'marriage'},{label:'先了解看看',value:'explore'}] },
                { question_type: 'single', title: '是否接受外国男生？', is_required: true,
                  options: [{label:'完全接受',value:'fully'},{label:'可以尝试',value:'try'},{label:'不太接受',value:'reluctant'}] },
                { question_type: 'single', title: '是否愿意长期发展关系？', is_required: true,
                  options: [{label:'是',value:'yes'},{label:'否',value:'no'},{label:'不确定',value:'unsure'}] },

                { question_type: 'single', title: '是否愿意视频聊天？', is_required: true,
                  options: [{label:'愿意',value:'yes'},{label:'不愿意',value:'no'}] },
                { question_type: 'single', title: '是否愿意未来出国？', is_required: true,
                  options: [{label:'愿意',value:'yes'},{label:'不愿意',value:'no'},{label:'看情况',value:'depends'}] },
                { question_type: 'textarea', title: '对理想伴侣的要求（可选）', settings: {placeholder:'描述您心目中的他...', maxLength:300} },
            ]
        };
        this.createFromTemplate(req, res, template);
    }

    // ==================== 从模板创建问卷 ====================
    async createFromTemplate(req, res, template) {
        try {
            const now = new Date().toISOString();

            // 创建问卷
            let surveyId;
            const surveySql = `INSERT INTO surveys (title,description,type,welcome_text,end_text,share_url,status,created_at,updated_at)
                               VALUES (?,?,?,?,?,?,?,?,?)`;
            const surveyParams = [template.title, template.description || '', template.type,
                template.welcome_text, template.end_text, this.generateShareCode(), 'draft', now, now];

            if (!this.isAsync) {
                surveyId = this.db.prepare(surveySql).run(...surveyParams).lastInsertRowid;
            } else {
                surveyId = await new Promise(resolve =>
                    this.db.run(surveySql, surveyParams, function(err) { resolve(this.lastID); })
                );
            }

            // 创建题目
            for (let i = 0; i < template.questions.length; i++) {
                const q = template.questions[i];
                const qSql = `INSERT INTO survey_questions (survey_id, question_type, title, description,
                    is_required, sort_order, options, settings) VALUES (?,?,?,?,?,?,?,?)`;
                const qParams = [surveyId, q.question_type, q.title, q.description || '',
                    q.is_required ? 1 : 0, i, JSON.stringify(q.options || []),
                    JSON.stringify(q.settings || {})];
                if (!this.isAsync) {
                    this.db.prepare(qSql).run(...qParams);
                } else {
                    await new Promise(resolve => this.db.run(qSql, qParams, () => resolve()));
                }
            }

            this.success(res, { id: surveyId, title: template.title }, '模板创建成功！');
        } catch(e) {
            console.error('[Survey] createFromTemplate error:', e);
            this.error(res, '模板创建失败');
        }
    }
}

module.exports = SurveyAPI;
