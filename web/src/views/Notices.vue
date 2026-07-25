<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type Notice } from '../api'
import { useAuthStore } from '../stores'
import { markNoticeRead } from '../unread'

const auth = useAuthStore()
const notices = ref<Notice[]>([])
const expanded = ref<Notice | null>(null)
const loading = ref(true)
const showPublish = ref(false)
const myManagedClubs = ref<any[]>([])
const pubForm = ref({ scope: 'school', club_id: 0, title: '', content: '' })
const pubError = ref('')
const toast = ref('')

async function load() {
  loading.value = true
  try {
    const res: any = await api.get('/notices?scope=mine')
    notices.value = res.data
  } finally {
    loading.value = false
  }
}

async function open(n: Notice) {
  const res: any = await api.get(`/notices/${n.id}`)
  expanded.value = res.data
  if (!n.is_read) markNoticeRead()
  n.is_read = 1
}

async function publish() {
  pubError.value = ''
  const f = pubForm.value
  if (!f.title.trim() || !f.content.trim()) { pubError.value = '标题和内容为必填项'; return }
  if (f.scope === 'club' && !f.club_id) { pubError.value = '请选择目标社团'; return }
  try {
    await api.post('/notices', { scope: f.scope, club_id: f.scope === 'club' ? f.club_id : undefined, title: f.title, content: f.content })
    showPublish.value = false
    pubForm.value = { scope: auth.isAdmin ? 'school' : 'club', club_id: 0, title: '', content: '' }
    toast.value = '发布成功'
    setTimeout(() => (toast.value = ''), 3000)
    await load()
  } catch (e: any) { pubError.value = e.message }
}

onMounted(async () => {
  await load()
  if (!auth.isAdmin) {
    pubForm.value.scope = 'club'
    try {
      const res: any = await api.get('/me/clubs')
      myManagedClubs.value = res.data.filter((c: any) => ['社长', '副社长', '部长'].includes(c.position) && c.status === 1)
    } catch { /* 忽略 */ }
  }
})
</script>

<template>
  <div>
    <header class="flex items-end justify-between mb-6">
      <div>
        <h1 class="page-title">通知公告</h1>
        <p class="page-sub">全校公告与你所在社团的内部通知</p>
      </div>
      <button v-if="auth.isAdmin || myManagedClubs.length" class="btn-primary" @click="showPublish = true">+ 发布通知</button>
    </header>

    <div v-if="loading" class="card p-12 text-center text-ink-3 text-[13px]">加载中…</div>
    <div v-else-if="!notices.length" class="card p-12 text-center text-ink-3 text-[13px]">暂无通知</div>
    <div v-else class="card divide-y divide-line-soft overflow-hidden">
      <button v-for="n in notices" :key="n.id" class="w-full text-left px-6 py-4 hover:bg-paper transition-colors" @click="open(n)">
        <div class="flex items-center gap-2 mb-1">
          <span class="tag" :class="n.scope === 'school' ? 'tag-accent' : 'tag-gray'">{{ n.scope === 'school' ? '全校公告' : n.club_name }}</span>
          <span v-if="!n.is_read" class="w-1.5 h-1.5 rounded-full bg-accent"></span>
          <span class="flex-1"></span>
          <span class="text-[11px] text-ink-3">{{ n.created_at?.slice(0, 10) }}</span>
        </div>
        <p class="text-[13px] leading-snug" :class="n.is_read ? 'text-ink-2' : 'text-ink font-medium'">{{ n.title }}</p>
      </button>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="expanded" class="fixed inset-0 bg-black/25 flex items-center justify-center z-50 px-4" @click.self="expanded = null">
      <div class="card w-full max-w-[560px] p-8 max-h-[80vh] overflow-y-auto">
        <span class="tag" :class="expanded.scope === 'school' ? 'tag-accent' : 'tag-gray'">{{ expanded.scope === 'school' ? '全校公告' : expanded.club_name }}</span>
        <h3 class="serif text-[20px] text-ink mt-3 mb-1">{{ expanded.title }}</h3>
        <p class="text-[11px] text-ink-3 mb-5">{{ expanded.publisher_name }} 发布于 {{ expanded.created_at }}</p>
        <p class="text-[13px] text-ink-2 leading-relaxed whitespace-pre-wrap">{{ expanded.content }}</p>
        <div class="flex justify-end mt-6"><button class="btn-ghost" @click="expanded = null">关闭</button></div>
      </div>
    </div>

    <!-- 发布弹窗 -->
    <div v-if="showPublish" class="fixed inset-0 bg-black/25 flex items-center justify-center z-50 px-4" @click.self="showPublish = false">
      <div class="card w-full max-w-[520px] p-7">
        <h3 class="serif text-[18px] text-ink mb-5">发布通知</h3>
        <div class="space-y-4">
          <div v-if="auth.isAdmin">
            <label class="label">发布范围</label>
            <select v-model="pubForm.scope" class="input">
              <option value="school">全校公告</option>
            </select>
          </div>
          <div v-else>
            <label class="label">发布到社团</label>
            <select v-model.number="pubForm.club_id" class="input">
              <option :value="0" disabled>请选择社团</option>
              <option v-for="c in myManagedClubs" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div><label class="label">标题 *</label><input v-model="pubForm.title" class="input" placeholder="通知标题" /></div>
          <div><label class="label">内容 *</label><textarea v-model="pubForm.content" rows="5" class="input resize-none" placeholder="通知正文…"></textarea></div>
          <p v-if="pubError" class="text-[12px] text-[#A32D2D] bg-[#FCEBEB] rounded-lg px-3 py-2">{{ pubError }}</p>
          <div class="flex justify-end gap-3">
            <button class="btn-ghost" @click="showPublish = false">取消</button>
            <button class="btn-primary" @click="publish">发布</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full z-50">{{ toast }}</div>
  </div>
</template>
