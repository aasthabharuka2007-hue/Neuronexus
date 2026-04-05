import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import * as api from '../api/client'
import type { LanguageCode } from '../api/types'
import { getOrCreateUserId } from '../lib/userId'

export type ThemeMode = 'light' | 'dark' | 'system'

type AppState = {
  userId: string
  language: LanguageCode
  voice: string
  favoriteCategories: string
  theme: ThemeMode
  setLanguage: (l: LanguageCode) => void
  setVoice: (v: string) => void
  setFavoriteCategories: (s: string) => void
  setTheme: (t: ThemeMode) => void
  applyThemeToDom: (t: ThemeMode) => void
  refreshPreferences: () => Promise<void>
  savePreferences: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

function applyDomTheme(theme: ThemeMode) {
  const root = document.documentElement
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [userId] = useState(getOrCreateUserId)
  const [language, setLanguageState] = useState<LanguageCode>('en')
  const [voice, setVoiceState] = useState('alloy')
  const [favoriteCategories, setFavoriteCategoriesState] = useState('')
  const [theme, setThemeState] = useState<ThemeMode>('system')

  const applyThemeToDom = useCallback((t: ThemeMode) => {
    applyDomTheme(t)
  }, [])

  useEffect(() => {
    applyDomTheme(theme)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme === 'system') applyDomTheme('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const refreshPreferences = useCallback(async () => {
    try {
      const p = await api.getPreferences(userId)
      setLanguageState(p.preferred_language)
      setVoiceState(p.voice_id)
      setFavoriteCategoriesState(p.favorite_categories ?? '')
      setThemeState(p.theme)
      applyDomTheme(p.theme)
    } catch {
      /* defaults */
    }
  }, [userId])

  useEffect(() => {
    void refreshPreferences()
  }, [refreshPreferences])

  const setLanguage = useCallback((l: LanguageCode) => setLanguageState(l), [])
  const setVoice = useCallback((v: string) => setVoiceState(v), [])
  const setFavoriteCategories = useCallback((s: string) => setFavoriteCategoriesState(s), [])
  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t)
    applyDomTheme(t)
  }, [])

  const savePreferences = useCallback(async () => {
    await api.putPreferences(userId, {
      preferred_language: language,
      favorite_categories: favoriteCategories.trim() || null,
      voice_id: voice,
      theme,
    })
  }, [userId, language, favoriteCategories, voice, theme])

  const value = useMemo(
    () => ({
      userId,
      language,
      voice,
      favoriteCategories,
      theme,
      setLanguage,
      setVoice,
      setFavoriteCategories,
      setTheme,
      applyThemeToDom,
      refreshPreferences,
      savePreferences,
    }),
    [
      userId,
      language,
      voice,
      favoriteCategories,
      theme,
      setLanguage,
      setVoice,
      setFavoriteCategories,
      setTheme,
      applyThemeToDom,
      refreshPreferences,
      savePreferences,
    ]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside AppProvider')
  return v
}
