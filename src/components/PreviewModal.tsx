import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from 'lucide-react'
import { api } from '../api'
import { fmtChf } from '../format'

export type PreviewKind = 'pdf' | 'excel'

type Info = Awaited<ReturnType<typeof api.pricedLvInfo>>
type Sheets = Awaited<ReturnType<typeof api.exportPreview>>

/** Full-screen check of an export before it is downloaded: PDF pages as images, the workbook as tables. */
export function PreviewModal({ kind, tenderId, onClose }: { kind: PreviewKind; tenderId: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [onClose])
  const pdf = kind === 'pdf'
  return (
    <div className="modal-backdrop preview-backdrop" onClick={onClose}>
      <section
        className="modal preview"
        role="dialog"
        aria-modal="true"
        aria-label={pdf ? 'Priced tender preview' : 'Offer workbook preview'}
        onClick={(e) => e.stopPropagation()}
      >
        {pdf ? <PdfPreview tenderId={tenderId} onClose={onClose} /> : <ExcelPreview tenderId={tenderId} onClose={onClose} />}
      </section>
    </div>
  )
}

function Bar({ title, sub, children, onClose }: { title: string; sub?: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="preview-bar">
      <div>
        <h2>{title}</h2>
        {sub && <small className="muted">{sub}</small>}
      </div>
      <div className="inline">
        {children}
        <button className="icon-button" onClick={onClose} aria-label="Close preview">
          <X />
        </button>
      </div>
    </div>
  )
}

function PdfPreview({ tenderId, onClose }: { tenderId: string; onClose: () => void }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.pricedLvInfo(tenderId).then(setInfo).catch((e) => setError((e as Error).message))
  }, [tenderId])

  // keep the page counter in step with scrolling
  useEffect(() => {
    const root = scroller.current
    if (!root || !info) return
    const seen = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setPage(Number((e.target as HTMLElement).dataset.page))),
      { root, threshold: 0.5 },
    )
    root.querySelectorAll('.preview-page').forEach((el) => seen.observe(el))
    return () => seen.disconnect()
  }, [info])

  const go = (n: number) => {
    if (!info) return
    const p = Math.min(Math.max(1, n), info.pages)
    scroller.current?.querySelector(`[data-page="${p}"]`)?.scrollIntoView({ block: 'start' })
    setPage(p)
  }

  return (
    <>
      <Bar
        title="Priced tender (PDF)"
        sub={info ? `${info.pages} pages · ${info.filled} of ${info.positions} positions priced · total ${fmtChf(info.total_chf)}` : 'Writing the prices into the tender…'}
        onClose={onClose}
      >
        <a className="button" href={api.pricedLvUrl(tenderId, true)} target="_blank" rel="noreferrer">
          <ExternalLink size={15} /> Open in new tab
        </a>
        <a className="button primary" href={api.pricedLvUrl(tenderId)} download>
          <Download size={15} /> Download PDF
        </a>
      </Bar>
      {info && (
        <div className="preview-nav">
          <button className="icon-button" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft size={16} />
          </button>
          <label>
            Page
            <input type="number" min={1} max={info.pages} value={page} onChange={(e) => go(Number(e.target.value))} />
            of {info.pages}
          </label>
          <button className="icon-button" onClick={() => go(page + 1)} disabled={page >= info.pages} aria-label="Next page">
            <ChevronRight size={16} />
          </button>
          <span className="preview-jumps">
            <button className="text-button" onClick={() => go(1)}>
              Cover sheet
            </button>
            <button className="text-button" onClick={() => go(2)}>
              Cost summary
            </button>
            {info.pages > 202 && (
              <button className="text-button" onClick={() => go(203)}>
                Duct price annex
              </button>
            )}
          </span>
        </div>
      )}
      <div className="preview-body pages" ref={scroller}>
        {error && <div className="notice">{error}</div>}
        {!info && !error && (
          <div className="loading-state">
            <span className="spinner" /> Writing the prices into the tender…
          </div>
        )}
        {info &&
          Array.from({ length: info.pages }, (_, i) => i + 1).map((n) => (
            <div className="preview-page" key={n} data-page={n}>
              <img src={api.pricedLvPageUrl(tenderId, n, info.key)} alt={`Page ${n}`} loading="lazy" />
              <span>{n}</span>
            </div>
          ))}
      </div>
    </>
  )
}

function cell(v: string | number | boolean | null) {
  if (v === null) return ''
  if (typeof v === 'number') return Number.isInteger(v) ? v.toLocaleString('de-CH') : v.toLocaleString('de-CH', { maximumFractionDigits: 2 })
  return String(v)
}

function ExcelPreview({ tenderId, onClose }: { tenderId: string; onClose: () => void }) {
  const [sheets, setSheets] = useState<Sheets | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    api.exportPreview(tenderId).then(setSheets).catch((e) => setError((e as Error).message))
  }, [tenderId])

  const sheet = sheets?.[active]
  const [head, ...body] = sheet?.rows ?? []
  return (
    <>
      <Bar title="Offer workbook (Excel)" sub={sheets ? `${sheets.length} sheets` : 'Building the workbook…'} onClose={onClose}>
        <a className="button primary" href={api.exportUrl(tenderId)} download>
          <Download size={15} /> Download Excel
        </a>
      </Bar>
      {sheets && (
        <div className="filter-pills sheet-tabs" role="tablist">
          {sheets.map((s, i) => (
            <button key={s.name} role="tab" aria-selected={i === active} className={i === active ? 'active' : ''} onClick={() => setActive(i)}>
              {s.name} <span>{Math.max(s.rows.length - 1, 0)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="preview-body sheet">
        {error && <div className="notice">{error}</div>}
        {!sheets && !error && (
          <div className="loading-state">
            <span className="spinner" /> Building the workbook…
          </div>
        )}
        {sheet && (
          <table className="position-table sheet-table">
            <thead>
              <tr>
                {(head ?? []).map((h, i) => (
                  <th key={i}>{cell(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, i) => (
                <tr key={i}>
                  {r.map((v, j) => (
                    <td key={j} className={typeof v === 'number' ? 'num' : ''} title={typeof v === 'string' && v.length > 40 ? v : undefined}>
                      {cell(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
