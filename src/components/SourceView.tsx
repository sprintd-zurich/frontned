import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'
import { api } from '../api'
import type { Position, SourceLocation } from '../types'

const cache = new Map<string, Promise<SourceLocation>>()

export function useSource(tenderId: string, lvId: string | null) {
  const [src, setSrc] = useState<SourceLocation | null>(null)
  useEffect(() => {
    if (!lvId) return
    let live = true
    const k = `${tenderId}/${lvId}`
    if (!cache.has(k)) cache.set(k, api.source(tenderId, lvId).catch(() => ({ page: 0, lines: [], block: null, match: 0 })))
    cache.get(k)!.then((s) => live && setSrc(s))
    return () => {
      live = false
    }
  }, [tenderId, lvId])
  return src && lvId ? src : null
}

/** The rendered tender page with the position's source highlighted (block in peach, quantity line in orange). */
export function SourceView({
  tenderId,
  position,
  pages,
  compact = false,
  zoomable = false,
}: {
  tenderId: string
  position: Position
  pages: number
  compact?: boolean
  zoomable?: boolean
}) {
  const src = useSource(tenderId, position.lv_id)
  const [page, setPage] = useState(position.source_page)
  const [zoom, setZoom] = useState(100)
  const [loaded, setLoaded] = useState(false)
  const view = useRef<HTMLDivElement>(null)
  const paper = useRef<HTMLDivElement>(null)
  useEffect(() => setPage(position.source_page), [position.lv_id, position.source_page])
  useEffect(() => setLoaded(false), [page])

  const marks = src && src.page === page ? src : null
  // bring the highlighted block into view once the page image has its size
  useEffect(() => {
    const v = view.current
    const p = paper.current
    if (!v || !p || !loaded || !marks) return
    const box = marks.block ?? marks.lines[0]
    if (box) v.scrollTop = Math.max(0, box.y0 * p.offsetHeight - (compact ? 40 : 90))
  }, [loaded, marks, compact, zoom])

  return (
    <div className={`source-view ${compact ? 'compact' : ''}`}>
      <div className="document-toolbar">
        <div className="inline">
          <button className="icon-button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft size={15} />
          </button>
          <span>
            Page <b>{page}</b> / {pages}
          </span>
          <button className="icon-button" aria-label="Next page" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight size={15} />
          </button>
          {page !== position.source_page && (
            <button className="text-button" onClick={() => setPage(position.source_page)}>
              Back to p. {position.source_page}
            </button>
          )}
          {position.source_pages.length > 1 &&
            position.source_pages
              .filter((n) => n !== position.source_page)
              .map((n) => (
                <button key={n} className="text-button" onClick={() => setPage(n)}>
                  p. {n}
                </button>
              ))}
        </div>
        {zoomable && (
          <div className="inline">
            <button className="icon-button" aria-label="Zoom out" disabled={zoom <= 75} onClick={() => setZoom(zoom - 25)}>
              <Minus size={15} />
            </button>
            <span>{zoom}%</span>
            <button className="icon-button" aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom(zoom + 25)}>
              <Plus size={15} />
            </button>
          </div>
        )}
      </div>
      <div ref={view} className="document-viewport source-viewport">
        <div ref={paper} className="source-paper" style={{ width: `${zoom}%` }}>
          <img src={api.pageUrl(tenderId, page)} alt={`Tender page ${page}`} onLoad={() => setLoaded(true)} />
          {marks?.block && <i className="hl-block" style={boxStyle(marks.block)} />}
          {marks?.lines.map((b, i) => <i key={i} className="hl-line" style={boxStyle(b)} />)}
        </div>
      </div>
      {src && src.lines.length === 0 && page === position.source_page && (
        <small className="muted">The source line could not be located on the page; the extracted text is shown under Technical.</small>
      )}
    </div>
  )
}

const pad = 0.004
function boxStyle(b: { x0: number; y0: number; x1: number; y1: number }) {
  return {
    left: `${(b.x0 - pad) * 100}%`,
    top: `${(b.y0 - pad) * 100}%`,
    width: `${(b.x1 - b.x0 + 2 * pad) * 100}%`,
    height: `${(b.y1 - b.y0 + 2 * pad) * 100}%`,
  }
}
