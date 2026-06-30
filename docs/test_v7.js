// Edge headless + CDP 端到端验证：快捷入口（4列 + 仿 zeai 风格）
const { exec } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SCREEN_DIR = 'C:\\Users\\Administrator\\WorkBuddy\\2026-06-21-16-26-51\\zeai_h5\\docs\\screens';
const URL_HOME = 'http://localhost:8088/';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

  // 启动 Edge headless
  const child = exec(`"${EDGE}" --headless=new --remote-debugging-port=9223 --window-size=400,900 --user-data-dir=C:\\Users\\Administrator\\AppData\\Local\\Temp\\edge-headless-8088-v2 about:blank`, { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('Edge 启动中...');
  await sleep(3000);

  const targets = await fetch('http://127.0.0.1:9223/json').then(r => r.json());
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
      return null;
    }
    return r.result?.result?.value;
  };

  // 0. 模拟 iPhone 12 视口（确保 4 列展示完整）
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(500);

  // 1. 打开 H5 首页
  await send('Page.navigate', { url: URL_HOME });
  await sleep(2500);

  // 2. 验证快捷入口
  const dims = await evalJS(`({ innerWidth: window.innerWidth, innerHeight: window.innerHeight, contentW: document.querySelector('.content')?.getBoundingClientRect().width })`);
  console.log('视口尺寸:', dims);
  const quick = await evalJS(`(() => {
    const grid = document.querySelector('.quick-grid');
    if (!grid) return { error: 'no .quick-grid' };
    const items = Array.from(grid.querySelectorAll('.item'));
    return {
      total: items.length,
      gridColumns: getComputedStyle(grid).gridTemplateColumns,
      items: items.map(it => ({
        title: it.querySelector('.label')?.textContent,
        sub: it.querySelector('.sub')?.textContent,
        iconChar: it.querySelector('.icon')?.textContent,
        iconBg: getComputedStyle(it.querySelector('.icon')).backgroundColor,
        iconSize: getComputedStyle(it.querySelector('.icon')).width
      }))
    };
  })()`);
  console.log('=== 快捷入口 ===');
  console.log('总数:', quick?.total);
  console.log('网格列数:', quick?.gridColumns);
  console.log('icon 尺寸:', quick?.items?.[0]?.iconSize);
  console.log('icon 背景:', quick?.items?.[0]?.iconBg);
  quick?.items?.forEach((it, i) => console.log(`  ${i+1}. ${it.iconChar} ${it.title} - ${it.sub}`));

  // 3. 截图
  const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 420, height: 900, scale: 1 } });
  fs.writeFileSync(SCREEN_DIR + '\\home_v7.png', Buffer.from(shot.result.data, 'base64'));
  console.log('截图已保存: home_v7.png');

  ws.close();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
