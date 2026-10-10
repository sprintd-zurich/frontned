import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { api } from '../api'
import type { Position } from '../types'
import { useSource } from './SourceView'

type Box = { x0: number; y0: number; x1: number; y1: number }
type PagePosition = { lv_id: string; block: Box | null; lines: Box[] }

const pageCache = new Map<string, Promise<PagePosition[]>>()
function pagePositions(tenderId: string, page: number) {
  const k = `${tenderId}/${page}`
  if (!pageCache.has(k)) pageCache.set(k, api.pagePositions(tenderId, page).catch(() => []))
  return pageCache.get(k)!
}

const area = (b: Box) => (b.x1 - b.x0) * (b.y1 - b.y0)
const inside = (b: Box, x: number, y: number) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1

/** The position under a point of a page: its quantity line first, else the smallest item block around it. */
function hit(list: PagePosition[], x: number, y: number) {
  const line = list.find((p) => p.lines.some((b) => inside(b, x, y)))
  if (line) return line
  return list.filter((p) => p.block && inside(p.block, x, y)).sort((a, b) => area(a.block!) - area(b.block!))[0] ?? null
}

/**
 * The whole tender as one scrollable document. The selected position is highlighted on its page and scrolled
 * into view; a click on a position's text on the page selects that position (and with it the table row).
 */
export function PdfScroller({
  tenderId,
  position,
  pages,
  onPick,
  priced,
}: {
  tenderId: string
  position: Position | undefined
  pages: number
  onPick?: (lvId: string) => void
  /** the priced tender (same page numbers, price annex appended) instead of the original */
  priced?: { key: string; pages: number }
}) {
  const total = priced?.pages ?? pages
  const src = useSource(tenderId, position?.lv_id ?? null)
  const [zoom, setZoom] = useState(100)
  const [current, setCurrent] = useState(position?.source_page ?? 1)
  const [typed, setTyped] = useState('')
  const [hover, setHover] = useState<{ page: number; p: PagePosition } | null>(null)
  const [found, setFound] = useState<Record<number, PagePosition[]>>({})
  const view = useRef<HTMLDivElement>(null)
  const refs = useRef<(HTMLDivElement | null)[]>([])

  const scrollTo = (page: number, y = 0, smooth = false) => {
    const v = view.current
    const el = refs.current[page - 1]
    if (!v || !el) return
    v.scrollTo({ top: Math.max(0, el.offsetTop + y * el.offsetHeight - 70), behavior: smooth ? 'smooth' : 'auto' })
  }

  // follow the selection: jump to the highlighted block of the selected position
  useEffect(() => {
    if (!position) return
    const box = src && src.page === position.source_page ? (src.block ?? src.lines[0]) : null
    scrollTo(position.source_page, box ? box.y0 : 0, true)
    // the page heights settle once images load; zoom changes them too
  }, [position?.lv_id, src, zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  const onScroll = () => {
    const v = view.current
    if (!v) return
    const mid = v.scrollTop + v.clientHeight / 3
    let n = 1
    for (let i = 0; i < refs.current.length; i++) {
      const el = refs.current[i]
      if (el && el.offsetTop <= mid) n = i + 1
      else if (el) break
    }
    if (n !== current) setCurrent(n)
  }

  const load = (page: number) => {
    if (!onPick || page > pages || found[page]) return
    pagePositions(tenderId, page).then((list) => setFound((f) => ({ ...f, [page]: list })))
  }

  const point = (ev: React.MouseEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect()
    return [(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height] as const
  }

  const jump = () => {
    const n = Math.round(Number(typed))
    if (n >= 1 && n <= total) scrollTo(n)
    setTyped('')
  }

  return (
    <div className="source-view pdf-scroller">
      <div className="document-toolbar">
        <div className="inline page-jump">
          <span>Page</span>
          <input
            aria-label="Go to page"
            inputMode="numeric"
            value={typed}
            placeholder={String(current)}
            onChange={(ev) => setTyped(ev.target.value.replace(/\D/g, ''))}
            onKeyDown={(ev) => ev.key === 'Enter' && jump()}
            onBlur={() => typed && jump()}
          />
          <span>/ {total}</span>
          {position && current !== position.source_page && (
            <button className="text-button" onClick={() => scrollTo(position.source_page, src?.block?.y0 ?? 0, true)}>
              Back to {position.ref ?? position.lv_id} (p. {position.source_page})
            </button>
          )}
        </div>
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
      <div ref={view} className="document-viewport source-viewport pdf-pages" onScroll={onScroll}>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => {
          const marks = src && position && src.page === n ? src : null
          const list = found[n]
          return (
            <div
              key={n}
              ref={(el) => {
                refs.current[n - 1] = el
              }}
              className={`source-paper pdf-page ${onPick && list?.length ? 'pickable' : ''}`}
              style={{ width: `${zoom}%` }}
              onMouseEnter={() => load(n)}
              onMouseMove={(ev) => {
                if (!list) return
                const [x, y] = point(ev)
                const p = hit(list, x, y)
                if (p?.lv_id !== hover?.p.lv_id || hover?.page !== n) setHover(p ? { page: n, p } : null)
              }}
              onMouseLeave={() => setHover(null)}
              onClick={(ev) => {
                if (!list || !onPick) return
                const [x, y] = point(ev)
                const p = hit(list, x, y)
                if (p) onPick(p.lv_id)
              }}
            >
              <img
                loading="lazy"
                src={priced ? api.pricedLvPageUrl(tenderId, n, priced.key) : api.pageUrl(tenderId, n)}
                alt={`${priced ? 'Priced tender' : 'Tender'} page ${n}`}
              />
              <span className="pdf-page-no">{n}</span>
              {marks?.block && <i className="hl-block" style={boxStyle(marks.block)} />}
              {marks?.lines.map((b, i) => <i key={i} className="hl-line" style={boxStyle(b)} />)}
              {hover?.page === n && hover.p.lv_id !== position?.lv_id && (hover.p.block ?? hover.p.lines[0]) && (
                <i className="hl-hover" style={boxStyle((hover.p.block ?? hover.p.lines[0])!)}>
                  <b>{hover.p.lv_id}</b>
                </i>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const pad = 0.004
function boxStyle(b: Box) {
  return {
    left: `${(b.x0 - pad) * 100}%`,
    top: `${(b.y0 - pad) * 100}%`,
    width: `${(b.x1 - b.x0 + 2 * pad) * 100}%`,
    height: `${(b.y1 - b.y0 + 2 * pad) * 100}%`,
  }
}
