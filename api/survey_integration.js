/**
 * =====================================================
 * StarMeet 问卷模块 - 一键集成代码
 * =====================================================
 *
 * 使用方法：
 * 1. 将此文件内容追加到 zeai_server.js 的末尾（在 app.listen() 之前）
 * 2. 确保 data/starmeet.db 已创建并执行了 survey_schema.sql
 * 3. 重启 Node 服务
 *
 * 如果你的项目不用 Express，请参考注释中的原生 http 适配方案
 */

// ====== 1. 引入问卷 API 模块 ======
try {
    const SurveyAPI = require('./api/survey');
    // 传入 app 实例（Express/Koa 等），SurveyAPI 会自动注册所有路由
    global.surveyApi = new SurveyAPI(
        (typeof __dirname !== 'undefined') ? path.join(__dirname, 'data', 'starmeet.db') : './data/starmeet.db',
        typeof app !== 'undefined' ? app : null
    );
    console.log('[StarMeet] ✅ 问卷管理模块已加载');
} catch(e) {
    console.error('[StarMeet] ⚠️ 问卷模块加载失败:', e.message);
}

// ====== 2. 自动建表（启动时执行一次）=====
try {
    // 尝试自动初始化数据库表
    if (global.surveyApi && global.surveyApi.db) {
        const fs = require('fs');
        const schemaPath = './data/survey_schema.sql';
        if (fs.existsSync(schemaPath)) {
            const sql = fs.readFileSync(schemaPath, 'utf8');
            try {
                global.surveyApi.db.exec(sql);
                console.log('[StarMeet] ✅ 问卷数据表已就绪');
            } catch(e2) {
                console.log('[StarMeet] ℹ️ 数据表已存在或不需要更新');
            }
        }
    }
} catch(e) {
    console.log('[StarMeet] ℹ️ 跳过自动建表');
}
