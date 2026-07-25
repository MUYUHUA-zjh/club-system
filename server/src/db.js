import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'club.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

/** 事务包装：BEGIN IMMEDIATE / COMMIT / ROLLBACK */
export function tx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    fn();
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS sys_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  real_name TEXT NOT NULL,
  gender INTEGER,
  student_id TEXT UNIQUE,
  college TEXT,
  major TEXT,
  grade TEXT,
  phone TEXT,
  email TEXT,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  status INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS club_type (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS club (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type_id INTEGER NOT NULL REFERENCES club_type(id),
  logo TEXT,
  cover_image TEXT,
  description TEXT,
  teacher_name TEXT,
  teacher_title TEXT,
  founder_id INTEGER NOT NULL REFERENCES sys_user(id),
  level INTEGER NOT NULL DEFAULT 1,
  member_count INTEGER NOT NULL DEFAULT 0,
  status INTEGER NOT NULL DEFAULT 0,          -- 0待审核 1正常 2整改 3注销
  reject_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS club_member (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES club(id),
  user_id INTEGER NOT NULL REFERENCES sys_user(id),
  department TEXT,
  position TEXT NOT NULL DEFAULT '社员',
  apply_reason TEXT,
  points INTEGER NOT NULL DEFAULT 0,
  status INTEGER NOT NULL DEFAULT 0,          -- 0待审核 1正常 2已退社
  join_time TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (club_id, user_id)
);

CREATE TABLE IF NOT EXISTS club_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  club_id INTEGER NOT NULL REFERENCES club(id),
  title TEXT NOT NULL,
  cover_image TEXT,
  content TEXT,
  location TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  sign_deadline TEXT NOT NULL,
  max_num INTEGER NOT NULL DEFAULT 0,         -- 0 表示不限
  need_audit INTEGER NOT NULL DEFAULT 0,
  activity_type INTEGER NOT NULL DEFAULT 1,   -- 1常规 2大型 3校外 4联合
  status INTEGER NOT NULL DEFAULT 1,          -- 1报名中 2进行中 3已结束 4已取消
  signup_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS activity_signup (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_id INTEGER NOT NULL REFERENCES club_activity(id),
  user_id INTEGER NOT NULL REFERENCES sys_user(id),
  is_waitlist INTEGER NOT NULL DEFAULT 0,
  sign_time TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  checkin_time TEXT,
  status INTEGER NOT NULL DEFAULT 1,          -- 1已报名 2已签到 4已取消
  extra_data TEXT,
  UNIQUE (activity_id, user_id)
);

CREATE TABLE IF NOT EXISTS notice (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL DEFAULT 'school',       -- school | club
  club_id INTEGER REFERENCES club(id),
  title TEXT NOT NULL,
  content TEXT,
  publisher_id INTEGER NOT NULL REFERENCES sys_user(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS notice_read (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notice_id INTEGER NOT NULL REFERENCES notice(id),
  user_id INTEGER NOT NULL REFERENCES sys_user(id),
  read_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (notice_id, user_id)
);

CREATE TABLE IF NOT EXISTS friend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES sys_user(id),
  friend_id INTEGER NOT NULL REFERENCES sys_user(id),
  status INTEGER NOT NULL DEFAULT 0,          -- 0待通过 1已是好友
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  UNIQUE (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS message (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES sys_user(id),
  receiver_id INTEGER NOT NULL REFERENCES sys_user(id),
  content TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_message_pair ON message (sender_id, receiver_id, created_at);
`);

function seed() {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM sys_user').get().c;
  if (userCount > 0) return;

  const hash = bcrypt.hashSync('123456', 10);
  const insertUser = db.prepare(`INSERT INTO sys_user
    (username, password, real_name, gender, student_id, college, major, grade, phone, email, role)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const seedAll = () => {
    // 用户：1 管理员 + 2 社长 + 6 学生
    insertUser.run('admin', bcrypt.hashSync('admin123', 10), '陈国华', 1, 'T0001', '校团委', '学生工作处', '-', '13800000001', 'admin@edu.cn', 'admin');
    insertUser.run('2023001', hash, '张晨', 1, '2023001', '计算机学院', '人工智能', '2023级', '13800000002', 'zhangchen@stu.edu.cn', 'student');
    insertUser.run('2023002', hash, '李婉婷', 2, '2023002', '新闻与传播学院', '摄影摄像', '2023级', '13800000003', 'liwt@stu.edu.cn', 'student');
    insertUser.run('2024001', hash, '林晓雨', 2, '2024001', '计算机学院', '软件工程', '2024级', '13800000004', 'linxy@stu.edu.cn', 'student');
    insertUser.run('2024002', hash, '王思远', 1, '2024002', '经济管理学院', '金融学', '2024级', '13800000005', 'wangsy@stu.edu.cn', 'student');
    insertUser.run('2024003', hash, '陈默', 1, '2024003', '外国语学院', '英语', '2024级', '13800000006', 'chenmo@stu.edu.cn', 'student');
    insertUser.run('2024004', hash, '赵雨桐', 2, '2024004', '体育学院', '运动训练', '2024级', '13800000007', 'zhaoyt@stu.edu.cn', 'student');
    insertUser.run('2024005', hash, '刘一帆', 1, '2024005', '文学院', '汉语言文学', '2024级', '13800000008', 'liuyf@stu.edu.cn', 'student');
    insertUser.run('2024006', hash, '孙可欣', 2, '2024006', '理学院', '数学与应用数学', '2024级', '13800000009', 'sunkx@stu.edu.cn', 'student');

    // 社团分类
    const insertType = db.prepare('INSERT INTO club_type (name) VALUES (?)');
    ['学术科技类', '文化艺术类', '体育竞技类', '公益服务类', '创新创业类', '兴趣爱好类', '思想政治类'].forEach(t => insertType.run(t));

    // 社团
    const insertClub = db.prepare(`INSERT INTO club
      (name, type_id, description, teacher_name, teacher_title, founder_id, level, member_count, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertClub.run('人工智能协会', 1, '聚焦人工智能前沿技术的学术社团，定期举办论文研读、大模型工作坊与黑客马拉松，欢迎对 AI 感兴趣的同学加入。', '周明远', '教授', 2, 5, 45, 1);
    insertClub.run('摄影协会', 6, '用镜头记录校园与城市。每周组织外拍活动、后期修图分享会，每年举办校园摄影展。', '许静', '副教授', 3, 4, 62, 1);
    insertClub.run('青年志愿者协会', 4, '校团委直属公益社团，组织支教、社区服务、大型赛事志愿服务，累计服务时长超 2 万小时。', '吴海涛', '讲师', 2, 5, 128, 1);
    insertClub.run('篮球协会', 3, '组织日常训练、院系联赛与裁判培训，无论你是高手还是新手都能找到属于自己的球场。', '郑强', '讲师', 4, 4, 86, 1);
    insertClub.run('话剧社', 2, '每学期一部大戏，从剧本围读到舞台呈现全流程参与，灯光、服化、表演均有专业指导。', '林青霞', '副教授', 5, 3, 38, 1);
    insertClub.run('创业协会', 5, '连接校园创业者与校外投资人，定期举办创业沙龙、商业计划书大赛与孵化器参观活动。', '钱伟', '教授', 6, 3, 41, 1);
    insertClub.run('桌游社', 6, '策略桌游、剧本杀、狼人杀应有尽有，每周五晚固定开局，正在申请正式成立。', '何欢', '讲师', 5, 0, 3, 0);

    // 成员关系
    const insertMember = db.prepare(`INSERT INTO club_member
      (club_id, user_id, department, position, status, join_time, points) VALUES (?, ?, ?, ?, 1, datetime('now', 'localtime', ?), ?)`);
    // AI 协会（club 1）
    insertMember.run(1, 2, '技术部', '社长', '-400 days', 320);
    insertMember.run(1, 4, '技术部', '社员', '-120 days', 80);
    insertMember.run(1, 9, '宣传部', '部长', '-200 days', 150);
    // 摄影协会（club 2）
    insertMember.run(2, 3, '社长层', '社长', '-380 days', 290);
    insertMember.run(2, 4, '外拍部', '社员', '-90 days', 60);
    insertMember.run(2, 7, '外拍部', '部长', '-150 days', 110);
    // 青志协（club 3）
    insertMember.run(3, 2, '支教部', '社员', '-300 days', 180);
    insertMember.run(3, 5, '办公室', '社长', '-350 days', 260);
    insertMember.run(3, 6, '支教部', '社员', '-100 days', 45);
    // 篮球协会（club 4）
    insertMember.run(4, 7, '竞赛部', '社长', '-320 days', 210);
    insertMember.run(4, 8, '竞赛部', '社员', '-60 days', 30);
    // 话剧社（club 5）
    insertMember.run(5, 8, '表演部', '社长', '-280 days', 190);
    // 创业协会（club 6）
    insertMember.run(6, 5, '项目部', '社长', '-250 days', 170);
    insertMember.run(6, 6, '项目部', '社员', '-80 days', 25);
    // 桌游社（club 7，待审核）
    insertMember.run(7, 6, '筹备组', '社长', '-10 days', 10);

    // 待审核入社申请
    db.prepare(`INSERT INTO club_member (club_id, user_id, position, apply_reason, status) VALUES (1, 6, '社员', '对大模型方向很感兴趣，希望参加论文研读会。', 0)`).run();
    db.prepare(`INSERT INTO club_member (club_id, user_id, position, apply_reason, status) VALUES (2, 5, '社员', '有一台全画幅相机，想系统学习人像摄影。', 0)`).run();

    // 活动
    const insertActivity = db.prepare(`INSERT INTO club_activity
      (club_id, title, content, location, start_time, end_time, sign_deadline, max_num, activity_type, status, signup_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime', ?))`);
    insertActivity.run(1, '大模型入门工作坊：从 Prompt 到 Agent', '面向零基础同学的大模型实践课，内容包括 Prompt 工程、RAG 原理讲解与动手搭建一个简单 Agent。请自带笔记本电脑。', '理科楼 302', datetime('+1 day', 19), datetime('+1 day', 21), datetime('+1 day', 12), 60, 1, 1, 2, '-5 days');
    insertActivity.run(2, '城市夜景外拍：江畔步道', '本周五傍晚集合外拍，主题「城市蓝调时刻」。请携带三脚架，活动结束后统一聚餐复盘作品。', '校南门集合', datetime('+4 day', 18.5), datetime('+4 day', 21), datetime('+3 day', 20), 20, 1, 1, 1, '-3 days');
    insertActivity.run(4, '「迎新杯」三人篮球赛', '面向全校新生的三人篮球赛，以自由组队形式报名，冠军队伍将获得定制球衣。', '东区篮球场', datetime('+7 day', 14), datetime('+7 day', 18), datetime('+6 day', 18), 48, 2, 1, 1, '-2 days');
    insertActivity.run(3, '敬老院探访志愿服务', '前往春晖敬老院陪伴老人，内容包括文艺表演、智能手机教学与房间整理。请提前学习服务手册。', '春晖敬老院', datetime('+9 day', 8), datetime('+9 day', 12), datetime('+8 day', 18), 30, 3, 1, 0, '-1 days');
    insertActivity.run(1, '论文研读会：Attention Is All You Need', '精读 Transformer 原始论文，由技术部领读，建议提前阅读论文前三节。', '理科楼 210', datetime('-10 day', 19), datetime('-10 day', 21), datetime('-11 day', 12), 40, 1, 3, 2, '-16 days');
    insertActivity.run(2, '春季校园摄影展', '年度摄影展，展出社员优秀作品 120 幅，开幕式邀请市摄影家协会老师点评。', '图书馆一层展厅', datetime('-20 day', 9), datetime('-20 day', 17), datetime('-21 day', 18), 0, 2, 3, 1, '-30 days');

    function datetime(offsetStr, hour) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(offsetStr));
      const h = Math.floor(hour);
      const m = Math.round((hour - h) * 60);
      d.setHours(h, m, 0, 0);
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
    }

    // 报名记录
    const insertSignup = db.prepare(`INSERT INTO activity_signup
      (activity_id, user_id, sign_time, status, checkin_time) VALUES (?, ?, datetime('now', 'localtime', ?), ?, ?)`);
    insertSignup.run(1, 4, '-2 days', 1, null);   // 林晓雨 报 AI 工作坊
    insertSignup.run(1, 5, '-1 days', 1, null);   // 王思远
    insertSignup.run(2, 4, '-2 days', 1, null);   // 林晓雨 报外拍
    insertSignup.run(3, 8, '-1 days', 1, null);   // 刘一帆 报篮球赛
    insertSignup.run(5, 4, '-12 days', 2, datetime('-10 day', 19));  // 已结束活动已签到
    insertSignup.run(5, 9, '-12 days', 2, datetime('-10 day', 19));
    insertSignup.run(6, 4, '-22 days', 2, datetime('-20 day', 9.5));

    // 通知公告
    const insertNotice = db.prepare(`INSERT INTO notice
      (scope, club_id, title, content, publisher_id, created_at) VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime', ?))`);
    insertNotice.run('school', null, '关于开展 2026 年春季学期社团年审工作的通知', '各社团：根据《学生社团管理办法》，请于 3 月 15 日前提交年度工作报告，年审结果将作为星级评定与经费支持的重要依据。', 1, '-2 days');
    insertNotice.run('school', null, '第六届「百团大战」社团招新活动预告', '本学期社团联合招新将于 3 月 20 日在中心广场举行，请各社团提前完成摊位申报与物料准备。', 1, '-5 days');
    insertNotice.run('club', 1, '本周论文研读会地点变更', '原定于理科楼 210 的研读会调整至 302 会议室，时间不变，请相互转告。', 2, '-1 days');
    insertNotice.run('club', 2, '外拍活动装备借用登记', '协会现有三脚架 5 支、补光灯 2 盏可供借用，请在活动前向部长登记。', 3, '-3 days');
  };

  tx(seedAll);
  console.log('[db] 种子数据初始化完成');
}

seed();
