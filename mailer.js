// mailer.js - 邮件发送模块（使用 nodemailer + QQ邮箱SMTP）
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// 邮件配置数据库文件路径
const mailConfigPath = path.join(__dirname, 'data', 'mail_config.json');

// 读取邮件配置（直接读JSON文件，不用jsondb）
function getMailConfig() {
  try {
    if (fs.existsSync(mailConfigPath)) {
      const data = JSON.parse(fs.readFileSync(mailConfigPath, 'utf8'));
      return Array.isArray(data) ? data[0] : data;
    }
  } catch (e) {
    console.error('[mailer] 读取邮件配置失败:', e.message);
  }
  return null;
}

// 缓存 transporter
let _transporter = null;
let _configCache = null;

/**
 * 获取或创建邮件 transporter
 */
function getTransporter() {
  const cfg = getMailConfig();
  if (!cfg || !cfg.smtpHost || !cfg.user || !cfg.pass) {
    return null;
  }
  // 检查配置是否变化
  const configKey = JSON.stringify({ host: cfg.smtpHost, port: cfg.smtpPort, user: cfg.user, pass: cfg.pass });
  if (_transporter && _configCache === configKey) {
    return _transporter;
  }
  try {
    _transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.secure !== false,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    _configCache = configKey;
    return _transporter;
  } catch (e) {
    console.error('[mailer] 创建Transport失败:', e.message);
    return null;
  }
}

/**
 * 发送注册验证码邮件
 * @param {string} email - 收件人邮箱
 * @param {string} code - 6位验证码
 * @returns {Promise<{ok:boolean, msg:string}>}
 */
async function sendCodeMail(email, code) {
  const cfg = getMailConfig();

  if (!cfg || !cfg.smtpHost) {
    // 未配置SMTP：开发模式，在控制台打印验证码
    console.log(`\n===== [开发模式] 验证码已生成 =====`);
    console.log(`  收件人: ${email}`);
    console.log(`  验证码: ${code}`);
    console.log(`=================================\n`);
    return { ok: true, msg: '开发模式：请查看服务器控制台获取验证码' };
  }

  const transport = getTransporter();
  if (!transport) {
    return { ok: false, msg: '邮件服务未正确配置' };
  }

  const subject = cfg.codeSubject || '【StarMeet】您的注册验证码';
  const template = (cfg.codeTemplate || '您的注册验证码是：{code}\n\n验证码10分钟内有效。')
    .replace('{code}', code);

  try {
    const info = await transport.sendMail({
      from: `"${cfg.fromName || 'StarMeet'}" <${cfg.user}>`,
      to: email,
      subject: subject,
      text: template,
    });
    console.log(`[mailer] 验证码已发送至 ${email}, messageId: ${info.messageId}`);
    return { ok: true, msg: '验证码已发送，请注意查收' };
  } catch (err) {
    console.error('[mailer] 发送失败:', err.message);
    return { ok: false, msg: '发送失败：' + err.message };
  }
}

module.exports = { sendCodeMail };
