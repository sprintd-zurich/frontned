import { useRef, useState } from 'react'
import { Bot, Calculator, Lightbulb, MessageSquareQuote, Paperclip, Pencil, Percent, Trash2, TrendingUp } from 'lucide-react'
import { api } from '../api'
import { initials, systemsOf } from '../derive'
import { fmtChf, fmtWhen } from '../format'
import { useEstimate, useStore } from '../store'
import type { Category, Experience as Entry, ExperienceApplies } from '../types'
import { Button, Empty } from '../components/ui'
import { Interview } from '../components/Interview'

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

const APPLIES: [ExperienceApplies, string][] = [
  ['all', 'material + labour'],
  ['labour', 'labour'],
  ['material', 'material'],
]
const appliesLabel = (a: ExperienceApplies | undefined) => APPLIES.find(([k]) => k === (a ?? 'all'))?.[1] ?? a
const signedChf = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmtChf(Math.abs(v))}`
const MODE_KEY = 'equans-experience-mode'
function savedMode(): 'interview' | 'manual' {
  try {
    return localStorage.getItem(MODE_KEY) === 'manual' ? 'manual' : 'interview'
  } catch {
    return 'interview'
  }
}

/**
 * The estimators' own experience for this tender: opinions, estimates with an adjustment, and files.
 * An estimate's percentage is applied to the cost of what it covers and flows into the price and the bid range,
 * unless the estimator switches the adjustments off.
 */
export function Experience() {
  const e = useEstimate()
  const [kind, setKind] = useState<Entry['kind'] | 'all'>('all')
  const entries = [...e.experience].reverse().filter((x) => kind === 'all' || x.kind === kind)
  const fx = e.experience_effect
  const act = useStore((s) => s.act)
  const [mode, setMode] = useState(savedMode)
  const pickMode = (m: 'interview' | 'manual') => {
    setMode(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* remembered for this visit only */
    }
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
            similar jobs, photos and files. Estimates with a percentage change the price.
          </p>
        </div>
        <div className={`experience-future ${fx.lines.length && !fx.applied ? 'off' : ''}`}>
          <Calculator size={16} />
          {fx.lines.length ? (
            <span>
              <strong>{fx.applied ? `${signedChf(fx.total_chf)} in the price` : 'Left out of the price'}</strong>
              <small>
                {fx.lines.length} estimate{fx.lines.length === 1 ? '' : 's'} ·{' '}
                {fx.applied ? 'added to the direct cost before overhead and margin' : `would add ${signedChf(fx.total_chf)}`}
              </small>
            </span>
          ) : (
            <span>
              <strong>Estimates change the price</strong>
              <small>A percentage is taken of the cost of what the estimate covers, then carries overhead and margin.</small>
            </span>
          )}
        </div>
      </section>
      <div className="segmented experience-mode">
        <button className={mode === 'interview' ? 'active' : ''} onClick={() => pickMode('interview')}>
          <Bot size={14} /> Interview with AI
        </button>
        <button className={mode === 'manual' ? 'active' : ''} onClick={() => pickMode('manual')}>
          <Pencil size={14} /> Add manually
        </button>
      </div>
      {mode === 'interview' && <Interview />}
      <div className={`experience-grid ${mode === 'interview' ? 'no-form' : ''}`}>
        {mode === 'manual' && <NewEntry />}
        <section className="card">
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
            entries.map((x) => <EntryRow key={x.id} x={x} />)
          ) : (
            <Empty icon={<Lightbulb size={28} />} title="No experience recorded yet">
              Add what you would tell a colleague pricing this tender for the first time.
            </Empty>
          )}
        </section>
        <section className="card experience-preview">
          <div className="section-heading">
            <h2>
              <TrendingUp size={18} /> Effect on the price
            </h2>
            {fx.lines.length > 0 && (
              <label className="experience-switch">
                <input
                  type="checkbox"
                  checked={fx.applied}
                  onChange={(ev) => {
                    const on = ev.target.checked
                    act('Updating the price…', (tid) => api.setExperienceApply(tid, on), on ? 'Estimates applied.' : 'Estimates left out.')
                  }}
                />
                Apply
              </label>
            )}
          </div>
          <p className="muted">
            {fx.applied
              ? 'Each estimate is a percentage of the cost of what it covers, added before overhead and margin.'
              : 'Switched off: the estimates are kept but left out of the price and the bid.'}
          </p>
          {fx.lines.length ? (
            <div className={fx.applied ? '' : 'experience-off'}>
              {fx.lines.map((l) => (
                <div className="adjustment-row" key={l.id}>
                  <span title={l.text}>{l.text || 'Estimate'}</span>
                  <small>
                    {scopeLabel(l, e.categories)} · {l.adjustment_pct > 0 ? '+' : ''}
                    {l.adjustment_pct}% of {appliesLabel(l.applies_to)} {fmtChf(l.base_chf)}
                  </small>
                  <b className={l.effect_chf >= 0 ? 'up' : 'down'}>{signedChf(l.effect_chf)}</b>
                </div>
              ))}
              <div className="adjustment-row total">
                <span>{fx.applied ? 'Added to the direct cost' : 'Would add to the direct cost'}</span>
                <small>{fx.applied && `selling price now ${fmtChf(e.project.selling_price_rounded_chf)}`}</small>
                <b className={fx.total_chf >= 0 ? 'up' : 'down'}>{signedChf(fx.total_chf)}</b>
              </div>
            </div>
          ) : (
            <p className="muted">An estimate with a percentage shows up here with its effect in CHF.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function scopeLabel(x: Pick<Entry, 'scope' | 'ref'>, categories: Category[]) {
  const s = SCOPES.find(([k]) => k === x.scope)?.[1] ?? x.scope
  if (x.scope === 'project') return s
  const ref = x.scope === 'category' ? (categories.find((c) => c.id === x.ref || c.label === x.ref)?.label ?? x.ref) : x.ref
  return `${s} ${ref}`
}

function EntryRow({ x }: { x: Entry }) {
  const e = useEstimate()
  const act = useStore((s) => s.act)
  const Icon = KINDS.find(([k]) => k === x.kind)?.[2] ?? MessageSquareQuote
  return (
    <div className="experience-entry">
      <span className="avatar tiny">{initials(x.author)}</span>
      <div>
        <div className="experience-meta">
          <span className={`experience-kind ${x.kind}`}>
            <Icon size={12} /> {KINDS.find(([k]) => k === x.kind)?.[1]}
          </span>
          {x.source === 'interview' && (
            <span className="experience-kind interview">
              <Bot size={12} /> Interview
            </span>
          )}
          <small>
            {scopeLabel(x, e.categories)} · {x.author ? `${x.author} · ` : ''}
            {fmtWhen(x.at)}
          </small>
        </div>
        {x.text && <p>{x.text}</p>}
        {x.reason && <small className="muted experience-reason">{x.reason}</small>}
        {x.adjustment_pct != null && (
          <small className="muted">
            Adjustment {x.adjustment_pct > 0 ? '+' : ''}
            {x.adjustment_pct}% of {appliesLabel(x.applies_to)}
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
  const [applies, setApplies] = useState<ExperienceApplies>('all')
  const [file, setFile] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const refs: [string, string][] =
    scope === 'system'
      ? systemsOf(e.positions).map((s) => [s.id, s.id])
      : scope === 'category'
        ? e.categories.map((c) => [c.id, c.label])
        : scope === 'position'
          ? e.positions.map((p) => [p.lv_id, `${p.lv_id} ${p.title}`.slice(0, 70)])
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
            applies_to: kind === 'estimate' ? applies : 'all',
            author: e.tender.meta.estimator,
          },
          file,
        ),
      'Experience saved.',
    )
    if (ok) {
      setText('')
      setPct('')
      setApplies('all')
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
          <span>Adjustment (%)</span>
          <div className="inline">
            <input type="number" step="0.5" value={pct} placeholder="e.g. 5 or -3" onChange={(ev) => setPct(ev.target.value)} />
            <select value={applies} onChange={(ev) => setApplies(ev.target.value as ExperienceApplies)} aria-label="Applies to">
              {APPLIES.map(([k, l]) => (
                <option key={k} value={k}>
                  of {l}
                </option>
              ))}
            </select>
          </div>
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
