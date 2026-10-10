import { useEffect, useState } from 'react'
import { FileCheck2, FileText } from 'lucide-react'
import { api } from '../api'
import { useEstimate, useStore } from '../store'
import { Filters, PositionTable, useFiltered } from '../components/PositionTable'
import { PdfScroller } from '../components/PdfScroller'
import { Split } from '../components/Split'

type PricedInfo = Awaited<ReturnType<typeof api.pricedLvInfo>>

/**
 * The extracted positions next to the tender page, with the selected position highlighted on the page.
 * With `priced` the page is the tender as it will be submitted, with the prices filled in.
 */
export function FaceToFace({ priced = false }: { priced?: boolean }) {
  const e = useEstimate()
  const { selected, select, filter } = useStore()
  const filtered = useFiltered()
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
  const rows = filtered
  // a click on the tender page selects its item; filters that would hide it are cleared first
  const pick = (lvId: string) => {
    if (!filtered.some((x) => x.lv_id === lvId)) filter({ pill: 'all', category: 'all', system: 'all', section: 'all', search: '', only: null, hideDucts: false })
    select(lvId)
  }
  return (
    <Split
      className={`face-layout ${priced ? 'priced' : ''}`}
      left={
        <section className="card">
          <div className="section-heading">
            <div className="inline">
              <h2>{priced ? 'Priced items' : 'Items'}</h2>
              <span className="subtitle">{rows.length} items</span>
            </div>
          </div>
          <Filters />
          <PositionTable rows={rows} mode={priced ? 'calculation' : 'positions'} limit={50} />
        </section>
      }
      right={
        <section className="card face-document">
          <div className="section-heading">
            <div className="doc-heading">
              <h2>{priced ? 'Priced tender' : 'Original tender'}</h2>
              <small title={e.tender.name}>
                {priced ? <FileCheck2 size={13} /> : <FileText size={13} />} {e.tender.name}
              </small>
            </div>
            {priced && info && (
              <small className="muted">
                {info.filled} of {info.positions} positions priced in the PDF
              </small>
            )}
          </div>
          {failed ? (
            <p className="muted">The priced tender could not be built: {failed}</p>
          ) : priced && !info ? (
            <div className="loading-state">
              <span className="spinner" /> Writing the prices into the tender…
            </div>
          ) : (
            <PdfScroller
              tenderId={e.tender.id}
              position={p}
              pages={e.tender.pages}
              onPick={pick}
              priced={priced && info ? { key: info.key, pages: info.pages } : undefined}
            />
          )}
        </section>
      }
    />
  )
}
