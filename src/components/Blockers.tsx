import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import { isBlocker, needsDecision, positionLabel } from '../derive'
import { useStore } from '../store'
import { StatusBadge } from './ui'

/** The project's unresolved blockers, one click away from every tab: a warning sign in the top bar with a list. */
export function BlockersButton() {
  const estimate = useStore((s) => s.estimate)
  const { select, filter } = useStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (ev: MouseEvent) => !box.current?.contains(ev.target as Node) && setOpen(false)
    const esc = (ev: KeyboardEvent) => ev.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])
  if (!estimate) return null
  const blockers = estimate.positions.filter(isBlocker).sort((a, b) => Number(needsDecision(b)) - Number(needsDecision(a)))
  const go = (ids: string[], first?: string) => {
    filter({ only: { label: 'Unresolved blockers', ids }, pill: 'all', category: 'all', system: 'all', search: '' })
    if (first) select(first)
    setOpen(false)
    navigate('/review')
  }
  return (
    <div className="blockers-menu" ref={box}>
      <button
        className={`icon-button blockers-button ${blockers.length ? 'on' : ''}`}
        title={blockers.length ? `${blockers.length} unresolved blockers` : 'No unresolved blockers'}
        aria-label="Unresolved blockers"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <AlertTriangle />
        {blockers.length > 0 && <b>{blockers.length > 99 ? '99+' : blockers.length}</b>}
      </button>
      {open && (
        <div className="blockers-pop" role="dialog" aria-label="Unresolved blockers">
          <div className="section-heading">
            <h3>Unresolved blockers</h3>
            <span className="count-badge">{blockers.length}</span>
          </div>
          <small className="muted">{estimate.tender.meta.project_name || estimate.tender.name}</small>
          {blockers.length ? (
            <>
              <div className="blockers-list">
                {blockers.slice(0, 60).map((p) => (
                  <button key={p.lv_id} onClick={() => go(blockers.map((x) => x.lv_id), p.lv_id)}>
                    <span>
                      <strong>{positionLabel(p)}</strong>
                      <small>
                        {p.lv_id} · {p.assumptions[0] ?? 'Approval pending'}
                      </small>
                    </span>
                    <StatusBadge p={p} />
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
              <button className="text-button" onClick={() => go(blockers.map((x) => x.lv_id))}>
                Review all {blockers.length} <ChevronRight size={14} />
              </button>
            </>
          ) : (
            <p className="blockers-empty">
              <CheckCircle2 size={18} /> Every priced item is approved.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
