import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileCheck2, FileText } from 'lucide-react'
import { api } from '../api'
import { useEstimate, useStore } from '../store'
import { Filters, PositionTable, useFiltered } from '../components/PositionTable'
import { SourceView } from '../components/SourceView'
import { Button } from '../components/ui'

type PricedInfo = Awaited<ReturnType<typeof api.pricedLvInfo>>

/**
 * The extracted positions next to the tender page, with the selected position highlighted on the page.
 * With `priced` the page is the tender as it will be submitted, with the prices filled in.
 */
export function FaceToFace({ priced = false }: { priced?: boolean }) {
  const e = useEstimate()
  const navigate = useNavigate()
  const { selected } = useStore()
  const filtered = useFiltered()
  const [samePage, setSamePage] = useState(false)
  const [info, setInfo] = useState<PricedInfo | null>(null)
  const [failed, setFailed] = useState('')
  useEffect(() => {
    if (!priced) return
    let live = true
    setFailed('')
    api
      .pricedLvInfo(e.tender.id)
      .then((i) => live && setInfo(i))
      .catch((err) => live && setFailed((err as Error).message))
    return () => {
      live = false
    }
  }, [priced, e])
  const p = e.positions.find((x) => x.lv_id === selected) ?? filtered[0] ?? e.positions[0]
  const rows = samePage && p ? filtered.filter((x) => x.source_pages.includes(p.source_page)) : filtered
  return (
    <div className={`face-layout ${priced ? 'priced' : ''}`}>
      <section className="card">
        <div className="section-heading">
          <div className="inline">
            <h2>{priced ? 'Priced positions' : 'LV Positions'}</h2>
            <span className="subtitle">{rows.length} positions</span>
          </div>
          {!priced && (
            <Button onClick={() => navigate('/review')}>
              Review selected <ArrowRight size={16} />
            </Button>
          )}
        </div>
        <label className="check-field same-page">
          <input type="checkbox" checked={samePage} onChange={(ev) => setSamePage(ev.target.checked)} />
          Only positions from page {p?.source_page}
        </label>
        <Filters />
        <PositionTable rows={rows} mode={priced ? 'calculation' : 'positions'} limit={10} />
      </section>
      <section className="card face-document">
        <div className="section-heading">
          <h2>{priced ? 'Priced tender' : 'Original tender'}</h2>
          {priced && info && (
            <small className="muted">
              {info.filled} of {info.positions} positions priced in the PDF
            </small>
          )}
        </div>
        <div className="document-file">
          {priced ? <FileCheck2 size={18} /> : <FileText size={18} />} {e.tender.name}
          <small>· {p ? `${p.lv_id} ${p.title}` : ''}</small>
        </div>
        {failed ? (
          <p className="muted">The priced tender could not be built: {failed}</p>
        ) : priced && !info ? (
          <div className="loading-state">
            <span className="spinner" /> Writing the prices into the tender…
          </div>
        ) : (
          p && (
            <SourceView
              tenderId={e.tender.id}
              position={p}
              pages={e.tender.pages}
              zoomable
              priced={priced && info ? { key: info.key, pages: info.pages } : undefined}
            />
          )
        )}
      </section>
    </div>
  )
}
