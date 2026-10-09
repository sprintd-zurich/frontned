import type { Status } from './types'

const chf0 = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 })
const chf2 = new Intl.NumberFormat('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('de-CH', { maximumFractionDigits: 2 })

export const fmtChf = (v: number | null | undefined, decimals = false) =>
  v == null ? '–' : `CHF ${(decimals ? chf2 : chf0).format(v)}`
export const fmtNum = (v: number | null | undefined) => (v == null ? '–' : num.format(v))

export const STATUS_META: Record<Status, { label: string; tone: string; help: string }> = {
  calculated: { label: 'Calculated', tone: 'ok', help: 'Exact catalogue match, priced with the productivity rule.' },
  supplier_quote_required: {
    label: 'Supplier quote',
    tone: 'info',
    help: 'Priced from a supplier package benchmark; confirm with a quote.',
  },
  assumption_applied: {
    label: 'Assumption',
    tone: 'warn',
    help: 'Priced with a stated assumption (e.g. nearest catalogue size).',
  },
  review_required: { label: 'Review', tone: 'alert', help: 'No reliable price found; the estimator needs to decide.' },
  insufficient_information: {
    label: 'Missing info',
    tone: 'alert',
    help: 'The tender does not give enough information (e.g. blank quantity).',
  },
  out_of_scope: { label: 'Out of scope', tone: 'muted', help: 'Excluded from this offer.' },
  non_priceable: { label: 'Not priceable', tone: 'muted', help: 'Summary or text line; covered elsewhere.' },
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
