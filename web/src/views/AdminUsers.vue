<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api, type AdminUser } from '../api'

const users = ref<AdminUser[]>([])
const filters = ref<{ grades: string[]; colleges: string[]; majors: string[] }>({ grades: [], colleges: [], majors: [] })
const keyword = ref('')
const grade = ref('')
const college = ref('')
const major = ref('')
const loading = ref(true)
const toast = ref('')
const detail = ref<AdminUser | null>(null)

function showToast(msg: string) { toast.value = msg; setTimeout(() => (toast.value = ''), 3000) }

async function load() {
  loading.value = true
  try {
    const params: any = {}
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (grade.value) params.grade = grade.value
    if (college.value) params.college = college.value
    if (major.value) params.major = major.value
    const res: any = await api.get('/admin/users', { params })
    users.value = res.data
  } finally {
    loading.value = false
  }
}

async function toggleStatus(u: AdminUser) {
  const action = u.status === 1 ? '禁用' : '启用'
  if (!confirm(`确定${action}账号「${u.real_name}（${u.student_id}）」吗？${u.status === 1 ? '禁用后该用户将无法登录。' : ''}`)) return
  try {
    await api.put(`/admin/users/${u.id}/status`, { status: u.status === 1 ? 0 : 1 })
    u.status = u.status === 1 ? 0 : 1
    showToast(`已${action} ${u.real_name} 的账号`)
  } catch (e: any) { showToast(e.message) }
}

async function resetPassword(u: AdminUser) {
  if (!confirm(`确定将 ${u.real_name} 的密码重置为 123456 吗？`)) return
  try {
    await api.post(`/admin/users/${u.id}/reset-password`)
    showToast(`已将 ${u.real_name} 的密码重置为 123456`)
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
      <h1 class="page-title">用户管理</h1>
      <p class="page-sub">全校注册用户档案与账号管理，共 {{ users.length }} 人</p>
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
    </div>

    <div v-if="loading" class="card p-12 text-center text-ink-3 text-[13px]">加载中…</div>
    <div v-else-if="!users.length" class="card p-12 text-center text-ink-3 text-[13px]">没有找到符合条件的用户</div>
    <div v-else class="card overflow-hidden">
      <table class="w-full text-[13px]">
        <thead>
          <tr class="text-left text-[11px] text-ink-3 border-b border-line bg-paper">
            <th class="px-5 py-3 font-medium">用户</th>
            <th class="py-3 font-medium">学院 / 专业 / 年级</th>
            <th class="py-3 font-medium">联系方式</th>
            <th class="py-3 font-medium">社团</th>
            <th class="py-3 font-medium">状态</th>
            <th class="py-3 px-5 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-b border-line-soft last:border-0 hover:bg-paper transition-colors">
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-full text-[11px] flex items-center justify-center shrink-0"
                  :class="u.gender === 2 ? 'bg-[#FBEAF0] text-[#993556]' : 'bg-accent-soft text-accent-deep'">{{ u.real_name.slice(0, 1) }}</span>
                <div>
                  <p class="text-ink">{{ u.real_name }}</p>
                  <p class="text-[11px] text-ink-3">{{ u.student_id }}</p>
                </div>
              </div>
            </td>
            <td class="py-3.5 text-ink-2 text-[12px]">{{ u.college || '—' }}<template v-if="u.major"> / {{ u.major }}</template> / {{ u.grade || '—' }}</td>
            <td class="py-3.5 text-ink-2 text-[12px]">{{ u.phone || '—' }}</td>
            <td class="py-3.5 text-ink-2 text-[12px]">{{ u.club_count }} 个</td>
            <td class="py-3.5">
              <span class="tag" :class="u.status === 1 ? 'tag-green' : 'tag-red'">{{ u.status === 1 ? '正常' : '已禁用' }}</span>
            </td>
            <td class="py-3.5 px-5 text-right">
              <div class="flex gap-2 justify-end">
                <button class="btn-ghost !py-1 !px-2.5 !text-[12px]" @click="detail = u">详情</button>
                <button class="btn-ghost !py-1 !px-2.5 !text-[12px]" @click="resetPassword(u)">重置密码</button>
                <button class="btn-danger !py-1" @click="toggleStatus(u)">{{ u.status === 1 ? '禁用' : '启用' }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="detail" class="fixed inset-0 bg-black/25 flex items-center justify-center z-50 px-4" @click.self="detail = null">
      <div class="card w-full max-w-[440px] p-7">
        <div class="flex items-center gap-4 mb-5">
          <span class="w-12 h-12 rounded-full bg-accent-soft text-accent-deep text-[16px] flex items-center justify-center">{{ detail.real_name.slice(0, 1) }}</span>
          <div>
            <h3 class="serif text-[18px] text-ink">{{ detail.real_name }}</h3>
            <p class="text-[11px] text-ink-3">{{ detail.student_id }} · 注册于 {{ detail.created_at?.slice(0, 10) }}</p>
          </div>
        </div>
        <div class="space-y-2.5 text-[13px]">
          <p class="flex justify-between"><span class="text-ink-3">学院 / 专业</span><span class="text-ink">{{ detail.college || '—' }} / {{ detail.major || '—' }}</span></p>
          <p class="flex justify-between"><span class="text-ink-3">年级</span><span class="text-ink">{{ detail.grade || '—' }}</span></p>
          <p class="flex justify-between"><span class="text-ink-3">手机号</span><span class="text-ink">{{ detail.phone || '—' }}</span></p>
          <p class="flex justify-between"><span class="text-ink-3">邮箱</span><span class="text-ink">{{ detail.email || '—' }}</span></p>
          <p class="flex justify-between"><span class="text-ink-3">加入社团数</span><span class="text-ink">{{ detail.club_count }}</span></p>
          <p class="flex justify-between"><span class="text-ink-3">好友数</span><span class="text-ink">{{ detail.friend_count }}</span></p>
        </div>
        <div class="flex justify-end mt-6"><button class="btn-ghost" @click="detail = null">关闭</button></div>
      </div>
    </div>

    <div v-if="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 bg-ink text-white text-[13px] px-5 py-2.5 rounded-full z-50">{{ toast }}</div>
  </div>
</template>
