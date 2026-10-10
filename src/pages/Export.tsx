import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronRight, Download, Eye, FileSpreadsheet } from 'lucide-react'
import { api } from '../api'
import { metrics, needsHuman } from '../derive'
import { fmtChf } from '../format'
import { useEstimate, useStore } from '../store'
import { PreviewModal, type PreviewKind } from '../components/PreviewModal'
import { Button } from '../components/ui'
import { FaceToFace } from './FaceToFace'

export function Export() {
  const e = useEstimate()
  const filter = useStore((s) => s.filter)
  const navigate = useNavigate()
  const [preview, setPreview] = useState<PreviewKind | null>(null)
  const m = metrics(e.positions)
  const pending = e.positions.filter(needsHuman)
  return (
    <div className="export-page">
      <section className="card export-header">
        <div>
          <span className="eyebrow">SUBMISSION WORKSPACE</span>
          <div className="export-title">
            <h1>Export</h1>
            {pending.length > 0 && (
              <button
                className="review-pending"
                title="Open these items in Review"
                onClick={() => {
                  filter({ only: { label: 'Needs attention', ids: pending.map((p) => p.lv_id) }, pill: 'all', category: 'all', system: 'all', search: '' })
                  navigate('/matched')
                }}
              >
                <AlertTriangle size={16} /> Needs attention · {pending.length}
              </button>
            )}
          </div>
          <p>
            {e.tender.meta.project_name || e.tender.name} <span className="separator">|</span> {e.tender.meta.trade || 'BKP 244'}{' '}
            <span className="separator">|</span> {fmtChf(e.offer.price_chf)}{' '}
            <small className="muted">{e.offer.scenario ? `${e.offer.scenario} bid` : 'indicative price, no bid selected'}</small>
            <span className="separator">|</span> {m.approved} of {m.priceable} approved
          </p>
        </div>
        <div className="inline">
          <Button onClick={() => setPreview('excel')}>
            <FileSpreadsheet size={16} /> Excel
          </Button>
          <Button onClick={() => setPreview('pdf')}>
            <Eye size={16} /> Preview PDF
          </Button>
          <a className="button primary" href={api.pricedLvUrl(e.tender.id)} download>
            <Download size={16} /> Export PDF
          </a>
        </div>
      </section>
      <FaceToFace priced />
      <section className="card">
        <h2>Documents</h2>
        <div className="doc-grid">
          <Doc
            icon="PDF"
            title="Priced tender (PDF)"
            sub="The LV itself with unit prices, amounts, chapter totals and the cover sheet filled in"
            onPreview={() => setPreview('pdf')}
            href={api.pricedLvUrl(e.tender.id)}
          />
          <Doc
            icon="XLS"
            title="Offer workbook (Excel)"
            sub="Summary, every position with its source page, open items, RFQs and parameters"
            onPreview={() => setPreview('excel')}
            href={api.exportUrl(e.tender.id)}
          />
          <Doc icon="PDF" title="Original tender" sub={`${e.tender.name} · ${e.tender.pages} pages`} href={api.tenderPdfUrl(e.tender.id)} open />
        </div>
      </section>
      <section className="card export-supplier">
        <div>
          <h2>Supplier requests</h2>
          <p className="muted">
            {m.quote ? `${m.quote} positions still wait for a supplier price.` : 'No position waits for a supplier price.'} Requests, mails
            and product sheets are prepared on the Supplier tab.
          </p>
        </div>
        <Button onClick={() => navigate('/supplier')}>
          Open Supplier <ChevronRight size={16} />
        </Button>
      </section>
      {preview && <PreviewModal kind={preview} tenderId={e.tender.id} onClose={() => setPreview(null)} />}
    </div>
  )
}

function Doc({ icon, title, sub, onPreview, href, open = false }: { icon: string; title: string; sub: string; onPreview?: () => void; href: string; open?: boolean }) {
  return (
    <div className="doc-card">
      <span className={`file-icon ${icon === 'XLS' ? 'csv' : ''}`}>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{sub}</small>
      </div>
      <div className="inline">
        {onPreview && (
          <Button className="small" onClick={onPreview}>
            <Eye size={14} /> Preview
          </Button>
        )}
        <a className="button small primary" href={href} {...(open ? { target: '_blank', rel: 'noreferrer' } : { download: true })}>
          <Download size={14} /> {open ? 'Open' : 'Download'}
        </a>
      </div>
    </div>
  )
}
