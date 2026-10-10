import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  Check,
  CirclePlay,
  Flag,
  Loader2,
  MessageSquareQuote,
  Percent,
  RotateCcw,
  Send,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { api } from '../api'
import { initials, systemsOf } from '../derive'
import { useEstimate, useStore } from '../store'
import type { AiStatus, Estimate, ExperienceApplies, InterviewDraft, InterviewSession, InterviewTurn } from '../types'
import { aiStatus, speak, stopSpeaking } from '../voice'
import { Button } from './ui'
import { MicButton } from './MicButton'

const MAX_QUESTIONS = 10
const TYPE_LABEL: Record<string, string> = { opening: 'Opening', clarify: 'Clarifying', probe: 'Probing', closing: 'Closing' }
const SCOPE_LABEL: Record<string, string> = { project: 'Whole tender', system: 'System', category: 'Category', position: 'Position' }
const APPLIES: [ExperienceApplies, string][] = [
  ['all', 'material + labour'],
  ['labour', 'labour'],
  ['material', 'material'],
]
const VOICE_KEY = 'equans-interview-voice'

/**
 * Interview mode of the Experience tab. The AI asks about this tender one question at a time, follows up on vague
 * answers and drafts Experience entries on the right; nothing is saved until the estimator confirms.
 * Flow and layout adapted from the Relay knowledge-capture interview (StartHack 2026).
 */
export function Interview() {
  const e = useEstimate()
  const tid = e.tender.id
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    aiStatus().then((s) => !cancelled && setStatus(s))
    api
      .getInterview(tid)
      .then((s) => !cancelled && setSession(s))
      .catch(() => !cancelled && setSession(null))
      .finally(() => !cancelled && setLoaded(true))
    return () => {
      cancelled = true
      stopSpeaking()
    }
  }, [tid])

  if (demo) return <Demo close={() => setDemo(false)} />
  if (!loaded) return <section className="card iv-start muted">Loading the interview…</section>
  if (!session) return <Start status={status} onStarted={setSession} onDemo={() => setDemo(true)} />
  return <Live session={session} setSession={setSession} status={status} />
}

/* ------------------------------------------------------------------ start */

