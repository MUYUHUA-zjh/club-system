const BASE = 'http://localhost:3001/api';
let passed = 0, failed = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}
const login = async (u, p) => (await call('POST', '/auth/login', { body: { username: u, password: p } }));

// 准备：王思远(2024002,id=5) 与 陈默(2024003,id=6) 互加好友并聊天
const wang = (await login('2024002', '123456')).json.data.token;
const chen = (await login('2024003', '123456')).json.data.token;
const admin = (await login('admin', 'admin123')).json.data.token;

console.log('\n[同学录]');
{
  const dir = await call('GET', '/users', { token: wang });
  check('用户目录可访问', dir.status === 200 && dir.json.data.length > 0);
  const someUser = dir.json.data.find(u => u.phone);
  check('手机号已脱敏', !someUser || someUser.phone.includes('****'), someUser?.phone);

  const byGrade = await call('GET', '/users?grade=2024级', { token: wang });
  check('按年级筛选', byGrade.json.data.every(u => u.grade === '2024级'));

  const byCollege = await call('GET', `/users?college=${encodeURIComponent('计算机学院')}`, { token: wang });
  check('按学院筛选', byCollege.json.data.every(u => u.college === '计算机学院'));

  const byKw = await call('GET', `/users?keyword=${encodeURIComponent('陈默')}`, { token: wang });
  check('按姓名搜索', byKw.json.data.some(u => u.real_name === '陈默'));
}

console.log('\n[好友申请全流程]');
{
  const send = await call('POST', '/friends/6', { token: wang });
  check('发送好友申请', send.status === 200, JSON.stringify(send.json));

  const dup = await call('POST', '/friends/6', { token: wang });
  check('重复申请被拒绝', dup.status === 409);

  const reqs = await call('GET', '/friends/requests', { token: chen });
  const req = reqs.json.data.find(r => r.real_name === '王思远');
  check('对方收到申请', !!req);

  const msgBefore = await call('GET', '/messages/unread/count', { token: chen });
  check('申请计入未读角标', msgBefore.json.data.requests >= 1);

  const accept = await call('POST', `/friends/requests/${req.id}/accept`, { token: chen });
  check('通过申请', accept.status === 200);

  const friendsW = await call('GET', '/friends', { token: wang });
  const friendsC = await call('GET', '/friends', { token: chen });
  check('双向好友关系建立', friendsW.json.data.some(f => f.real_name === '陈默') && friendsC.json.data.some(f => f.real_name === '王思远'));

  const again = await call('POST', '/friends/6', { token: wang });
  check('已是好友不可重复添加', again.status === 409);
}

console.log('\n[站内聊天全流程]');
{
  const s1 = await call('POST', '/messages/6', { token: wang, body: { content: '陈默，周末外拍活动一起去吗？' } });
  check('好友可发消息', s1.status === 200, JSON.stringify(s1.json));

  const unread = await call('GET', '/messages/unread/count', { token: chen });
  check('未读消息计数正确', unread.json.data.count >= 1, JSON.stringify(unread.json));

  const conv = await call('GET', '/messages/conversations', { token: chen });
  const convW = conv.json.data.find(c => c.real_name === '王思远');
  check('会话列表含最新消息与未读数', convW?.last_message?.includes('外拍') && convW?.unread >= 1);

  const history = await call('GET', '/messages/5', { token: chen });
  check('读取聊天记录', history.json.data.messages.some(m => m.content.includes('外拍')));

  const unreadAfter = await call('GET', '/messages/unread/count', { token: chen });
  check('阅读后未读清零', unreadAfter.json.data.count === 0);

  const lin = (await login('2024001', '123456')).json.data.token;
  const blocked = await call('POST', '/messages/5', { token: lin, body: { content: '我们不是好友' } });
  check('非好友聊天被拦截', blocked.status === 403);
}

console.log('\n[管理员用户管理]');
{
  const forbidden = await call('GET', '/admin/users', { token: wang });
  check('普通用户无权访问', forbidden.status === 403);

  const list = await call('GET', '/admin/users', { token: admin });
  check('管理员查看全部用户', list.status === 200 && list.json.data.length > 0);
  const sun = list.json.data.find(u => u.student_id === '2024006');
  check('含完整联系方式（未脱敏）', !!sun && !String(sun.phone).includes('*'), sun?.phone);

  const disable = await call('PUT', `/admin/users/${sun.id}/status`, { token: admin, body: { status: 0 } });
  check('禁用账号', disable.status === 200);
  const loginDisabled = await login('2024006', '123456');
  check('被禁用账号无法登录', loginDisabled.status === 403 || loginDisabled.status === 401);

  const enable = await call('PUT', `/admin/users/${sun.id}/status`, { token: admin, body: { status: 1 } });
  check('恢复账号', enable.status === 200);

  const reset = await call('POST', `/admin/users/${sun.id}/reset-password`, { token: admin });
  check('重置密码', reset.status === 200);
  const relogin = await login('2024006', '123456');
  check('重置后可正常登录', relogin.status === 200);
}

console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed ? 1 : 0);
