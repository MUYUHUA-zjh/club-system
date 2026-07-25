<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores'

const router = useRouter()
const auth = useAuthStore()
const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  error.value = ''
  if (!username.value || !password.value) { error.value = '请输入学号和密码'; return }
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-paper flex items-center justify-center px-4">
    <div class="w-full max-w-[380px]">
      <div class="flex items-center gap-2.5 justify-center mb-10">
        <span class="w-3 h-3 rounded-full bg-accent inline-block"></span>
        <span class="serif text-[22px] text-ink">社团云</span>
      </div>
      <div class="card p-8">
        <h1 class="serif text-[20px] text-ink mb-1">欢迎回来</h1>
        <p class="text-[12px] text-ink-3 mb-6">使用学号登录大学社团管理系统</p>
        <div class="space-y-4">
          <div>
            <label class="label">学号</label>
            <input v-model="username" class="input" placeholder="请输入学号" @keyup.enter="submit" />
          </div>
          <div>
            <label class="label">密码</label>
            <input v-model="password" type="password" class="input" placeholder="请输入密码" @keyup.enter="submit" />
          </div>
          <p v-if="error" class="text-[12px] text-[#A32D2D] bg-[#FCEBEB] rounded-lg px-3 py-2">{{ error }}</p>
          <button class="btn-primary w-full !py-2.5" :disabled="loading" @click="submit">
            {{ loading ? '登录中…' : '登 录' }}
          </button>
        </div>
      </div>
      <p class="text-center text-[12px] text-ink-3 mt-5">
        还没有账号？<router-link to="/register" class="text-accent-deep font-medium hover:underline">立即注册</router-link>
      </p>
      <p class="text-center text-[11px] text-ink-3 mt-2">演示账号：admin / admin123（管理员）· 2024001 / 123456（学生）</p>
    </div>
  </div>
</template>
