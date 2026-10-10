import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link2 } from 'lucide-react'
import type { Trace } from '../types'

/** A number with its source: a click shows where it comes from (tender, company catalogue, rule, parameter or an edit). */
export function Traced({ trace, children, className = '' }: { trace?: Trace; children: ReactNode; className?: string }) {
  // fixed to the viewport so scrolling tables and panels never clip it
  const [open, setOpen] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(null)
    const away = (ev: MouseEvent) => !ref.current?.contains(ev.target as Node) && close()
    const esc = (ev: KeyboardEvent) => ev.key === 'Escape' && close()
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    document.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])
  if (!trace) return <span className={className}>{children}</span>
  return (
    <span className={`traced ${className}`} ref={ref}>
      <button
        type="button"
        className="traced-value"
        aria-expanded={!!open}
        title={`Source: ${trace.source}`}
        onClick={(ev) => {
          ev.stopPropagation()
          const r = ev.currentTarget.getBoundingClientRect()
          const below = r.bottom + 180 < window.innerHeight
          setOpen(open ? null : { top: below ? r.bottom + 6 : Math.max(8, r.top - 186), left: Math.max(8, Math.min(r.left, window.innerWidth - 396)) })
        }}
      >
        {children}
      </button>
      {open && (
        <span className="trace-pop" role="dialog" aria-label="Source of this number" style={open}>
          <strong>
            <Link2 size={13} /> {trace.source}
          </strong>
          {trace.lines.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </span>
      )}
    </span>
  )
}

/** The source of a value as a small clickable line under it. */
export function SourceLine({ trace }: { trace?: Trace }) {
  if (!trace) return null
  return (
    <Traced trace={trace} className="source-line">
      <Link2 size={11} /> {trace.source}
    </Traced>
  )
}
