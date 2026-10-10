import { FileText } from 'lucide-react'
import { systemsOf } from '../derive'
import { useEstimate, useStore } from '../store'
import { Detail } from '../components/Detail'
import { Filters, PositionTable, useFiltered } from '../components/PositionTable'
import { Empty } from '../components/ui'
import { Split } from '../components/Split'

/**
 * The review queue: every tender position matched against the company database (catalogue, supplier packages,
 * productivity rules). Positions without company data come first: review them, add the information or ask for it.
 */
export function Workspace() {
  const e = useEstimate()
  const { selected, system } = useStore()
  const rows = useFiltered(true)
  const p = e.positions.find((x) => x.lv_id === selected) ?? rows[0] ?? e.positions[0]
  const sys = systemsOf(e.positions).find((s) => s.id === system)
  return (
    <Split
      className="workspace review"
      left={
        <section className="card positions-list">
          <div className="section-heading">
            <div className="inline">
              <h2>Review</h2>
              <span className="subtitle">
                {rows.length} items {sys && `(${sys.name})`} need your sign-off
              </span>
            </div>
          </div>
          <Filters review />
          <PositionTable rows={rows} mode="review" limit={50} />
        </section>
      }
      right={
        p ? (
          <Detail p={p} mode="review" rows={rows} />
        ) : (
          <section className="card">
            <Empty icon={<FileText size={28} />} title="No position selected" />
          </section>
        )
      }
    />
  )
}
