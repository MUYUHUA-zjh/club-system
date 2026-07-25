import jwt from 'jsonwebtoken';
import { db } from './db.js';

// 密钥从环境变量读取（见 .env / .env.example）。
// 曾硬编码在此处的旧值已随代码进入 Git 历史，视作泄露并已作废，请改用 .env 中的随机值。
function loadSecret(name) {
  const v = process.env[name];
  if (v) return v;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`[auth] 缺少环境变量 ${name}，生产环境已拒绝启动（禁止使用示例密钥）`);
  }
  console.warn(`[auth] 警告：未设置 ${name}，使用不安全的开发默认值，请配置 .env`);
  return 'dev-insecure-default-change-me';
}

export const JWT_SECRET = loadSecret('JWT_SECRET');
export const CHECKIN_SECRET = loadSecret('CHECKIN_SECRET');

export function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: '未登录或登录已过期' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, real_name, role, status FROM sys_user WHERE id = ?').get(payload.id);
    if (!user || user.status !== 1) return res.status(401).json({ message: '账号不存在或已被禁用' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: '未登录或登录已过期' });
  }
}

export function adminRequired(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '需要管理员权限' });
  next();
}

/** 判断用户是否为某社团的管理者（社长/副社长/部长）或系统管理员 */
export function isClubManager(userId, clubId) {
  const u = db.prepare('SELECT role FROM sys_user WHERE id = ?').get(userId);
  if (u?.role === 'admin') return true;
  const m = db.prepare(`SELECT position FROM club_member WHERE club_id = ? AND user_id = ? AND status = 1`).get(clubId, userId);
  return !!m && ['社长', '副社长', '部长'].includes(m.position);
}

/** 判断用户是否为某社团的负责人（社长/副社长）或系统管理员 */
export function isClubLeader(userId, clubId) {
  const u = db.prepare('SELECT role FROM sys_user WHERE id = ?').get(userId);
  if (u?.role === 'admin') return true;
  const m = db.prepare(`SELECT position FROM club_member WHERE club_id = ? AND user_id = ? AND status = 1`).get(clubId, userId);
  return !!m && ['社长', '副社长'].includes(m.position);
}

export function clubManagerRequired(req, res, next) {
  const clubId = Number(req.params.clubId || req.params.id || req.body.club_id);
  if (!clubId) return res.status(400).json({ message: '缺少社团 ID' });
  if (!isClubManager(req.user.id, clubId)) return res.status(403).json({ message: '仅社团管理者可执行此操作' });
  next();
}

/** 动态签到码：活动ID + 分钟级时间窗口，HMAC 摘要取 6 位 */
import crypto from 'node:crypto';
export function checkinCode(activityId, windowOffset = 0) {
  const win = Math.floor(Date.now() / 60000) + windowOffset;
  const h = crypto.createHmac('sha256', CHECKIN_SECRET).update(`${activityId}:${win}`).digest('hex');
  return h.slice(0, 6).toUpperCase();
}
