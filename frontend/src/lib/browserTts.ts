import type { LanguageCode } from '../api/types'

const LANG_MAP: Record<LanguageCode, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  mr: 'mr-IN',
}

/** Wait for Chrome/Edge to load voices (often empty on first call). */
function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis
    const list = synth.getVoices()
    if (list.length > 0) {
      resolve(list)
      return
    }
    const done = () => {
      synth.removeEventListener('voiceschanged', done)
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', done)
    setTimeout(done, 300)
  })
}

/**
 * Free fallback when OpenAI TTS fails (quota, network, etc.).
 * Uses the browser's built-in text-to-speech.
 */
export async function speakWithBrowserTts(text: string, language: LanguageCode): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    throw new Error('This browser does not support speech synthesis.')
  }
  const trimmed = text.trim()
  if (!trimmed) throw new Error('No text to speak.')

  const lang = LANG_MAP[language]
  window.speechSynthesis.cancel()

  const voices = await voicesReady()
  const u = new SpeechSynthesisUtterance(trimmed.slice(0, 8000))
  u.lang = lang
  u.rate = 1
  const prefix = lang.split('-')[0]?.toLowerCase() ?? 'en'
  const match =
    voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase())) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix))
  if (match) u.voice = match

  return new Promise((resolve, reject) => {
    u.onend = () => resolve()
    u.onerror = (ev) => reject(new Error((ev as SpeechSynthesisErrorEvent).error ?? 'speech error'))
    window.speechSynthesis.speak(u)
  })
}
