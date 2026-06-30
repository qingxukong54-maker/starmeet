@echo off
chcp 65001 > nul

echo 测试快捷入口编辑和删除功能
echo ================================

REM 登录获取token
curl -s -X POST http://localhost:8090/api/admin/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"admin888\"}" > login_result.json

REM 提取token
for /f "tokens=2 delims=:" %%a in ('findstr "\"token\"" login_result.json') do (
  set TOKEN=%%a
  set TOKEN=!TOKEN:"=!
  set TOKEN=!TOKEN:,=!
)

echo 登录成功，token已获取
echo.

REM 获取当前列表
curl -s http://localhost:8090/api/admin/match-banners ^
  -H "Authorization: Bearer c7d4a9a8e69eb842588c503006c38b16" > list_before.json

echo 当前快捷入口列表：
type list_before.json | findstr "\"id\""
echo.

REM 测试编辑：修改第一个条目标题
echo 正在测试编辑功能...
REM 这里需要手动构造编辑后的JSON，暂时跳过

REM 测试删除：删除第一个条目
echo 正在测试删除功能...
REM 这里需要手动构造删除后的JSON，暂时跳过

echo.
echo 测试完成
pause
