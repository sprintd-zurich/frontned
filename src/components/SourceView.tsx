import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
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

/** The tender as a scrollable stack of pages. The selected position's page is scrolled into view and highlighted. */
export function SourceView({
  tenderId,
  position,
  pages,
  compact = false,
  zoomable = false,
  zoom: controlledZoom,
  onZoomChange,
  pricedKey,
}: {
  tenderId: string
  position: Position
  pages: number
  compact?: boolean
  zoomable?: boolean
  zoom?: number
  onZoomChange?: (zoom: number) => void
  pricedKey?: string
}) {
  const src = useSource(tenderId, position.lv_id)
  const [internalZoom, setInternalZoom] = useState(100)
  const zoom = controlledZoom ?? internalZoom
  const setZoom = onZoomChange ?? setInternalZoom
  const view = useRef<HTMLDivElement>(null)
  const target = position.source_page

  useEffect(() => {
    const root = view.current
    if (!root) return
    const slot = root.querySelector<HTMLElement>(`[data-page="${target}"]`)
    if (slot) root.scrollTop = Math.max(0, slot.offsetTop)
  }, [position.lv_id, target])

  return (
    <div className={`source-view scrollable ${compact ? 'compact' : ''}`}>
      {zoomable && (
        <div className="document-toolbar">
          <div className="inline">
            <button className="icon-button" aria-label="Zoom out" disabled={zoom <= 75} onClick={() => setZoom(zoom - 25)}>
              <Minus size={15} />
            </button>
            <span>{zoom}%</span>
            <button className="icon-button" aria-label="Zoom in" disabled={zoom >= 200} onClick={() => setZoom(zoom + 25)}>
              <Plus size={15} />
            </button>
          </div>
        </div>
      )}
      <div ref={view} className="document-viewport source-viewport source-scroll">
        <div className="source-stack" style={{ width: `${zoom}%` }}>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <TenderPage
              key={n}
              tenderId={tenderId}
              page={n}
              marks={src && src.page === n ? src : null}
              isSource={n === target}
              pricedKey={pricedKey}
            />
          ))}
        </div>
      </div>
      {src && src.lines.length === 0 && (
        <small className="muted">
          The source line could not be located on the page; the extracted text is shown under Technical.
        </small>
      )}
    </div>
  )
}

function TenderPage({
  tenderId,
  page,
  marks,
  isSource,
  pricedKey,
}: {
  tenderId: string
  page: number
  marks: SourceLocation | null
  isSource: boolean
  pricedKey?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setShow(true)
      },
      { rootMargin: '800px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!loaded || !marks || !isSource) return
    const v = ref.current?.closest('.source-viewport')
    const paper = ref.current
    if (!v || !paper) return
    const box = marks.block ?? marks.lines[0]
    if (box) {
      const top = paper.offsetTop + box.y0 * paper.offsetHeight
      ;(v as HTMLElement).scrollTop = Math.max(0, top - 80)
    }
  }, [loaded, marks, isSource])

  return (
    <div ref={ref} data-page={page} className={`source-page-slot ${isSource ? 'source' : ''}`}>
      <span className="source-page-label">Page {page}</span>
      {show ? (
        <div className="source-paper">
          <img
            src={pricedKey ? api.pricedLvPageUrl(tenderId, page, pricedKey) : api.pageUrl(tenderId, page)}
            alt={`${pricedKey ? 'Priced tender' : 'Tender'} page ${page}`}
            onLoad={() => setLoaded(true)}
          />
          {marks?.block && <i className="hl-block" style={boxStyle(marks.block)} />}
          {marks?.lines.map((b, i) => (
            <i key={i} className="hl-line" style={boxStyle(b)} />
          ))}
        </div>
      ) : (
        <div className="source-page-placeholder">Page {page}</div>
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
