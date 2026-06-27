const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')

/** Resolve avatar/file URLs — Cloudinary absolute URLs pass through unchanged */
export function resolveMediaUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return `${API_BASE}/${url}`
}

export function resolveAvatarUrl(avatar) {
  return resolveMediaUrl(avatar)
}
