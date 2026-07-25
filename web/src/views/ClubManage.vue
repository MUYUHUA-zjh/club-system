<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, type Activity, type Club, type Member } from '../api'

const route = useRoute()
const clubId = Number(route.params.id)
const tab = ref<'members' | 'activities' | 'stats' | 'settings'>('members')
const club = ref<Club | null>(null)
const members = ref<Member[]>([])
const pending = ref<Member[]>([])
const activities = ref<Activity[]>([])
const stats = ref<any>(null)
const types = ref<{ id: number; name: string }[]>([])
const keyword = ref('')
const toast = ref('')
const error = ref('')

// 活动表单
const showActForm = ref(false)
const actForm = ref({ title: '', content: '', location: '', start_time: '', end_time: '', sign_deadline: '', max_num: 0, activity_type: 1 })
const actSaving = ref(false)

// 名单
const expandedAct = ref(0)
const signups = ref<any[]>([])

// 签到码
const qrModal = ref<{ title: string; qr: string; code: string } | null>(null)
let qrTimer: any = null

function showToast(msg: string) { toast.value = msg; setTimeout(() => (toast.value = ''), 3000) }
function toLocalInput(t: string) { return t ? t.slice(0, 16).replace(' ', 'T') : '' }
function fmt(t: string) { return t ? t.slice(5, 16) : '' }

async function loadBase() {
  const [c, ts]: any[] = await Promise.all([api.get(`/clubs/${clubId}`), api.get('/clubs/types')])
  club.value = c.data
  types.value = ts.data
}
async function loadMembers() {
  const [m, p]: any[] = await Promise.all([
    api.get(`/clubs/${clubId}/members`, { params: { status: 1, keyword: keyword.value || undefined } }),
    api.get(`/clubs/${clubId}/members`, { params: { status: 0 } })
  ])
  members.value = m.data
  pending.value = p.data
}
async function loadActivities() {
  const res: any = await api.get(`/activities?club_id=${clubId}`)
  activities.value = res.data
}
async function loadStats() {
  const res: any = await api.get(`/stats/club/${clubId}`)
  stats.value = res.data
}

async function review(m: Member, approve: boolean) {
  try {
    await api.post(`/clubs/${clubId}/members/${m.id}/review`, { approve })
    showToast(approve ? `已通过 ${m.real_name} 的入社申请` : '已拒绝该申请')
    await loadMembers()
  } catch (e: any) { error.value = e.message }
}
async function removeMember(m: Member) {
  if (!confirm(`确定将 ${m.real_name} 移出社团吗？`)) return
  try {
    await api.delete(`/clubs/${clubId}/members/${m.id}`)
    showToast('已移除该成员')
    await loadMembers()
  } catch (e: any) { error.value = e.message }
}

async function saveActivity() {
  const f = actForm.value
  if (!f.title || !f.start_time || !f.end_time || !f.sign_deadline) { error.value = '请填写活动标题与完整时间信息'; return }
  actSaving.value = true
  try {
    await api.post('/activities', {
      club_id: clubId, title: f.title, content: f.content, location: f.location,
      start_time: f.start_time.replace('T', ' ') + ':00', end_time: f.end_time.replace('T', ' ') + ':00',
      sign_deadline: f.sign_deadline.replace('T', ' ') + ':00', max_num: Number(f.max_num) || 0, activity_type: f.activity_type
    })
    showActForm.value = false
    actForm.value = { title: '', content: '', location: '', start_time: '', end_time: '', sign_deadline: '', max_num: 0, activity_type: 1 }
    showToast('活动发布成功')
    await loadActivities()
  } catch (e: any) { error.value = e.message } finally { actSaving.value = false }
}

async function cancelActivity(a: Activity) {
  if (!confirm(`确定取消活动「${a.title}」吗？`)) return
  await api.put(`/activities/${a.id}`, { status: 4 })
  showToast('活动已取消')
  await loadActivities()
}

async function toggleSignups(a: Activity) {
  if (expandedAct.value === a.id) { expandedAct.value = 0; return }
  const res: any = await api.get(`/activities/${a.id}/signups`)
  signups.value = res.data
  expandedAct.value = a.id
}

async function showQr(a: Activity) {
  const res: any = await api.get(`/activities/${a.id}/checkin-code`)
  qrModal.value = { title: a.title, qr: res.data.qr, code: res.data.code }
  clearInterval(qrTimer)
  qrTimer = setInterval(async () => {
    try {
      const r: any = await api.get(`/activities/${a.id}/checkin-code`)
      if (qrModal.value) { qrModal.value.qr = r.data.qr; qrModal.value.code = r.data.code }
    } catch { /* 忽略 */ }
  }, 30000)
}
function closeQr() { qrModal.value = null; clearInterval(qrTimer) }

