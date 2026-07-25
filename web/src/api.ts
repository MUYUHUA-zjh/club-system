import axios from 'axios'

export const api = axios.create({ baseURL: '/api', timeout: 15000 })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res.data,
  err => {
    const message = err.response?.data?.message || '网络异常，请稍后重试'
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      if (location.pathname !== '/login') location.href = '/login'
    }
    return Promise.reject(new Error(message))
  }
)

/* ---- 类型 ---- */
export interface User {
  id: number; username: string; real_name: string; role: 'admin' | 'student'
  student_id?: string; college?: string; major?: string; grade?: string
  gender?: number; phone?: string; email?: string; avatar?: string
}
export interface Club {
  id: number; name: string; type_id: number; type_name?: string; logo?: string
  description?: string; teacher_name?: string; teacher_title?: string
  founder_id: number; founder_name?: string; level: number; member_count: number
  status: number; reject_reason?: string; created_at: string
  my_membership?: { id: number; position: string; status: number } | null
  leaders?: { position: string; real_name: string }[]
  is_manager?: boolean
}
export interface Activity {
  id: number; club_id: number; club_name?: string; title: string; content?: string
  location?: string; start_time: string; end_time: string; sign_deadline: string
  max_num: number; signup_count: number; activity_type: number; status: number
  my_signup?: number; is_manager?: boolean
}
export interface Notice {
  id: number; scope: 'school' | 'club'; club_id?: number; club_name?: string
  title: string; content: string; publisher_name: string; created_at: string; is_read?: number
}
export interface Member {
  id: number; position: string; department?: string; points: number; status: number
  apply_reason?: string; join_time?: string; created_at: string
  real_name: string; student_id: string; college?: string; major?: string; grade?: string
}
export interface UserDir {
  id: number; real_name: string; gender?: number; student_id: string
  college?: string; major?: string; grade?: string; phone?: string
  club_count: number; created_at: string
  friend_status: 'none' | 'pending_sent' | 'pending_received' | 'friend'
}
export interface Friend {
  id: number; real_name: string; college?: string; grade?: string
  relation_id?: number; friend_since?: string
  last_message?: string; last_time?: string; unread?: number
}
export interface FriendRequest {
  id: number; user_id: number; real_name: string; student_id: string
  college?: string; grade?: string; created_at: string
}
export interface ChatMessage {
  id: number; sender_id: number; sender_name: string; content: string; created_at: string
}
export interface AdminUser {
  id: number; username: string; real_name: string; gender?: number; student_id: string
  college?: string; major?: string; grade?: string; phone?: string; email?: string
  role: string; status: number; created_at: string; club_count: number; friend_count: number
}
