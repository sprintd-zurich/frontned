import type { Status } from './types'

const nf = (d: number) => new Intl.NumberFormat('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d })
const plain = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 })

/** CHF amounts without the currency, Swiss grouping (1’234.50). */
export const money = (v: number, decimals = 0) => nf(decimals).format(v)
export const fmtChf = (v: number | null | undefined, decimals = false) =>
  v == null ? '–' : `CHF ${money(v, decimals ? 2 : 0)}`
export const fmtNum = (v: number | null | undefined) => (v == null ? '–' : plain.format(v))
export const pct = (v: number) => `${Math.round(v * 100)}%`

export const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const fmtWhen = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const time = d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`
  const y = new Date(today)
  y.setDate(today.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${time}`
  return `${fmtDate(iso)}, ${time}`
}

/** "04.08.2026" (as printed in the tender) or ISO "2026-10-30" to a Date. */
export const parseDay = (s: string | null | undefined) => {
  if (!s) return null
  const ch = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  const d = ch ? new Date(+ch[3], +ch[2] - 1, +ch[1]) : new Date(`${s.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export const UNIT: Record<string, string> = { pc: 'Stk', m2: 'm²', m: 'm', h: 'h', LS: 'psch' }
export const unit = (u: string) => UNIT[u] ?? u

export const STATUS_META: Record<Status, { label: string; tone: string; help: string }> = {
  calculated: { label: 'Calculated', tone: 'info', help: 'Exact catalogue match, priced with the productivity rule.' },
  supplier_quote_required: {
    label: 'Supplier quote',
    tone: 'violet',
    help: 'Priced from a supplier package benchmark; confirm with a quote.',
  },
  assumption_applied: {
    label: 'Assumption',
    tone: 'amber',
    help: 'Priced with a stated assumption (e.g. nearest catalogue size).',
  },
  review_required: { label: 'Needs review', tone: 'warning', help: 'No reliable price found; the estimator needs to decide.' },
  insufficient_information: {
    label: 'Missing info',
    tone: 'danger',
    help: 'The tender does not give enough information (e.g. blank quantity).',
  },
  out_of_scope: { label: 'Out of scope', tone: 'neutral', help: 'Excluded from this offer.' },
  non_priceable: {
    label: 'Not priced separately',
    tone: 'neutral',
    help: 'Summary line, or work already in a project cost line (see the note on the position).',
  },
}

export const STATUS_ORDER: Status[] = [
  'calculated',
  'supplier_quote_required',
  'assumption_applied',
  'review_required',
  'insufficient_information',
  'out_of_scope',
  'non_priceable',
]
