import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from './stores'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('./views/Login.vue'), meta: { public: true } },
    { path: '/register', component: () => import('./views/Register.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('./layout/AppLayout.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', component: () => import('./views/Dashboard.vue') },
        { path: 'clubs', component: () => import('./views/Clubs.vue') },
        { path: 'clubs/:id', component: () => import('./views/ClubDetail.vue') },
        { path: 'clubs/:id/manage', component: () => import('./views/ClubManage.vue') },
        { path: 'activities', component: () => import('./views/Activities.vue') },
        { path: 'activities/:id', component: () => import('./views/ActivityDetail.vue') },
        { path: 'notices', component: () => import('./views/Notices.vue') },
        { path: 'users', component: () => import('./views/Users.vue') },
        { path: 'friends', component: () => import('./views/Friends.vue') },
        { path: 'stats', component: () => import('./views/Stats.vue'), meta: { admin: true } },
        { path: 'approvals', component: () => import('./views/AdminApprovals.vue'), meta: { admin: true } },
        { path: 'admin/users', component: () => import('./views/AdminUsers.vue'), meta: { admin: true } },
        { path: 'profile', component: () => import('./views/Profile.vue') }
      ]
    }
  ]
})

router.beforeEach(async to => {
  const auth = useAuthStore()
  if (to.meta.public) return true
  if (!auth.token) return '/login'
  if (!auth.user) {
    try { await auth.fetchMe() } catch { return '/login' }
  }
  if (to.meta.admin && auth.user?.role !== 'admin') return '/dashboard'
  return true
})

export default router
