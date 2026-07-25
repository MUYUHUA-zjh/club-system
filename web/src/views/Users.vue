<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type UserDir } from '../api'
import { refreshUnread } from '../unread'

const users = ref<UserDir[]>([])
const filters = ref<{ grades: string[]; colleges: string[]; majors: string[] }>({ grades: [], colleges: [], majors: [] })
const grade = ref('')
const college = ref('')
const major = ref('')
const keyword = ref('')
const loading = ref(true)
const toast = ref('')

function showToast(msg: string) { toast.value = msg; setTimeout(() => (toast.value = ''), 3000) }

async function load() {
  loading.value = true
  try {
    const params: any = {}
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (grade.value) params.grade = grade.value
    if (college.value) params.college = college.value
    if (major.value) params.major = major.value
    const res: any = await api.get('/users', { params })
    users.value = res.data
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  grade.value = ''; college.value = ''; major.value = ''; keyword.value = ''
  load()
}

async function addFriend(u: UserDir) {
  try {
    const res: any = await api.post(`/friends/${u.id}`)
    u.friend_status = res.data.status
    showToast(res.data.status === 'friend' ? `已与 ${u.real_name} 成为好友` : `好友申请已发送给 ${u.real_name}`)
    refreshUnread()
  } catch (e: any) { showToast(e.message) }
}

onMounted(async () => {
  const res: any = await api.get('/users/filters')
  filters.value = res.data
  await load()
})
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="page-title">我的同学</h1>
      <p class="page-sub">浏览注册系统的同学，找到志同道合的伙伴</p>
    </header>

    <!-- 筛选栏 -->
    <div class="card p-4 mb-5 flex flex-wrap items-center gap-3">
      <input v-model="keyword" class="input !w-[200px]" placeholder="搜索姓名或学号…" @keyup.enter="load" />
      <select v-model="grade" class="input !w-[130px]" @change="load">
        <option value="">全部年级</option>
        <option v-for="g in filters.grades" :key="g" :value="g">{{ g }}</option>
      </select>
      <select v-model="college" class="input !w-[170px]" @change="load">
        <option value="">全部学院</option>
        <option v-for="c in filters.colleges" :key="c" :value="c">{{ c }}</option>
      </select>
      <select v-model="major" class="input !w-[160px]" @change="load">
        <option value="">全部专业</option>
        <option v-for="m in filters.majors" :key="m" :value="m">{{ m }}</option>
      </select>
      <button class="btn-primary !py-2" @click="load">查询</button>
      <button class="btn-ghost !py-2" @click="resetFilters">重置</button>
    </div>

    <!-- 用户列表 -->
    <div v-if="loading" class="card p-12 text-center text-ink-3 text-[13px]">加载中…</div>
    <div v-else-if="!users.length" class="card p-12 text-center text-ink-3 text-[13px]">没有找到符合条件的同学</div>
    <div v-else class="grid grid-cols-2 gap-4">
      <div v-for="u in users" :key="u.id" class="card p-5">
        <div class="flex items-start gap-3.5">
          <span class="w-11 h-11 rounded-full text-[14px] flex items-center justify-center shrink-0"
            :class="u.gender === 2 ? 'bg-[#FBEAF0] text-[#993556]' : 'bg-accent-soft text-accent-deep'">{{ u.real_name.slice(0, 1) }}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-[14px] font-medium text-ink">{{ u.real_name }}</p>
              <span v-if="u.friend_status === 'friend'" class="tag tag-green">好友</span>
            </div>
            <p class="text-[11px] text-ink-3 mt-0.5">{{ u.student_id }} · {{ u.grade || '年级未知' }}</p>
            <p class="text-[12px] text-ink-2 mt-1.5">{{ u.college || '—' }}<template v-if="u.major"> · {{ u.major }}</template></p>
            <div class="flex items-center gap-4 mt-2 text-[11px] text-ink-3">
              <span>{{ u.club_count }} 个社团</span>
              <span v-if="u.phone">{{ u.phone }}</span>
            </div>
          </div>
          <div class="shrink-0">
            <router-link v-if="u.friend_status === 'friend'" to="/friends" class="btn-ghost !py-1.5 !px-3 !text-[12px]">发消息</router-link>
            <span v-else-if="u.friend_status === 'pending_sent'" class="tag tag-amber !px-3 !py-1.5">待通过</span>
            <router-link v-else-if="u.friend_status === 'pending_received'" to="/friends" class="tag tag-accent !px-3 !py-1.5 cursor-pointer">待你通过</router-link>
            <button v-else class="btn-primary !py-1.5 !px-3 !text-[12px]" @click="addFriend(u)">+ 加好友</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full z-50">{{ toast }}</div>
  </div>
</template>
