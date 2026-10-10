import type { Activity, Estimate, Position } from './types'

/** Colours of the design's system semicircles, assigned to the tender's systems in order. */
export const SYSTEM_COLORS = ['#0785ff', '#ff6a20', '#ee3547', '#009c7b', '#ffb91d', '#7752d7', '#a4aab7', '#062969']

export interface SystemInfo {
  id: string
  code: string
  name: string
  color: string
}

/** "244.01 LA01 Nebenräume UG" -> code 244.01, name "LA01 Nebenräume UG". */
export function systemsOf(positions: Position[]): SystemInfo[] {
  const ids = [...new Set(positions.map((p) => p.system))].sort()
  return ids.map((id, i) => {
    const m = id.match(/^(\d{3}\.\d{2})\s+(.*)$/)
    return { id, code: m?.[1] ?? '', name: m?.[2] ?? id, color: SYSTEM_COLORS[i % SYSTEM_COLORS.length] }
  })
}

export const isPriceable = (p: Position) => p.status !== 'non_priceable' && p.status !== 'out_of_scope'
export const needsDecision = (p: Position) =>
  !p.reviewed && (p.status === 'review_required' || p.status === 'insufficient_information')
/** How the position was matched against the company data (catalogue, supplier packages, productivity rules). */
export const MATCH_LABEL: Record<string, string> = {
  exact: 'Exact catalogue item',
  supplier: 'Supplier package',
  nearest: 'Nearest catalogue item',
  labour_only: 'Labour only (installation rule)',
  unknown: 'No match in the company data',
}
/** The company data covers the position: a quantity, a catalogue item or rule, and no open decision. */
export const hasCompanyData = (p: Position) =>
  !needsDecision(p) && p.quantity != null && p.match_kind !== 'unknown' && (!!p.product_id || (!!p.install_code && p.install_code !== 'UNKNOWN'))
/** Everything an estimator still has to sign off before the offer goes out. */
export const isBlocker = (p: Position) => isPriceable(p) && !p.reviewed
/** open positions a person has to act on: a decision, missing information or a supplier to contact */
export const needsHuman = (p: Position) => needsDecision(p) || (!p.reviewed && p.status === 'supplier_quote_required')
export const isDuctList = (p: Position) => p.kind.startsWith('duct') || p.kind.startsWith('fitting')

export function metrics(ps: Position[]) {
  const priceable = ps.filter(isPriceable)
  const approved = priceable.filter((p) => p.reviewed).length
  const decision = ps.filter(needsDecision).length
  return {
    total: ps.length,
    priceable: priceable.length,
    approved,
    decision,
    quote: priceable.filter((p) => !p.reviewed && p.status === 'supplier_quote_required').length,
    assumption: priceable.filter((p) => !p.reviewed && p.status === 'assumption_applied').length,
    open: priceable.length - approved,
    value: ps.reduce((s, p) => s + p.direct_position_cost_chf, 0),
    percent: priceable.length ? Math.round((approved / priceable.length) * 100) : 0,
  }
}

/** Status pills of the position tables. */
export const PILLS = [
  ['all', 'All'],
  ['decision', 'Needs review'],
  ['supplier', 'Supplier quote'],
  ['assumption', 'Assumption'],
  ['calculated', 'Calculated'],
  ['approved', 'Approved'],
] as const
export type Pill = (typeof PILLS)[number][0]

/** the colour of each status filter is the colour of its status tag in the table */
export const PILL_TONE: Record<string, string> = {
  all: 'neutral',
  decision: 'warning',
  supplier: 'violet',
  assumption: 'amber',
  calculated: 'info',
  approved: 'success',
}


export function pillMatch(p: Position, pill: Pill) {
  switch (pill) {
    case 'all':
      return true
    case 'decision':
      return needsDecision(p)
    case 'supplier':
      return !p.reviewed && p.status === 'supplier_quote_required'
    case 'assumption':
      return !p.reviewed && p.status === 'assumption_applied'
    case 'calculated':
      return !p.reviewed && p.status === 'calculated'
    case 'approved':
      return p.reviewed
  }
}

export function lastOf(activity: Activity[], kinds: Activity['kind'][]) {
  for (let i = activity.length - 1; i >= 0; i--) if (kinds.includes(activity[i].kind)) return activity[i]
  return null
}

/** The design's six workflow stages, measured on the real estimate. */
export function workflow(e: Estimate) {
  const priceable = e.positions.filter(isPriceable)
  const n = Math.max(priceable.length, 1)
  const share = (f: (p: Position) => boolean) => Math.round((priceable.filter(f).length / n) * 100)
  const lastExport = lastOf(e.activity, ['export'])
  const lastChange = lastOf(e.activity, ['change', 'review', 'scenario'])
  const exported = !!lastExport && (!lastChange || lastExport.at >= lastChange.at)
  return [
    { key: 'extract', label: 'Extract', value: share((p) => p.quantity != null), url: '/positions' },
    { key: 'match', label: 'Match', value: share((p) => p.match_kind !== 'unknown'), url: '/review' },
    { key: 'calculate', label: 'Calculate', value: share((p) => p.direct_position_cost_chf > 0), url: '/review' },
    { key: 'review', label: 'Review', value: share((p) => !needsDecision(p)), url: '/review' },
    { key: 'approve', label: 'Approve', value: share((p) => p.reviewed), url: '/review' },
    { key: 'export', label: 'Export', value: exported ? 100 : 0, url: '/export' },
  ]
}

export const positionLabel = (p: Position) => `${p.title}${p.variant ? ` · ${p.variant}` : ''}`

export function initials(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts.slice(0, 2).map((s) => s[0]!.toUpperCase()).join('') : 'ES'
}
