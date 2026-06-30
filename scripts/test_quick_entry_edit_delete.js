// 完整测试快捷入口的编辑和删除功能
const http = require('http');

let token = '';

// 步骤1：登录
function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ username: 'admin', password: 'admin888' });
    const options = {
      hostname: 'localhost',
      port: 8090,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.code === 0) {
          token = result.data.token;
          console.log('✅ 登录成功');
          resolve();
        } else {
          reject(new Error('登录失败: ' + result.msg));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// 步骤2：获取快捷入口列表
function getList() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8090,
      path: '/api/admin/match-banners',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.code === 0) {
          console.log(`✅ 获取列表成功，共 ${result.data.length} 条`);
          resolve(result.data);
        } else {
          reject(new Error('获取列表失败: ' + result.msg));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// 步骤3：编辑第一个快捷入口
function editEntry(id, newTitle) {
  return new Promise((resolve, reject) => {
    // 先获取完整列表
    getList().then(list => {
      const target = list.find(item => item.id === id);
      if (!target) return reject(new Error('找不到ID: ' + id));
      
      // 修改标题
      target.title = newTitle;
      
      const data = JSON.stringify({ list });
      const options = {
        hostname: 'localhost',
        port: 8090,
        path: '/api/admin/match-banners',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'Content-Length': data.length
        }
      };
      
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          const result = JSON.parse(body);
          if (result.code === 0) {
            console.log(`✅ 编辑成功: ${id} -> ${newTitle}`);
            resolve();
          } else {
            reject(new Error('编辑失败: ' + result.msg));
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    }).catch(reject);
  });
}

// 步骤4：删除第一个快捷入口
function deleteEntry(id) {
  return new Promise((resolve, reject) => {
    getList().then(list => {
      const newList = list.filter(item => item.id !== id);
      
      const data = JSON.stringify({ list: newList });
      const options = {
        hostname: 'localhost',
        port: 8090,
        path: '/api/admin/match-banners',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'Content-Length': data.length
        }
      };
      
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          const result = JSON.parse(body);
          if (result.code === 0) {
            console.log(`✅ 删除成功: ${id}`);
            console.log(`   删除后数量: ${result.data.length}`);
            resolve();
          } else {
            reject(new Error('删除失败: ' + result.msg));
          }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    }).catch(reject);
  });
}

// 主测试流程
async function runTests() {
  try {
    console.log('=== 开始测试快捷入口编辑和删除功能 ===\n');
    
    // 登录
    await login();
    
    // 获取列表
    const list = await getList();
    console.log('\n当前快捷入口:');
    list.forEach((item, idx) => {
      console.log(`  ${idx + 1}. ID: ${item.id}, 标题: ${item.title}`);
    });
    
    if (list.length === 0) {
      console.log('❌ 列表为空，无法测试');
      return;
    }
    
    // 测试编辑
    const editId = list[0].id;
    const newTitle = list[0].title + '（已编辑）';
    console.log(`\n--- 测试编辑功能 ---`);
    console.log(`编辑 ID: ${editId}`);
    await editEntry(editId, newTitle);
    
    // 验证编辑
    const listAfterEdit = await getList();
    const editedItem = listAfterEdit.find(item => item.id === editId);
    if (editedItem && editedItem.title === newTitle) {
      console.log(`✅ 编辑验证通过: ${editedItem.title}`);
    } else {
      console.log(`❌ 编辑验证失败`);
    }
    
    // 测试删除
    const deleteId = listAfterEdit[0].id;
    console.log(`\n--- 测试删除功能 ---`);
    console.log(`删除 ID: ${deleteId}`);
    await deleteEntry(deleteId);
    
    // 验证删除
    const listAfterDelete = await getList();
    const deletedItem = listAfterDelete.find(item => item.id === deleteId);
    if (!deletedItem) {
      console.log(`✅ 删除验证通过: ID ${deleteId} 已不存在`);
      console.log(`   删除后数量: ${listAfterDelete.length}`);
    } else {
      console.log(`❌ 删除验证失败: ID ${deleteId} 仍存在`);
    }
    
    console.log('\n=== 测试完成 ===');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

runTests();
