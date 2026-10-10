/**
 * Voice for the Experience interview, ported from the Hack am Rhein frontend (lib/voice.ts).
 * ElevenLabs runs through the backend, which holds the keys. Without it, or if the network fails during a demo,
 * the browser's own speech recognition and speech output take over.
 */
import { api } from './api'
import type { AiStatus } from './types'

let status: Promise<AiStatus | null> | null = null

/** Which model and voice services the backend has keys for (asked once per visit). */
export function aiStatus(): Promise<AiStatus | null> {
  status ??= api.aiStatus().catch(() => null)
  return status
}

/* ----------------------------- Voice in ----------------------------- */

interface BrowserRecognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export function browserRecognition(): BrowserRecognition | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserRecognition
    webkitSpeechRecognition?: new () => BrowserRecognition
  }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  if (!Ctor) return null
  const recognition = new Ctor()
  recognition.lang = navigator.language || 'de-CH'
  recognition.interimResults = false
  recognition.continuous = true
  return recognition
}

/* ----------------------------- Voice out ---------------------------- */

let current: HTMLAudioElement | null = null

export function stopSpeaking() {
  current?.pause()
  current = null
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

const looksGerman = (text: string) => /\b(der|die|das|und|nicht|wie|ist|Sie|für|mit)\b|[äöüß]/i.test(text)

/** Reads the text aloud and resolves when playback ends. */
export async function speak(tid: string, text: string): Promise<void> {
  stopSpeaking()
  if ((await aiStatus())?.voice.speak) {
    try {
      const url = URL.createObjectURL(await api.speak(tid, text))
      const audio = new Audio(url)
      current = audio
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve()
        audio.onpause = () => resolve()
        audio.onerror = () => reject(new Error('Audio playback failed'))
        audio.play().catch(reject)
      }).finally(() => URL.revokeObjectURL(url))
      return
    } catch {
      // fall through to the browser's own voice
    }
  }
  if (!('speechSynthesis' in window)) return
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = looksGerman(text) ? 'de-CH' : 'en-GB'
    u.onend = () => resolve()
    u.onerror = () => resolve()
    window.speechSynthesis.speak(u)
  })
}
