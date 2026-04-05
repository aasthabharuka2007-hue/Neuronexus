import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as api from '../api/client'
import { HttpApiError } from '../api/client'
import type { NewsArticle, SummarizeResponse } from '../api/types'
import { useApp } from '../context/AppContext'
import { speakWithBrowserTts } from '../lib/browserTts'
import { quickExcerptFromArticle } from '../lib/quickExcerpt'

function articleBody(a: NewsArticle): string {
  const c = a.content?.replace(/\[\+\d+ chars\]/, '').trim()
  if (c && c.length > 40) return c
  const d = a.description?.trim()
  if (d) return d
  return a.title
}

export function Article() {
  const loc = useLocation()
  const navigate = useNavigate()
  const { userId, language, voice } = useApp()
  const article = loc.state?.article as NewsArticle | undefined

  const [summary, setSummary] = useState<SummarizeResponse | null>(null)
  const [sumLoading, setSumLoading] = useState(false)
  const [sumErr, setSumErr] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioLoading, setAudioLoading] = useState(false)
  const [ttsFallbackHint, setTtsFallbackHint] = useState<string | null>(null)
  const [offlinePreview, setOfflinePreview] = useState<{ short: string; bullets: string[] } | null>(null)

  const text = useMemo(() => (article ? articleBody(article) : ''), [article])

  useEffect(() => {
    if (!article) navigate('/', { replace: true })
  }, [article, navigate])

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [audioUrl])

  if (!article) return null

  const runSummarize = async () => {
    setSumLoading(true)
    setSumErr(null)
    setOfflinePreview(null)
    try {
      const s = await api.summarizeArticle(text, language, userId)
      setSummary(s)
    } catch (e) {
      if (e instanceof HttpApiError && e.status === 429) {
        setSumErr(e.message)
        setOfflinePreview(quickExcerptFromArticle(text, article))
      } else {
        setSumErr(e instanceof Error ? e.message : 'Summary failed')
      }
    } finally {
      setSumLoading(false)
    }
  }

  const playSummaryAudio = async () => {
    const t = summary?.short_summary || text
    setAudioLoading(true)
    setTtsFallbackHint(null)
    try {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioUrl(null)
      const blob = await api.fetchTts(t.slice(0, 4000), language, voice, userId)
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
    } catch (apiErr) {
      try {
        if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
        await speakWithBrowserTts(t, language)
        setTtsFallbackHint(
          'OpenAI voice unavailable — playing with your browser’s text-to-speech. Add billing at platform.openai.com for higher-quality audio.'
        )
      } catch {
        setSumErr(
          apiErr instanceof Error
            ? apiErr.message
            : 'Audio failed. Check OpenAI quota or use a browser with speech support.'
        )
      }
    } finally {
      setAudioLoading(false)
    }
  }

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <Link
        to="/"
        className="inline-flex text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
      >
        ← Back to headlines
      </Link>

      {article.url_to_image && (
        <img
          src={article.url_to_image}
          alt=""
          className="max-h-80 w-full rounded-2xl object-cover shadow-lg"
        />
      )}

      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {article.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500">
          {article.source_name && <span>{article.source_name}</span>}
          {article.published_at && <span>{new Date(article.published_at).toLocaleString()}</span>}
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          Open original source →
        </a>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Article text</h2>
        <p className="mt-3 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{text}</p>
        <button
          type="button"
          onClick={runSummarize}
          disabled={sumLoading}
          className="mt-4 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-60"
        >
          {sumLoading ? 'Summarizing…' : 'Generate AI summary'}
        </button>
        {sumErr && (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">{sumErr}</p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-violet-700 underline dark:text-violet-300"
              >
                Gemini API keys (free tier) →
              </a>
              <a
                href="https://platform.openai.com/account/billing"
                target="_blank"
                rel="noreferrer"
                className="font-medium text-violet-700 underline dark:text-violet-300"
              >
                OpenAI billing →
              </a>
            </div>
          </div>
        )}
      </section>

      {offlinePreview && !summary && (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Basic extract (not AI)</h2>
          <p className="text-xs text-slate-500">
            Shown while OpenAI is unavailable — first lines from the article only.
          </p>
          <p className="text-slate-800 dark:text-slate-200">{offlinePreview.short}</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {offlinePreview.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      )}

      {summary && (
        <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/80 p-6 dark:border-violet-900 dark:bg-violet-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">AI summary</h2>
            <button
              type="button"
              onClick={playSummaryAudio}
              disabled={audioLoading}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-violet-600"
            >
              {audioLoading ? 'Loading audio…' : 'Play summary audio'}
            </button>
          </div>
          {ttsFallbackHint && (
            <p className="text-sm text-amber-800 dark:text-amber-200">{ttsFallbackHint}</p>
          )}
          {summary.cached && (
            <p className="text-xs text-slate-500">Served from cache</p>
          )}
          <div>
            <h3 className="text-sm font-medium text-violet-800 dark:text-violet-300">Short</h3>
            <p className="mt-1 text-slate-800 dark:text-slate-200">{summary.short_summary}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-violet-800 dark:text-violet-300">Bullets</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-slate-800 dark:text-slate-200">
              {summary.bullet_points.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-violet-800 dark:text-violet-300">Simplified</h3>
            <p className="mt-1 text-slate-800 dark:text-slate-200">{summary.simplified_explanation}</p>
          </div>
          {audioUrl && (
            <audio
              key={audioUrl}
              controls
              className="mt-2 w-full"
              src={audioUrl}
            >
              <track kind="captions" />
            </audio>
          )}
        </section>
      )}
    </article>
  )
}
