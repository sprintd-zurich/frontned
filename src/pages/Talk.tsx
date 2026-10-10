import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Bot, Check, Mic, MessageSquareQuote, Percent, Send, Sparkles, Square, Undo2, Volume2, VolumeX } from 'lucide-react'
import { api } from '../api'
import { useEstimate, useStore } from '../store'
import type { TalkEntry, TalkTurn } from '../types'
import { Button } from '../components/ui'

interface Message {
  role: 'user' | 'assistant'
  text: string
  entries?: TalkEntry[]
  /** per extracted entry: saved, or removed again with Undo */
  state?: ('saved' | 'removed')[]
}

/**
 * Talk mode: the estimator speaks, the assistant (Apertus, voiced by ElevenLabs) asks follow-up questions and
 * saves the opinions and estimates it hears as Experience entries straight away; Undo removes a wrong one.
 */
export function Talk({ onSuggest }: { onSuggest: () => void }) {
  const e = useEstimate()
  const act = useStore((s) => s.act)
  const busyGlobal = useStore((s) => s.busy)
  const [messages, setMessages] = useState<Message[]>([])
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [speechNote, setSpeechNote] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const recorder = useRef<MediaRecorder | null>(null)
  const player = useRef<HTMLAudioElement | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const voiceOn = e.voice_service?.configured
  const thinkOn = e.suggestion_service?.configured

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

  useEffect(() => () => player.current?.pause(), [])

  const play = (audio: string | null) => {
    player.current?.pause()
    if (!audio || muted) return
    player.current = new Audio(`data:audio/mpeg;base64,${audio}`)
    player.current.play().catch(() => {})
  }

  const send = async (input: { audio?: Blob; text?: string }) => {
    setBusy(input.audio ? 'Listening…' : 'Thinking…')
    setError(null)
    const history = messages.map((m) => ({ role: m.role, text: m.text }))
    let turn: TalkTurn | null = null
    try {
      // the backend saves what it extracts and returns the updated estimate, so the entry list refreshes too
      await act(
        input.audio ? 'Listening…' : 'Thinking…',
        async (tid) => {
          turn = await api.talk(tid, { ...input, history, speak: !!voiceOn && !muted })
          return turn.estimate
        },
      )
    } finally {
      setBusy(null)
    }
    const out = turn as TalkTurn | null
    if (!out) return // act() already shows the error
    setMessages((ms) => [
      ...ms,
      ...(out.transcript ? [{ role: 'user' as const, text: out.transcript }] : []),
      { role: 'assistant', text: out.reply, entries: out.entries, state: out.entries.map(() => 'saved' as const) },
    ])
    setSpeechNote(out.speech_error)
    play(out.audio)
  }

  const start = async () => {
    player.current?.pause()
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' })
        if (blob.size) send({ audio: blob })
      }
      rec.start()
      recorder.current = rec
      setSeconds(0)
      setRecording(true)
    } catch {
      setError('The microphone is blocked. Allow it in the browser (lock icon next to the address) or type below.')
    }
  }

  const stop = () => {
    recorder.current?.stop()
    recorder.current = null
    setRecording(false)
  }

  const submitTyped = () => {
    const text = typed.trim()
    if (!text) return
    setTyped('')
    send({ text })
  }

  const undo = async (mi: number, ei: number) => {
    const entry = messages[mi].entries![ei]
    const ok = await act('Removing…', (tid) => api.deleteExperience(tid, entry.id), 'Entry removed.')
    if (!ok) return
    setMessages((ms) =>
      ms.map((m, i) => (i === mi ? { ...m, state: m.state!.map((st, j) => (j === ei ? 'removed' : st)) } : m)),
    )
  }

  return (
    <section className="card talk">
      <div className="talk-head">
        <div>
          <span className="ai-badge">
            <Bot size={13} /> AI assistant
          </span>
          <h2>Talk it through</h2>
          <p className="muted">
            Say what you know about this tender. The assistant asks follow-up questions and saves the opinions and estimates it
            hears as entries; undo any that are wrong.
          </p>
        </div>
        <button
          className="icon-button"
          onClick={() => {
            setMuted(!muted)
            player.current?.pause()
          }}
          title={muted ? 'Turn the spoken replies on' : 'Mute the spoken replies'}
          aria-label={muted ? 'Unmute' : 'Mute'}
          disabled={!voiceOn}
        >
          {muted || !voiceOn ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
      {!thinkOn && (
        <p className="suggestion-note">
          <AlertTriangle size={14} /> The backend has no Apertus key, so the assistant can't answer. Set <code>APERTUS_API_KEY</code> in{' '}
          <code>backend/.env</code>.
        </p>
      )}
      {thinkOn && !voiceOn && (
        <p className="suggestion-note">
          <AlertTriangle size={14} /> No ElevenLabs key yet: type instead of speaking, replies are written only. Set{' '}
          <code>ELEVENLABS_API_KEY</code> in <code>backend/.env</code> and restart the backend.
        </p>
      )}
      <div className="talk-log" ref={scroller}>
        {!messages.length && !busy && (
          <div className="talk-start">
            <Button primary disabled={!thinkOn} onClick={() => send({})}>
              <Mic size={14} /> Start the conversation
            </Button>
          </div>
        )}
        {messages.map((m, mi) => (
          <div key={mi} className={`talk-msg ${m.role}`}>
            <div className="talk-bubble">{m.text}</div>
            {m.entries?.map((x, ei) => (
              <div key={ei} className={`talk-entry ${m.state?.[ei]}`}>
                <div className="experience-meta">
                  <span className={`experience-kind ${x.kind}`}>
                    {x.kind === 'estimate' ? <Percent size={12} /> : <MessageSquareQuote size={12} />}{' '}
                    {x.kind === 'estimate' ? 'Estimate' : 'Opinion'}
                  </span>
                  <small>{x.scope === 'project' ? 'Whole tender' : `${x.scope === 'system' ? 'System' : 'Category'} ${x.ref}`}</small>
                  {x.adjustment_pct != null && (
                    <b className={x.adjustment_pct >= 0 ? 'up' : 'down'}>
                      {x.adjustment_pct > 0 ? '+' : ''}
                      {x.adjustment_pct}%
                    </b>
                  )}
                </div>
                <p>{x.text}</p>
                {x.quote && <q>{x.quote}</q>}
                {m.state?.[ei] === 'saved' ? (
                  <div className="talk-entry-actions">
                    <small className="talk-saved">
                      <Check size={12} /> Saved to the entries
                    </small>
                    <Button className="small" disabled={!!busyGlobal} onClick={() => undo(mi, ei)}>
                      <Undo2 size={13} /> Undo
                    </Button>
                  </div>
                ) : (
                  <small className="muted">Removed</small>
                )}
              </div>
            ))}
          </div>
        ))}
        {busy && (
          <div className="talk-msg assistant">
            <div className="talk-bubble typing">{busy}</div>
          </div>
        )}
      </div>
      {error && (
        <p className="suggestion-note">
          <AlertTriangle size={14} /> {error}
        </p>
      )}
      {speechNote && !error && <small className="muted">Spoken reply unavailable: {speechNote}</small>}
      <div className="talk-input">
        <button
          className={`talk-mic ${recording ? 'on' : ''}`}
          disabled={!voiceOn || !thinkOn || (!!busy && !recording)}
          onClick={recording ? stop : start}
          title={recording ? 'Stop and send' : 'Hold the conversation by voice'}
          aria-label={recording ? 'Stop recording' : 'Speak'}
        >
          {recording ? <Square size={16} /> : <Mic size={18} />}
        </button>
        {recording ? (
          <span className="talk-recording">
            <i /> Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} · press the button to send
          </span>
        ) : (
          <input
            value={typed}
            placeholder={voiceOn ? 'Press the microphone and speak, or type here' : 'Type what you would say'}
            disabled={!thinkOn || !!busy}
            onChange={(ev) => setTyped(ev.target.value)}
            onKeyDown={(ev) => ev.key === 'Enter' && submitTyped()}
          />
        )}
        {!recording && (
          <Button disabled={!typed.trim() || !!busy} onClick={submitTyped}>
            <Send size={14} />
          </Button>
        )}
      </div>
      <div className="talk-foot">
        <Button className="small" primary disabled={!e.experience.length || !thinkOn || !!busyGlobal} onClick={onSuggest}>
          <Sparkles size={13} /> Suggest a bid price from the entries
        </Button>
      </div>
    </section>
  )
}
