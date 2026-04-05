const KEY = 'voice-news-user-id'

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `u_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`
}

export function getOrCreateUserId(): string {
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = randomId()
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return randomId()
  }
}
