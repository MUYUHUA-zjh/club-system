import { ref } from 'vue'
import { api } from './api'

/** 全局未读状态：通知公告 + 好友消息/申请 */
export const unreadNotices = ref(0)
export const unreadMessages = ref(0)
export const friendRequests = ref(0)

export async function refreshUnread() {
  try {
    const [n, m]: any[] = await Promise.all([
      api.get('/notices/unread/count'),
      api.get('/messages/unread/count')
    ])
    unreadNotices.value = n.data.count
    unreadMessages.value = m.data.count
    friendRequests.value = m.data.requests
  } catch { /* 未登录或网络异常时静默 */ }
}

/** 阅读通知后本地递减，避免整页刷新 */
export function markNoticeRead() {
  if (unreadNotices.value > 0) unreadNotices.value--
}
