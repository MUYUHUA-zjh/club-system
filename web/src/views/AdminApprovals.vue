<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type Club } from '../api'

const pending = ref<(Club & { founder_name: string })[]>([])
const loading = ref(true)
const rejectTarget = ref<Club | null>(null)
const rejectReason = ref('')
const error = ref('')
const toast = ref('')

async function load() {
  loading.value = true
  try {
    const res: any = await api.get('/clubs/pending/list')
    pending.value = res.data
  } finally {
    loading.value = false
  }
}

async function approve(c: Club) {
  if (!confirm(`确定通过「${c.name}」的成立申请吗？社团空间将自动创建，发起人将成为社长。`)) return
  try {
    await api.post(`/clubs/${c.id}/audit`, { approve: true })
    toast.value = `已通过「${c.name}」的成立申请`
    setTimeout(() => (toast.value = ''), 3000)
    await load()
  } catch (e: any) { error.value = e.message }
}

async function reject() {
  if (!rejectReason.value.trim()) { error.value = '请填写驳回原因'; return }
  try {
    await api.post(`/clubs/${rejectTarget.value!.id}/audit`, { approve: false, reason: rejectReason.value })
    rejectTarget.value = null
    rejectReason.value = ''
    toast.value = '已驳回该申请'
    setTimeout(() => (toast.value = ''), 3000)
    await load()
  } catch (e: any) { error.value = e.message }
}

onMounted(load)
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="page-title">社团成立审核</h1>
      <p class="page-sub">审核学生发起的社团成立申请，通过后自动创建社团空间</p>
    </header>

    <p v-if="error" class="text-[12px] text-[#A32D2D] bg-[#FCEBEB] rounded-lg px-3 py-2 mb-4">{{ error }}</p>

    <div v-if="loading" class="card p-12 text-center text-ink-3 text-[13px]">加载中…</div>
    <div v-else-if="!pending.length" class="card p-12 text-center">
      <p class="text-ink-3 text-[13px]">当前没有待审核的社团申请</p>
    </div>
    <div v-else class="space-y-4">
      <div v-for="c in pending" :key="c.id" class="card p-6">
        <div class="flex items-start gap-4">
          <span class="w-12 h-12 rounded-xl bg-accent-soft text-accent-deep serif text-[20px] flex items-center justify-center shrink-0">{{ c.name.slice(0, 1) }}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-[15px] font-medium text-ink">{{ c.name }}</h3>
              <span class="tag tag-accent">{{ c.type_name }}</span>
            </div>
            <p class="text-[12px] text-ink-2 leading-relaxed mt-1.5">{{ c.description }}</p>
            <div class="flex items-center gap-5 mt-2.5 text-[11px] text-ink-3">
              <span>发起人：{{ c.founder_name }}</span>
              <span v-if="c.teacher_name">指导老师：{{ c.teacher_name }} {{ c.teacher_title }}</span>
              <span>提交于 {{ c.created_at?.slice(0, 10) }}</span>
            </div>
            <p v-if="c.reject_reason" class="text-[11px] text-[#A32D2D] mt-2">上次驳回原因：{{ c.reject_reason }}</p>
          </div>
          <div class="flex gap-2 shrink-0">
            <button class="btn-primary !py-1.5" @click="approve(c)">通过</button>
            <button class="btn-ghost !py-1.5" @click="rejectTarget = c; error = ''">驳回</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 驳回弹窗 -->
    <div v-if="rejectTarget" class="fixed inset-0 bg-black/25 flex items-center justify-center z-50 px-4" @click.self="rejectTarget = null">
      <div class="card w-full max-w-[440px] p-7">
        <h3 class="serif text-[18px] text-ink mb-1">驳回「{{ rejectTarget.name }}」的申请</h3>
        <p class="text-[12px] text-ink-3 mb-4">驳回原因将反馈给发起人，修改后可重新提交</p>
        <textarea v-model="rejectReason" rows="4" class="input resize-none" placeholder="如：社团宗旨与现有社团重复，请补充差异化定位…"></textarea>
        <div class="flex justify-end gap-3 mt-4">
          <button class="btn-ghost" @click="rejectTarget = null">取消</button>
          <button class="btn-primary" @click="reject">确认驳回</button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full z-50">{{ toast }}</div>
  </div>
</template>
