/**
 * 邮件发送模块
 * 用 nodemailer 通过 QQ邮箱 SMTP 发送邮件
 */
const nodemailer = require('nodemailer');

let cachedTransporter = null;
let cachedConfigKey = '';

function getTransporter() {
  const fs = require('fs');
  const path = require('path');
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'mail_config.json'), 'utf8'));
  // 兼容两种格式：对象 或 数组包裹 [{...}]
  const cfg = Array.isArray(raw) ? (raw[0] || {}) : raw;
  const key = cfg.user + '|' + cfg.pass + '|' + cfg.smtpHost + '|' + cfg.smtpPort;
  if (cachedTransporter && cachedConfigKey === key) return { transporter: cachedTransporter, cfg };
  // 重新创建 transporter
  cachedTransporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: parseInt(cfg.smtpPort) || 465,
    secure: cfg.secure !== false,
    auth: { user: cfg.user, pass: cfg.pass }
  });
  cachedConfigKey = key;
  return { transporter: cachedTransporter, cfg };
}

/**
 * 发送验证码邮件
 * @param {string} to - 收件人邮箱
 * @param {string} code - 验证码
 * @returns {Promise<{ok: boolean, msg: string}>}
 */
async function sendCodeMail(to, code) {
  try {
    const { transporter, cfg } = getTransporter();
    const html = (cfg.codeTemplate || '您的注册验证码是：{code}').replace(/\{code\}/g, code)
      .replace(/\n/g, '<br>');
    await transporter.sendMail({
      from: `"${cfg.fromName || 'StarMeet'}" <${cfg.user}>`,
      to,
      subject: cfg.codeSubject || '【StarMeet】您的注册验证码',
      text: (cfg.codeTemplate || '您的注册验证码是：{code}').replace(/\{code\}/g, code),
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; padding:24px; max-width:560px; margin:0 auto; background:#fff;">
        <div style="text-align:center; padding:20px 0; border-bottom:1px solid #eee;">
          <h2 style="margin:0; color:#ff4d6d;">${cfg.fromName || 'StarMeet'}</h2>
        </div>
        <div style="padding:24px 0; color:#333; line-height:1.8; font-size:15px;">
          <p>您好，</p>
          <p>${html}</p>
          <p style="color:#999; font-size:13px; margin-top:24px;">如果不是您本人操作，请忽略此邮件。</p>
        </div>
      </div>`
    });
    return { ok: true, msg: '发送成功' };
  } catch (err) {
    return { ok: false, msg: '邮件发送失败：' + err.message };
  }
}

module.exports = { sendCodeMail };
