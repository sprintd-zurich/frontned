import { FileText } from 'lucide-react'
import { systemsOf } from '../derive'
import { useEstimate, useStore } from '../store'
import { Detail } from '../components/Detail'
import { Filters, PositionTable, useFiltered } from '../components/PositionTable'
import { Empty } from '../components/ui'
import { BuildUp } from './BuildUp'
import { ChecksCard } from './Checks'

/** The review queue: positions that need a decision first, the detail with its calculation on the right. */
export function Workspace() {
  const e = useEstimate()
  const { selected, system } = useStore()
  const rows = useFiltered(true)
  const view = useStore((s) => s.calcView)
  const setView = (v: 'positions' | 'buildup') => useStore.setState({ calcView: v })
  const p = e.positions.find((x) => x.lv_id === selected) ?? rows[0] ?? e.positions[0]
  const sys = systemsOf(e.positions).find((s) => s.id === system)
  if (view === 'buildup') return <BuildUp onBack={() => setView('positions')} />
  return (
    <div className="workspace review">
      <ChecksCard />
      <section className="card positions-list">
        <div className="section-heading">
          <div className="inline">
            <h2>Review</h2>
            <span className="subtitle">
              {rows.length} positions {sys && `(${sys.name})`} need your sign-off
            </span>
          </div>
          <div className="segmented">
            <button className="active">Positions</button>
            <button onClick={() => setView('buildup')}>Project build-up</button>
          </div>
        </div>
        <Filters review />
        <PositionTable rows={rows} mode="review" limit={10} />
      </section>
      {p ? (
        <Detail p={p} mode="review" rows={rows} />
      ) : (
        <section className="card">
          <Empty icon={<FileText size={28} />} title="No position selected" />
        </section>
      )}
    </div>
  )
}