async function saveSettings() {
  if (!club.value) return
  try {
    await api.put(`/clubs/${clubId}`, {
      name: club.value.name, type_id: club.value.type_id, description: club.value.description,
      teacher_name: club.value.teacher_name, teacher_title: club.value.teacher_title
    })
    showToast('社团信息已保存')
  } catch (e: any) { error.value = e.message }
}

function switchTab(t: typeof tab.value) {
  tab.value = t
  error.value = ''
  if (t === 'members') loadMembers()
  if (t === 'activities') loadActivities()
  if (t === 'stats') loadStats()
}

onMounted(async () => {
  await loadBase()
  await loadMembers()
})
</script>

<template>
  <div v-if="club">
    <header class="flex items-end justify-between mb-6">
      <div>
        <router-link :to="`/clubs/${clubId}`" class="text-[12px] text-ink-3 hover:text-ink">← 返回社团主页</router-link>
        <h1 class="page-title mt-1">{{ club.name }} · 管理台</h1>
      </div>
    </header>

    <!-- 标签页 -->
    <div class="flex gap-1 mb-6 border-b border-line">
      <button v-for="t in [['members','成员管理'],['activities','活动管理'],['stats','数据看板'],['settings','社团设置']]" :key="t[0]"
        class="px-4 py-2.5 text-[13px] transition-colors border-b-2 -mb-px"
        :class="tab === t[0] ? 'text-accent-deep border-accent font-medium' : 'text-ink-3 border-transparent hover:text-ink'"
        @click="switchTab(t[0] as any)">{{ t[1] }}</button>
    </div>

    <p v-if="error" class="text-[12px] text-[#A32D2D] bg-[#FCEBEB] rounded-lg px-3 py-2 mb-4">{{ error }}</p>

    <!-- 成员管理 -->
    <div v-if="tab === 'members'">
      <div v-if="pending.length" class="card p-5 mb-5">
        <h3 class="text-[14px] font-medium text-ink mb-3">待审核申请（{{ pending.length }}）</h3>
        <div class="space-y-3">
          <div v-for="m in pending" :key="m.id" class="flex items-start gap-4 pb-3 border-b border-line-soft last:border-0 last:pb-0">
            <span class="w-9 h-9 rounded-full bg-amber-50 bg-[#FAEEDA] text-[#854F0B] text-[12px] flex items-center justify-center shrink-0">{{ m.real_name.slice(0, 1) }}</span>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] text-ink">{{ m.real_name }} <span class="text-[11px] text-ink-3">{{ m.student_id }} · {{ m.college }} {{ m.grade }}</span></p>
              <p class="text-[12px] text-ink-2 mt-1">{{ m.apply_reason || '未填写申请理由' }}</p>
            </div>
            <div class="flex gap-2 shrink-0">
              <button class="btn-primary !py-1.5 !px-3 !text-[12px]" @click="review(m, true)">通过</button>
              <button class="btn-ghost !py-1.5 !px-3 !text-[12px]" @click="review(m, false)">拒绝</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-[14px] font-medium text-ink">成员列表（{{ members.length }}）</h3>
          <input v-model="keyword" class="input !w-[200px]" placeholder="搜索姓名或学号…" @keyup.enter="loadMembers" />
        </div>
        <div v-if="!members.length" class="text-center text-ink-3 text-[13px] py-8">暂无成员</div>
        <table v-else class="w-full text-[13px]">
          <thead>
            <tr class="text-left text-[11px] text-ink-3 border-b border-line">
              <th class="pb-2 font-medium">成员</th><th class="pb-2 font-medium">职位</th><th class="pb-2 font-medium">学院 / 年级</th><th class="pb-2 font-medium">积分</th><th class="pb-2 font-medium">入社时间</th><th class="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.id" class="border-b border-line-soft last:border-0">
              <td class="py-3">
                <div class="flex items-center gap-2.5">
                  <span class="w-7 h-7 rounded-full bg-paper-deep text-ink-2 text-[11px] flex items-center justify-center">{{ m.real_name.slice(0, 1) }}</span>
                  <div><p class="text-ink">{{ m.real_name }}</p><p class="text-[11px] text-ink-3">{{ m.student_id }}</p></div>
                </div>
              </td>
              <td><span class="tag" :class="m.position === '社长' ? 'tag-accent' : 'tag-gray'">{{ m.position }}</span></td>
              <td class="text-ink-2">{{ m.college }} · {{ m.grade }}</td>
              <td class="text-accent-deep">{{ m.points }}</td>
              <td class="text-ink-3 text-[12px]">{{ m.join_time?.slice(0, 10) }}</td>
              <td class="text-right"><button v-if="m.position !== '社长'" class="btn-danger" @click="removeMember(m)">移除</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 活动管理 -->
    <div v-if="tab === 'activities'">
      <div class="flex justify-between items-center mb-4">
        <p class="text-[13px] text-ink-3">共 {{ activities.length }} 场活动</p>
        <button class="btn-primary" @click="showActForm = !showActForm">{{ showActForm ? '收起' : '+ 发布活动' }}</button>
      </div>

      <div v-if="showActForm" class="card p-6 mb-5">
        <h3 class="text-[14px] font-medium text-ink mb-4">发布新活动</h3>
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2"><label class="label">活动标题 *</label><input v-model="actForm.title" class="input" placeholder="如 大模型入门工作坊" /></div>
          <div><label class="label">开始时间 *</label><input v-model="actForm.start_time" type="datetime-local" class="input" /></div>
          <div><label class="label">结束时间 *</label><input v-model="actForm.end_time" type="datetime-local" class="input" /></div>
          <div><label class="label">报名截止 *</label><input v-model="actForm.sign_deadline" type="datetime-local" class="input" /></div>
          <div><label class="label">人数上限（0 为不限）</label><input v-model.number="actForm.max_num" type="number" min="0" class="input" /></div>
          <div><label class="label">活动地点</label><input v-model="actForm.location" class="input" placeholder="如 理科楼 302" /></div>
          <div>
            <label class="label">活动类型</label>
            <select v-model.number="actForm.activity_type" class="input">
              <option :value="1">常规活动</option><option :value="2">大型活动</option><option :value="3">校外活动</option><option :value="4">联合活动</option>
            </select>
          </div>
          <div class="col-span-2"><label class="label">活动介绍</label><textarea v-model="actForm.content" rows="3" class="input resize-none" placeholder="活动内容、注意事项、需要携带的物品…"></textarea></div>
        </div>
        <div class="flex justify-end gap-3 mt-4">
          <button class="btn-ghost" @click="showActForm = false">取消</button>
          <button class="btn-primary" :disabled="actSaving" @click="saveActivity">{{ actSaving ? '发布中…' : '发布活动' }}</button>
        </div>
      </div>

      <div v-if="!activities.length" class="card p-10 text-center text-ink-3 text-[13px]">还没有发布过活动</div>
      <div v-else class="space-y-3">
        <div v-for="a in activities" :key="a.id" class="card overflow-hidden">
          <div class="flex items-center gap-4 px-5 py-4">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-[13px] font-medium text-ink truncate">{{ a.title }}</p>
                <span class="tag" :class="{ 1: 'tag-accent', 2: 'tag-green', 3: 'tag-gray', 4: 'tag-red' }[a.status] || 'tag-gray'">
                  {{ { 1: '报名中', 2: '进行中', 3: '已结束', 4: '已取消' }[a.status] }}
                </span>
              </div>
              <p class="text-[11px] text-ink-3 mt-1">{{ fmt(a.start_time) }} · {{ a.location }} · 报名 {{ a.signup_count }}{{ a.max_num ? '/' + a.max_num : '' }} 人</p>
            </div>
            <div class="flex gap-2 shrink-0">
              <button class="btn-ghost !py-1.5 !px-3 !text-[12px]" @click="toggleSignups(a)">{{ expandedAct === a.id ? '收起名单' : '报名名单' }}</button>
              <button v-if="a.status !== 3 && a.status !== 4" class="btn-ghost !py-1.5 !px-3 !text-[12px]" @click="showQr(a)">签到码</button>
              <a v-if="a.signup_count > 0" class="btn-ghost !py-1.5 !px-3 !text-[12px]" :href="`/api/activities/${a.id}/export`" target="_blank">导出名单</a>
              <button v-if="a.status === 1" class="btn-danger" @click="cancelActivity(a)">取消活动</button>
            </div>
          </div>
          <div v-if="expandedAct === a.id" class="border-t border-line-soft bg-paper px-5 py-4">
            <p v-if="!signups.length" class="text-[12px] text-ink-3">暂无报名记录</p>
            <table v-else class="w-full text-[12px]">
              <thead><tr class="text-left text-[11px] text-ink-3"><th class="pb-2 font-medium">姓名</th><th class="pb-2 font-medium">学号</th><th class="pb-2 font-medium">报名时间</th><th class="pb-2 font-medium">签到时间</th><th class="pb-2 font-medium">状态</th></tr></thead>
              <tbody>
                <tr v-for="s in signups" :key="s.id" class="border-t border-line-soft">
                  <td class="py-2 text-ink">{{ s.real_name }}</td>
                  <td class="text-ink-2">{{ s.student_id }}</td>
                  <td class="text-ink-3">{{ fmt(s.sign_time) }}</td>
                  <td class="text-ink-3">{{ s.checkin_time ? fmt(s.checkin_time) : '—' }}</td>
                  <td><span class="tag" :class="s.status === 2 ? 'tag-green' : 'tag-accent'">{{ s.status === 2 ? '已签到' : '已报名' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据看板 -->
    <div v-if="tab === 'stats' && stats">
      <div class="grid grid-cols-4 gap-3 mb-5">
        <div class="card p-5"><p class="text-[12px] text-ink-3">社团成员</p><p class="serif text-[28px] text-ink mt-1">{{ stats.members }}</p></div>
        <div class="card p-5"><p class="text-[12px] text-ink-3">累计活动</p><p class="serif text-[28px] text-ink mt-1">{{ stats.activities }}</p></div>
        <div class="card p-5"><p class="text-[12px] text-ink-3">累计报名人次</p><p class="serif text-[28px] text-ink mt-1">{{ stats.signups }}</p></div>
        <div class="card p-5"><p class="text-[12px] text-ink-3">活动签到率</p><p class="serif text-[28px] text-accent-deep mt-1">{{ stats.checkinRate }}%</p></div>
      </div>
      <div class="card p-6">
        <h3 class="text-[14px] font-medium text-ink mb-4">成员年级分布</h3>
        <div v-if="!stats.gradeDist.length" class="text-ink-3 text-[12px]">暂无数据</div>
        <div v-else class="space-y-3">
          <div v-for="g in stats.gradeDist" :key="g.grade" class="flex items-center gap-3">
            <span class="w-16 text-[12px] text-ink-2">{{ g.grade }}</span>
            <div class="flex-1 h-2.5 rounded-full bg-paper-deep overflow-hidden">
              <div class="h-full bg-accent rounded-full" :style="{ width: Math.round(g.count / stats.members * 100) + '%' }"></div>
            </div>
            <span class="w-10 text-right text-[12px] text-ink-3">{{ g.count }} 人</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 社团设置 -->
    <div v-if="tab === 'settings'" class="card p-6 max-w-[560px]">
      <div class="space-y-4">
        <div><label class="label">社团名称</label><input v-model="club.name" class="input" /></div>
        <div>
          <label class="label">社团分类</label>
          <select v-model="club.type_id" class="input"><option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}</option></select>
        </div>
        <div><label class="label">社团简介</label><textarea v-model="club.description" rows="4" class="input resize-none"></textarea></div>
        <div class="grid grid-cols-2 gap-4">
          <div><label class="label">指导老师</label><input v-model="club.teacher_name" class="input" /></div>
          <div><label class="label">老师职称</label><input v-model="club.teacher_title" class="input" /></div>
        </div>
        <div class="flex justify-end"><button class="btn-primary" @click="saveSettings">保存修改</button></div>
      </div>
    </div>

    <!-- 签到码弹窗 -->
    <div v-if="qrModal" class="fixed inset-0 bg-black/25 flex items-center justify-center z-50 px-4" @click.self="closeQr">
      <div class="card w-full max-w-[340px] p-7 text-center">
        <h3 class="serif text-[17px] text-ink mb-1">{{ qrModal.title }}</h3>
        <p class="text-[12px] text-ink-3 mb-4">签到码每分钟自动刷新，请社员现场输入</p>
        <img :src="qrModal.qr" class="w-[220px] h-[220px] mx-auto rounded-xl border border-line" alt="签到二维码" />
        <p class="serif text-[32px] tracking-[8px] text-accent-deep mt-4">{{ qrModal.code }}</p>
        <p class="text-[11px] text-ink-3 mt-1">6 位动态签到码</p>
        <button class="btn-ghost w-full mt-5" @click="closeQr">关闭</button>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full z-50">{{ toast }}</div>
  </div>
</template>
