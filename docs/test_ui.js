// Edge headless + CDP 端到端验证 H5 首页 + 联系我们
const { exec } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREEN_DIR = 'C:\\Users\\Administrator\\WorkBuddy\\2026-06-21-16-26-51\\zeai_h5\\docs\\screens';
const URL_HOME = 'http://localhost:8088/';
const URL_CONTACT = 'http://localhost:8088/#contact';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

  // 启动 Edge headless
  const child = exec(`"${EDGE}" --headless=new --remote-debugging-port=9222 --window-size=390,844 --user-data-dir=C:\\Users\\Administrator\\AppData\\Local\\Temp\\edge-headless-8088 about:blank`, { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('Edge 启动中...');
  await sleep(3000);

  // 获取调试 targets
  const targets = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const t = targets.find(x => x.type === 'page');
  if (!t) { console.error('找不到 page target'); process.exit(1); }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.on('message', data => {
    const m = JSON.parse(data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  });
  await new Promise((r, j) => { ws.on('open', r); ws.on('error', j); });
  const send = (method, params = {}) => {
    return new Promise(resolve => {
      const myId = ++id;
      pending.set(myId, resolve);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  };
  const evalJS = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) {
      console.error('JS 异常:', r.result.exceptionDetails.text);
      console.error(r.result.exceptionDetails.exception?.description);
      return null;
    }
    return r.result?.result?.value;
  };

  // 移动端 UA + 视口
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Network.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1' });

  // 1. 加载首页
  console.log('\n=== 1. 加载 H5 首页 ===');
  await send('Page.navigate', { url: URL_HOME });
  await sleep(2500);

  // 等待渲染
  let renderCheck = '';
  for (let i = 0; i < 20; i++) {
    renderCheck = await evalJS(`document.getElementById('content')?.innerHTML?.length || 0`);
    if (renderCheck > 200) break;
    await sleep(300);
  }
  console.log('content 长度:', renderCheck);

  // 验证 9 个快捷入口
  const quickCount = await evalJS(`document.querySelectorAll('.quick-grid .item').length`);
  console.log('快捷入口渲染数量:', quickCount, '(期望 9)');

  // 验证 banner
  const bannerCount = await evalJS(`document.querySelectorAll('.banner-slide').length`);
  console.log('轮播图数量:', bannerCount);

  // 验证 联系我们 入口
  const contactItem = await evalJS(`(() => {
    const items = document.querySelectorAll('.quick-grid .item');
    for (const it of items) {
      if (it.textContent.includes('联系我们')) {
        return { found: true, label: it.querySelector('.label')?.textContent, sub: it.querySelector('.sub')?.textContent };
      }
    }
    return { found: false };
  })()`);
  console.log('联系我们入口:', JSON.stringify(contactItem));

  // 截图首页
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(SCREEN_DIR + '/home_new.png', Buffer.from(shot1.result.data, 'base64'));
  console.log('首页截图: home_new.png');

  // 2. 点击联系我们
  console.log('\n=== 2. 跳转联系我们 ===');
  // 用 JS 模拟点击
  await evalJS(`(() => {
    const items = document.querySelectorAll('.quick-grid .item');
    for (const it of items) {
      if (it.textContent.includes('联系我们')) { it.click(); return true; }
    }
    return false;
  })()`);
  await sleep(1500);

  const pageContent = await evalJS(`document.getElementById('content')?.innerHTML || ''`);
  console.log('联系我们页面长度:', pageContent.length);
  const hasPhone = pageContent.includes('400-888-8888') || pageContent.includes('tel:');
  const hasWechat = pageContent.includes('starmeet_cs');
  const hasEmail = pageContent.includes('service@starmeet.com');
  const hasAddress = pageContent.includes('福州') || pageContent.includes('地址');
  const hasWorkTime = pageContent.includes('09:00') || pageContent.includes('工作时间');
  console.log('包含: 电话=', hasPhone, '微信=', hasWechat, '邮箱=', hasEmail, '地址=', hasAddress, '工作时间=', hasWorkTime);

  // 截图联系我们
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(SCREEN_DIR + '/contact.png', Buffer.from(shot2.result.data, 'base64'));
  console.log('联系我们截图: contact.png');

  // 3. 进入 Admin 后台测试"联系我们"菜单
  console.log('\n=== 3. Admin 后台联系我们 ===');
  // 桌面视口
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Network.clearBrowserCookies');
  await send('Network.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' });

  await send('Page.navigate', { url: 'http://localhost:8088/admin/' });
  await sleep(1500);

  // 登录
  await evalJS(`(() => {
    document.getElementById('loginUser').value = 'admin';
    document.getElementById('loginPwd').value = 'admin888';
    Admin.login();
  })()`);
  await sleep(1500);

  // 点击"联系我们"菜单
  const clickContact = await evalJS(`(() => {
    const items = document.querySelectorAll('.menu-item');
    for (const it of items) {
      if (it.dataset.page === 'contact') { it.click(); return true; }
    }
    return false;
  })()`);
  console.log('点击联系我们菜单:', clickContact);
  await sleep(1500);

  const titleText = await evalJS(`document.getElementById('pageTitle')?.textContent || ''`);
  console.log('当前页面标题:', titleText);
  const formOk = await evalJS(`!!document.getElementById('c_phone')`);
  console.log('联系表单渲染:', formOk);
  const phoneVal = await evalJS(`document.getElementById('c_phone')?.value || ''`);
  console.log('电话字段值:', phoneVal);

  // 截图 Admin
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(SCREEN_DIR + '/admin_contact.png', Buffer.from(shot3.result.data, 'base64'));
  console.log('Admin 截图: admin_contact.png');

  // 4. 测试保存
  await evalJS(`(() => {
    document.getElementById('c_phone').value = '400-100-8888';
    document.getElementById('c_phoneDisplay').value = '400-100-8888';
    document.getElementById('c_wechat').value = 'starmeet_vip';
    document.getElementById('c_intro').value = 'StarMeet 婚恋平台测试简介';
    Admin.saveContact();
  })()`);
  await sleep(1000);
  const saveToast = await evalJS(`document.getElementById('toast')?.textContent || ''`);
  console.log('保存 toast:', saveToast);

  // 5. 验证 H5 端同步刷新
  await send('Page.navigate', { url: URL_HOME });
  await sleep(1500);
  await evalJS(`Pages.renderContact()`);
  await sleep(1000);
  const contactNewPhone = await evalJS(`document.querySelector('.contact-card.phone .value')?.textContent || ''`);
  console.log('H5 联系我们新电话:', contactNewPhone);
  const shot4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(SCREEN_DIR + '/contact_updated.png', Buffer.from(shot4.result.data, 'base64'));
  console.log('更新后联系我们截图: contact_updated.png');

  ws.close();
  // 杀 Edge
  exec(`taskkill /F /IM msedge.exe 2>nul`);
  console.log('\n=== 验证完成 ===');
  process.exit(0);
}

run().catch(e => { console.error('ERROR:', e); exec(`taskkill /F /IM msedge.exe 2>nul`); process.exit(1); });
