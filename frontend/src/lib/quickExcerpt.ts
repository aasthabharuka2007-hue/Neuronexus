import type { NewsArticle } from '../api/types'

/** When OpenAI is unavailable, show a simple extract (not AI-generated). */
export function quickExcerptFromArticle(body: string, article: NewsArticle): {
  short: string
  bullets: string[]
} {
  const desc = article.description?.trim()
  const sentences = body
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)

  const short =
    desc && desc.length > 40 ? desc : sentences.slice(0, 2).join(' ') || body.slice(0, 400).trim()

  const bullets = (sentences.length ? sentences : [body.slice(0, 200)])
    .slice(0, 6)
    .map((s) => (s.length > 160 ? `${s.slice(0, 157)}…` : s))

  return { short, bullets }
}
