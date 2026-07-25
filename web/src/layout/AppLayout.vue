<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores'
import { unreadNotices, unreadMessages, friendRequests, refreshUnread } from '../unread'

const route = useRoute()
const auth = useAuthStore()

const menus = computed(() => {
  const base = [
    { path: '/dashboard', label: '工作台', icon: 'home' },
    { path: '/clubs', label: '社团广场', icon: 'grid' },
    { path: '/activities', label: '活动中心', icon: 'calendar' },
    { path: '/notices', label: '通知公告', icon: 'bell' },
    { path: '/users', label: '我的同学', icon: 'users' },
    { path: '/friends', label: '好友消息', icon: 'chat' }
  ]
  if (auth.isAdmin) {
    base.push({ path: '/stats', label: '数据大盘', icon: 'chart' })
    base.push({ path: '/approvals', label: '审核管理', icon: 'check' })
    base.push({ path: '/admin/users', label: '用户管理', icon: 'shield' })
  }
  base.push({ path: '/profile', label: '个人中心', icon: 'user' })
  return base
})

// 挂载与每次路由切换都刷新未读数，保证红点及时消失
onMounted(refreshUnread)
watch(() => route.path, refreshUnread)

const msgBadge = computed(() => unreadMessages.value + friendRequests.value)
</script>

<template>
  <div class="flex min-h-screen bg-paper">
    <!-- 侧边栏 -->
    <aside class="w-[200px] shrink-0 border-r border-line flex flex-col fixed inset-y-0 bg-paper z-10">
      <div class="flex items-center gap-2 px-5 pt-6 pb-5">
        <span class="w-2.5 h-2.5 rounded-full bg-accent inline-block"></span>
        <span class="serif text-[17px] text-ink">社团云</span>
      </div>
      <nav class="flex-1 px-3 space-y-1 overflow-y-auto">
        <router-link
          v-for="m in menus" :key="m.path" :to="m.path"
          class="nav-item" :class="{ active: route.path === m.path || route.path.startsWith(m.path + '/') }"
        >
          <svg v-if="m.icon === 'home'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>
          <svg v-else-if="m.icon === 'grid'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
          <svg v-else-if="m.icon === 'calendar'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
          <svg v-else-if="m.icon === 'bell'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>
          <svg v-else-if="m.icon === 'users'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3 3.5-4.5 6.5-4.5s5.5 1.5 6.5 4.5"/><path d="M16 5a3.5 3.5 0 0 1 0 6.5M21.5 20c-.5-1.8-1.6-3-3-3.8"/></svg>
          <svg v-else-if="m.icon === 'chat'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/></svg>
          <svg v-else-if="m.icon === 'chart'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>
          <svg v-else-if="m.icon === 'check'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-5"/><circle cx="12" cy="12" r="9"/></svg>
          <svg v-else-if="m.icon === 'shield'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>
          <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/></svg>
          <span class="flex-1">{{ m.label }}</span>
          <span v-if="m.path === '/notices' && unreadNotices > 0" class="text-[10px] bg-accent text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{{ unreadNotices > 99 ? '99+' : unreadNotices }}</span>
          <span v-if="m.path === '/friends' && msgBadge > 0" class="text-[10px] bg-accent text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">{{ msgBadge > 99 ? '99+' : msgBadge }}</span>
        </router-link>
      </nav>
      <div class="px-3 pb-5">
        <div class="flex items-center gap-2.5 px-3 py-3 border-t border-line">
          <span class="w-8 h-8 rounded-full bg-accent text-white text-[12px] flex items-center justify-center font-medium">
            {{ auth.user?.real_name?.slice(0, 1) }}
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-[12px] font-medium text-ink truncate">{{ auth.user?.real_name }}</p>
            <p class="text-[11px] text-ink-3 truncate">{{ auth.isAdmin ? '系统管理员' : auth.user?.student_id }}</p>
          </div>
          <button class="text-ink-3 hover:text-ink transition-colors" title="退出登录" @click="auth.logout()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- 主内容 -->
    <main class="flex-1 ml-[200px] min-w-0">
      <div class="max-w-[960px] mx-auto px-8 py-8">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>
