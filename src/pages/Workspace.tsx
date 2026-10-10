import { useNavigate } from 'react-router-dom'
import { Calculator, FileText, Maximize2 } from 'lucide-react'
import { systemsOf } from '../derive'
import { tenderPath } from '../routes'
import { useEstimate, useStore } from '../store'
import { CostPanel } from '../components/CostPanel'
import { Detail } from '../components/Detail'
import { Filters, PositionTable, useFiltered, type Mode } from '../components/PositionTable'
import { SourceView } from '../components/SourceView'
import { Button, Empty } from '../components/ui'
import { BuildUp } from './BuildUp'
import { ChecksCard } from './Checks'

export function Workspace({ mode }: { mode: Mode }) {
  const e = useEstimate()
  const { selected, system, select } = useStore()
  const rows = useFiltered(mode === 'review')
  const navigate = useNavigate()
  const view = useStore((s) => (mode === 'calculation' ? s.calcView : 'positions'))
  const setView = (v: 'positions' | 'buildup') => useStore.setState({ calcView: v })
  const p = e.positions.find((x) => x.lv_id === selected) ?? rows[0] ?? e.positions[0]
  const sys = systemsOf(e.positions).find((s) => s.id === system)
  if (view === 'buildup') return <BuildUp onBack={() => setView('positions')} />
  return (
    <div className={`workspace ${mode}`}>
      {mode === 'review' && <ChecksCard />}
      <section className="card positions-list">
        <div className="section-heading">
          <div className="inline">
            <h2>{mode === 'review' ? 'Review' : mode === 'calculation' ? 'Calculation' : 'LV Positions'}</h2>
            <span className="subtitle">
              {rows.length} positions {sys && `(${sys.name})`}
              {mode === 'review' && ' need your sign-off'}
            </span>
          </div>
          {mode === 'positions' && (
            <Button onClick={() => navigate(tenderPath(e.tender.id, 'face-to-face'))}>
              <FileText size={16} /> Face 2 face
            </Button>
          )}
          {mode === 'calculation' && (
            <div className="segmented">
              <button className="active">Positions</button>
              <button onClick={() => setView('buildup')}>Project build-up</button>
            </div>
          )}
        </div>
        <Filters review={mode === 'review'} />
        <PositionTable rows={rows} mode={mode} limit={mode === 'positions' ? 8 : 10} />
      </section>
      {!p ? (
        <section className="card">
          <Empty icon={<FileText size={28} />} title="No position selected" />
        </section>
      ) : mode === 'positions' ? (
        <div className="position-bottom">
          <section className="card original-panel">
            <div className="section-heading">
              <h2>Original tender</h2>
              <small>Page {p.source_page}</small>
            </div>
            <SourceView tenderId={e.tender.id} position={p} pages={e.tender.pages} compact />
            <Button
              onClick={() => {
                select(p.lv_id)
                navigate(tenderPath(e.tender.id, 'face-to-face'))
              }}
            >
              <Maximize2 size={15} /> Open Face 2 face
            </Button>
          </section>
          <Detail p={p} mode="positions" rows={rows} />
          <section className="card cost-panel">
            <CostPanel p={p} />
            <div className="notice subtle">
              <Calculator size={16} /> Rates and factors from the project parameters · change them under Calculation
            </div>
          </section>
        </div>
      ) : (
        <Detail p={p} mode={mode} rows={rows} />
      )}
    </div>
  )
}
