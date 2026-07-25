<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { api, type ChatMessage, type Friend, type FriendRequest, type UserDir } from '../api'
import { refreshUnread } from '../unread'
import { useAuthStore } from '../stores'

const auth = useAuthStore()
const conversations = ref<Friend[]>([])
const requests = ref<FriendRequest[]>([])
const active = ref<Friend | null>(null)
const messages = ref<ChatMessage[]>([])
const draft = ref('')
const sending = ref(false)
const toast = ref('')
const msgBox = ref<HTMLElement | null>(null)
let pollTimer: any = null

// 添加好友（按学号/姓名搜索）
const searchKw = ref('')
const searchResults = ref<UserDir[]>([])
const searching = ref(false)

function showToast(msg: string) { toast.value = msg; setTimeout(() => (toast.value = ''), 3000) }
function fmtTime(t: string) { return t ? t.slice(5, 16) : '' }

async function loadConversations(keepActive = true) {
  const res: any = await api.get('/messages/conversations')
  conversations.value = res.data
  if (keepActive && active.value) {
    const still = conversations.value.find(c => c.id === active.value!.id)
    if (still) active.value = { ...active.value, unread: still.unread, last_message: still.last_message }
  }
}
async function loadRequests() {
  const res: any = await api.get('/friends/requests')
  requests.value = res.data
}

async function search() {
  if (!searchKw.value.trim()) { searchResults.value = []; return }
  searching.value = true
  try {
    const res: any = await api.get('/users', { params: { keyword: searchKw.value.trim() } })
    searchResults.value = res.data.slice(0, 5)
  } finally { searching.value = false }
}

async function addFriend(u: UserDir) {
  try {
    const res: any = await api.post(`/friends/${u.id}`)
    u.friend_status = res.data.status
    showToast(res.data.status === 'friend' ? `已与 ${u.real_name} 成为好友` : '好友申请已发送')
    await Promise.all([loadConversations(false), loadRequests(), refreshUnread()])
  } catch (e: any) { showToast(e.message) }
}

async function handleRequest(r: FriendRequest, accept: boolean) {
  try {
    await api.post(`/friends/requests/${r.id}/${accept ? 'accept' : 'reject'}`)
    showToast(accept ? `已与 ${r.real_name} 成为好友` : '已忽略该申请')
    await Promise.all([loadConversations(false), loadRequests(), refreshUnread()])
  } catch (e: any) { showToast(e.message) }
}

async function openChat(f: Friend) {
  active.value = f
  await fetchMessages()
  f.unread = 0
  refreshUnread()
  clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    await fetchMessages(true)
    loadConversations()
  }, 3000)
}

async function fetchMessages(silent = false) {
  if (!active.value) return
  try {
    const res: any = await api.get(`/messages/${active.value.id}`)
    const isNew = res.data.messages.length !== messages.value.length
    messages.value = res.data.messages
    if (!silent || isNew) {
      await nextTick()
      msgBox.value?.scrollTo({ top: msgBox.value.scrollHeight })
    }
  } catch { /* 忽略 */ }
}

async function send() {
  const content = draft.value.trim()
  if (!content || !active.value || sending.value) return
  sending.value = true
  try {
    await api.post(`/messages/${active.value.id}`, { content })
    draft.value = ''
    await fetchMessages(true)
    loadConversations()
  } catch (e: any) { showToast(e.message) } finally { sending.value = false }
}

