import { useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Bot, Check, Keyboard, Lightbulb, MessageSquareQuote, Mic, Paperclip, Percent, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { initials, systemsOf } from '../derive'
import { fmtChf, fmtWhen } from '../format'
import { useEstimate, useStore } from '../store'
import type { BidSuggestion, Estimate, Experience as Entry } from '../types'
import { Button, Empty } from '../components/ui'
import { Talk } from './Talk'

const KINDS = [
  ['opinion', 'Opinion', MessageSquareQuote],
  ['estimate', 'Estimate', Percent],
  ['file', 'File', Paperclip],
] as const

const SCOPES = [
  ['project', 'Whole tender'],
  ['system', 'System'],
  ['category', 'Category'],
  ['position', 'Position'],
] as const

/**
 * The estimators' own experience for this tender: opinions, estimates with a suggested adjustment, and files.
 * Kept with the tender so it can later adjust the bid scenarios from history and experience; prices are not changed yet.
 */
const MODE = 'equans-experience-mode'
function savedMode(): 'talk' | 'write' {
  try {
    return localStorage.getItem(MODE) === 'talk' ? 'talk' : 'write'
  } catch {
    return 'write'
  }
}

export function Experience() {
  const act = useStore((s) => s.act)
  const [mode, setModeState] = useState(savedMode)
  const setMode = (m: 'talk' | 'write') => {
    setModeState(m)
    try {
      localStorage.setItem(MODE, m)
    } catch {
      /* the mode then lasts for this visit */
    }
  }
  const suggest = async () => {
    const ok = await act('Asking Apertus…', (tid) => api.suggestBid(tid), 'Apertus suggested a bid price.')
    if (ok) document.getElementById('bid-suggestion')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <div className="experience-page">
      <section className="card experience-intro">
        <Lightbulb size={26} />
        <div>
          <span className="eyebrow">EMPLOYEE EXPERIENCE</span>
          <h1>Experience</h1>
          <p>
            Everything the team knows that the tender and the company data don't: opinions on risks, own estimates, lessons from
            similar jobs, photos and files. Entries are kept with the tender.
          </p>
        </div>
        <div className="experience-future">
          <Sparkles size={16} />
          <span>
            <strong>Bid suggestion</strong>
            <small>Apertus, the Swiss open language model, can read these entries with the bid scenarios and suggest a bid price below.</small>
          </span>
        </div>
      </section>
      <div className="mode-toggle" role="tablist" aria-label="How to add experience">
        <button role="tab" aria-selected={mode === 'talk'} className={mode === 'talk' ? 'active' : ''} onClick={() => setMode('talk')}>
          <Mic size={15} /> Talk
        </button>
        <button role="tab" aria-selected={mode === 'write'} className={mode === 'write' ? 'active' : ''} onClick={() => setMode('write')}>
          <Keyboard size={15} /> Write
        </button>
      </div>
      <div className="experience-grid">
        {/* both stay mounted so the conversation survives switching back and forth */}
        <div hidden={mode !== 'talk'}>
          <Talk onSuggest={suggest} />
        </div>
        <div hidden={mode !== 'write'}>
          <NewEntry />
        </div>
        <Entries />
      </div>
      <SuggestionPanel />
    </div>
  )
}

function Entries() {
  const e = useEstimate()
  const [kind, setKind] = useState<Entry['kind'] | 'all'>('all')
  const entries = [...e.experience].reverse().filter((x) => kind === 'all' || x.kind === kind)
  const usedIds = new Set(e.bid_suggestion?.entries_used.map((u) => u.id) ?? [])
  return (
    <section className="card experience-entries">
      <div className="section-heading">
        <h2>Entries</h2>
        <div className="filter-pills">
          {[['all', 'All'] as const, ...KINDS.map(([k, l]) => [k, l] as const)].map(([k, l]) => (
            <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
              {l} ({k === 'all' ? e.experience.length : e.experience.filter((x) => x.kind === k).length})
            </button>
          ))}
        </div>
      </div>
      {entries.length ? (
        entries.map((x) => <EntryRow key={x.id} x={x} used={usedIds.has(x.id)} />)
      ) : (
        <Empty icon={<Lightbulb size={28} />} title="No experience recorded yet">
          Add what you would tell a colleague pricing this tender for the first time.
        </Empty>
      )}
    </section>
  )
}

/** Jump to an entry in the list and flash it, so each point of the suggestion can be checked against its source. */
function showEntry(id: string) {
  const el = document.getElementById(`exp-${id}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.remove('flash')
  void el.offsetWidth
  el.classList.add('flash')
}

/** Out of date when the entries or the scenario prices changed since Apertus was asked. */
function staleness(e: Estimate, s: BidSuggestion) {
  const now = e.experience.map((x) => x.id)
  const added = now.filter((id) => !s.input.entry_ids.includes(id)).length
  const removed = s.input.entry_ids.filter((id) => !now.includes(id)).length
  const moved = e.bid.scenarios.some(
    (c) => s.input.scenarios.find((x) => x.name === c.scenario)?.bid_price_chf !== c.bid_price_chf,
  )
  const why = [
    added && `${added} entr${added > 1 ? 'ies' : 'y'} added`,
    removed && `${removed} entr${removed > 1 ? 'ies' : 'y'} removed`,
    moved && 'the bid scenarios changed',
  ].filter(Boolean)
  return why.length ? `Out of date: ${why.join(', ')} since this suggestion. Ask again to include it.` : null
}

function SuggestionPanel() {
  const e = useEstimate()
  const act = useStore((st) => st.act)
  const busy = useStore((st) => st.busy)
  const s = e.bid_suggestion
  const svc = e.suggestion_service
  const asking = busy === 'Asking Apertus…'
  const ask = () => act('Asking Apertus…', (tid) => api.suggestBid(tid), 'Apertus suggested a bid price.')
  const entry = (id: string) => e.experience.find((x) => x.id === id)
  const label = (id: string) => {
    const x = entry(id)
    return x ? x.text || x.file?.name || id : `${id} (removed)`
  }
  const stale = s ? staleness(e, s) : null
  const applied = !!s && e.bid.experience?.suggestion_at === s.at
  const navigate = useNavigate()
  return (
    <section className="card suggestion" id="bid-suggestion">
      <div className="suggestion-head">
        <div>
          <span className="ai-badge">
            <Bot size={13} /> AI suggestion
          </span>
          <h2>Bid price suggestion</h2>
          <p className="muted">
            Apertus reads the experience entries above and the bid scenarios, then suggests a price with its reasons. It never
            changes a price: you decide on the Bid tab.
          </p>
        </div>
        <div className="suggestion-ask">
          <Button
            primary
            disabled={!e.experience.length || !svc?.configured || !!busy}
            title={
              !svc?.configured
                ? 'Set APERTUS_API_KEY in backend/.env and restart the backend'
                : !e.experience.length
                  ? 'Add an experience entry first'
                  : undefined
            }
            onClick={ask}
          >
            <Sparkles size={14} /> {asking ? 'Asking Apertus…' : s ? 'Ask again' : 'Suggest a bid price'}
          </Button>
          <small>{svc?.model ?? 'Apertus'}</small>
        </div>
      </div>
      {!svc?.configured && (
        <p className="suggestion-note">
          <AlertTriangle size={14} /> The backend has no Apertus key. Copy <code>backend/.env.example</code> to{' '}
          <code>backend/.env</code>, fill in <code>APERTUS_API_KEY</code> and restart uvicorn.
        </p>
      )}
      {s ? (
        <>
          {stale && (
            <p className="suggestion-note">
              <AlertTriangle size={14} /> {stale}
            </p>
          )}
          <div className="suggestion-body">
            <div className="suggestion-price">
              <small>Suggested bid</small>
              <strong>{fmtChf(s.price_chf)}</strong>
              <span>
                Range {fmtChf(s.low_chf)} – {fmtChf(s.high_chf)}
              </span>
              {s.margin_pct != null && <span>Margin {s.margin_pct}% on the cost baseline {fmtChf(s.input.cost_baseline_chf)}</span>}
              {s.closest_scenario && <span>Closest scenario: {s.closest_scenario}</span>}
              <RangeBar s={s} />
            </div>
            <div className="suggestion-why">
              {s.summary && <p className="suggestion-summary">{s.summary}</p>}
              <h3>Reasoning</h3>
              <ol>
                {s.reasoning.map((r, i) => (
                  <li key={i}>
                    {r.text}
                    {(r.entries.length > 0 || r.scenarios.length > 0) && (
                      <span className="cite-row">
                        {r.entries.map((id) => (
                          <button key={id} className="cite entry" onClick={() => showEntry(id)} title="Show this entry">
                            {label(id)}
                          </button>
                        ))}
                        {r.scenarios.map((n) => (
                          <span key={n} className="cite scenario" title="Bid scenario from company data">
                            {n} {fmtChf(s.input.scenarios.find((x) => x.name === n)?.bid_price_chf)}
                          </span>
                        ))}
                      </span>
                    )}
                    {!r.entries.length && !r.scenarios.length && <span className="cite none">No source cited</span>}
                  </li>
                ))}
              </ol>
              {s.caveats.length > 0 && (
                <>
                  <h3>Caveats</h3>
                  <ul>
                    {s.caveats.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <div className="suggestion-sources">
              <h3>
                Entries used ({s.entries_used.length} of {s.input.entry_ids.length})
              </h3>
              {s.entries_used.map((u) => (
                <button key={u.id} className="source-entry" onClick={() => showEntry(u.id)}>
                  <span>{label(u.id)}</span>
                  {u.how && <small>{u.how}</small>}
                  {u.effect_pct != null && (
                    <b className={u.effect_pct >= 0 ? 'up' : 'down'}>
                      {u.effect_pct > 0 ? '+' : ''}
                      {u.effect_pct}%
                    </b>
                  )}
                </button>
              ))}
              {s.entries_ignored.length > 0 && (
                <>
                  <h3>Not used</h3>
                  {s.entries_ignored.map((id) => (
                    <button key={id} className="source-entry ignored" onClick={() => showEntry(id)}>
                      <span>{label(id)}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="suggestion-apply">
            {applied ? (
              <>
                <span className="talk-saved">
                  <Check size={13} /> On the Bid tab as the Experience scenario
                </span>
                <Button className="small" onClick={() => navigate('/bid')}>
                  Open the Bid tab <ArrowRight size={13} />
                </Button>
              </>
            ) : (
              <>
                <span className="muted">
                  {e.bid.experience
                    ? `The Bid tab shows an older suggestion (${fmtChf(e.bid.experience.bid_price_chf)}).`
                    : 'Compare it with the calculated scenarios on the Bid tab.'}
                </span>
                <Button
                  className="small"
                  primary
                  disabled={!!busy}
                  onClick={() => act('Adding…', (tid) => api.applySuggestion(tid), 'Added to the Bid tab as the Experience scenario.')}
                >
                  <Plus size={13} /> {e.bid.experience ? 'Replace the Experience scenario' : 'Add as a bid scenario'}
                </Button>
              </>
            )}
          </div>
          <small className="muted suggestion-foot">
            Written by {s.model} · {fmtWhen(s.at)} · AI suggestion, check it before you use it. Prices in the tender are unchanged.
          </small>
        </>
      ) : (
        svc?.configured && (
          <p className="muted">
            {e.experience.length ? 'No suggestion yet.' : 'Add at least one experience entry, then ask for a suggestion.'}
          </p>
        )
      )}
    </section>
  )
}

/** The suggested range against the calculated scenarios, on one scale. */
function RangeBar({ s }: { s: BidSuggestion }) {
  const [hover, setHover] = useState<string | null>(null)
  const prices = [s.low_chf, s.high_chf, s.price_chf, ...s.input.scenarios.map((x) => x.bid_price_chf)]
  const lo = Math.min(...prices) * 0.99
  const hi = Math.max(...prices) * 1.01
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div className="range-bar" aria-label="Suggested range against the bid scenarios">
      <div className="range-track">
        <i className="range-band" style={{ left: at(s.low_chf), width: `calc(${at(s.high_chf)} - ${at(s.low_chf)})` }} />
        {s.input.scenarios.map((x) => (
          <i
            key={x.name}
            className="range-tick"
            style={{ left: at(x.bid_price_chf) }}
            onMouseEnter={() => setHover(x.name)}
            onMouseLeave={() => setHover(null)}
            title={`${x.name} ${fmtChf(x.bid_price_chf)}`}
          />
        ))}
        <i className="range-dot" style={{ left: at(s.price_chf) }} title={`Suggested ${fmtChf(s.price_chf)}`} />
      </div>
      <div className="range-labels">
        {s.input.scenarios.map((x) => (
          <span key={x.name} className={hover === x.name ? 'on' : ''} style={{ left: at(x.bid_price_chf) }}>
            {x.name}
          </span>
        ))}
      </div>
    </div>
  )
}

function scopeLabel(x: Entry) {
  const s = SCOPES.find(([k]) => k === x.scope)?.[1] ?? x.scope
  return x.scope === 'project' ? s : `${s} ${x.ref}`
}

function EntryRow({ x, used }: { x: Entry; used: boolean }) {
  const e = useEstimate()
  const act = useStore((s) => s.act)
  const Icon = KINDS.find(([k]) => k === x.kind)?.[2] ?? MessageSquareQuote
  return (
    <div className="experience-entry" id={`exp-${x.id}`}>
      <span className="avatar tiny">{initials(x.author)}</span>
      <div>
        <div className="experience-meta">
          <span className={`experience-kind ${x.kind}`}>
            <Icon size={12} /> {KINDS.find(([k]) => k === x.kind)?.[1]}
          </span>
          <small>
            {scopeLabel(x)} · {x.author ? `${x.author} · ` : ''}
            {fmtWhen(x.at)}
          </small>
          {x.source === 'talk' && (
            <span className="talk-tag" title="Saved from a spoken conversation">
              <Mic size={11} /> talk
            </span>
          )}
          {used && (
            <span className="used-tag" title="Used by the latest bid suggestion">
              <Bot size={11} /> used
            </span>
          )}
        </div>
        {x.text && <p>{x.text}</p>}
        {x.quote && <q className="entry-quote">{x.quote}</q>}
        {x.adjustment_pct != null && (
          <small className="muted">
            Suggested adjustment {x.adjustment_pct > 0 ? '+' : ''}
            {x.adjustment_pct}%
          </small>
        )}
        {x.file && (
          <a className="file-link" href={api.experienceFileUrl(e.tender.id, x.id)} target="_blank" rel="noreferrer">
            <Paperclip size={12} /> {x.file.name}
          </a>
        )}
      </div>
      <button
        className="icon-button"
        aria-label="Delete entry"
        onClick={() => act('Removing…', (tid) => api.deleteExperience(tid, x.id))}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function NewEntry() {
  const e = useEstimate()
  const act = useStore((s) => s.act)
  const [kind, setKind] = useState<Entry['kind']>('opinion')
  const [scope, setScope] = useState<Entry['scope']>('project')
  const [ref, setRef] = useState('')
  const [text, setText] = useState('')
  const [pct, setPct] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const refs: [string, string][] =
    scope === 'system'
      ? systemsOf(e.positions).map((s) => [s.id, s.id])
      : scope === 'category'
        ? e.categories.map((c) => [c.label, c.label])
        : scope === 'position'
          ? e.positions.map((p) => [p.lv_id, `${p.ref ?? p.lv_id} ${p.title}`.slice(0, 70)])
          : []
  const ready = (text.trim() || file) && (scope === 'project' || ref)
  const save = async () => {
    const ok = await act(
      'Saving…',
      (tid) =>
        api.addExperience(
          tid,
          {
            text,
            kind,
            scope,
            ref: scope === 'project' ? '' : ref,
            adjustment_pct: kind === 'estimate' ? pct : '',
            author: e.tender.meta.estimator,
          },
          file,
        ),
      'Experience saved.',
    )
    if (ok) {
      setText('')
      setPct('')
      setFile(null)
    }
  }
  return (
    <section className="card experience-form">
      <h2>Add experience</h2>
      <div className="segmented">
        {KINDS.map(([k, l, I]) => (
          <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}>
            <I size={14} /> {l}
          </button>
        ))}
      </div>
      <label>
        <span>Applies to</span>
        <div className="inline">
          <select
            value={scope}
            onChange={(ev) => {
              setScope(ev.target.value as Entry['scope'])
              setRef('')
            }}
          >
            {SCOPES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          {scope !== 'project' && (
            <select value={ref} onChange={(ev) => setRef(ev.target.value)} aria-label="Which one">
              <option value="">Choose…</option>
              {refs.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </div>
      </label>
      <label>
        <span>{kind === 'estimate' ? 'Your estimate and why' : kind === 'file' ? 'What the file shows' : 'Your opinion'}</span>
        <textarea
          rows={4}
          value={text}
          placeholder={
            kind === 'estimate'
              ? 'e.g. School sites in Oberglatt need a crane for the roof units, about 8% more labour.'
              : kind === 'file'
                ? 'e.g. Final account of the 2023 school job in Bülach.'
                : 'e.g. The planner usually accepts equivalent products from Swegon.'
          }
          onChange={(ev) => setText(ev.target.value)}
        />
      </label>
      {kind === 'estimate' && (
        <label>
          <span>Suggested adjustment to the price (%)</span>
          <input type="number" step="0.5" value={pct} placeholder="e.g. 5 or -3" onChange={(ev) => setPct(ev.target.value)} />
        </label>
      )}
      <div className="experience-file">
        <Button className="small" onClick={() => input.current?.click()}>
          <Paperclip size={14} /> {file ? 'Change file' : 'Attach a file'}
        </Button>
        {file && <small>{file.name}</small>}
        <input ref={input} type="file" hidden onChange={(ev) => setFile(ev.target.files?.[0] ?? null)} />
      </div>
      <Button primary disabled={!ready} onClick={save}>
        Save experience
      </Button>
    </section>
  )
}
