<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api, type Activity, type Notice } from '../api'
import { useAuthStore } from '../stores'

const auth = useAuthStore()
const stats = ref({ clubs: 0, signups: 0, checkins: 0, hours: 0, points: 0 })
const upcoming = ref<any[]>([])
const notices = ref<Notice[]>([])
const loading = ref(true)

const greeting = computed(() => {
  const h = new Date().getHours()
  const name = auth.user?.real_name || '同学'
  if (h < 6) return `夜深了，${name}`
  if (h < 12) return `早上好，${name}`
  if (h < 14) return `中午好，${name}`
  if (h < 18) return `下午好，${name}`
  return `晚上好，${name}`
})

function fmt(t: string) {
  const d = new Date(t.replace(' ', 'T'))
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(async () => {
  try {
    const [s, acts, ns]: any[] = await Promise.all([
      api.get('/stats/me'),
      api.get('/me/activities'),
      api.get('/notices?scope=mine')
    ])
    stats.value = s.data
    upcoming.value = acts.data.filter((a: any) => a.status !== 3 && a.signup_status !== 4).slice(0, 4)
    notices.value = ns.data.slice(0, 4)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <header class="mb-8">
      <h1 class="page-title">{{ greeting }}</h1>
      <p class="page-sub">这是你在社团云的最新动态</p>
    </header>

    <!-- 指标卡 -->
    <div class="grid grid-cols-4 gap-3 mb-8">
      <div class="card p-5">
        <p class="text-[12px] text-ink-3">我的社团</p>
        <p class="serif text-[30px] text-ink mt-1 leading-none">{{ stats.clubs }}</p>
      </div>
      <div class="card p-5">
        <p class="text-[12px] text-ink-3">已报名活动</p>
        <p class="serif text-[30px] text-ink mt-1 leading-none">{{ stats.signups }}</p>
      </div>
      <div class="card p-5">
        <p class="text-[12px] text-ink-3">累计参与时长</p>
        <p class="serif text-[30px] text-ink mt-1 leading-none">{{ stats.hours }}<span class="text-[13px] text-ink-3 font-sans"> 小时</span></p>
      </div>
      <div class="card p-5">
        <p class="text-[12px] text-ink-3">社团积分</p>
        <p class="serif text-[30px] text-accent-deep mt-1 leading-none">{{ stats.points }}</p>
      </div>
    </div>

    <div class="grid grid-cols-5 gap-6">
      <!-- 我的近期活动 -->
      <section class="col-span-3">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-[15px] font-medium text-ink">我的近期活动</h2>
          <router-link to="/activities" class="text-[12px] text-accent-deep hover:underline">浏览全部活动</router-link>
        </div>
        <div v-if="loading" class="card p-10 text-center text-ink-3 text-[13px]">加载中…</div>
        <div v-else-if="!upcoming.length" class="card p-10 text-center">
          <p class="text-ink-3 text-[13px] mb-3">你还没有报名任何进行中的活动</p>
          <router-link to="/activities" class="btn-ghost text-[12px]">去看看有什么活动</router-link>
        </div>
        <div v-else class="card divide-y divide-line-soft overflow-hidden">
          <router-link v-for="a in upcoming" :key="a.id" :to="`/activities/${a.id}`" class="flex items-center gap-4 px-5 py-4 hover:bg-paper transition-colors">
            <div class="w-11 h-11 rounded-xl bg-accent-soft flex flex-col items-center justify-center shrink-0">
              <span class="text-[14px] font-medium text-accent-deep leading-none">{{ new Date(a.start_time.replace(' ','T')).getDate() }}</span>
              <span class="text-[10px] text-accent-deep">{{ new Date(a.start_time.replace(' ','T')).getMonth() + 1 }}月</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] text-ink truncate">{{ a.title }}</p>
              <p class="text-[11px] text-ink-3 mt-0.5">{{ a.club_name }} · {{ fmt(a.start_time) }} · {{ a.location }}</p>
            </div>
            <span class="tag" :class="a.signup_status === 2 ? 'tag-green' : 'tag-accent'">{{ a.signup_status === 2 ? '已签到' : '已报名' }}</span>
          </router-link>
        </div>
      </section>

      <!-- 最新公告 -->
      <section class="col-span-2">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-[15px] font-medium text-ink">最新公告</h2>
          <router-link to="/notices" class="text-[12px] text-accent-deep hover:underline">全部</router-link>
        </div>
        <div v-if="!notices.length && !loading" class="card p-10 text-center text-ink-3 text-[13px]">暂无公告</div>
        <div v-else class="card divide-y divide-line-soft overflow-hidden">
          <router-link v-for="n in notices" :key="n.id" to="/notices" class="block px-5 py-4 hover:bg-paper transition-colors">
            <div class="flex items-center gap-2 mb-1">
              <span class="tag" :class="n.scope === 'school' ? 'tag-accent' : 'tag-gray'">{{ n.scope === 'school' ? '全校' : n.club_name }}</span>
              <span v-if="!n.is_read" class="w-1.5 h-1.5 rounded-full bg-accent"></span>
            </div>
            <p class="text-[13px] text-ink leading-snug line-clamp-2">{{ n.title }}</p>
            <p class="text-[11px] text-ink-3 mt-1">{{ n.created_at?.slice(0, 10) }}</p>
          </router-link>
        </div>
      </section>
    </div>
  </div>
</template>
