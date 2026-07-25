<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '../api'

const stats = ref<any>(null)

onMounted(async () => {
  const res: any = await api.get('/stats/overview')
  stats.value = res.data
})
</script>

<template>
  <div>
    <header class="mb-6">
      <h1 class="page-title">数据大盘</h1>
      <p class="page-sub">全校社团运营状态一览</p>
    </header>

    <div v-if="!stats" class="card p-12 text-center text-ink-3 text-[13px]">加载中…</div>
    <template v-else>
      <div class="grid grid-cols-4 gap-3 mb-6">
        <div class="card p-5"><p class="text-[12px] text-ink-3">在册社团</p><p class="serif text-[30px] text-ink mt-1 leading-none">{{ stats.clubs }}</p></div>
        <div class="card p-5"><p class="text-[12px] text-ink-3">注册用户</p><p class="serif text-[30px] text-ink mt-1 leading-none">{{ stats.users }}</p></div>
        <div class="card p-5"><p class="text-[12px] text-ink-3">本月新增活动</p><p class="serif text-[30px] text-ink mt-1 leading-none">{{ stats.monthActivities }}</p></div>
        <div class="card p-5">
          <p class="text-[12px] text-ink-3">待办事项</p>
          <p class="serif text-[30px] text-accent-deep mt-1 leading-none">{{ stats.pendingClubs + stats.pendingMembers }}</p>
          <p class="text-[11px] text-ink-3 mt-1">社团审核 {{ stats.pendingClubs }} · 入社申请 {{ stats.pendingMembers }}</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-5">
        <!-- 分类分布 -->
        <div class="card p-6">
          <h3 class="text-[14px] font-medium text-ink mb-4">社团类型分布</h3>
          <div v-if="!stats.typeDist.length" class="text-ink-3 text-[12px]">暂无数据</div>
          <div v-else class="space-y-3">
            <div v-for="t in stats.typeDist" :key="t.name" class="flex items-center gap-3">
              <span class="w-20 text-[12px] text-ink-2">{{ t.name }}</span>
              <div class="flex-1 h-2.5 rounded-full bg-paper-deep overflow-hidden">
                <div class="h-full bg-accent rounded-full" :style="{ width: Math.round(t.count / stats.clubs * 100) + '%' }"></div>
              </div>
              <span class="w-8 text-right text-[12px] text-ink-3">{{ t.count }}</span>
            </div>
          </div>
        </div>

        <!-- 社团规模排行 -->
        <div class="card p-6">
          <h3 class="text-[14px] font-medium text-ink mb-4">社团规模 TOP 10</h3>
          <div class="space-y-2.5">
            <router-link v-for="(c, i) in stats.topClubs" :key="c.name" to="/clubs" class="flex items-center gap-3 group">
              <span class="w-6 h-6 rounded-md text-[11px] flex items-center justify-center shrink-0"
                :class="i < 3 ? 'bg-accent-soft text-accent-deep font-medium' : 'bg-paper-deep text-ink-3'">{{ i + 1 }}</span>
              <span class="flex-1 text-[13px] text-ink group-hover:text-accent-deep transition-colors truncate">{{ c.name }}</span>
              <span class="text-[11px] text-ink-3">{{ c.type_name }}</span>
              <span class="text-[12px] text-ink-2 w-14 text-right">{{ c.member_count }} 人</span>
            </router-link>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
