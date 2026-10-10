import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, FileSearch } from 'lucide-react'
import { useEstimate } from '../store'

/** What the parser read out of the tender PDF, and what it could not place.
 *
 * An estimator has to know whether a short offer means a small job or an unread document, so the
 * page budget is stated in full: front matter, the Leistungsverzeichnis itself, the engineer duct
 * lists, and anything left over. */
export function ExtractionCoverage() {
  const e = useEstimate()
  const x = e.extraction
  const [open, setOpen] = useState(false)
  if (!x || !x.pages) return null

  const complete = x.read_pages === x.body_pages && x.missed_pages.length === 0
  const other = Math.max(x.body_pages - x.lv_pages - x.duct_list_pages, 0)
  const segments = [
    { label: 'Front matter', pages: x.front_matter_pages, cls: 'skip' },
    { label: 'Leistungsverzeichnis', pages: x.lv_pages, cls: 'lv' },
    { label: 'Duct lists', pages: x.duct_list_pages, cls: 'duct' },
    { label: 'Not read', pages: other, cls: 'gap' },
    { label: 'Plan lists, annexes', pages: x.trailing_pages, cls: 'skip' },
  ].filter((s) => s.pages > 0)

  return (
    <div className={`coverage-card ${complete ? '' : 'alert'}`}>
      <div className="coverage-head">
        <div className="coverage-headline">
          <span className="coverage-eyebrow">
            <FileSearch size={12} /> EXTRACTION COVERAGE
          </span>
          <h3>
            {x.read_pages} of {x.body_pages} Leistungsverzeichnis pages read
            <span className="muted"> — {x.positions} positions</span>
          </h3>
          <p className="muted">
            {x.header_pattern
              ? `Recognised "${x.project}" as the running header${
                  x.header_pattern === 'bkp_code'
                    ? ' and read the BKP code off every page to assign its system.'
                    : '. No BKP code in the header, so systems come from the page titles.'
                }`
              : 'No running header recognised, so no positions could be read from this document.'}
          </p>
        </div>
        <div className="coverage-pages">
          <span className="coverage-pages-num">{x.pages}</span>
          <span className="coverage-pages-lbl">pages in document</span>
        </div>
      </div>

      <div className="coverage-bar">
        {segments.map((s) => (
          <div
            key={s.label}
            className={`coverage-seg ${s.cls}`}
            style={{ flexGrow: s.pages }}
            title={`${s.label}: ${s.pages} page${s.pages === 1 ? '' : 's'}`}
          />
        ))}
      </div>
      <div className="coverage-legend">
        {segments.map((s) => (
          <span key={s.label}>
            <i className={`coverage-dot ${s.cls}`} />
            {s.label} · {s.pages}
          </span>
        ))}
      </div>

      {x.warnings.map((w) => (
        <p key={w} className="coverage-warning">
          <AlertTriangle size={14} /> {w}
        </p>
      ))}

      <button className="coverage-toggle" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {open ? 'Hide' : 'Show'} the page-by-page breakdown
      </button>

      {open && (
        <div className="coverage-detail">
          <table className="coverage-table">
            <thead>
              <tr>
                <th>System</th>
                <th className="r">LV pages</th>
                <th className="r">Positions</th>
              </tr>
            </thead>
            <tbody>
              {x.systems.map((s) => (
                <tr key={s.system}>
                  <td>{s.system}</td>
                  <td className="r">{s.pages || '—'}</td>
                  <td className="r">{s.positions}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {x.unread.length > 0 && (
            <div className="coverage-unread">
              <strong>Pages the parser did not place</strong>
              <ul>
                {x.unread.map((u) => (
                  <li key={u.page}>
                    <a
                      className="link-button"
                      href={`/api/tenders/${e.tender.id}/pages/${u.page}.png`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Page {u.page}
                    </a>
                    <span className="muted">{u.first_line || '(no text on the first line)'}</span>
                    {u.quantity_lines > 0 && (
                      <em className="coverage-flag">
                        {u.quantity_lines} quantity line{u.quantity_lines === 1 ? '' : 's'}
                      </em>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
