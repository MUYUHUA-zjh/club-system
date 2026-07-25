<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores'

const router = useRouter()
const auth = useAuthStore()
const form = ref({ username: '', password: '', confirm: '', real_name: '', college: '', major: '', grade: '', phone: '', email: '' })
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  const f = form.value
  if (!f.username || !f.password || !f.real_name) { error.value = '学号、密码、姓名为必填项'; return }
  if (f.password.length < 6) { error.value = '密码长度不能少于 6 位'; return }
  if (f.password !== f.confirm) { error.value = '两次输入的密码不一致'; return }
  loading.value = true
  try {
    await auth.register({ username: f.username.trim(), password: f.password, real_name: f.real_name.trim(), college: f.college, major: f.major, grade: f.grade, phone: f.phone, email: f.email })
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-paper flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-[420px]">
      <div class="flex items-center gap-2.5 justify-center mb-8">
        <span class="w-3 h-3 rounded-full bg-accent inline-block"></span>
        <span class="serif text-[22px] text-ink">社团云</span>
      </div>
      <div class="card p-8">
        <h1 class="serif text-[20px] text-ink mb-1">创建账号</h1>
        <p class="text-[12px] text-ink-3 mb-6">注册后即可浏览社团、报名活动</p>
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-1">
            <label class="label">学号 *</label>
            <input v-model="form.username" class="input" placeholder="如 2024007" />
          </div>
          <div class="col-span-1">
            <label class="label">姓名 *</label>
            <input v-model="form.real_name" class="input" placeholder="真实姓名" />
          </div>
          <div class="col-span-1">
            <label class="label">密码 *</label>
            <input v-model="form.password" type="password" class="input" placeholder="至少 6 位" />
          </div>
          <div class="col-span-1">
            <label class="label">确认密码 *</label>
            <input v-model="form.confirm" type="password" class="input" placeholder="再次输入" />
          </div>
          <div class="col-span-1">
            <label class="label">学院</label>
            <input v-model="form.college" class="input" placeholder="如 计算机学院" />
          </div>
          <div class="col-span-1">
            <label class="label">专业</label>
            <input v-model="form.major" class="input" placeholder="如 软件工程" />
          </div>
          <div class="col-span-1">
            <label class="label">年级</label>
            <input v-model="form.grade" class="input" placeholder="如 2024级" />
          </div>
          <div class="col-span-1">
            <label class="label">手机号</label>
            <input v-model="form.phone" class="input" placeholder="选填" />
          </div>
        </div>
        <p v-if="error" class="text-[12px] text-[#A32D2D] bg-[#FCEBEB] rounded-lg px-3 py-2 mt-4">{{ error }}</p>
        <button class="btn-primary w-full !py-2.5 mt-5" :disabled="loading" @click="submit">
          {{ loading ? '注册中…' : '注册并登录' }}
        </button>
      </div>
      <p class="text-center text-[12px] text-ink-3 mt-5">
        已有账号？<router-link to="/login" class="text-accent-deep font-medium hover:underline">直接登录</router-link>
      </p>
    </div>
  </div>
</template>
