<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, type Activity, type Club, type Member } from '../api'

const route = useRoute()
const clubId = Number(route.params.id)
const club = ref<Club | null>(null)
const members = ref<Member[]>([])
const activities = ref<Activity[]>([])
const loading = ref(true)
const toast = ref('')
const showApply = ref(false)
const applyReason = ref('')
const applyLoading = ref(false)

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 3000)
}

async function load() {
  loading.value = true
  try {
    const [c, m, a]: any[] = await Promise.all([
      api.get(`/clubs/${clubId}`),
      api.get(`/clubs/${clubId}/members`),
      api.get(`/activities?club_id=${clubId}&scope=upcoming`)
    ])
    club.value = c.data
    members.value = m.data
    activities.value = a.data
  } finally {
    loading.value = false
  }
}

async function apply() {
  applyLoading.value = true
  try {
    await api.post(`/clubs/${clubId}/apply`, { reason: applyReason.value })
    showApply.value = false
    showToast('入社申请已提交，等待社团审核')
    await load()
  } catch (e: any) {
    showToast(e.message)
  } finally {
    applyLoading.value = false
  }
}

async function quit() {
  if (!confirm('确定要退出该社团吗？')) return
  try {
    await api.post(`/clubs/${clubId}/quit`)
    showToast('已退出社团')
    await load()
  } catch (e: any) {
    showToast(e.message)
  }
}

function fmt(t: string) {
  const d = new Date(t.replace(' ', 'T'))
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="card p-12 text-center text-ink-3 text-[13px]">加载中…</div>
  <div v-else-if="club">
    <!-- 头部 -->
    <div class="card p-7 mb-5">
      <div class="flex items-start gap-5">
        <span class="w-16 h-16 rounded-2xl bg-accent-soft text-accent-deep serif text-[26px] flex items-center justify-center shrink-0">{{ club.name.slice(0, 1) }}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="serif text-[24px] text-ink">{{ club.name }}</h1>
            <div class="flex gap-0.5 pt-1">
              <svg v-for="i in 5" :key="i" width="13" height="13" viewBox="0 0 24 24" :fill="i <= club.level ? '#D97757' : '#E8E4DB'"><path d="M12 2l3 6.6 7 .8-5.2 4.9 1.4 7-6.2-3.5-6.2 3.5 1.4-7L2 9.4l7-.8z"/></svg>
            </div>
            <span class="tag tag-accent">{{ club.type_name }}</span>
          </div>
          <p class="text-[13px] text-ink-2 leading-relaxed mt-2 max-w-[560px]">{{ club.description }}</p>
          <div class="flex items-center gap-5 mt-3 text-[12px] text-ink-3">
            <span>{{ club.member_count }} 名成员</span>
            <span v-if="club.teacher_name">指导老师：{{ club.teacher_name }} {{ club.teacher_title }}</span>
            <span>发起人：{{ club.founder_name }}</span>
          </div>
        </div>
        <div class="shrink-0 flex flex-col gap-2">
          <router-link v-if="club.is_manager" :to="`/clubs/${clubId}/manage`" class="btn-primary text-center">管理社团</router-link>
          <template v-else>
            <span v-if="club.my_membership?.status === 0" class="tag tag-amber !px-4 !py-2">审核中</span>
            <button v-else-if="club.my_membership?.status === 1" class="btn-ghost" @click="quit">退出社团</button>
            <button v-else class="btn-primary" @click="showApply = true">申请加入</button>
          </template>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-5 gap-5">
      <!-- 近期活动 -->
      <section class="col-span-3">
        <h2 class="text-[15px] font-medium text-ink mb-3">近期活动</h2>
        <div v-if="!activities.length" class="card p-8 text-center text-ink-3 text-[13px]">暂无进行中的活动</div>
        <div v-else class="card divide-y divide-line-soft overflow-hidden">
          <router-link v-for="a in activities" :key="a.id" :to="`/activities/${a.id}`" class="flex items-center gap-4 px-5 py-4 hover:bg-paper transition-colors">
            <div class="w-11 h-11 rounded-xl bg-accent-soft flex flex-col items-center justify-center shrink-0">
              <span class="text-[14px] font-medium text-accent-deep leading-none">{{ new Date(a.start_time.replace(' ','T')).getDate() }}</span>
              <span class="text-[10px] text-accent-deep">{{ new Date(a.start_time.replace(' ','T')).getMonth() + 1 }}月</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] text-ink truncate">{{ a.title }}</p>
              <p class="text-[11px] text-ink-3 mt-0.5">{{ fmt(a.start_time) }} · {{ a.location }}</p>
            </div>
            <span class="text-[11px] text-ink-3">{{ a.signup_count }}{{ a.max_num ? '/' + a.max_num : '' }} 人</span>
            <span v-if="a.my_signup" class="tag tag-green">已报名</span>
          </router-link>
        </div>
      </section>

      <!-- 成员 -->
      <section class="col-span-2">
        <h2 class="text-[15px] font-medium text-ink mb-3">社团成员（{{ members.length }}）</h2>
        <div class="card p-5">
          <div class="mb-4 pb-4 border-b border-line-soft" v-if="club.leaders?.length">
            <p class="text-[11px] text-ink-3 mb-2">负责人</p>
            <div class="flex flex-wrap gap-2">
              <span v-for="l in club.leaders" :key="l.real_name" class="tag tag-accent !px-3 !py-1">{{ l.real_name }} · {{ l.position }}</span>
            </div>
          </div>
          <div class="space-y-2.5 max-h-[320px] overflow-y-auto">
            <div v-for="m in members" :key="m.id" class="flex items-center gap-3">
              <span class="w-8 h-8 rounded-full bg-paper-deep text-ink-2 text-[12px] flex items-center justify-center shrink-0">{{ m.real_name.slice(0, 1) }}</span>
              <div class="flex-1 min-w-0">
                <p class="text-[12px] text-ink truncate">{{ m.real_name }}</p>
                <p class="text-[11px] text-ink-3">{{ m.position }}<template v-if="m.department"> · {{ m.department }}</template></p>
              </div>
              <span class="text-[11px] text-accent-deep">{{ m.points }} 分</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- 入社申请弹窗 -->
    <div v-if="showApply" class="fixed inset-0 bg-black/25 flex items-center justify-center z-50 px-4" @click.self="showApply = false">
      <div class="card w-full max-w-[440px] p-7">
        <h3 class="serif text-[18px] text-ink mb-1">申请加入 {{ club.name }}</h3>
        <p class="text-[12px] text-ink-3 mb-5">提交后由社团管理者审核</p>
        <label class="label">申请理由</label>
        <textarea v-model="applyReason" rows="4" class="input resize-none" placeholder="介绍一下自己，以及为什么想加入…"></textarea>
        <div class="flex justify-end gap-3 pt-4">
          <button class="btn-ghost" @click="showApply = false">取消</button>
          <button class="btn-primary" :disabled="applyLoading" @click="apply">{{ applyLoading ? '提交中…' : '提交申请' }}</button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full z-50">{{ toast }}</div>
  </div>
</template>
