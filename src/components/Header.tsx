import type { Estimate } from '../types'
import { fmtChf } from '../format'
import { api } from '../api'

export type Tab = 'positions' | 'buildup' | 'bid' | 'rfq'

interface Props {
  estimate: Estimate
  tab: Tab
  onTab: (t: Tab) => void
  busy: string | null
  onHome: () => void
}

export function Header({ estimate, tab, onTab, busy, onHome }: Props) {
  const ps = estimate.positions
  const priceable = ps.filter((p) => !['non_priceable', 'out_of_scope'].includes(p.status))
  const priced = priceable.filter((p) => p.direct_position_cost_chf > 0).length
  const exact = priceable.filter((p) => p.status === 'calculated').length
  const assumed = priceable.filter((p) => p.status === 'assumption_applied').length
  const attention = priceable.filter(
    (p) => !p.reviewed && ['review_required', 'insufficient_information'].includes(p.status),
  ).length
  const pct = (n: number) => `${Math.round((100 * n) / Math.max(priceable.length, 1))}%`

  return (
    <header className="header">
      <div className="header-top">
        <button className="brand" onClick={onHome} title="Back to start">
          <span className="brand-mark">E</span>
          <span>
            <strong>Pricing Assistant</strong>
            <span className="muted small"> · {estimate.tender.name}</span>
          </span>
        </button>
        <nav className="tabs">
          <button className={tab === 'positions' ? 'active' : ''} onClick={() => onTab('positions')}>
            Positions
          </button>
          <button className={tab === 'buildup' ? 'active' : ''} onClick={() => onTab('buildup')}>
            Price build-up
          </button>
          <button className={tab === 'bid' ? 'active' : ''} onClick={() => onTab('bid')}>
            Bid decision
          </button>
          <button className={tab === 'rfq' ? 'active' : ''} onClick={() => onTab('rfq')}>
            Supplier RFQs
          </button>
        </nav>
        <div className="busy">{busy && <span className="spinner small" />}</div>
        <a className="btn export" href={api.exportUrl(estimate.tender.id)} download>
          Export offer (Excel)
        </a>
      </div>
      <div className="kpis">
        <Kpi label="Positions found" value={String(ps.length)} sub={`${priceable.length} priceable`} />
        <Kpi label="Priced" value={pct(priced)} sub={`${exact} exact · ${assumed} with assumption`} tone="ok" />
        <Kpi label="Need your decision" value={String(attention)} sub="review or missing info" tone="alert" />
        <Kpi label="Direct cost incl. project costs" value={fmtChf(estimate.project.direct_cost_chf)} sub={`${estimate.project.install_hours.toLocaleString('de-CH')} h installation`} />
        <Kpi
          label="Indicative selling price"
          value={fmtChf(estimate.project.selling_price_rounded_chf)}
          sub={`${estimate.project.target_margin_pct}% margin · ${estimate.project.overhead_pct}% overhead`}
          tone="primary"
        />
      </div>
    </header>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className={`kpi ${tone ?? ''}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  )
}
