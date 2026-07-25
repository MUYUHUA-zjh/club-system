import { Router } from 'express';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { db, tx } from './db.js';
import { signToken, authRequired, adminRequired, isClubManager, isClubLeader, checkinCode } from './auth.js';

export const router = Router();

const ok = (res, data) => res.json({ data });
const fail = (res, status, message) => res.status(status).json({ message });
const now = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const publicUser = u => ({ id: u.id, username: u.username, real_name: u.real_name, gender: u.gender, student_id: u.student_id, college: u.college, major: u.major, grade: u.grade, phone: u.phone, email: u.email, avatar: u.avatar, role: u.role });
const syncMemberCount = clubId => db.prepare('UPDATE club SET member_count = (SELECT COUNT(*) FROM club_member WHERE club_id = ? AND status = 1) WHERE id = ?').run(clubId, clubId);
const syncSignupCount = actId => db.prepare("UPDATE club_activity SET signup_count = (SELECT COUNT(*) FROM activity_signup WHERE activity_id = ? AND status IN (1,2) AND is_waitlist = 0) WHERE id = ?").run(actId, actId);

/* ---------------- 认证 ---------------- */

router.post('/auth/register', (req, res) => {
  const { username, password, real_name, college, major, grade, phone, email } = req.body || {};
  if (!username || !password || !real_name) return fail(res, 400, '学号、密码、姓名为必填项');
  if (String(password).length < 6) return fail(res, 400, '密码长度不能少于 6 位');
  if (db.prepare('SELECT id FROM sys_user WHERE username = ?').get(username)) return fail(res, 409, '该学号已注册，请直接登录');
  const hash = bcrypt.hashSync(String(password), 10);
  const r = db.prepare(`INSERT INTO sys_user (username, password, real_name, student_id, college, major, grade, phone, email)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(username, hash, real_name, username, college || '', major || '', grade || '', phone || '', email || '');
  const user = db.prepare('SELECT * FROM sys_user WHERE id = ?').get(r.lastInsertRowid);
  ok(res, { token: signToken(user), user: publicUser(user) });
});

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return fail(res, 400, '请输入学号和密码');
  const user = db.prepare('SELECT * FROM sys_user WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(String(password), user.password)) return fail(res, 401, '学号或密码错误');
  if (user.status !== 1) return fail(res, 403, '账号已被禁用，请联系管理员');
  ok(res, { token: signToken(user), user: publicUser(user) });
});

router.get('/auth/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM sys_user WHERE id = ?').get(req.user.id);
  ok(res, publicUser(user));
});

router.put('/users/me', authRequired, (req, res) => {
  const { real_name, gender, college, major, grade, phone, email } = req.body || {};
  db.prepare(`UPDATE sys_user SET real_name = COALESCE(?, real_name), gender = COALESCE(?, gender),
    college = COALESCE(?, college), major = COALESCE(?, major), grade = COALESCE(?, grade),
    phone = COALESCE(?, phone), email = COALESCE(?, email) WHERE id = ?`)
    .run(real_name ?? null, gender ?? null, college ?? null, major ?? null, grade ?? null, phone ?? null, email ?? null, req.user.id);
  ok(res, publicUser(db.prepare('SELECT * FROM sys_user WHERE id = ?').get(req.user.id)));
});

/* ---------------- 社团 ---------------- */

router.get('/clubs/types', (req, res) => ok(res, db.prepare('SELECT * FROM club_type ORDER BY id').all()));

router.get('/clubs', (req, res) => {
  const { type_id, keyword } = req.query;
  let sql = `SELECT c.*, t.name AS type_name FROM club c JOIN club_type t ON t.id = c.type_id WHERE c.status = 1`;
  const params = [];
  if (type_id) { sql += ' AND c.type_id = ?'; params.push(type_id); }
  if (keyword) { sql += ' AND (c.name LIKE ? OR c.description LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  sql += ' ORDER BY c.level DESC, c.member_count DESC';
  ok(res, db.prepare(sql).all(...params));
});

router.get('/clubs/pending/list', authRequired, adminRequired, (req, res) => {
  ok(res, db.prepare(`SELECT c.*, t.name AS type_name, u.real_name AS founder_name FROM club c
    JOIN club_type t ON t.id = c.type_id JOIN sys_user u ON u.id = c.founder_id
    WHERE c.status = 0 ORDER BY c.created_at DESC`).all());
});

router.get('/clubs/:id', authRequired, (req, res) => {
  const club = db.prepare(`SELECT c.*, t.name AS type_name, u.real_name AS founder_name FROM club c
    JOIN club_type t ON t.id = c.type_id JOIN sys_user u ON u.id = c.founder_id WHERE c.id = ?`).get(req.params.id);
  if (!club) return fail(res, 404, '社团不存在');
  const my = db.prepare('SELECT id, position, status FROM club_member WHERE club_id = ? AND user_id = ?').get(club.id, req.user.id);
  const leaders = db.prepare(`SELECT m.position, u.real_name FROM club_member m JOIN sys_user u ON u.id = m.user_id
    WHERE m.club_id = ? AND m.status = 1 AND m.position IN ('社长','副社长')`).all(club.id);
  ok(res, { ...club, my_membership: my || null, leaders, is_manager: isClubManager(req.user.id, club.id) });
});

router.post('/clubs', authRequired, (req, res) => {
  const { name, type_id, description, teacher_name, teacher_title } = req.body || {};
  if (!name || !type_id || !description) return fail(res, 400, '社团名称、分类、简介为必填项');
  const pendingCount = db.prepare('SELECT COUNT(*) AS c FROM club WHERE founder_id = ? AND status = 0').get(req.user.id).c;
  if (pendingCount >= 2) return fail(res, 400, '你已有 2 个待审核的社团申请，请等待审核结果');
  if (db.prepare('SELECT id FROM club WHERE name = ? AND status != 3').get(name)) return fail(res, 409, '已存在同名社团，请更换名称');
  const r = db.prepare(`INSERT INTO club (name, type_id, description, teacher_name, teacher_title, founder_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 0)`).run(name, type_id, description, teacher_name || '', teacher_title || '', req.user.id);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/clubs/:id', authRequired, (req, res) => {
  const club = db.prepare('SELECT * FROM club WHERE id = ?').get(req.params.id);
  if (!club) return fail(res, 404, '社团不存在');
  if (!isClubLeader(req.user.id, club.id)) return fail(res, 403, '仅社团负责人可编辑社团信息');
  const { name, type_id, description, teacher_name, teacher_title } = req.body || {};
  db.prepare(`UPDATE club SET name = COALESCE(?, name), type_id = COALESCE(?, type_id),
    description = COALESCE(?, description), teacher_name = COALESCE(?, teacher_name),
    teacher_title = COALESCE(?, teacher_title), updated_at = ? WHERE id = ?`)
    .run(name ?? null, type_id ?? null, description ?? null, teacher_name ?? null, teacher_title ?? null, now(), club.id);
  ok(res, { id: club.id });
});

router.post('/clubs/:id/audit', authRequired, adminRequired, (req, res) => {
  const { approve, reason } = req.body || {};
  const club = db.prepare('SELECT * FROM club WHERE id = ?').get(req.params.id);
  if (!club || club.status !== 0) return fail(res, 400, '该社团不在待审核状态');
  if (approve) {
    tx(() => {
      db.prepare('UPDATE club SET status = 1, reject_reason = NULL, updated_at = ? WHERE id = ?').run(now(), club.id);
      db.prepare(`INSERT INTO club_member (club_id, user_id, position, status, join_time) VALUES (?, ?, '社长', 1, ?)
        ON CONFLICT (club_id, user_id) DO UPDATE SET status = 1, position = '社长', join_time = ?`).run(club.id, club.founder_id, now(), now());
      syncMemberCount(club.id);
    });
  } else {
    if (!reason) return fail(res, 400, '驳回时必须填写驳回原因');
    db.prepare('UPDATE club SET status = 0, reject_reason = ?, updated_at = ? WHERE id = ?').run(reason, now(), club.id);
  }
  ok(res, { id: club.id });
});

/* ---------------- 成员 ---------------- */

router.post('/clubs/:id/apply', authRequired, (req, res) => {
  const club = db.prepare('SELECT * FROM club WHERE id = ?').get(req.params.id);
  if (!club || club.status !== 1) return fail(res, 404, '社团不存在或未通过审核');
  const existing = db.prepare('SELECT * FROM club_member WHERE club_id = ? AND user_id = ?').get(club.id, req.user.id);
  if (existing) {
    if (existing.status === 0) return fail(res, 409, '你的入社申请正在审核中');
    if (existing.status === 1) return fail(res, 409, '你已是该社团成员');
    db.prepare("UPDATE club_member SET status = 0, apply_reason = ?, created_at = ? WHERE id = ?").run(req.body?.reason || '', now(), existing.id);
    return ok(res, { id: existing.id });
  }
  const r = db.prepare('INSERT INTO club_member (club_id, user_id, apply_reason, status) VALUES (?, ?, ?, 0)')
    .run(club.id, req.user.id, req.body?.reason || '');
  ok(res, { id: r.lastInsertRowid });
});

router.get('/clubs/:id/members', authRequired, (req, res) => {
  const clubId = Number(req.params.id);
  const manager = isClubManager(req.user.id, clubId);
  const { keyword, status } = req.query;
  if (String(status) === '0' && !manager) return fail(res, 403, '仅社团管理者可查看待审核申请');
  let sql = `SELECT m.id, m.position, m.department, m.points, m.status, m.apply_reason, m.join_time, m.created_at,
    u.real_name, u.student_id, u.college, u.major, u.grade
    FROM club_member m JOIN sys_user u ON u.id = m.user_id WHERE m.club_id = ?`;
  const params = [clubId];
  if (status !== undefined && status !== '') { sql += ' AND m.status = ?'; params.push(Number(status)); }
  else if (!manager) sql += ' AND m.status = 1';
  if (keyword) { sql += ' AND (u.real_name LIKE ? OR u.student_id LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  sql += " ORDER BY CASE m.position WHEN '社长' THEN 0 WHEN '副社长' THEN 1 WHEN '部长' THEN 2 ELSE 3 END, m.join_time";
  ok(res, db.prepare(sql).all(...params));
});

router.post('/clubs/:clubId/members/:memberId/review', authRequired, (req, res) => {
  const clubId = Number(req.params.clubId);
  if (!isClubManager(req.user.id, clubId)) return fail(res, 403, '仅社团管理者可审核入社申请');
  const m = db.prepare('SELECT * FROM club_member WHERE id = ? AND club_id = ? AND status = 0').get(req.params.memberId, clubId);
  if (!m) return fail(res, 404, '申请不存在或已处理');
  if (req.body?.approve) {
    db.prepare("UPDATE club_member SET status = 1, join_time = ? WHERE id = ?").run(now(), m.id);
    syncMemberCount(clubId);
  } else {
    db.prepare('DELETE FROM club_member WHERE id = ?').run(m.id);
  }
  ok(res, { id: m.id });
});

router.delete('/clubs/:clubId/members/:memberId', authRequired, (req, res) => {
  const clubId = Number(req.params.clubId);
  if (!isClubLeader(req.user.id, clubId)) return fail(res, 403, '仅社团负责人可移除成员');
  const m = db.prepare('SELECT * FROM club_member WHERE id = ? AND club_id = ?').get(req.params.memberId, clubId);
  if (!m) return fail(res, 404, '成员不存在');
  if (m.user_id === req.user.id) return fail(res, 400, '不能移除自己，请使用退社功能');
  db.prepare('UPDATE club_member SET status = 2 WHERE id = ?').run(m.id);
  syncMemberCount(clubId);
  ok(res, { id: m.id });
});

router.post('/clubs/:id/quit', authRequired, (req, res) => {
  const m = db.prepare('SELECT * FROM club_member WHERE club_id = ? AND user_id = ? AND status = 1').get(req.params.id, req.user.id);
  if (!m) return fail(res, 404, '你不是该社团成员');
  if (m.position === '社长') return fail(res, 400, '社长需先完成换届交接才能退社');
  db.prepare('UPDATE club_member SET status = 2 WHERE id = ?').run(m.id);
  syncMemberCount(Number(req.params.id));
  ok(res, { id: m.id });
});

/* ---------------- 活动 ---------------- */

router.get('/activities', authRequired, (req, res) => {
  const { club_id, keyword, scope } = req.query;
  let sql = `SELECT a.*, c.name AS club_name FROM club_activity a JOIN club c ON c.id = a.club_id WHERE a.status != 4`;
  const params = [];
  if (club_id) { sql += ' AND a.club_id = ?'; params.push(club_id); }
  if (keyword) { sql += ' AND (a.title LIKE ? OR a.location LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  if (scope === 'upcoming') sql += " AND a.status IN (1, 2)";
  sql += ' ORDER BY CASE WHEN a.status = 3 THEN 1 ELSE 0 END, a.start_time';
  const rows = db.prepare(sql).all(...params);
  const mySignups = db.prepare('SELECT activity_id, status FROM activity_signup WHERE user_id = ?').all(req.user.id);
  const map = Object.fromEntries(mySignups.map(s => [s.activity_id, s.status]));
  ok(res, rows.map(a => ({ ...a, my_signup: map[a.id] || 0 })));
});

router.get('/activities/:id', authRequired, (req, res) => {
  const a = db.prepare(`SELECT a.*, c.name AS club_name FROM club_activity a JOIN club c ON c.id = a.club_id WHERE a.id = ?`).get(req.params.id);
  if (!a) return fail(res, 404, '活动不存在');
  const my = db.prepare('SELECT status FROM activity_signup WHERE activity_id = ? AND user_id = ?').get(a.id, req.user.id);
  ok(res, { ...a, my_signup: my?.status || 0, is_manager: isClubManager(req.user.id, a.club_id) });
});

router.post('/activities', authRequired, (req, res) => {
  const { club_id, title, content, location, start_time, end_time, sign_deadline, max_num, activity_type } = req.body || {};
  if (!club_id || !title || !start_time || !end_time || !sign_deadline) return fail(res, 400, '社团、标题、时间信息为必填项');
  if (!isClubManager(req.user.id, Number(club_id))) return fail(res, 403, '仅社团管理者可发布活动');
  const r = db.prepare(`INSERT INTO club_activity (club_id, title, content, location, start_time, end_time, sign_deadline, max_num, activity_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(club_id, title, content || '', location || '', start_time, end_time, sign_deadline, Number(max_num) || 0, Number(activity_type) || 1);
  ok(res, { id: r.lastInsertRowid });
});

router.put('/activities/:id', authRequired, (req, res) => {
  const a = db.prepare('SELECT * FROM club_activity WHERE id = ?').get(req.params.id);
  if (!a) return fail(res, 404, '活动不存在');
  if (!isClubManager(req.user.id, a.club_id)) return fail(res, 403, '仅社团管理者可编辑活动');
  const { title, content, location, start_time, end_time, sign_deadline, max_num, status } = req.body || {};
  db.prepare(`UPDATE club_activity SET title = COALESCE(?, title), content = COALESCE(?, content),
    location = COALESCE(?, location), start_time = COALESCE(?, start_time), end_time = COALESCE(?, end_time),
    sign_deadline = COALESCE(?, sign_deadline), max_num = COALESCE(?, max_num), status = COALESCE(?, status) WHERE id = ?`)
    .run(title ?? null, content ?? null, location ?? null, start_time ?? null, end_time ?? null, sign_deadline ?? null,
      max_num === undefined ? null : Number(max_num), status ?? null, a.id);
  ok(res, { id: a.id });
});

router.post('/activities/:id/signup', authRequired, (req, res) => {
  const a = db.prepare('SELECT * FROM club_activity WHERE id = ?').get(req.params.id);
  if (!a) return fail(res, 404, '活动不存在');
  if (a.status !== 1) return fail(res, 400, '该活动不在报名阶段');
  if (a.sign_deadline < now()) return fail(res, 400, '报名已截止');
  try {
    tx(() => {
      const existing = db.prepare('SELECT * FROM activity_signup WHERE activity_id = ? AND user_id = ?').get(a.id, req.user.id);
      if (existing && existing.status !== 4) throw Object.assign(new Error('你已报名该活动'), { status: 409 });
      if (a.max_num > 0) {
        const count = db.prepare('SELECT COUNT(*) AS c FROM activity_signup WHERE activity_id = ? AND status IN (1,2)').get(a.id).c;
        if (count >= a.max_num) throw Object.assign(new Error('名额已满，请关注社团后续活动'), { status: 409 });
      }
      if (existing) db.prepare("UPDATE activity_signup SET status = 1, sign_time = ? WHERE id = ?").run(now(), existing.id);
      else db.prepare('INSERT INTO activity_signup (activity_id, user_id) VALUES (?, ?)').run(a.id, req.user.id);
      syncSignupCount(a.id);
    });
  } catch (e) {
    return fail(res, e.status || 500, e.message);
  }
  ok(res, { id: a.id });
});

router.post('/activities/:id/cancel-signup', authRequired, (req, res) => {
  const s = db.prepare('SELECT * FROM activity_signup WHERE activity_id = ? AND user_id = ? AND status = 1').get(req.params.id, req.user.id);
  if (!s) return fail(res, 404, '你没有待取消的报名');
  db.prepare('UPDATE activity_signup SET status = 4 WHERE id = ?').run(s.id);
  syncSignupCount(Number(req.params.id));
  ok(res, { id: s.id });
});

router.get('/activities/:id/signups', authRequired, (req, res) => {
  const a = db.prepare('SELECT * FROM club_activity WHERE id = ?').get(req.params.id);
  if (!a) return fail(res, 404, '活动不存在');
  if (!isClubManager(req.user.id, a.club_id)) return fail(res, 403, '仅社团管理者可查看报名名单');
  ok(res, db.prepare(`SELECT s.id, s.status, s.sign_time, s.checkin_time, u.real_name, u.student_id, u.college, u.grade, u.phone
    FROM activity_signup s JOIN sys_user u ON u.id = s.user_id
    WHERE s.activity_id = ? AND s.status != 4 ORDER BY s.sign_time`).all(a.id));
});

router.get('/activities/:id/export', authRequired, (req, res) => {
  const a = db.prepare('SELECT a.*, c.name AS club_name FROM club_activity a JOIN club c ON c.id = a.club_id WHERE a.id = ?').get(req.params.id);
  if (!a) return fail(res, 404, '活动不存在');
  if (!isClubManager(req.user.id, a.club_id)) return fail(res, 403, '仅社团管理者可导出名单');
  const rows = db.prepare(`SELECT u.real_name, u.student_id, u.college, u.grade, u.phone, s.sign_time, s.checkin_time, s.status
    FROM activity_signup s JOIN sys_user u ON u.id = s.user_id WHERE s.activity_id = ? AND s.status != 4 ORDER BY s.sign_time`).all(a.id);
  const statusText = { 1: '已报名', 2: '已签到', 4: '已取消' };
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['姓名,学号,学院,年级,手机号,报名时间,签到时间,状态']
    .concat(rows.map(r => [r.real_name, r.student_id, r.college, r.grade, r.phone, r.sign_time, r.checkin_time || '', statusText[r.status]].map(esc).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="activity-${a.id}-signups.csv"`);
  res.send('﻿' + lines.join('\r\n'));
});

/* ---------------- 签到 ---------------- */

router.get('/activities/:id/checkin-code', authRequired, async (req, res) => {
  const a = db.prepare('SELECT * FROM club_activity WHERE id = ?').get(req.params.id);
  if (!a) return fail(res, 404, '活动不存在');
  if (!isClubManager(req.user.id, a.club_id)) return fail(res, 403, '仅社团管理者可生成签到码');
  const code = checkinCode(a.id);
  const qr = await QRCode.toDataURL(JSON.stringify({ a: a.id, c: code }), { margin: 1, width: 280, color: { dark: '#1F1E1B', light: '#FFFFFF' } });
  ok(res, { code, qr, valid_seconds: 60 - (Math.floor(Date.now() / 1000) % 60) });
});

router.post('/activities/:id/checkin', authRequired, (req, res) => {
  const a = db.prepare('SELECT * FROM club_activity WHERE id = ?').get(req.params.id);
  if (!a) return fail(res, 404, '活动不存在');
  const s = db.prepare('SELECT * FROM activity_signup WHERE activity_id = ? AND user_id = ? AND status IN (1,2)').get(a.id, req.user.id);
  if (!s) return fail(res, 404, '你尚未报名该活动，无法签到');
  if (s.status === 2) return fail(res, 409, '你已完成签到，无需重复操作');
  const code = String(req.body?.code || '').trim().toUpperCase();
  const valid = [0, -1, 1].some(w => checkinCode(a.id, w) === code);
  if (!code || !valid) return fail(res, 400, '签到码无效或已过期，请向工作人员获取最新签到码');
  db.prepare('UPDATE activity_signup SET status = 2, checkin_time = ? WHERE id = ?').run(now(), s.id);
  ok(res, { id: s.id, checkin_time: now() });
});

/* ---------------- 通知公告 ---------------- */

router.get('/notices', authRequired, (req, res) => {
  const { scope, club_id } = req.query;
  let sql = `SELECT n.*, u.real_name AS publisher_name, c.name AS club_name,
    EXISTS(SELECT 1 FROM notice_read r WHERE r.notice_id = n.id AND r.user_id = ?) AS is_read
    FROM notice n JOIN sys_user u ON u.id = n.publisher_id LEFT JOIN club c ON c.id = n.club_id`;
  const conds = [];
  const params = [req.user.id];
  if (scope === 'school') conds.push("n.scope = 'school'");
  if (scope === 'club' && club_id) { conds.push("n.scope = 'club' AND n.club_id = ?"); params.push(Number(club_id)); }
  if (scope === 'mine') {
    conds.push("(n.scope = 'school' OR n.club_id IN (SELECT club_id FROM club_member WHERE user_id = ? AND status = 1))");
    params.push(req.user.id);
  }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY n.created_at DESC LIMIT 100';
  ok(res, db.prepare(sql).all(...params));
});

router.get('/notices/unread/count', authRequired, (req, res) => {
  const c = db.prepare(`SELECT COUNT(*) AS c FROM notice n
    WHERE (n.scope = 'school' OR n.club_id IN (SELECT club_id FROM club_member WHERE user_id = ? AND status = 1))
    AND NOT EXISTS (SELECT 1 FROM notice_read r WHERE r.notice_id = n.id AND r.user_id = ?)`).get(req.user.id, req.user.id).c;
  ok(res, { count: c });
});

router.get('/notices/:id', authRequired, (req, res) => {
  const n = db.prepare(`SELECT n.*, u.real_name AS publisher_name, c.name AS club_name FROM notice n
    JOIN sys_user u ON u.id = n.publisher_id LEFT JOIN club c ON c.id = n.club_id WHERE n.id = ?`).get(req.params.id);
  if (!n) return fail(res, 404, '通知不存在');
  db.prepare('INSERT OR IGNORE INTO notice_read (notice_id, user_id) VALUES (?, ?)').run(n.id, req.user.id);
  ok(res, n);
});

router.post('/notices', authRequired, (req, res) => {
  const { scope, club_id, title, content } = req.body || {};
  if (!title || !content) return fail(res, 400, '标题和内容为必填项');
  if (scope === 'school') {
    if (req.user.role !== 'admin') return fail(res, 403, '仅管理员可发布全校公告');
    const r = db.prepare("INSERT INTO notice (scope, title, content, publisher_id) VALUES ('school', ?, ?, ?)").run(title, content, req.user.id);
    return ok(res, { id: r.lastInsertRowid });
  }
  if (!club_id) return fail(res, 400, '缺少社团 ID');
  if (!isClubManager(req.user.id, Number(club_id))) return fail(res, 403, '仅社团管理者可发布社团通知');
  const r = db.prepare("INSERT INTO notice (scope, club_id, title, content, publisher_id) VALUES ('club', ?, ?, ?, ?)")
    .run(club_id, title, content, req.user.id);
  ok(res, { id: r.lastInsertRowid });
});

/* ---------------- 我的 ---------------- */

router.get('/me/clubs', authRequired, (req, res) => {
  ok(res, db.prepare(`SELECT m.id AS member_id, m.position, m.points, m.join_time, m.status,
    c.id, c.name, c.level, c.member_count, c.description, t.name AS type_name
    FROM club_member m JOIN club c ON c.id = m.club_id JOIN club_type t ON t.id = c.type_id
    WHERE m.user_id = ? AND m.status IN (0, 1) ORDER BY m.status, m.join_time DESC`).all(req.user.id));
});

router.get('/me/activities', authRequired, (req, res) => {
  ok(res, db.prepare(`SELECT s.status AS signup_status, s.sign_time, s.checkin_time,
    a.id, a.title, a.location, a.start_time, a.end_time, a.status, c.name AS club_name
    FROM activity_signup s JOIN club_activity a ON a.id = s.activity_id JOIN club c ON c.id = a.club_id
    WHERE s.user_id = ? AND s.status != 4 ORDER BY a.start_time DESC`).all(req.user.id));
});

/* ---------------- 数据统计 ---------------- */

router.get('/stats/overview', authRequired, adminRequired, (req, res) => {
  const clubs = db.prepare('SELECT COUNT(*) AS c FROM club WHERE status = 1').get().c;
  const pendingClubs = db.prepare('SELECT COUNT(*) AS c FROM club WHERE status = 0').get().c;
  const users = db.prepare('SELECT COUNT(*) AS c FROM sys_user WHERE status = 1').get().c;
  const monthActivities = db.prepare("SELECT COUNT(*) AS c FROM club_activity WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')").get().c;
  const pendingMembers = db.prepare('SELECT COUNT(*) AS c FROM club_member WHERE status = 0').get().c;
  const typeDist = db.prepare(`SELECT t.name, COUNT(*) AS count FROM club c JOIN club_type t ON t.id = c.type_id WHERE c.status = 1 GROUP BY t.id ORDER BY count DESC`).all();
  const topClubs = db.prepare(`SELECT c.name, c.member_count, c.level, t.name AS type_name FROM club c JOIN club_type t ON t.id = c.type_id WHERE c.status = 1 ORDER BY c.member_count DESC LIMIT 10`).all();
  ok(res, { clubs, pendingClubs, users, monthActivities, pendingMembers, typeDist, topClubs });
});

router.get('/stats/club/:id', authRequired, (req, res) => {
  const clubId = Number(req.params.id);
  if (!isClubManager(req.user.id, clubId)) return fail(res, 403, '仅社团管理者可查看社团看板');
  const members = db.prepare('SELECT COUNT(*) AS c FROM club_member WHERE club_id = ? AND status = 1').get(clubId).c;
  const pending = db.prepare('SELECT COUNT(*) AS c FROM club_member WHERE club_id = ? AND status = 0').get(clubId).c;
  const activities = db.prepare('SELECT COUNT(*) AS c FROM club_activity WHERE club_id = ?').get(clubId).c;
  const signups = db.prepare(`SELECT COUNT(*) AS c FROM activity_signup s JOIN club_activity a ON a.id = s.activity_id WHERE a.club_id = ? AND s.status != 4`).get(clubId).c;
  const checkins = db.prepare(`SELECT COUNT(*) AS c FROM activity_signup s JOIN club_activity a ON a.id = s.activity_id WHERE a.club_id = ? AND s.status = 2`).get(clubId).c;
  const gradeDist = db.prepare(`SELECT COALESCE(NULLIF(u.grade, ''), '未知') AS grade, COUNT(*) AS count FROM club_member m JOIN sys_user u ON u.id = m.user_id WHERE m.club_id = ? AND m.status = 1 GROUP BY u.grade ORDER BY grade`).all(clubId);
  ok(res, { members, pending, activities, signups, checkinRate: signups ? Math.round((checkins / signups) * 100) : 0, gradeDist });
});

router.get('/stats/me', authRequired, (req, res) => {
  const clubs = db.prepare('SELECT COUNT(*) AS c FROM club_member WHERE user_id = ? AND status = 1').get(req.user.id).c;
  const signups = db.prepare('SELECT COUNT(*) AS c FROM activity_signup WHERE user_id = ? AND status IN (1,2)').get(req.user.id).c;
  const checkins = db.prepare('SELECT COUNT(*) AS c FROM activity_signup WHERE user_id = ? AND status = 2').get(req.user.id).c;
  const hours = db.prepare(`SELECT COALESCE(SUM((julianday(a.end_time) - julianday(a.start_time)) * 24), 0) AS h
    FROM activity_signup s JOIN club_activity a ON a.id = s.activity_id WHERE s.user_id = ? AND s.status = 2`).get(req.user.id).h;
  const points = db.prepare('SELECT COALESCE(SUM(points), 0) AS p FROM club_member WHERE user_id = ? AND status = 1').get(req.user.id).p;
  ok(res, { clubs, signups, checkins, hours: Math.round(hours), points });
});

/* ---------------- 同学录（用户目录） ---------------- */

const maskPhone = p => (p && p.length >= 7 ? p.slice(0, 3) + '****' + p.slice(-4) : '');

router.get('/users/filters', authRequired, (req, res) => {
  const grades = db.prepare("SELECT DISTINCT grade FROM sys_user WHERE grade IS NOT NULL AND grade != '' AND role != 'admin' ORDER BY grade").all().map(r => r.grade);
  const colleges = db.prepare("SELECT DISTINCT college FROM sys_user WHERE college IS NOT NULL AND college != '' AND role != 'admin' ORDER BY college").all().map(r => r.college);
  const majors = db.prepare("SELECT DISTINCT major FROM sys_user WHERE major IS NOT NULL AND major != '' AND role != 'admin' ORDER BY major").all().map(r => r.major);
  ok(res, { grades, colleges, majors });
});

router.get('/users', authRequired, (req, res) => {
  const { keyword, grade, college, major } = req.query;
  let sql = `SELECT u.id, u.real_name, u.gender, u.student_id, u.college, u.major, u.grade, u.phone, u.created_at,
    (SELECT COUNT(*) FROM club_member m WHERE m.user_id = u.id AND m.status = 1) AS club_count,
    (SELECT f.status FROM friend f WHERE f.user_id = ? AND f.friend_id = u.id) AS friend_out,
    (SELECT f.status FROM friend f WHERE f.user_id = u.id AND f.friend_id = ?) AS friend_in
    FROM sys_user u WHERE u.status = 1 AND u.role != 'admin' AND u.id != ?`;
  const params = [req.user.id, req.user.id, req.user.id];
  if (keyword) { sql += ' AND (u.real_name LIKE ? OR u.student_id LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  if (grade) { sql += ' AND u.grade = ?'; params.push(grade); }
  if (college) { sql += ' AND u.college = ?'; params.push(college); }
  if (major) { sql += ' AND u.major = ?'; params.push(major); }
  sql += ' ORDER BY u.grade DESC, u.student_id LIMIT 200';
  const rows = db.prepare(sql).all(...params);
  ok(res, rows.map(u => ({
    ...u,
    phone: maskPhone(u.phone),
    friend_status: u.friend_out === 1 ? 'friend' : u.friend_out === 0 ? 'pending_sent' : u.friend_in === 0 ? 'pending_received' : 'none',
    friend_out: undefined,
    friend_in: undefined
  })));
});

/* ---------------- 好友 ---------------- */

const isFriend = (a, b) => !!db.prepare('SELECT id FROM friend WHERE user_id = ? AND friend_id = ? AND status = 1').get(a, b);

router.get('/friends', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT f.id AS relation_id, f.created_at AS friend_since,
    u.id, u.real_name, u.gender, u.student_id, u.college, u.major, u.grade
    FROM friend f JOIN sys_user u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 1 ORDER BY u.real_name`).all(req.user.id);
  ok(res, rows);
});

router.get('/friends/requests', authRequired, (req, res) => {
  const rows = db.prepare(`SELECT f.id, f.created_at,
    u.id AS user_id, u.real_name, u.student_id, u.college, u.grade
    FROM friend f JOIN sys_user u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status = 0 ORDER BY f.created_at DESC`).all(req.user.id);
  ok(res, rows);
});

router.post('/friends/:userId', authRequired, (req, res) => {
  const targetId = Number(req.params.userId);
  if (targetId === req.user.id) return fail(res, 400, '不能添加自己为好友');
  const target = db.prepare("SELECT * FROM sys_user WHERE id = ? AND status = 1 AND role != 'admin'").get(targetId);
  if (!target) return fail(res, 404, '用户不存在');
  if (isFriend(req.user.id, targetId)) return fail(res, 409, '你们已经是好友了');
  if (db.prepare('SELECT id FROM friend WHERE user_id = ? AND friend_id = ? AND status = 0').get(req.user.id, targetId)) {
    return fail(res, 409, '好友申请已发送，等待对方通过');
  }
  // 对方已向我发过申请 → 直接互相通过
  const incoming = db.prepare('SELECT id FROM friend WHERE user_id = ? AND friend_id = ? AND status = 0').get(targetId, req.user.id);
  if (incoming) {
    tx(() => {
      db.prepare('UPDATE friend SET status = 1 WHERE id = ?').run(incoming.id);
      db.prepare('INSERT OR IGNORE INTO friend (user_id, friend_id, status) VALUES (?, ?, 1)').run(req.user.id, targetId);
    });
    return ok(res, { status: 'friend', message: `对方也想加你好友，已直接成为好友` });
  }
  db.prepare('INSERT OR IGNORE INTO friend (user_id, friend_id, status) VALUES (?, ?, 0)').run(req.user.id, targetId);
  ok(res, { status: 'pending_sent' });
});

router.post('/friends/requests/:id/accept', authRequired, (req, res) => {
  const r = db.prepare('SELECT * FROM friend WHERE id = ? AND friend_id = ? AND status = 0').get(req.params.id, req.user.id);
  if (!r) return fail(res, 404, '申请不存在或已处理');
  tx(() => {
    db.prepare('UPDATE friend SET status = 1 WHERE id = ?').run(r.id);
    db.prepare('INSERT OR IGNORE INTO friend (user_id, friend_id, status) VALUES (?, ?, 1)').run(req.user.id, r.user_id);
  });
  ok(res, { id: r.id });
});

router.post('/friends/requests/:id/reject', authRequired, (req, res) => {
  const r = db.prepare('SELECT * FROM friend WHERE id = ? AND friend_id = ? AND status = 0').get(req.params.id, req.user.id);
  if (!r) return fail(res, 404, '申请不存在或已处理');
  db.prepare('DELETE FROM friend WHERE id = ?').run(r.id);
  ok(res, { id: r.id });
});

router.delete('/friends/:userId', authRequired, (req, res) => {
  const targetId = Number(req.params.userId);
  tx(() => {
    db.prepare('DELETE FROM friend WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)')
      .run(req.user.id, targetId, targetId, req.user.id);
  });
  ok(res, {});
});

/* ---------------- 站内聊天 ---------------- */

router.get('/messages/conversations', authRequired, (req, res) => {
  const friends = db.prepare(`SELECT u.id, u.real_name, u.college, u.grade
    FROM friend f JOIN sys_user u ON u.id = f.friend_id WHERE f.user_id = ? AND f.status = 1`).all(req.user.id);
  const lastStmt = db.prepare(`SELECT content, created_at, sender_id FROM message
    WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
    ORDER BY created_at DESC, id DESC LIMIT 1`);
  const unreadStmt = db.prepare('SELECT COUNT(*) AS c FROM message WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL');
  const rows = friends.map(f => {
    const last = lastStmt.get(req.user.id, f.id, f.id, req.user.id);
    const unread = unreadStmt.get(f.id, req.user.id).c;
    return { ...f, last_message: last?.content || '', last_time: last?.created_at || '', unread };
  }).sort((a, b) => (b.last_time || '').localeCompare(a.last_time || ''));
  ok(res, rows);
});

router.get('/messages/unread/count', authRequired, (req, res) => {
  const c = db.prepare('SELECT COUNT(*) AS c FROM message WHERE receiver_id = ? AND read_at IS NULL').get(req.user.id).c;
  const reqCount = db.prepare('SELECT COUNT(*) AS c FROM friend WHERE friend_id = ? AND status = 0').get(req.user.id).c;
  ok(res, { count: c, requests: reqCount });
});

router.get('/messages/:friendId', authRequired, (req, res) => {
  const fid = Number(req.params.friendId);
  if (!isFriend(req.user.id, fid)) return fail(res, 403, '你们还不是好友，无法聊天');
  tx(() => {
    db.prepare('UPDATE message SET read_at = datetime(\'now\', \'localtime\') WHERE sender_id = ? AND receiver_id = ? AND read_at IS NULL').run(fid, req.user.id);
  });
  const rows = db.prepare(`SELECT m.id, m.content, m.created_at, m.sender_id, u.real_name AS sender_name
    FROM message m JOIN sys_user u ON u.id = m.sender_id
    WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at DESC, m.id DESC LIMIT 100`).all(req.user.id, fid, fid, req.user.id);
  const friend = db.prepare('SELECT id, real_name, student_id, college, grade FROM sys_user WHERE id = ?').get(fid);
  ok(res, { friend, messages: rows.reverse() });
});

router.post('/messages/:friendId', authRequired, (req, res) => {
  const fid = Number(req.params.friendId);
  const content = String(req.body?.content || '').trim();
  if (!content) return fail(res, 400, '消息内容不能为空');
  if (content.length > 500) return fail(res, 400, '单条消息不能超过 500 字');
  if (!isFriend(req.user.id, fid)) return fail(res, 403, '你们还不是好友，无法聊天');
  const r = db.prepare('INSERT INTO message (sender_id, receiver_id, content) VALUES (?, ?, ?)').run(req.user.id, fid, content);
  ok(res, { id: r.lastInsertRowid });
});

/* ---------------- 管理员：用户管理 ---------------- */

router.get('/admin/users', authRequired, adminRequired, (req, res) => {
  const { keyword, grade, college, major } = req.query;
  let sql = `SELECT u.id, u.username, u.real_name, u.gender, u.student_id, u.college, u.major, u.grade,
    u.phone, u.email, u.role, u.status, u.created_at,
    (SELECT COUNT(*) FROM club_member m WHERE m.user_id = u.id AND m.status = 1) AS club_count,
    (SELECT COUNT(*) FROM friend f WHERE f.user_id = u.id AND f.status = 1) AS friend_count
    FROM sys_user u WHERE u.role != 'admin'`;
  const conds = [];
  const params = [];
  if (keyword) { conds.push('(u.real_name LIKE ? OR u.student_id LIKE ?)'); params.push(`%${keyword}%`, `%${keyword}%`); }
  if (grade) { conds.push('u.grade = ?'); params.push(grade); }
  if (college) { conds.push('u.college = ?'); params.push(college); }
  if (major) { conds.push('u.major = ?'); params.push(major); }
  if (conds.length) sql += ' AND ' + conds.join(' AND ');
  sql += ' ORDER BY u.created_at DESC LIMIT 500';
  ok(res, db.prepare(sql).all(...params));
});

router.put('/admin/users/:id/status', authRequired, adminRequired, (req, res) => {
  const u = db.prepare("SELECT * FROM sys_user WHERE id = ? AND role != 'admin'").get(req.params.id);
  if (!u) return fail(res, 404, '用户不存在');
  const status = req.body?.status === 1 ? 1 : 0;
  db.prepare('UPDATE sys_user SET status = ? WHERE id = ?').run(status, u.id);
  ok(res, { id: u.id, status });
});

router.post('/admin/users/:id/reset-password', authRequired, adminRequired, (req, res) => {
  const u = db.prepare("SELECT * FROM sys_user WHERE id = ? AND role != 'admin'").get(req.params.id);
  if (!u) return fail(res, 404, '用户不存在');
  db.prepare('UPDATE sys_user SET password = ? WHERE id = ?').run(bcrypt.hashSync('123456', 10), u.id);
  ok(res, { id: u.id });
});
