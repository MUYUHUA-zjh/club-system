<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type Activity } from '../api'

const activities = ref<Activity[]>([])
const keyword = ref('')
const filter = ref<'all' | 'upcoming' | 'mine'>('all')
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    const params: any = {}
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (filter.value === 'upcoming') params.scope = 'upcoming'
    const res: any = await api.get('/activities', { params })
    let list: Activity[] = res.data
    if (filter.value === 'mine') list = list.filter(a => a.my_signup && a.my_signup !== 4)
    activities.value = list
  } finally {
    loading.value = false
  }
}

function fmt(t: string) {
  const d = new Date(t.replace(' ', 'T'))
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日 周${week} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const typeNames: Record<number, string> = { 1: '常规', 2: '大型', 3: '校外', 4: '联合' }

onMounted(load)
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="page-title">活动中心</h1>
      <p class="page-sub">浏览全校社团活动，一键报名参与</p>
    </header>

    <div class="flex items-center gap-2 mb-5">
      <button v-for="f in [['all','全部活动'],['upcoming','报名中'],['mine','我报名的']]" :key="f[0]"
        class="tag !px-3 !py-1.5 cursor-pointer transition-all"
        :class="filter === f[0] ? 'tag-accent' : 'tag-gray hover:bg-line'"
        @click="filter = f[0] as any; load()">{{ f[1] }}</button>
      <div class="flex-1"></div>
      <input v-model="keyword" class="input !w-[220px]" placeholder="搜索活动标题或地点…" @keyup.enter="load" />
    </div>

    <div v-if="loading" class="card p-12 text-center text-ink-3 text-[13px]">加载中…</div>
    <div v-else-if="!activities.length" class="card p-12 text-center text-ink-3 text-[13px]">暂无活动</div>
    <div v-else class="space-y-3">
      <router-link v-for="a in activities" :key="a.id" :to="`/activities/${a.id}`"
        class="card flex items-center gap-5 px-6 py-5 hover:border-ink-3 transition-colors group"
        :class="{ 'opacity-60': a.status === 3 }">
        <div class="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0"
          :class="a.status === 3 ? 'bg-paper-deep' : 'bg-accent-soft'">
          <span class="text-[16px] font-medium leading-none" :class="a.status === 3 ? 'text-ink-3' : 'text-accent-deep'">{{ new Date(a.start_time.replace(' ','T')).getDate() }}</span>
          <span class="text-[10px]" :class="a.status === 3 ? 'text-ink-3' : 'text-accent-deep'">{{ new Date(a.start_time.replace(' ','T')).getMonth() + 1 }}月</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-[14px] font-medium text-ink group-hover:text-accent-deep transition-colors truncate">{{ a.title }}</p>
            <span class="tag tag-gray shrink-0">{{ typeNames[a.activity_type] }}</span>
          </div>
          <p class="text-[12px] text-ink-3 mt-1">{{ a.club_name }} · {{ fmt(a.start_time) }} · {{ a.location }}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-[12px] text-ink-2">{{ a.signup_count }}{{ a.max_num ? ' / ' + a.max_num : '' }} 人</p>
          <span v-if="a.status === 3" class="tag tag-gray mt-1">已结束</span>
          <span v-else-if="a.my_signup === 2" class="tag tag-green mt-1">已签到</span>
          <span v-else-if="a.my_signup === 1" class="tag tag-green mt-1">已报名</span>
          <span v-else-if="a.max_num && a.signup_count >= a.max_num" class="tag tag-amber mt-1">名额已满</span>
          <span v-else class="tag tag-accent mt-1">报名中</span>
        </div>
      </router-link>
    </div>
  </div>
</template>
