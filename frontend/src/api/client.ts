/**
 * API base: use VITE_API_URL in production (e.g. https://api.example.com).
 * Dev uses Vite proxy — empty string hits same origin.
 */
const BASE = import.meta.env.VITE_API_URL ?? ''

import type {
  AnalyzeImageResponse,
  AnalyzeVideoResponse,
  LanguageCode,
  NewsListResponse,
  PreferencesOut,
  SummarizeResponse,
} from './types'

function headers(userId: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
  }
}

/** Thrown for non-2xx API responses so callers can branch on `status` (e.g. 429 quota). */
export class HttpApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'HttpApiError'
  }
}

/** Parse FastAPI { detail: string | ValidationError[] } for display. */
function httpErrorDetail(res: Response, raw: string): string {
  try {
    const j = JSON.parse(raw) as { detail?: string | Array<{ msg?: string }> }
    if (typeof j.detail === 'string') return j.detail
    if (Array.isArray(j.detail)) {
      const parts = j.detail.map((d) => d.msg).filter(Boolean)
      if (parts.length) return parts.join('; ')
    }
  } catch {
    /* ignore */
  }
  return raw.slice(0, 500) || `Request failed (${res.status})`
}

export async function fetchNews(params: {
  category?: string
  country?: string
  keyword?: string
}): Promise<NewsListResponse> {
  const q = new URLSearchParams()
  if (params.category) q.set('category', params.category)
  // Always send country (avoid omitting — backend defaults to us and NewsAPI needs a region context).
  q.set('country', params.country ?? 'us')
  if (params.keyword) q.set('keyword', params.keyword)
  const url = `${BASE}/news?${q.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    const raw = await res.text()
    throw new Error(httpErrorDetail(res, raw))
  }
  return res.json()
}

export async function summarizeArticle(
  text: string,
  language: LanguageCode,
  userId: string
): Promise<SummarizeResponse> {
  const res = await fetch(`${BASE}/summarize`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify({ text, language }),
  })
  if (!res.ok) {
    const raw = await res.text()
    throw new HttpApiError(res.status, httpErrorDetail(res, raw))
  }
  return res.json()
}

export async function fetchTts(
  text: string,
  language: LanguageCode,
  voice: string,
  userId: string
): Promise<Blob> {
  const res = await fetch(`${BASE}/tts`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify({ text, language, voice }),
  })
  if (!res.ok) {
    const raw = await res.text()
    throw new Error(httpErrorDetail(res, raw))
  }
  const blob = await res.blob()
  if (blob.size < 100) {
    throw new Error('TTS returned an empty or invalid audio file.')
  }
  return blob
}

export async function analyzeImage(file: File, userId: string): Promise<AnalyzeImageResponse> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch(`${BASE}/analyze-image`, {
    method: 'POST',
    headers: { 'X-User-Id': userId },
    body: fd,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function analyzeVideo(
  file: File,
  language: LanguageCode,
  userId: string
): Promise<AnalyzeVideoResponse> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('language', language)
  const res = await fetch(`${BASE}/analyze-video`, {
    method: 'POST',
    headers: { 'X-User-Id': userId },
    body: fd,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getPreferences(userId: string): Promise<PreferencesOut> {
  const res = await fetch(`${BASE}/preferences/${encodeURIComponent(userId)}`, {
    headers: { 'X-User-Id': userId },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function putPreferences(
  userId: string,
  body: {
    preferred_language: LanguageCode
    favorite_categories: string | null
    voice_id: string
    theme: 'light' | 'dark' | 'system'
  }
): Promise<PreferencesOut> {
  const res = await fetch(`${BASE}/preferences/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: headers(userId),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
