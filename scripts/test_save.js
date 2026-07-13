// 测试保存用户资料功能
const http = require('http');

const BASE = 'http://localhost:8090';

// 1. 登录
function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ phone: '13900000001', password: '123456' });
    const req = http.request(`${BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        resolve(result);
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

// 2. 保存资料
function saveProfile(token) {
  const patch = {
    nickname: '测试昵称_' + Date.now(),
    age: 26,
    city: '厦门',
    bio: '这是测试个人介绍'
  };
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(patch);
    const req = http.request(`${BASE}/api/me`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json', 
        'Content-Length': data.length,
        'Authorization': 'Bearer ' + token
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        resolve(result);
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

// 3. 获取用户资料
function getProfile(token) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE}/api/me`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        resolve(result);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function test() {
  console.log('1. 登录...');
  const loginRes = await login();
  if (loginRes.code !== 0) {
    console.error('登录失败:', loginRes.msg);
    return;
  }
  const token = loginRes.data.token;
  console.log('✅ 登录成功, token:', token.slice(0, 20) + '...');
  
  const user = loginRes.data.user;
  console.log('当前用户:', user.nickname, user.phone);
  
  console.log('\n2. 保存资料...');
  const saveRes = await saveProfile(token);
  console.log('保存结果:', JSON.stringify(saveRes, null, 2));
  
  if (saveRes.code === 0) {
    console.log('✅ 保存成功');
    
    console.log('\n3. 获取最新资料...');
    const getRes = await getProfile(token);
    if (getRes.code === 0) {
      console.log('✅ 获取成功');
      console.log('昵称:', getRes.data.nickname);
      console.log('城市:', getRes.data.city);
      console.log('个人介绍:', getRes.data.bio);
    }
  }
}

test().catch(console.error);
