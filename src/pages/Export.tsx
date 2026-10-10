import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, Download, Eye, FileSpreadsheet } from 'lucide-react'
import { api } from '../api'
import { isBlocker, lastOf, metrics, needsDecision, positionLabel, workflow } from '../derive'
import { fmtChf } from '../format'
import { useEstimate, useStore } from '../store'
import { PreviewModal, type PreviewKind } from '../components/PreviewModal'
import { Button, Ring, StatusBadge } from '../components/ui'
import { FaceToFace } from './FaceToFace'

export function Export() {
  const e = useEstimate()
  const { select, filter } = useStore()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<PreviewKind | null>(null)
  const [showAll, setShowAll] = useState(false)
  const m = metrics(e.positions)
  const steps = workflow(e)
  const blockers = e.positions.filter(isBlocker).sort((a, b) => Number(needsDecision(b)) - Number(needsDecision(a)))
  const warnings = e.checks.filter((c) => c.level === 'warning').length
  const rfqSent = !!lastOf(e.activity, ['export']) && e.activity.some((a) => a.kind === 'export' && (a.text.startsWith('RFQ') || a.text.startsWith('Supplier item list')))
  const checklist: [string, boolean, string][] = [
    ['Positions extracted from the tender', true, `${m.total} positions`],
    ['Every position matched', steps[1].value === 100, `${steps[1].value}%`],
    ['Open decisions resolved', m.decision === 0, m.decision ? `${m.decision} open` : 'Complete'],
    ['Supplier quotes requested', m.quote === 0 || rfqSent, m.quote ? `${m.quote} positions` : 'Complete'],
    ['Design checks verified', warnings === 0, warnings ? `${warnings} to verify` : 'Complete'],
    ['All positions approved', m.open === 0, m.open ? `${m.open} open` : 'Complete'],
    ['Submission date set', !!e.tender.meta.submission_date, e.tender.meta.submission_date || 'Open'],
  ]
  return (
    <div className="export-page">
      <section className="card export-header">
        <div>
          <span className="eyebrow">SUBMISSION WORKSPACE</span>
          <h1>Export & submission</h1>
          <p>
            {e.tender.meta.project_name || e.tender.name} <span className="separator">|</span> {e.tender.meta.trade || 'BKP 244'}{' '}
            <span className="separator">|</span> {fmtChf(e.project.selling_price_rounded_chf)}
          </p>
        </div>
        <div className="inline">
          <Button onClick={() => setPreview('excel')}>
            <FileSpreadsheet size={16} /> Offer (Excel)
          </Button>
          <Button primary onClick={() => setPreview('pdf')}>
            <Eye size={16} /> Preview priced tender
          </Button>
        </div>
      </section>
      <FaceToFace priced />
      <div className="export-grid">
        <section className="card">
          <h2>Submission checklist</h2>
          <div className="export-progress">
            <Ring value={m.percent} />
            <div>
              <h2>
                {m.approved} of {m.priceable} approved
              </h2>
              <p>{m.open} remaining submission blockers</p>
            </div>
          </div>
          {checklist.map(([label, ok, note]) => (
            <div className="checklist-item" key={label}>
              {ok ? <CheckCircle2 className="success-text" size={21} /> : <Clock3 className="warning-text" size={21} />}
              <span>{label}</span>
              <small>{note}</small>
            </div>
          ))}
          <div className="notice">
            <AlertTriangle size={19} />
            <span>
              Exports always reflect the current estimate. Open positions are exported with their status, so the files can be
              checked before every position is approved.
            </span>
          </div>
        </section>
        <section className="card blockers">
          <div className="section-heading">
            <h2>Unresolved blockers</h2>
            <span className="count-badge">{blockers.length}</span>
          </div>
          {blockers.length ? (
            <>
              {(showAll ? blockers : blockers.slice(0, 12)).map((p) => (
                <button
                  key={p.lv_id}
                  onClick={() => {
                    select(p.lv_id)
                    filter({ system: 'all', pill: 'all', search: '', only: null })
                    navigate('/review')
                  }}
                >
                  <span>
                    <strong>{positionLabel(p)}</strong>
                    <small>
                      {p.lv_id} · {p.assumptions[0] ?? 'Approval pending'}
                    </small>
                  </span>
                  <StatusBadge p={p} />
                  <ChevronRight size={16} />
                </button>
              ))}
              {blockers.length > 12 && (
                <button className="text-button show-more" onClick={() => setShowAll(!showAll)}>
                  {showAll ? 'Show fewer' : `Show all ${blockers.length}`}
                </button>
              )}
            </>
          ) : (
            <div className="empty-state">
              <CheckCircle2 size={34} />
              <h3>Ready for submission</h3>
              <p>Every priced position is approved.</p>
            </div>
          )}
        </section>
      </div>
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
