const BASE = 'http://localhost:3001/api';
let passed = 0, failed = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${extra}`); }
}

const login = async (u, p) => (await call('POST', '/auth/login', { body: { username: u, password: p } })).json.data.token;

// 准备账号
const admin = await login('admin', 'admin123');
const zhangchen = await login('2023001', '123456');   // AI 协会社长
const linxy = await login('2024001', '123456');       // 林晓雨
const sunkx = await login('2024006', '123456');       // 孙可欣（桌游社发起人）

console.log('\n[链路 1] 社团成立全流程');
{
  const create = await call('POST', '/clubs', { token: sunkx, body: { name: '轮滑社', type_id: 3, description: '一起刷街，享受速度与自由。', teacher_name: '刘教练' } });
  check('学生提交社团申请', create.status === 200, JSON.stringify(create.json));
  const clubId = create.json.data?.id;

  const pending = await call('GET', '/clubs/pending/list', { token: admin });
  check('管理员可见待审核列表', pending.json.data.some(c => c.id === clubId));

  const audit = await call('POST', `/clubs/${clubId}/audit`, { token: admin, body: { approve: true } });
  check('管理员审核通过', audit.status === 200);

  const detail = await call('GET', `/clubs/${clubId}`, { token: sunkx });
  check('社团状态为正常', detail.json.data.status === 1);
  check('发起人自动成为社长', detail.json.data.my_membership?.position === '社长');

  const dup = await call('POST', '/clubs', { token: sunkx, body: { name: '轮滑社', type_id: 3, description: '重名测试' } });
  check('同名社团被拒绝', dup.status === 409);
}

console.log('\n[链路 2] 入社审核全流程');
{
  const apply = await call('POST', '/clubs/4/apply', { token: linxy, body: { reason: '想打篮球' } });
  check('学生提交入社申请', apply.status === 200, JSON.stringify(apply.json));

  const listBefore = await call('GET', '/clubs/4/members?status=0', { token: login('2024004', '123456').then ? await login('2024004', '123456') : '' });
  const target = listBefore.json.data.find(m => m.real_name === '林晓雨');
  check('社长可见待审核申请', !!target);

  const review = await call('POST', `/clubs/4/members/${target.id}/review`, { token: await login('2024004', '123456'), body: { approve: true } });
  check('社长审核通过', review.status === 200);

  const club = await call('GET', '/clubs/4', { token: linxy });
  check('成员列表显示该学生', club.json.data.my_membership?.status === 1);

  const dup = await call('POST', '/clubs/4/apply', { token: linxy, body: { reason: '重复申请' } });
  check('重复申请被拒绝', dup.status === 409);

  const stranger = await call('GET', '/clubs/4/members?status=0', { token: linxy });
  check('普通成员无审核权限', stranger.status === 403 || !stranger.json.data);
}

console.log('\n[链路 3] 活动报名全流程（含名额限制）');
{
  // 创建一个只有 1 个名额的活动
  const act = await call('POST', '/activities', { token: zhangchen, body: {
    club_id: 1, title: '测试-小场沙龙', location: '理科楼101',
    start_time: '2026-08-01 19:00:00', end_time: '2026-08-01 21:00:00',
    sign_deadline: '2026-07-31 18:00:00', max_num: 1
  } });
  check('社长发布活动', act.status === 200, JSON.stringify(act.json));
  const actId = act.json.data?.id;

  const s1 = await call('POST', `/activities/${actId}/signup`, { token: linxy });
  check('学生报名成功', s1.status === 200, JSON.stringify(s1.json));

  const dup = await call('POST', `/activities/${actId}/signup`, { token: linxy });
  check('重复报名被拒绝', dup.status === 409);

  const wangsy = await login('2024002', '123456');
  const s2 = await call('POST', `/activities/${actId}/signup`, { token: wangsy });
  check('名额满员无法再报', s2.status === 409, JSON.stringify(s2.json));

  const cancel = await call('POST', `/activities/${actId}/cancel-signup`, { token: linxy });
  check('取消报名', cancel.status === 200);
  const s3 = await call('POST', `/activities/${actId}/signup`, { token: wangsy });
  check('取消后名额释放可再报', s3.status === 200);
}

console.log('\n[链路 4] 二维码签到全流程');
{
  // 活动 1：AI 工作坊，林晓雨已报名（种子数据）
  const forbidden = await call('GET', '/activities/1/checkin-code', { token: linxy });
  check('普通成员不可生成签到码', forbidden.status === 403);

  const codeRes = await call('GET', '/activities/1/checkin-code', { token: zhangchen });
  check('社长生成签到码', codeRes.status === 200 && !!codeRes.json.data.code && !!codeRes.json.data.qr);
  const code = codeRes.json.data.code;

  const bad = await call('POST', '/activities/1/checkin', { token: linxy, body: { code: 'XXXXXX' } });
  check('错误签到码被拒绝', bad.status === 400);

  const okCheckin = await call('POST', '/activities/1/checkin', { token: linxy, body: { code } });
  check('正确签到码签到成功', okCheckin.status === 200, JSON.stringify(okCheckin.json));

  const twice = await call('POST', '/activities/1/checkin', { token: linxy, body: { code } });
  check('重复签到被拒绝', twice.status === 409);

  const signups = await call('GET', '/activities/1/signups', { token: zhangchen });
  const me = signups.json.data.find(s => s.real_name === '林晓雨');
  check('签到列表实时更新', me?.status === 2 && !!me?.checkin_time);
}

console.log(`\n结果：${passed} 通过，${failed} 失败`);
process.exit(failed ? 1 : 0);
