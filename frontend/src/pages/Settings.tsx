import { useState } from 'react'
import { useApp } from '../context/AppContext'
import type { LanguageCode } from '../api/types'

const VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const

export function Settings() {
  const {
    userId,
    language,
    setLanguage,
    voice,
    setVoice,
    favoriteCategories,
    setFavoriteCategories,
    theme,
    setTheme,
    savePreferences,
    refreshPreferences,
  } = useApp()
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const onSave = async () => {
    setErr(null)
    setSaved(false)
    try {
      await savePreferences()
      setSaved(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-slate-900 dark:text-white">
          Settings
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Preferences sync to the server. Your anonymous ID:{' '}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">{userId}</code>
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Preferred language (summaries &amp; TTS)</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageCode)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="mr">Marathi</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">TTS voice</span>
          <select
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          >
            {VOICES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Favorite categories (comma-separated NewsAPI slugs)
          </span>
          <input
            value={favoriteCategories}
            onChange={(e) => setFavoriteCategories(e.target.value)}
            placeholder="technology, science"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          />
          <span className="text-xs text-slate-500">
            e.g. business, entertainment, general, health, science, sports, technology
          </span>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Theme</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-500"
          >
            Save preferences
          </button>
          <button
            type="button"
            onClick={() => void refreshPreferences()}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-800 dark:border-slate-700 dark:text-slate-200"
          >
            Reload from server
          </button>
        </div>
        {saved && <p className="text-sm text-green-600 dark:text-green-400">Saved.</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </div>
    </div>
  )
}