onMounted(async () => {
  await Promise.all([loadConversations(false), loadRequests()])
  if (conversations.value.length) openChat(conversations.value[0])
})
onBeforeUnmount(() => clearInterval(pollTimer))
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="page-title">好友消息</h1>
      <p class="page-sub">添加好友，随时交流社团大小事</p>
    </header>

    <div class="card overflow-hidden flex" style="height: calc(100vh - 210px); min-height: 460px;">
      <!-- 左栏 -->
      <div class="w-[280px] shrink-0 border-r border-line flex flex-col bg-paper">
        <!-- 添加好友 -->
        <div class="p-3 border-b border-line">
          <div class="flex gap-2">
            <input v-model="searchKw" class="input !py-1.5 !text-[12px]" placeholder="输入学号或姓名加好友" @keyup.enter="search" />
            <button class="btn-primary !py-1.5 !px-3 !text-[12px] shrink-0" @click="search">查找</button>
          </div>
          <div v-if="searchResults.length" class="mt-2 space-y-1.5">
            <div v-for="u in searchResults" :key="u.id" class="flex items-center gap-2 bg-surface rounded-lg px-2.5 py-2 border border-line-soft">
              <span class="w-6 h-6 rounded-full bg-accent-soft text-accent-deep text-[10px] flex items-center justify-center shrink-0">{{ u.real_name.slice(0, 1) }}</span>
              <div class="flex-1 min-w-0">
                <p class="text-[12px] text-ink truncate">{{ u.real_name }}</p>
                <p class="text-[10px] text-ink-3">{{ u.student_id }}</p>
              </div>
              <span v-if="u.friend_status === 'friend'" class="text-[10px] text-ink-3">已是好友</span>
              <span v-else-if="u.friend_status === 'pending_sent'" class="text-[10px] text-ink-3">待通过</span>
              <button v-else class="text-[11px] text-accent-deep font-medium" @click="addFriend(u)">+ 添加</button>
            </div>
          </div>
          <p v-else-if="searching" class="text-[11px] text-ink-3 mt-2">查找中…</p>
        </div>

        <!-- 好友申请 -->
        <div v-if="requests.length" class="p-3 border-b border-line">
          <p class="text-[11px] text-ink-3 mb-2">新的朋友（{{ requests.length }}）</p>
          <div class="space-y-2">
            <div v-for="r in requests" :key="r.id" class="bg-surface rounded-lg px-2.5 py-2 border border-line-soft">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-[#FAEEDA] text-[#854F0B] text-[10px] flex items-center justify-center shrink-0">{{ r.real_name.slice(0, 1) }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-[12px] text-ink truncate">{{ r.real_name }}</p>
                  <p class="text-[10px] text-ink-3">{{ r.college }} · {{ r.grade }}</p>
                </div>
              </div>
              <div class="flex gap-1.5 mt-1.5">
                <button class="btn-primary !py-0.5 !px-2.5 !text-[11px] flex-1" @click="handleRequest(r, true)">通过</button>
                <button class="btn-ghost !py-0.5 !px-2.5 !text-[11px]" @click="handleRequest(r, false)">忽略</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 会话列表 -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="!conversations.length" class="p-6 text-center text-ink-3 text-[12px]">
            还没有好友<br />通过上方搜索或「我的同学」添加
          </div>
          <button v-for="c in conversations" :key="c.id"
            class="w-full flex items-center gap-2.5 px-3 py-3 text-left transition-colors border-b border-line-soft"
            :class="active?.id === c.id ? 'bg-surface' : 'hover:bg-surface/60'"
            @click="openChat(c)">
            <span class="w-9 h-9 rounded-full bg-accent-soft text-accent-deep text-[12px] flex items-center justify-center shrink-0">{{ c.real_name.slice(0, 1) }}</span>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] text-ink truncate">{{ c.real_name }}</p>
              <p class="text-[11px] text-ink-3 truncate">{{ c.last_message || '开始聊天吧' }}</p>
            </div>
            <span v-if="c.unread" class="text-[10px] bg-accent text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center shrink-0">{{ c.unread }}</span>
          </button>
        </div>
      </div>

      <!-- 右栏：聊天窗口 -->
      <div class="flex-1 flex flex-col min-w-0 bg-surface">
        <template v-if="active">
          <div class="px-5 py-3.5 border-b border-line flex items-center gap-3">
            <span class="w-8 h-8 rounded-full bg-accent-soft text-accent-deep text-[12px] flex items-center justify-center">{{ active.real_name.slice(0, 1) }}</span>
            <div>
              <p class="text-[14px] font-medium text-ink">{{ active.real_name }}</p>
              <p class="text-[11px] text-ink-3">{{ active.college }} · {{ active.grade }}</p>
            </div>
          </div>

          <div ref="msgBox" class="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-paper">
            <div v-if="!messages.length" class="text-center text-ink-3 text-[12px] pt-16">打个招呼，开始你们的对话</div>
            <div v-for="m in messages" :key="m.id" class="flex" :class="m.sender_id === auth.user?.id ? 'justify-end' : 'justify-start'">
              <div class="max-w-[70%]">
                <div class="px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words"
                  :class="m.sender_id === auth.user?.id ? 'bg-accent text-white rounded-br-md' : 'bg-surface border border-line text-ink rounded-bl-md'">
                  {{ m.content }}
                </div>
                <p class="text-[10px] text-ink-3 mt-1" :class="m.sender_id === auth.user?.id ? 'text-right' : ''">{{ fmtTime(m.created_at) }}</p>
              </div>
            </div>
          </div>

          <div class="p-3.5 border-t border-line flex gap-2.5">
            <input v-model="draft" class="input flex-1" placeholder="输入消息，回车发送…" maxlength="500" @keyup.enter="send" />
            <button class="btn-primary shrink-0 !px-5" :disabled="!draft.trim() || sending" @click="send">发送</button>
          </div>
        </template>
        <div v-else class="flex-1 flex items-center justify-center text-ink-3 text-[13px]">选择一位好友开始聊天</div>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full z-50">{{ toast }}</div>
  </div>
</template>
