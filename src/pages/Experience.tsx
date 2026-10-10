import { useRef, useState } from 'react'
import { Lightbulb, MessageSquareQuote, Paperclip, Percent, Sparkles, Trash2, TrendingUp } from 'lucide-react'
import { api } from '../api'
import { initials, systemsOf } from '../derive'
import { fmtWhen } from '../format'
import { useEstimate, useStore } from '../store'
import type { Experience as Entry } from '../types'
import { Button, Empty } from '../components/ui'

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
export function Experience() {
  const e = useEstimate()
  const [kind, setKind] = useState<Entry['kind'] | 'all'>('all')
  const entries = [...e.experience].reverse().filter((x) => kind === 'all' || x.kind === kind)
  const estimates = e.experience.filter((x) => x.adjustment_pct != null)
  const net = estimates.reduce((s, x) => s + (x.adjustment_pct ?? 0), 0)
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
            <strong>Planned</strong>
            <small>These entries will feed adjustments to the bid scenarios based on history and experience.</small>
          </span>
        </div>
      </section>
      <div className="experience-grid">
        <NewEntry />
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
          <h2>
            <TrendingUp size={18} /> Suggested adjustments
          </h2>
          <p className="muted">Collected from the estimates. Not applied to the price yet.</p>
          {estimates.length ? (
            <>
              {estimates.map((x) => (
                <div className="adjustment-row" key={x.id}>
                  <span>{x.text || x.file?.name}</span>
                  <small>{scopeLabel(x)}</small>
                  <b className={(x.adjustment_pct ?? 0) >= 0 ? 'up' : 'down'}>
                    {(x.adjustment_pct ?? 0) > 0 ? '+' : ''}
                    {x.adjustment_pct}%
                  </b>
                </div>
              ))}
              <div className="adjustment-row total">
                <span>Sum of suggestions</span>
                <small />
                <b className={net >= 0 ? 'up' : 'down'}>
                  {net > 0 ? '+' : ''}
                  {Math.round(net * 10) / 10}%
                </b>
              </div>
            </>
          ) : (
            <p className="muted">An estimate with a percentage shows up here.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function scopeLabel(x: Entry) {
  const s = SCOPES.find(([k]) => k === x.scope)?.[1] ?? x.scope
  return x.scope === 'project' ? s : `${s} ${x.ref}`
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
          <small>
            {scopeLabel(x)} · {x.author ? `${x.author} · ` : ''}
            {fmtWhen(x.at)}
          </small>
        </div>
        {x.text && <p>{x.text}</p>}
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