function Start({
  status,
  onStarted,
  onDemo,
}: {
  status: AiStatus | null
  onStarted: (s: InterviewSession) => void
  onDemo: () => void
}) {
  const e = useEstimate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = !!status?.llm.provider
  const start = async () => {
    setBusy(true)
    setError('')
    try {
      onStarted(await api.startInterview(e.tender.id))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card iv-start">
      <div className="iv-start-icon">
        <Bot size={24} />
      </div>
      <div>
        <h2>Interview with AI</h2>
        <p>
          The AI asks you about this tender, one question at a time: open positions, missing supplier quotes, the biggest
          systems and site conditions. It turns your answers into draft entries; you check them, and nothing is saved until
          you confirm.
        </p>
        <p className="muted small-print">
          About 5 to 10 questions. Answer by typing or by voice, in German or English.
          {status?.llm.provider && ` Runs on ${providerLabel(status.llm.provider)}.`}
        </p>
        {!ready && status && <p className="iv-error">No AI key is configured in the backend. Use “Add manually” or the demo.</p>}
        {error && <p className="iv-error">{error}</p>}
      </div>
      <div className="iv-start-actions">
        <Button primary disabled={!ready || busy} onClick={start}>
          {busy ? <Loader2 size={15} className="spin" /> : <Bot size={15} />} {busy ? 'Preparing…' : 'Start interview'}
        </Button>
        <Button className="small" onClick={onDemo} title="Plays a prepared interview without calling any AI">
          <CirclePlay size={14} /> Play demo
        </Button>
      </div>
    </section>
  )
}

const providerLabel = (p: string | null) => (p === 'apertus' ? 'Apertus 🇨🇭' : p === 'claude' ? 'Claude' : 'AI')

/* ------------------------------------------------------------------ live interview */

function Live({
  session,
  setSession,
  status,
}: {
  session: InterviewSession
  setSession: (s: InterviewSession | null) => void
  status: AiStatus | null
}) {
  const e = useEstimate()
  const tid = e.tender.id
  const act = useStore((s) => s.act)
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [voiceOn, setVoiceOn] = useState(() => {
    try {
      return localStorage.getItem(VOICE_KEY) === '1'
    } catch {
      return false
    }
  })
  const thread = useRef<HTMLDivElement>(null)
  const spoken = useRef<string>('')
  const asked = session.turns.filter((t) => t.role === 'agent').length
  const active = session.status === 'active'
  const last = session.turns[session.turns.length - 1]

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: 'smooth' })
  }, [session.turns.length, thinking])

  // Read each new question aloud when voice is on.
  useEffect(() => {
    if (!voiceOn || !last || last.role !== 'agent' || spoken.current === last.at + last.text) return
    spoken.current = last.at + last.text
    speak(tid, last.text).catch(() => undefined)
  }, [voiceOn, last, tid])

  const toggleVoice = () => {
    const on = !voiceOn
    setVoiceOn(on)
    if (!on) stopSpeaking()
    else if (last?.role === 'agent') spoken.current = ''
    try {
      localStorage.setItem(VOICE_KEY, on ? '1' : '0')
    } catch {
      /* remembered for this visit only */
    }
  }

  const send = async () => {
    const answer = text.trim()
    if (!answer || thinking) return
    stopSpeaking()
    setThinking(true)
    setError('')
    // Show the answer straight away; the server's copy replaces it when the next question arrives.
    setSession({ ...session, turns: [...session.turns, { role: 'estimator', text: answer, at: new Date().toISOString() }] })
    setText('')
    try {
      setSession(await api.answerInterview(tid, session.id, answer))
    } catch (err) {
      setSession(session)
      setText(answer)
      setError((err as Error).message)
    } finally {
      setThinking(false)
    }
  }

  const finish = async () => setSession(await api.finishInterview(tid, session.id))
  const discard = async () => {
    stopSpeaking()
    await api.discardInterview(tid, session.id)
    setSession(null)
  }
  const confirm = () =>
    act(
      'Saving the interview…',
      async (t) => {
        const r = await api.confirmInterview(t, session.id)
        setSession(null)
        return r.estimate
      },
      'Experience entries saved.',
    )

  const drafts = session.drafts.filter((d) => d.status !== 'replaced')
  const kept = drafts.filter((d) => d.status === 'keep')
  const topic = session.topics.find((t) => t.id === [...session.turns].reverse().find((x) => x.topic_id)?.topic_id)

  return (
    <div className="iv">
      <section className="card iv-chat">
        <div className="iv-head">
          <span className={`iv-live ${active ? '' : 'ended'}`}>
            <i /> {active ? 'Live interview' : 'Interview finished'}
          </span>
          <div className="iv-head-title">
            <strong>{e.tender.meta.project_name || e.tender.name}</strong>
            <small>
              {Math.min(asked, MAX_QUESTIONS)} of up to {MAX_QUESTIONS} questions · {providerLabel(session.provider)}
            </small>
          </div>
          <div className="iv-head-actions">
            {status?.voice.speak !== undefined && (
              <button className={`icon-button ${voiceOn ? 'pressed' : ''}`} onClick={toggleVoice} title={voiceOn ? 'Stop reading questions aloud' : 'Read questions aloud'}>
                {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            )}
            {active && (
              <Button className="small" onClick={finish} disabled={thinking}>
                <Square size={13} /> Finish
              </Button>
            )}
            <Button className="small" onClick={discard} disabled={thinking} title="Discard the interview; nothing is saved">
              <Trash2 size={13} /> Discard
            </Button>
          </div>
        </div>
        <div className="iv-progress">
          <span style={{ width: `${(Math.min(asked, MAX_QUESTIONS) / MAX_QUESTIONS) * 100}%` }} />
        </div>
        <div className="iv-topics">
          {session.topics.map((t) => (
            <span key={t.id} className={`iv-topic ${topic?.id === t.id ? 'current' : ''}`} title={t.detail}>
              {t.title}
            </span>
          ))}
        </div>
        <div className="iv-thread" ref={thread}>
          {session.turns.map((t, i) => (
            <Turn key={i} t={t} who={e.tender.meta.estimator} onReplay={() => speak(tid, t.text).catch(() => undefined)} />
          ))}
          {thinking && (
            <div className="iv-turn agent">
              <span className="iv-avatar agent">
                <Bot size={15} />
              </span>
              <div className="iv-msg">
                <div className="iv-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
        </div>
        {active ? (
          <div className="iv-compose">
            <textarea
              rows={2}
              value={text}
              placeholder="Your answer… (Enter to send, Shift+Enter for a new line)"
              onChange={(ev) => setText(ev.target.value)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' && !ev.shiftKey) {
                  ev.preventDefault()
                  void send()
                }
              }}
              disabled={thinking}
            />
            <div className="iv-compose-actions">
              <MicButton
                tid={tid}
                disabled={thinking}
                onTranscript={(t) => setText((cur) => (cur ? `${cur} ${t}` : t))}
                onError={setError}
              />
              <Button primary onClick={send} disabled={!text.trim() || thinking}>
                <Send size={14} /> Send
              </Button>
            </div>
            {error && <p className="iv-error">{error}</p>}
          </div>
        ) : (
          <p className="iv-finished">The interview is finished. Check the drafts on the right and confirm the ones to keep.</p>
        )}
      </section>

      <aside className="card iv-record">
        <div className="iv-record-head">
          <h2>Experience record</h2>
          {active && <span className="iv-building">{thinking ? 'listening…' : 'building…'}</span>}
        </div>
        {drafts.length ? (
          drafts.map((d) => <DraftCard key={d.id} d={d} e={e} session={session} setSession={setSession} />)
        ) : (
          <p className="muted iv-record-empty">
            Drafts appear here as you answer: opinions, and estimates with a percentage of what they cover.
          </p>
        )}
        <div className="iv-record-foot">
          <small className="muted">Nothing is saved until you confirm. Confirmed estimates change the price.</small>
          <Button primary disabled={!kept.length || thinking} onClick={confirm}>
            <Check size={15} /> Confirm {kept.length || ''} entr{kept.length === 1 ? 'y' : 'ies'}
          </Button>
        </div>
      </aside>
    </div>
  )
}

