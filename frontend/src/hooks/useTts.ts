import { useCallback, useRef, useState } from 'react'
import * as api from '../api/client'
import type { LanguageCode } from '../api/types'
import { speakWithBrowserTts } from '../lib/browserTts'

export function useTts(userId: string, language: LanguageCode, voice: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallbackHint, setFallbackHint] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    setFallbackHint(null)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      stop()
      if (!text.trim()) return
      setLoading(true)
      setError(null)
      setFallbackHint(null)
      try {
        const blob = await api.fetchTts(text.slice(0, 4000), language, voice, userId)
        const url = URL.createObjectURL(blob)
        urlRef.current = url
        const audio = new Audio(url)
        audioRef.current = audio
        await audio.play()
        audio.onended = () => stop()
      } catch (apiErr) {
        try {
          await speakWithBrowserTts(text, language)
          setFallbackHint(
            'OpenAI voice unavailable (quota or network). Using your browser’s built-in speech instead.'
          )
        } catch {
          setError(
            apiErr instanceof Error
              ? apiErr.message
              : 'TTS failed. Add billing at platform.openai.com or use a browser that supports speech.'
          )
        }
      } finally {
        setLoading(false)
      }
    },
    [language, voice, userId, stop]
  )

  return { speak, stop, loading, error, fallbackHint }
}
