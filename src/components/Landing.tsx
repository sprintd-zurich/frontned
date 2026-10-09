import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

interface Props {
  busy: string | null
  error: string | null
  onDemo: () => void
  onUpload: (f: File) => void
  onOpen: (id: string) => void
}

const STEPS = [
  ['Ingest', 'Reads the full tender PDF'],
  ['Extract', 'Finds systems, positions, quantities and units'],
  ['Match', 'Links each position to catalogue items or supplier packages'],
  ['Estimate', 'Calculates installation hours and labour'],
  ['Price', 'Builds direct cost, overhead and selling price'],
  ['Review', 'Shows the source page and every assumption'],
]

export function Landing({ busy, error, onDemo, onUpload, onOpen }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [recent, setRecent] = useState<{ id: string; name: string; pages: number }[]>([])

  useEffect(() => {
    api.listTenders().then((t) => setRecent(t.slice(-5).reverse())).catch(() => {})
  }, [])

  return (
    <div className="landing">
      <div className="landing-hero">
        <div className="eyebrow">Equans Switzerland · Pricing Assistant</div>
        <h1>From tender to first price</h1>
        <p>
          Upload a tender package. The assistant extracts every LV position, matches it to the reference data and
          builds a first price you can check, adjust and defend.
        </p>
      </div>

      <div className="landing-grid">
        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            const f = e.dataTransfer.files[0]
            if (f) onUpload(f)
          }}
          onClick={() => !busy && input.current?.click()}
        >
          <input
            ref={input}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
          />
          {busy ? (
            <>
              <div className="spinner" />
              <div className="drop-title">{busy}</div>
            </>
          ) : (
            <>
              <div className="drop-icon">⇪</div>
              <div className="drop-title">Drop the tender PDF here</div>
              <div className="drop-sub">or click to choose a file (Leistungsverzeichnis, BKP 244)</div>
            </>
          )}
        </div>

        <div className="demo-card">
          <div className="eyebrow">Hackathon tender</div>
          <h3>Schulhaus Oberglatt</h3>
          <p>BKP 244 Lüftungsanlagen · 202 pages · 6 systems</p>
          <button className="btn primary" disabled={!!busy} onClick={onDemo}>
            Open the Oberglatt tender
          </button>
          {recent.length > 0 && (
            <div className="recent">
              <div className="muted small">Recent estimates</div>
              {recent.map((t) => (
                <button key={t.id} className="link" onClick={() => onOpen(t.id)} disabled={!!busy}>
                  {t.name} <span className="muted">· {t.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="banner error">{error}</div>}

      <ol className="steps">
        {STEPS.map(([t, d], i) => (
          <li key={t}>
            <span className="step-no">{String(i + 1).padStart(2, '0')}</span>
            <strong>{t}</strong>
            <span>{d}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
