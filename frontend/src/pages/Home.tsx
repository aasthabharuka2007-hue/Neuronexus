import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api/client'
import type { NewsArticle } from '../api/types'
import { useApp } from '../context/AppContext'
import { useTts } from '../hooks/useTts'
import { SkeletonCard } from '../components/SkeletonCard'

const CATEGORIES = [
  { value: '', label: 'All (top)' },
  { value: 'business', label: 'Business' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'general', label: 'General' },
  { value: 'health', label: 'Health' },
  { value: 'science', label: 'Science' },
  { value: 'sports', label: 'Sports' },
  { value: 'technology', label: 'Technology' },
]

function previewText(a: NewsArticle): string {
  const parts = [a.title, a.description].filter(Boolean)
  return parts.join('. ').slice(0, 1200)
}

function NewsCard({ article, onOpen }: { article: NewsArticle; onOpen: (a: NewsArticle) => void }) {
  const { userId, language, voice } = useApp()
  const { speak, loading, error, fallbackHint, stop } = useTts(userId, language, voice)

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-900">
      <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
        {article.url_to_image ? (
          <img
            src={article.url_to_image}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">No image</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="line-clamp-2 text-left text-base font-semibold text-slate-900 dark:text-slate-100">
          {article.title}
        </h2>
        {article.source_name && (
          <p className="mt-1 text-left text-xs text-violet-600 dark:text-violet-400">{article.source_name}</p>
        )}
        {article.description && (
          <p className="mt-2 line-clamp-3 flex-1 text-left text-sm text-slate-600 dark:text-slate-400">
            {article.description}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpen(article)}
            className="flex-1 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-500 min-[400px]:flex-none"
          >
            Summary
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => speak(previewText(article))}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-violet-300 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 min-[400px]:flex-none"
          >
            {loading ? '…' : 'Play audio'}
          </button>
          <button
            type="button"
            onClick={stop}
            className="rounded-xl border border-transparent px-2 py-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Stop
          </button>
        </div>
        {fallbackHint && (
          <p className="mt-2 text-left text-xs text-amber-700 dark:text-amber-300">{fallbackHint}</p>
        )}
        {error && <p className="mt-2 text-left text-xs text-red-600">{error}</p>}
      </div>
    </article>
  )
}

export function Home() {
  const navigate = useNavigate()
  const { favoriteCategories, language } = useApp()
  const [country, setCountry] = useState('us')
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [articles, setArticles] = useState<NewsArticle[]>([])
  const [relaxedFilters, setRelaxedFilters] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  /** Apply saved favorite category once when prefs load — do not treat '' (All) as falsy and re-apply. */
  const appliedFavoriteCategory = useRef(false)
  useEffect(() => {
    if (appliedFavoriteCategory.current) return
    const first = favoriteCategories.split(',')[0]?.trim().toLowerCase()
    if (first && CATEGORIES.some((c) => c.value === first)) {
      setCategory(first)
      appliedFavoriteCategory.current = true
    }
  }, [favoriteCategories])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const res = await api.fetchNews({
          country,
          category: category || undefined,
          keyword: keyword || undefined,
        })
        if (!cancelled) {
          setArticles(res.articles)
          setRelaxedFilters(Boolean(res.relaxed_filters))
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load news')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [country, category, keyword])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
          Today&apos;s headlines
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">
          Summarize with AI, listen in {language === 'en' ? 'English' : language === 'hi' ? 'Hindi' : 'Marathi'}.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/60 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Country</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          >
            {[
              { code: 'us', label: 'United States (US)' },
              { code: 'in', label: 'India (IN)' },
              { code: 'gb', label: 'United Kingdom (GB)' },
              { code: 'au', label: 'Australia (AU)' },
              { code: 'ca', label: 'Canada (CA)' },
            ].map(({ code, label }) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value || 'all'} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
          <span className="text-slate-500">Keyword</span>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search…"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      {!loading && relaxedFilters && articles.length > 0 && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          No exact match for your category or keyword in this country — showing top headlines for{' '}
          <strong>{country.toUpperCase()}</strong> only. Choose &quot;All (top)&quot; or clear the keyword to
          match what you see.
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : articles.map((a, idx) => (
              <NewsCard
                key={`${a.url}-${idx}`}
                article={a}
                onOpen={(art) => navigate('/article', { state: { article: art } })}
              />
            ))}
      </div>

      {!loading && articles.length === 0 && !err && (
        <div className="mx-auto max-w-lg space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">No stories available right now.</p>
          <p className="text-amber-900/90 dark:text-amber-200/90">
            NewsAPI returned no articles for this request (even after fallbacks). Try another country, clear
            filters, or confirm your plan allows the &quot;everything&quot; endpoint. Restart the backend after
            updating code so the latest fallbacks run.
          </p>
        </div>
      )}
    </div>
  )
}
