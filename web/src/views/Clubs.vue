<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type Club } from '../api'

const clubs = ref<Club[]>([])
const types = ref<{ id: number; name: string }[]>([])
const keyword = ref('')
const activeType = ref(0)
const loading = ref(true)
const showCreate = ref(false)
const createForm = ref({ name: '', type_id: 1, description: '', teacher_name: '', teacher_title: '' })
const createError = ref('')
const createLoading = ref(false)
const toast = ref('')

async function load() {
  loading.value = true
  try {
    const params: any = {}
    if (activeType.value) params.type_id = activeType.value
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    const res: any = await api.get('/clubs', { params })
    clubs.value = res.data
  } finally {
    loading.value = false
  }
}

async function submitCreate() {
  createError.value = ''
  const f = createForm.value
  if (!f.name.trim() || !f.description.trim()) { createError.value = '社团名称与简介为必填项'; return }
  createLoading.value = true
  try {
    await api.post('/clubs', { ...f, name: f.name.trim(), description: f.description.trim() })
    showCreate.value = false
    toast.value = '社团成立申请已提交，等待团委审核'
    setTimeout(() => (toast.value = ''), 3000)
  } catch (e: any) {
    createError.value = e.message
  } finally {
    createLoading.value = false
  }
}

onMounted(async () => {
  const res: any = await api.get('/clubs/types')
  types.value = res.data
  await load()
})
</script>

<template>
  <div>
    <header class="flex items-end justify-between mb-6">
      <div>
        <h1 class="page-title">社团广场</h1>
        <p class="page-sub">发现感兴趣的社团，开启你的第二课堂</p>
      </div>
      <button class="btn-primary" @click="showCreate = true">+ 申请成立社团</button>
    </header>

    <!-- 筛选 -->
    <div class="flex flex-wrap items-center gap-2 mb-5">
      <button
        class="tag !px-3 !py-1.5 cursor-pointer transition-all"
        :class="activeType === 0 ? 'tag-accent' : 'tag-gray hover:bg-line'"
        @click="activeType = 0; load()"
      >全部</button>
      <button
        v-for="t in types" :key="t.id"
        class="tag !px-3 !py-1.5 cursor-pointer transition-all"
        :class="activeType === t.id ? 'tag-accent' : 'tag-gray hover:bg-line'"
        @click="activeType = t.id; load()"
      >{{ t.name }}</button>
      <div class="flex-1"></div>
      <input v-model="keyword" class="input !w-[220px]" placeholder="搜索社团名称或简介…" @keyup.enter="load" />
    </div>

    <!-- 列表 -->
    <div v-if="loading" class="card p-12 text-center text-ink-3 text-[13px]">加载中…</div>
    <div v-else-if="!clubs.length" class="card p-12 text-center text-ink-3 text-[13px]">没有找到符合条件的社团</div>
    <div v-else class="grid grid-cols-2 gap-4">
      <router-link v-for="c in clubs" :key="c.id" :to="`/clubs/${c.id}`" class="card p-5 hover:border-ink-3 transition-colors group">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <span class="w-11 h-11 rounded-xl bg-accent-soft text-accent-deep serif text-[18px] flex items-center justify-center">{{ c.name.slice(0, 1) }}</span>
            <div>
              <p class="text-[14px] font-medium text-ink group-hover:text-accent-deep transition-colors">{{ c.name }}</p>
              <p class="text-[11px] text-ink-3 mt-0.5">{{ c.type_name }}</p>
            </div>
          </div>
          <div class="flex gap-0.5">
            <svg v-for="i in 5" :key="i" width="12" height="12" viewBox="0 0 24 24" :fill="i <= c.level ? '#D97757' : '#E8E4DB'"><path d="M12 2l3 6.6 7 .8-5.2 4.9 1.4 7-6.2-3.5-6.2 3.5 1.4-7L2 9.4l7-.8z"/></svg>
          </div>
        </div>
        <p class="text-[12px] text-ink-2 leading-relaxed line-clamp-2 mb-3">{{ c.description }}</p>
        <div class="flex items-center justify-between text-[11px] text-ink-3">
          <span>{{ c.member_count }} 名成员</span>
          <span v-if="c.teacher_name">指导老师：{{ c.teacher_name }}</span>
        </div>
      </router-link>
    </div>

    <!-- 申请成立社团弹窗 -->
    <div v-if="showCreate" class="fixed inset-0 bg-black/25 flex items-center justify-center z-50 px-4" @click.self="showCreate = false">
      <div class="card w-full max-w-[480px] p-7">
        <h3 class="serif text-[18px] text-ink mb-1">申请成立社团</h3>
        <p class="text-[12px] text-ink-3 mb-5">提交后由指导老师确认、团委审核，审核通过即正式成立</p>
        <div class="space-y-4">
          <div>
            <label class="label">社团名称 *</label>
            <input v-model="createForm.name" class="input" placeholder="如 人工智能协会" />
          </div>
          <div>
            <label class="label">社团分类 *</label>
            <select v-model="createForm.type_id" class="input">
              <option v-for="t in types" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div>
            <label class="label">社团简介 *</label>
            <textarea v-model="createForm.description" rows="3" class="input resize-none" placeholder="介绍社团宗旨、主要活动方向…"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="label">指导老师</label>
              <input v-model="createForm.teacher_name" class="input" placeholder="姓名" />
            </div>
            <div>
              <label class="label">老师职称</label>
              <input v-model="createForm.teacher_title" class="input" placeholder="如 副教授" />
            </div>
          </div>
          <p v-if="createError" class="text-[12px] text-[#A32D2D] bg-[#FCEBEB] rounded-lg px-3 py-2">{{ createError }}</p>
          <div class="flex justify-end gap-3 pt-1">
            <button class="btn-ghost" @click="showCreate = false">取消</button>
            <button class="btn-primary" :disabled="createLoading" @click="submitCreate">{{ createLoading ? '提交中…' : '提交申请' }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 轻提示 -->
    <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full z-50">{{ toast }}</div>
  </div>
</template>
