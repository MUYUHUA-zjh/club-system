import { defineStore } from 'pinia'
import { api, type User } from './api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: null as User | null
  }),
  getters: {
    isAdmin: s => s.user?.role === 'admin'
  },
  actions: {
    async login(username: string, password: string) {
      const res: any = await api.post('/auth/login', { username, password })
      this.token = res.data.token
      this.user = res.data.user
      localStorage.setItem('token', this.token)
    },
    async register(payload: Record<string, any>) {
      const res: any = await api.post('/auth/register', payload)
      this.token = res.data.token
      this.user = res.data.user
      localStorage.setItem('token', this.token)
    },
    async fetchMe() {
      const res: any = await api.get('/auth/me')
      this.user = res.data
    },
    logout() {
      this.token = ''
      this.user = null
      localStorage.removeItem('token')
      location.href = '/login'
    }
  }
})