function Turn({ t, who, onReplay }: { t: InterviewTurn; who?: string | null; onReplay?: () => void }) {
  return (
    <div className={`iv-turn ${t.role === 'agent' ? 'agent' : 'me'} rise`}>
      {t.role === 'agent' ? (
        <span className="iv-avatar agent">
          <Bot size={15} />
        </span>
      ) : (
        <span className="avatar tiny">{initials(who ?? null)}</span>
      )}
      <div className="iv-msg">
        {t.role === 'agent' && t.type && (
          <span className="iv-tag">
            {TYPE_LABEL[t.type] ?? t.type}
            {onReplay && (
              <button className="iv-replay" onClick={onReplay} title="Read aloud">
                <Volume2 size={11} />
              </button>
            )}
          </span>
        )}
        <p>{t.text}</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ drafts */

function refOptions(e: Estimate, scope: InterviewDraft['scope']): [string, string][] {
  if (scope === 'system') return systemsOf(e.positions).map((s) => [s.id, s.id])
  if (scope === 'category') return e.categories.map((c) => [c.id, c.label])
  if (scope === 'position') return e.positions.map((p) => [p.lv_id, `${p.lv_id} ${p.title}`.slice(0, 60)])
  return []
}

function DraftCard({
  d,
  e,
  session,
  setSession,
}: {
  d: InterviewDraft
  e: Estimate
  session: InterviewSession
  setSession: (s: InterviewSession) => void
}) {
  const [pct, setPct] = useState(d.adjustment_pct?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => setPct(d.adjustment_pct?.toString() ?? ''), [d.adjustment_pct])
  const confirmed = d.status === 'confirmed'
  const edit = async (body: Parameters<typeof api.editDraft>[3]) => {
    setSaving(true)
    try {
      setSession(await api.editDraft(e.tender.id, session.id, d.id, body))
    } finally {
      setSaving(false)
    }
  }
  const savePct = () => {
    const v = pct.trim()
    if (v === (d.adjustment_pct?.toString() ?? '')) return
    if (v === '') void edit({ clear_pct: true, kind: 'opinion' })
    else if (!Number.isNaN(Number(v))) void edit({ adjustment_pct: Number(v) })
  }
  const Icon = d.kind === 'estimate' ? Percent : MessageSquareQuote
  return (
    <div className={`iv-draft ${d.status === 'drop' ? 'dropped' : ''} ${saving ? 'saving' : ''} rise`}>
      <div className="iv-draft-head">
        <span className={`experience-kind ${d.kind}`}>
          <Icon size={12} /> {d.kind === 'estimate' ? 'Estimate' : 'Opinion'}
        </span>
        {!confirmed && (
          <button
            className="icon-button"
            onClick={() => edit({ status: d.status === 'drop' ? 'keep' : 'drop' })}
            title={d.status === 'drop' ? 'Keep this draft' : 'Drop this draft'}
          >
            {d.status === 'drop' ? <RotateCcw size={13} /> : <X size={13} />}
          </button>
        )}
      </div>
      <p>{d.text}</p>
      {d.reason && <small className="muted">{d.reason}</small>}
      {d.status !== 'drop' && !confirmed && (
        <div className="iv-draft-fields">
          <select
            value={d.scope}
            aria-label="Applies to"
            onChange={(ev) => {
              const scope = ev.target.value as InterviewDraft['scope']
              const first = refOptions(e, scope)[0]?.[0] ?? ''
              void edit({ scope, ref: first })
            }}
          >
            {Object.entries(SCOPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          {d.scope !== 'project' && (
            <select value={d.ref} aria-label="Which one" onChange={(ev) => void edit({ ref: ev.target.value })}>
              {refOptions(e, d.scope).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
          <div className="iv-draft-pct">
            <input
              type="number"
              step="0.5"
              value={pct}
              placeholder="%"
              aria-label="Adjustment in percent"
              onChange={(ev) => setPct(ev.target.value)}
              onBlur={savePct}
              onKeyDown={(ev) => ev.key === 'Enter' && savePct()}
            />
            <span>%</span>
            <select
              value={d.applies_to}
              aria-label="Of which cost"
              disabled={d.kind !== 'estimate'}
              onChange={(ev) => void edit({ applies_to: ev.target.value as ExperienceApplies })}
            >
              {APPLIES.map(([k, l]) => (
                <option key={k} value={k}>
                  of {l}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
      {d.flags.map((f) => (
        <small key={f} className="iv-flag">
          <AlertTriangle size={11} /> {f}
        </small>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ scripted demo */

/** A prepared interview for the pitch: plays without any AI call or key, and saves nothing. */
const DEMO: { turn: InterviewTurn; drafts?: InterviewDraft[] }[] = [
  {
    turn: {
      role: 'agent',
      type: 'opening',
      at: '1',
      text: 'Grüezi! The supply units for the Turnhalle (LA05) sit on the roof. How do they get up there, and what does that mean for the installation time?',
    },
  },
  { turn: { role: 'estimator', at: '2', text: 'They go up by crane. On school sites that usually costs us about 8% more installation time.' } },
  {
    turn: {
      role: 'agent',
      type: 'clarify',
      at: '3',
      text: 'Does the 8% apply only to the Turnhalle system, or to all roof work including the mounting system on the flat roof (244.06)?',
    },
    drafts: [
      {
        id: 'd1',
        kind: 'estimate',
        text: 'Roof units go up by crane: about 8% more installation time.',
        reason: 'Crane and access slow the installation on school sites.',
        scope: 'system',
        ref: '244.05 LA05 Turnhalle',
        applies_to: 'labour',
        adjustment_pct: 8,
        flags: [],
        status: 'keep',
      },
    ],
  },
  { turn: { role: 'estimator', at: '4', text: 'Only the Turnhalle. And the planner usually accepts Swegon instead of Trox.' } },
  {
    turn: {
      role: 'agent',
      type: 'probe',
      at: '5',
      text: 'Good to know. 90 positions still wait for supplier quotes. Is there a supplier whose prices you would trust without a quote?',
    },
    drafts: [
      {
        id: 'd2',
        kind: 'opinion',
        text: 'The planner usually accepts Swegon as an equivalent to Trox.',
        reason: 'Opens a cheaper product alternative.',
        scope: 'project',
        ref: '',
        applies_to: 'material',
        adjustment_pct: null,
        flags: [],
        status: 'keep',
      },
    ],
  },
]

function Demo({ close }: { close: () => void }) {
  const [step, setStep] = useState(1)
  const thread = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (step >= DEMO.length) return
    const id = setTimeout(() => setStep(step + 1), 2200)
    return () => clearTimeout(id)
  }, [step])
  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: 'smooth' })
  }, [step])
  const shown = DEMO.slice(0, step)
  const drafts = shown.flatMap((s) => s.drafts ?? [])
  return (
    <div className="iv">
      <section className="card iv-chat">
        <div className="iv-head">
          <span className="iv-live demo">
            <i /> Demo · scripted
          </span>
          <div className="iv-head-title">
            <strong>Prepared interview</strong>
            <small>No AI is called and nothing is saved</small>
          </div>
          <div className="iv-head-actions">
            <Button className="small" onClick={() => setStep(1)}>
              <RotateCcw size={13} /> Replay
            </Button>
            <Button className="small" onClick={close}>
              <X size={13} /> Close
            </Button>
          </div>
        </div>
        <div className="iv-progress">
          <span style={{ width: `${(step / DEMO.length) * 100}%` }} />
        </div>
        <div className="iv-thread" ref={thread}>
          {shown.map((s, i) => (
            <Turn key={i} t={s.turn} who="Estimator" />
          ))}
        </div>
      </section>
      <aside className="card iv-record">
        <div className="iv-record-head">
          <h2>Experience record</h2>
          <span className="iv-building">demo</span>
        </div>
        {drafts.map((d) => (
          <div key={d.id} className="iv-draft rise">
            <div className="iv-draft-head">
              <span className={`experience-kind ${d.kind}`}>
                {d.kind === 'estimate' ? <Percent size={12} /> : <MessageSquareQuote size={12} />}{' '}
                {d.kind === 'estimate' ? 'Estimate' : 'Opinion'}
              </span>
            </div>
            <p>{d.text}</p>
            <small className="muted">
              {SCOPE_LABEL[d.scope]} {d.ref}
              {d.adjustment_pct != null && ` · +${d.adjustment_pct}% of ${d.applies_to}`}
            </small>
          </div>
        ))}
        <div className="iv-record-foot">
          <small className="muted">
            <Flag size={11} /> In a real interview you would confirm these and the estimate would change the price.
          </small>
        </div>
      </aside>
    </div>
  )
}
