<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api, type Activity } from '../api'

const route = useRoute()
const actId = Number(route.params.id)
const activity = ref<Activity | null>(null)
const loading = ref(true)
const acting = ref(false)
const toast = ref('')
const checkinCodeInput = ref('')
const checking = ref(false)

function showToast(msg: string) { toast.value = msg; setTimeout(() => (toast.value = ''), 3500) }

async function load() {
  loading.value = true
  try {
    const res: any = await api.get(`/activities/${actId}`)
    activity.value = res.data
  } finally {
    loading.value = false
  }
}

async function signup() {
  acting.value = true
  try {
    await api.post(`/activities/${actId}/signup`)
    showToast('报名成功，记得按时参加活动')
    await load()
  } catch (e: any) { showToast(e.message) } finally { acting.value = false }
}

async function cancelSignup() {
  if (!confirm('确定取消报名吗？名额将释放给其他同学')) return
  acting.value = true
  try {
    await api.post(`/activities/${actId}/cancel-signup`)
    showToast('已取消报名')
    await load()
  } catch (e: any) { showToast(e.message) } finally { acting.value = false }
}

async function checkin() {
  if (!checkinCodeInput.value.trim()) { showToast('请输入 6 位签到码'); return }
  checking.value = true
  try {
    await api.post(`/activities/${actId}/checkin`, { code: checkinCodeInput.value.trim() })
    showToast('签到成功，祝你活动愉快')
    checkinCodeInput.value = ''
    await load()
  } catch (e: any) { showToast(e.message) } finally { checking.value = false }
}

const full = computed(() => !!activity.value?.max_num && (activity.value?.signup_count ?? 0) >= (activity.value?.max_num ?? 0))
const deadlinePassed = computed(() => activity.value && activity.value.sign_deadline < new Date().toISOString().slice(0, 19).replace('T', ' '))

function fmt(t: string) {
  if (!t) return ''
  const d = new Date(t.replace(' ', 'T'))
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${week} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

onMounted(load)
</script>

<template>
  <div v-if="loading" class="card p-12 text-center text-ink-3 text-[13px]">加载中…</div>
  <div v-else-if="activity">
    <router-link to="/activities" class="text-[12px] text-ink-3 hover:text-ink">← 返回活动中心</router-link>

    <div class="card p-8 mt-3">
      <div class="flex items-start justify-between gap-6">
        <div class="flex-1 min-w-0">
          <router-link :to="`/clubs/${activity.club_id}`" class="text-[12px] text-accent-deep hover:underline">{{ activity.club_name }}</router-link>
          <h1 class="serif text-[26px] text-ink leading-snug mt-1 mb-4">{{ activity.title }}</h1>
          <div class="space-y-2 text-[13px] text-ink-2">
            <p class="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
              {{ fmt(activity.start_time) }} — {{ fmt(activity.end_time).slice(-6) }}
            </p>
            <p class="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {{ activity.location || '地点待定' }}
            </p>
            <p class="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5"/><path d="M16 5a3.5 3.5 0 0 1 0 6.5M21.5 20c-.5-1.8-1.6-3-3-3.8"/></svg>
              已报名 {{ activity.signup_count }}{{ activity.max_num ? ' / ' + activity.max_num : '' }} 人 · 报名截止 {{ fmt(activity.sign_deadline).slice(5) }}
            </p>
          </div>
        </div>
        <div class="shrink-0 w-[200px] text-right">
          <span v-if="activity.status === 3" class="tag tag-gray !px-4 !py-2">活动已结束</span>
          <span v-else-if="activity.status === 4" class="tag tag-red !px-4 !py-2">活动已取消</span>
          <template v-else-if="activity.my_signup === 2">
            <span class="tag tag-green !px-4 !py-2">已完成签到</span>
          </template>
          <template v-else-if="activity.my_signup === 1">
            <button class="btn-ghost w-full" :disabled="acting" @click="cancelSignup">取消报名</button>
          </template>
          <template v-else>
            <span v-if="full" class="tag tag-amber !px-4 !py-2">名额已满</span>
            <span v-else-if="deadlinePassed" class="tag tag-gray !px-4 !py-2">报名已截止</span>
            <button v-else class="btn-primary w-full !py-2.5" :disabled="acting" @click="signup">{{ acting ? '报名中…' : '立即报名' }}</button>
          </template>
        </div>
      </div>

      <div v-if="activity.content" class="mt-6 pt-6 border-t border-line-soft">
        <h2 class="text-[14px] font-medium text-ink mb-2">活动详情</h2>
        <p class="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">{{ activity.content }}</p>
      </div>

      <!-- 签到区 -->
      <div v-if="activity.my_signup === 1 && activity.status !== 3 && activity.status !== 4" class="mt-6 pt-6 border-t border-line-soft">
        <h2 class="text-[14px] font-medium text-ink mb-1">活动签到</h2>
        <p class="text-[12px] text-ink-3 mb-3">到达现场后，输入工作人员出示的 6 位动态签到码</p>
        <div class="flex gap-2 max-w-[320px]">
          <input v-model="checkinCodeInput" class="input !text-center !tracking-[6px] !font-medium uppercase" maxlength="6" placeholder="______" @keyup.enter="checkin" />
          <button class="btn-primary shrink-0" :disabled="checking" @click="checkin">{{ checking ? '签到中…' : '签 到' }}</button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full z-50">{{ toast }}</div>
  </div>
</template>
