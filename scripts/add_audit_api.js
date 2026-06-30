const fs = require('fs');
const c = fs.readFileSync('zeai_server.js', 'utf8');
const insertPos = 50149;

const toInsert = `
  // ===== 用户审核 =====
  // 管理员审核通过
  if (pathname === '/api/admin/user/approve' && method === 'POST') {
    const { userId } = params;
    if (!userId) return sendJson(res, { code: 1, msg: 'userId必填' });
    const user = usersDB.find(u => u.userId === userId || u.id === userId);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
    usersDB.update(user.id, { status: 'approved', rejectReason: '' });
    // 发送站内信通知
    messagesDB.insert({ from: 'system', to: user.id, content: '恭喜！您的账号已通过审核，现在可以正常使用所有功能了。', read: false, createdAt: new Date().toISOString() });
    return sendJson(res, { code: 0, msg: '审核通过' });
  }

  // 管理员审核拒绝
  if (pathname === '/api/admin/user/reject' && method === 'POST') {
    const { userId, reason } = params;
    if (!userId) return sendJson(res, { code: 1, msg: 'userId必填' });
    if (!reason) return sendJson(res, { code: 1, msg: '请填写拒绝原因' });
    const user = usersDB.find(u => u.userId === userId || u.id === userId);
    if (!user) return sendJson(res, { code: 1, msg: '用户不存在' });
    usersDB.update(user.id, { status: 'rejected', rejectReason: reason });
    // 发送站内信通知
    messagesDB.insert({ from: 'system', to: user.id, content: '很抱歉，您的账号审核未通过。原因：' + reason + '。请修改后重新提交。', read: false, createdAt: new Date().toISOString() });
    return sendJson(res, { code: 0, msg: '已拒绝' });
  }

  // 获取站内信
  if (pathname === '/api/me/messages' && method === 'GET') {
    const msgs = messagesDB.filter(m => m.to === currentUser.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, { code: 0, data: { list: msgs } });
  }

  // 标记站内信已读
  if (pathname === '/api/me/messages/read' && method === 'POST') {
    const { messageId } = params;
    if (messageId) {
      messagesDB.update(messageId, { read: true });
    } else {
      // 全部标记已读
      messagesDB.all().filter(m => m.to === currentUser.id).forEach(m => { m.read = true; });
      messagesDB.save();
    }
    return sendJson(res, { code: 0 });
  }
`;

const newContent = c.slice(0, insertPos) + toInsert + c.slice(insertPos);
fs.writeFileSync('zeai_server.js', newContent, 'utf8');
console.log('审核API添加成功');
