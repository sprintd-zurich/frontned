import { useState } from 'react'
import { useEstimate, useStore } from '../store'
import type { Meta } from '../types'
import { Button } from '../components/ui'

const FIELDS: [keyof Meta, string, string?][] = [
  ['project_name', 'Project'],
  ['client', 'Client (Bauherr)'],
  ['location', 'Site'],
  ['tender_no', 'Tender no.'],
  ['submission_date', 'Submission date', 'date'],
  ['estimator', 'Estimator'],
]

/** Project details: read from the cover sheet where possible, completed by the estimator. */
export function MetaForm({ onDone }: { onDone: () => void }) {
  const meta = useEstimate().tender.meta
  const setMeta = useStore((s) => s.setMeta)
  const [draft, setDraft] = useState<Partial<Meta>>({})
  return (
    <form
      className="meta-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (Object.keys(draft).length) await setMeta(draft)
        onDone()
      }}
    >
      <p className="muted">Read from the tender cover sheet where possible. Submission date and estimator are yours to set.</p>
      {FIELDS.map(([k, label, type]) => (
        <label key={k}>
          <span>{label}</span>
          <input type={type ?? 'text'} value={draft[k] ?? meta[k] ?? ''} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
        </label>
      ))}
      <div className="modal-actions">
        <Button onClick={onDone}>Cancel</Button>
        <Button primary type="submit">
          Save details
        </Button>
      </div>
    </form>
  )
}
