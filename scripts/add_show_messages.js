const fs = require('fs');
let c = fs.readFileSync('h5/app.js', 'utf8');

// 在 renderMine() 函数结束后插入 showMessages() 和 markMessageRead()
// renderMine 结束位置：查找 '      </div>\n    }\n  },'（后面是 renderContact）
const RenderMineEnd = c.indexOf('      </div>\\n    }\\n  },\n  async renderContact');
if (RenderMineEnd < 0) { console.log('未找到renderMine结束位置'); process.exit(1); }

const toInsert = `  },

  async showMessages() {
    if (!App.user) return Auth.openLogin();
    const res = await App.api('/api/me/messages');
    if (res.code !== 0) return App.toast('加载失败');
    const msgs = res.data.list || [];
    const content = document.getElementById('content');
    content.innerHTML = \`
      <div class="page active">
        <div class="section-title">📨 站内信</div>
        \${msgs.length === 0 ? '<div class="empty"><div class="icon">📭</div>暂无站内信</div>' :
          msgs.map(m => \`
            <div class="msg-item \${m.read ? '' : 'unread'}" onclick="Pages.markMessageRead('\${m.id}')">
              <div class="msg-content">\${m.content}</div>
              <div class="msg-time">\${new Date(m.createdAt).toLocaleString('zh-CN')}</div>
            </div>
          \`).join('')}
        <div style="text-align:center;margin-top:12px;">
          <button class="btn" onclick="Pages.markMessageRead()">全部标为已读</button>
        </div>
      </div>
    \`;
  },

  async markMessageRead(messageId) {
    await App.api('/api/me/messages/read', { method: 'POST', body: messageId ? { messageId } : {} });
    this.showMessages();
  },

`;

c = c.slice(0, RenderMineEnd + 12) + toInsert + c.slice(RenderMineEnd + 12);
fs.writeFileSync('h5/app.js', c, 'utf8');
console.log('showMessages() 添加成功');
