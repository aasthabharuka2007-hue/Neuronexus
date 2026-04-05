import { useState } from 'react'
import * as api from '../api/client'
import { useApp } from '../context/AppContext'
import type { LanguageCode } from '../api/types'

export function Upload() {
  const { userId, language } = useApp()
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [vidFile, setVidFile] = useState<File | null>(null)
  const [vidLang, setVidLang] = useState<LanguageCode>(language)
  const [imgResult, setImgResult] = useState<Awaited<ReturnType<typeof api.analyzeImage>> | null>(null)
  const [vidResult, setVidResult] = useState<Awaited<ReturnType<typeof api.analyzeVideo>> | null>(null)
  const [imgLoading, setImgLoading] = useState(false)
  const [vidLoading, setVidLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onImage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!imgFile) return
    setErr(null)
    setImgLoading(true)
    setImgResult(null)
    try {
      const r = await api.analyzeImage(imgFile, userId)
      setImgResult(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Image analysis failed')
    } finally {
      setImgLoading(false)
    }
  }

  const onVideo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vidFile) return
    setErr(null)
    setVidLoading(true)
    setVidResult(null)
    try {
      const r = await api.analyzeVideo(vidFile, vidLang, userId)
      setVidResult(r)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Video analysis failed')
    } finally {
      setVidLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900 dark:text-white">
          Upload media
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Images: vision description, OCR, and meaning. Videos: extract speech, transcribe with Whisper, then
          summarize.
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </div>
      )}

      <form onSubmit={onImage} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Image analysis</h2>
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(e) => setImgFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
        <button
          type="submit"
          disabled={!imgFile || imgLoading}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {imgLoading ? 'Analyzing…' : 'Analyze image'}
        </button>
        {imgResult && (
          <div className="mt-4 space-y-3 text-left text-sm">
            <div>
              <h3 className="font-medium text-violet-700 dark:text-violet-400">Description</h3>
              <p className="text-slate-700 dark:text-slate-300">{imgResult.description}</p>
            </div>
            <div>
              <h3 className="font-medium text-violet-700 dark:text-violet-400">Extracted text</h3>
              <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{imgResult.extracted_text}</p>
            </div>
            <div>
              <h3 className="font-medium text-violet-700 dark:text-violet-400">Summary</h3>
              <p className="text-slate-700 dark:text-slate-300">{imgResult.summary_meaning}</p>
            </div>
          </div>
        )}
      </form>

      <form onSubmit={onVideo} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Video analysis</h2>
        <p className="text-xs text-slate-500">
          Requires <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">ffmpeg</code> on the server.
          Large files may take several minutes.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span>Summary language</span>
          <select
            value={vidLang}
            onChange={(e) => setVidLang(e.target.value as LanguageCode)}
            className="max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="mr">Marathi</option>
          </select>
        </label>
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
          onChange={(e) => setVidFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm"
        />
        <button
          type="submit"
          disabled={!vidFile || vidLoading}
          className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {vidLoading ? 'Processing video…' : 'Analyze video'}
        </button>
        {vidResult && (
          <div className="mt-4 space-y-3 text-left text-sm">
            <div>
              <h3 className="font-medium text-violet-700 dark:text-violet-400">Transcript</h3>
              <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{vidResult.transcript}</p>
            </div>
            <div>
              <h3 className="font-medium text-violet-700 dark:text-violet-400">Summary</h3>
              <p className="text-slate-700 dark:text-slate-300">{vidResult.short_summary}</p>
            </div>
            <ul className="list-inside list-disc text-slate-700 dark:text-slate-300">
              {vidResult.bullet_points.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <p className="text-slate-700 dark:text-slate-300">{vidResult.simplified_explanation}</p>
          </div>
        )}
      </form>
    </div>
  )
}
