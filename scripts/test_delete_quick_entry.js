// 测试删除快捷入口功能
const http = require('http');

// 先登录获取token
const loginData = JSON.stringify({
  username: 'admin',
  password: 'admin888'
});

const loginOptions = {
  hostname: 'localhost',
  port: 8090,
  path: '/api/admin/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

const loginReq = http.request(loginOptions, (loginRes) => {
  let loginBody = '';
  loginRes.on('data', (chunk) => loginBody += chunk);
  loginRes.on('end', () => {
    const loginResult = JSON.parse(loginBody);
    if (loginResult.code !== 0) {
      console.log('登录失败:', loginResult.msg);
      return;
    }
    
    const token = loginResult.data.token;
    console.log('登录成功，token:', token.slice(0, 20) + '...');
    
    // 获取当前快捷入口列表
    const getOptions = {
      hostname: 'localhost',
      port: 8090,
      path: '/api/admin/match-banners',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    };
    
    const getReq = http.request(getOptions, (getRes) => {
      let getBody = '';
      getRes.on('data', (chunk) => getBody += chunk);
      getRes.on('end', () => {
        const getData = JSON.parse(getBody);
        console.log('当前快捷入口数量:', getData.data.length);
        console.log('快捷入口列表:');
        getData.data.forEach((item, idx) => {
          console.log(`  ${idx + 1}. ID: ${item.id}, 标题: ${item.title}`);
        });
        
        if (getData.data.length > 0) {
          // 尝试删除第一个快捷入口
          const deleteId = getData.data[0].id;
          const newList = getData.data.filter(item => item.id !== deleteId);
          
          const deleteData = JSON.stringify({ list: newList });
          const deleteOptions = {
            hostname: 'localhost',
            port: 8090,
            path: '/api/admin/match-banners',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token,
              'Content-Length': deleteData.length
            }
          };
          
          console.log(`\n尝试删除 ID: ${deleteId}`);
          console.log(`删除后列表数量: ${newList.length}`);
          
          const deleteReq = http.request(deleteOptions, (deleteRes) => {
            let deleteBody = '';
            deleteRes.on('data', (chunk) => deleteBody += chunk);
            deleteRes.on('end', () => {
              const deleteResult = JSON.parse(deleteBody);
              console.log('删除结果:', deleteResult);
              
              // 再次获取列表，确认删除是否生效
              const verifyReq = http.request(getOptions, (verifyRes) => {
                let verifyBody = '';
                verifyRes.on('data', (chunk) => verifyBody += chunk);
                verifyRes.on('end', () => {
                  const verifyData = JSON.parse(verifyBody);
                  console.log('\n删除后验证 - 当前快捷入口数量:', verifyData.data.length);
                  console.log('验证结果:', verifyData.data.length === newList.length ? '✅ 删除成功' : '❌ 删除失败');
                });
              });
              verifyReq.on('error', (e) => console.error('验证请求错误:', e));
              verifyReq.end();
            });
          });
          deleteReq.on('error', (e) => console.error('删除请求错误:', e));
          deleteReq.write(deleteData);
          deleteReq.end();
        }
      });
    });
    getReq.on('error', (e) => console.error('获取请求错误:', e));
    getReq.end();
  });
});

loginReq.on('error', (e) => console.error('登录请求错误:', e));
loginReq.write(loginData);
loginReq.end();
