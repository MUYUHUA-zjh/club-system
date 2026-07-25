<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'
import { useAuthStore } from '../stores'

const auth = useAuthStore()
const tab = ref<'info' | 'clubs' | 'activities'>('info')
const form = ref({ real_name: '', gender: 1, college: '', major: '', grade: '', phone: '', email: '' })
const myClubs = ref<any[]>([])
const myActivities = ref<any[]>([])
const toast = ref('')
const error = ref('')

function showToast(msg: string) { toast.value = msg; setTimeout(() => (toast.value = ''), 3000) }
function fmt(t: string) { return t ? t.slice(5, 16) : '' }

async function saveInfo() {
  try {
    const res: any = await api.put('/users/me', form.value)
    auth.user = res.data
    showToast('个人信息已保存')
  } catch (e: any) { error.value = e.message }
}

async function quitClub(c: any) {
  if (!confirm(`确定退出「${c.name}」吗？`)) return
  try {
    await api.post(`/clubs/${c.id}/quit`)
    showToast('已退出社团')
    const res: any = await api.get('/me/clubs')
    myClubs.value = res.data
  } catch (e: any) { showToast(e.message) }
}

onMounted(async () => {
  if (auth.user) {
    const u = auth.user
    form.value = { real_name: u.real_name || '', gender: u.gender || 1, college: u.college || '', major: u.major || '', grade: u.grade || '', phone: u.phone || '', email: u.email || '' }
  }
  const [c, a]: any[] = await Promise.all([api.get('/me/clubs'), api.get('/me/activities')])
  myClubs.value = c.data
  myActivities.value = a.data
})
</script>

<template>
  <div>
    <header class="flex items-center gap-4 mb-6">
      <span class="w-14 h-14 rounded-full bg-accent text-white text-[20px] flex items-center justify-center font-medium">{{ auth.user?.real_name?.slice(0, 1) }}</span>
      <div>
        <h1 class="page-title">{{ auth.user?.real_name }}</h1>
        <p class="page-sub">{{ auth.user?.student_id }} · {{ auth.user?.college || '未填写学院' }} {{ auth.user?.grade }}</p>
      </div>
    </header>

    <div class="flex gap-1 mb-6 border-b border-line">
      <button v-for="t in [['info','个人信息'],['clubs','我的社团'],['activities','我的活动']]" :key="t[0]"
        class="px-4 py-2.5 text-[13px] transition-colors border-b-2 -mb-px"
        :class="tab === t[0] ? 'text-accent-deep border-accent font-medium' : 'text-ink-3 border-transparent hover:text-ink'"
        @click="tab = t[0] as any">{{ t[1] }}</button>
    </div>

    <p v-if="error" class="text-[12px] text-[#A32D2D] bg-[#FCEBEB] rounded-lg px-3 py-2 mb-4">{{ error }}</p>

    <!-- 个人信息 -->
    <div v-if="tab === 'info'" class="card p-6 max-w-[560px]">
      <div class="grid grid-cols-2 gap-4">
        <div><label class="label">姓名</label><input v-model="form.real_name" class="input" /></div>
        <div>
          <label class="label">性别</label>
          <select v-model.number="form.gender" class="input"><option :value="1">男</option><option :value="2">女</option></select>
        </div>
        <div><label class="label">学院</label><input v-model="form.college" class="input" /></div>
        <div><label class="label">专业</label><input v-model="form.major" class="input" /></div>
        <div><label class="label">年级</label><input v-model="form.grade" class="input" placeholder="如 2024级" /></div>
        <div><label class="label">手机号</label><input v-model="form.phone" class="input" /></div>
        <div class="col-span-2"><label class="label">邮箱</label><input v-model="form.email" class="input" /></div>
      </div>
      <div class="flex justify-end mt-5"><button class="btn-primary" @click="saveInfo">保存修改</button></div>
    </div>

    <!-- 我的社团 -->
    <div v-if="tab === 'clubs'">
      <div v-if="!myClubs.length" class="card p-10 text-center">
        <p class="text-ink-3 text-[13px] mb-3">你还没有加入任何社团</p>
        <router-link to="/clubs" class="btn-ghost text-[12px]">去社团广场看看</router-link>
      </div>
      <div v-else class="grid grid-cols-2 gap-4">
        <div v-for="c in myClubs" :key="c.member_id" class="card p-5">
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-3">
              <span class="w-10 h-10 rounded-xl bg-accent-soft text-accent-deep serif text-[16px] flex items-center justify-center">{{ c.name.slice(0, 1) }}</span>
              <div>
                <router-link :to="`/clubs/${c.id}`" class="text-[14px] font-medium text-ink hover:text-accent-deep">{{ c.name }}</router-link>
                <p class="text-[11px] text-ink-3">{{ c.type_name }}</p>
              </div>
            </div>
            <span class="tag" :class="c.status === 0 ? 'tag-amber' : (c.position === '社员' ? 'tag-gray' : 'tag-accent')">
              {{ c.status === 0 ? '审核中' : c.position }}
            </span>
          </div>
          <div class="flex items-center justify-between text-[11px] text-ink-3 mt-3">
            <span>积分 <span class="text-accent-deep font-medium">{{ c.points }}</span> · {{ c.join_time?.slice(0, 10) || '—' }} 加入</span>
            <div class="flex gap-2">
              <router-link v-if="['社长','副社长','部长'].includes(c.position) && c.status === 1" :to="`/clubs/${c.id}/manage`" class="text-accent-deep hover:underline">管理</router-link>
              <button v-if="c.status === 1 && c.position !== '社长'" class="text-ink-3 hover:text-[#A32D2D]" @click="quitClub(c)">退社</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 我的活动 -->
    <div v-if="tab === 'activities'">
      <div v-if="!myActivities.length" class="card p-10 text-center">
        <p class="text-ink-3 text-[13px] mb-3">你还没有报名任何活动</p>
        <router-link to="/activities" class="btn-ghost text-[12px]">去活动中心看看</router-link>
      </div>
      <div v-else class="card divide-y divide-line-soft overflow-hidden">
        <router-link v-for="a in myActivities" :key="a.id" :to="`/activities/${a.id}`" class="flex items-center gap-4 px-5 py-4 hover:bg-paper transition-colors">
          <div class="flex-1 min-w-0">
            <p class="text-[13px] text-ink truncate">{{ a.title }}</p>
            <p class="text-[11px] text-ink-3 mt-0.5">{{ a.club_name }} · {{ fmt(a.start_time) }} · {{ a.location }}</p>
          </div>
          <span v-if="a.status === 3" class="tag tag-gray">已结束</span>
          <span class="tag" :class="a.signup_status === 2 ? 'tag-green' : 'tag-accent'">{{ a.signup_status === 2 ? '已签到' : '已报名' }}</span>
        </router-link>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full z-50">{{ toast }}</div>
  </div>
</template>
