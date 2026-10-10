import { useEffect, useRef, useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import { api } from '../api'
import { aiStatus, browserRecognition } from '../voice'

type State = 'idle' | 'recording' | 'transcribing'

/**
 * Record a spoken answer and hand back the text, ported from the Hack am Rhein mic button.
 * Uses the backend (ElevenLabs, OpenAI as backup) when it has a key, otherwise the browser's own recognition.
 * The text is not sent on its own: it lands in the answer box so the estimator can correct it first.
 */
export function MicButton({
  tid,
  disabled,
  onTranscript,
  onError,
}: {
  tid: string
  disabled?: boolean
  onTranscript: (text: string) => void
  onError: (message: string) => void
}) {
  const [state, setState] = useState<State>('idle')
  const [mode, setMode] = useState<'server' | 'browser' | 'none' | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const recognition = useRef<ReturnType<typeof browserRecognition>>(null)

  useEffect(() => {
    let cancelled = false
    aiStatus().then((s) => {
      if (cancelled) return
      if (s?.voice.listen && typeof MediaRecorder !== 'undefined') setMode('server')
      else setMode(browserRecognition() ? 'browser' : 'none')
    })
    return () => {
      cancelled = true
      recorder.current?.stream.getTracks().forEach((t) => t.stop())
      recognition.current?.stop()
    }
  }, [])

  if (mode === null || mode === 'none') return null

  const startServer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        setState('transcribing')
        try {
          const { text } = await api.transcribe(tid, new Blob(chunks, { type: rec.mimeType || 'audio/webm' }))
          if (text) onTranscript(text)
          else onError('Nothing was heard. Record again and speak closer to the microphone.')
        } catch {
          onError('The recording could not be transcribed. Record again or type your answer.')
        } finally {
          setState('idle')
        }
      }
      recorder.current = rec
      rec.start()
      setState('recording')
    } catch {
      onError('Microphone access was blocked. Allow it in the browser settings, or type your answer.')
    }
  }

  const startBrowser = () => {
    const rec = browserRecognition()
    if (!rec) return
    let heard = ''
    rec.onresult = (event) => {
      heard = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(' ')
    }
    rec.onerror = () => onError('Speech recognition stopped. Record again or type your answer.')
    rec.onend = () => {
      setState('idle')
      if (heard.trim()) onTranscript(heard.trim())
    }
    recognition.current = rec
    rec.start()
    setState('recording')
  }

  const toggle = () => {
    if (state === 'recording') {
      if (mode === 'server') recorder.current?.stop()
      else recognition.current?.stop()
      return
    }
    if (mode === 'server') void startServer()
    else startBrowser()
  }

  return (
    <button
      type="button"
      className={`button iv-mic ${state === 'recording' ? 'recording' : ''}`}
      onClick={toggle}
      disabled={disabled || state === 'transcribing'}
      aria-pressed={state === 'recording'}
      title={state === 'recording' ? 'Stop recording' : 'Answer by voice'}
    >
      {state === 'transcribing' ? <Loader2 size={16} className="spin" /> : state === 'recording' ? <Square size={14} /> : <Mic size={16} />}
      {state === 'transcribing' ? 'Transcribing' : state === 'recording' ? 'Stop' : 'Speak'}
    </button>
  )
}
