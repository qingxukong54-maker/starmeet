const fs = require('fs');
let c = fs.readFileSync('admin/admin.js', 'utf8');

// 在 _getSelectedIds() 之后、exportUsers() 之前插入审核函数
const insertPos = c.indexOf('  async exportUsers() {');
if (insertPos < 0) { console.log('未找到插入位置'); process.exit(1); }

const toInsert = `
  // 审核通过
  async approveUser(userId) {
    if (!confirm('确认通过审核？')) return;
    const res = await this.api('/api/admin/user/approve', { method: 'POST', body: { userId } });
    if (res.code === 0) { this.toast('审核通过'); this.loadUsers(); }
    else this.toast(res.msg || '操作失败');
  }

  // 审核拒绝
  async rejectUser(userId) {
    const reason = prompt('请填写拒绝原因：');
    if (!reason) return;
    const res = await this.api('/api/admin/user/reject', { method: 'POST', body: { userId, reason } });
    if (res.code === 0) { this.toast('已拒绝'); this.loadUsers(); }
    else this.toast(res.msg || '操作失败');
  }
`;

c = c.slice(0, insertPos) + toInsert + c.slice(insertPos);
fs.writeFileSync('admin/admin.js', c, 'utf8');
console.log('审核函数添加成功');
