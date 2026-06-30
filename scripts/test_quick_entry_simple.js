// 简化测试：直接测试编辑和删除API
const http = require('http');

const loginData = JSON.stringify({ username: 'admin', password: 'admin888' });

const loginOptions = {
  hostname: 'localhost',
  port: 8090,
  path: '/api/admin/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
};

const loginReq = http.request(loginOptions, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const result = JSON.parse(body);
    if (result.code !== 0) {
      console.log('登录失败:', result.msg);
      return;
    }
    
    const token = result.data.token;
    console.log('✅ 登录成功\n');
    
    // 获取当前列表
    const getOptions = {
      hostname: 'localhost',
      port: 8090,
      path: '/api/admin/match-banners',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    
    const getReq = http.request(getOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        const list = result.data;
        console.log('当前快捷入口列表:');
        list.forEach((item, idx) => {
          console.log(`  ${idx + 1}. ID: ${item.id}, 标题: ${item.title}`);
        });
        
        if (list.length === 0) {
          console.log('\n❌ 列表为空，无法测试');
          return;
        }
        
        // 测试1：编辑第一个条目
        const editId = list[0].id;
        const newTitle = list[0].title + '（测试编辑）';
        const editedList = list.map(item => {
          if (item.id === editId) {
            return { ...item, title: newTitle };
          }
          return item;
        });
        
        console.log(`\n--- 测试编辑 ---`);
        console.log(`编辑 ID: ${editId}`);
        console.log(`新标题: ${newTitle}`);
        
        const editData = JSON.stringify({ list: editedList });
        const editOptions = {
          hostname: 'localhost',
          port: 8090,
          path: '/api/admin/match-banners',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
            'Content-Length': editData.length
          }
        };
        
        const editReq = http.request(editOptions, (res) => {
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => {
            const result = JSON.parse(body);
            if (result.code === 0) {
              console.log('✅ 编辑API调用成功');
              
              // 验证编辑
              const verifyReq = http.request(getOptions, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                  const result = JSON.parse(body);
                  const editedItem = result.data.find(item => item.id === editId);
                  if (editedItem && editedItem.title === newTitle) {
                    console.log(`✅ 编辑验证通过: ${editedItem.title}\n`);
                  } else {
                    console.log(`❌ 编辑验证失败\n`);
                  }
                  
                  // 测试2：删除第一个条目
                  const deleteId = result.data[0].id;
                  const newList = result.data.filter(item => item.id !== deleteId);
                  
                  console.log(`--- 测试删除 ---`);
                  console.log(`删除 ID: ${deleteId}`);
                  
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
                  
                  const deleteReq = http.request(deleteOptions, (res) => {
                    let body = '';
                    res.on('data', (chunk) => body += chunk);
                    res.on('end', () => {
                      const result = JSON.parse(body);
                      if (result.code === 0) {
                        console.log('✅ 删除API调用成功');
                        console.log(`   删除后数量: ${result.data.length}`);
                        
                        // 验证删除
                        const verifyReq2 = http.request(getOptions, (res) => {
                          let body = '';
                          res.on('data', (chunk) => body += chunk);
                          res.on('end', () => {
                            const result = JSON.parse(body);
                            const deletedItem = result.data.find(item => item.id === deleteId);
                            if (!deletedItem) {
                              console.log(`✅ 删除验证通过: ID ${deleteId} 已不存在`);
                              console.log(`   最终数量: ${result.data.length}`);
                            } else {
                              console.log(`❌ 删除验证失败: ID ${deleteId} 仍存在`);
                            }
                          });
                        });
                        verifyReq2.on('error', (e) => console.error('验证请求错误:', e));
                        verifyReq2.end();
                      } else {
                        console.log('❌ 删除API调用失败:', result.msg);
                      }
                    });
                  });
                  deleteReq.on('error', (e) => console.error('删除请求错误:', e));
                  deleteReq.write(deleteData);
                  deleteReq.end();
                });
              });
              verifyReq.on('error', (e) => console.error('验证请求错误:', e));
              verifyReq.end();
            } else {
              console.log('❌ 编辑API调用失败:', result.msg);
            }
          });
        });
        editReq.on('error', (e) => console.error('编辑请求错误:', e));
        editReq.write(editData);
        editReq.end();
      });
    });
    getReq.on('error', (e) => console.error('获取请求错误:', e));
    getReq.end();
  });
});

loginReq.on('error', (e) => console.error('登录请求错误:', e));
loginReq.write(loginData);
loginReq.end();
