import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText } from 'lucide-react'
import { useEstimate, useStore } from '../store'
import { Filters, PositionTable, useFiltered } from '../components/PositionTable'
import { SourceView } from '../components/SourceView'
import { Button } from '../components/ui'

/** The tender page and the extracted positions side by side; the selected position is highlighted on the page. */
export function FaceToFace() {
  const e = useEstimate()
  const navigate = useNavigate()
  const { selected } = useStore()
  const filtered = useFiltered()
  const [samePage, setSamePage] = useState(true)
  const p = e.positions.find((x) => x.lv_id === selected) ?? filtered[0] ?? e.positions[0]
  const rows = samePage && p ? filtered.filter((x) => x.source_pages.includes(p.source_page)) : filtered
  return (
    <div className="face-layout">
      <section className="card face-document">
        <div className="section-heading">
          <h2>Face 2 face</h2>
          <button className="text-button" onClick={() => navigate('/positions')}>
            Back to positions <ArrowRight size={15} />
          </button>
        </div>
        <p className="muted">Compare the original tender with the extracted positions. Verify, correct and complete.</p>
        <div className="document-file">
          <FileText size={18} /> {e.tender.name}
          <small>· {p ? `${p.lv_id} ${p.title}` : ''}</small>
        </div>
        {p && <SourceView tenderId={e.tender.id} position={p} pages={e.tender.pages} zoomable />}
      </section>
      <section className="card">
        <div className="section-heading">
          <h2>Extracted positions</h2>
          <Button onClick={() => navigate('/review')}>
            Review selected <ArrowRight size={16} />
          </Button>
        </div>
        <label className="check-field same-page">
          <input type="checkbox" checked={samePage} onChange={(ev) => setSamePage(ev.target.checked)} />
          Only positions from page {p?.source_page}
        </label>
        <Filters />
        <PositionTable rows={rows} limit={8} />
      </section>
    </div>
  )
}
