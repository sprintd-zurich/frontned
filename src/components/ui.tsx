import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { STATUS_META } from '../format'
import type { Position } from '../types'

export function Badge({ tone, children, title }: { tone: string; children: ReactNode; title?: string }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      <i />
      {children}
    </span>
  )
}

/** Approved positions show as Approved; everything else by its pricing status. */
export function StatusBadge({ p }: { p: Pick<Position, 'status' | 'reviewed'> }) {
  if (p.reviewed) return <Badge tone="success" title="Approved by the estimator">Approved</Badge>
  const m = STATUS_META[p.status]
  return (
    <Badge tone={m.tone} title={m.help}>
      {m.label}
    </Badge>
  )
}

export function Button({
  children,
  onClick,
  primary = false,
  className = '',
  disabled = false,
  title,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  primary?: boolean
  className?: string
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
}) {
  return (
    <button type={type} title={title} disabled={disabled} className={`button ${primary ? 'primary' : ''} ${className}`} onClick={onClick}>
      {children}
    </button>
  )
}

export function Ring({ value, size = 104, label, color = '#087dff' }: { value: number; size?: number; label?: string; color?: string }) {
  return (
    <div
      className="ring"
      style={{ width: size, height: size, background: `conic-gradient(${color} 0% ${value}%, #e3e8f0 ${value}% 100%)` }}
    >
      <div>
        <strong>{value}%</strong>
        {label && <small>{label}</small>}
      </div>
    </div>
  )
}

export function Progress({ value, color = '#0785ff' }: { value: number; color?: string }) {
  return (
    <div className="progress-track">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  )
}

export function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', h)
    document.querySelector<HTMLButtonElement>('.modal .icon-button')?.focus()
    return () => document.removeEventListener('keydown', h)
  }, [close])
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className={`modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return
          const els = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex="0"]'),
          ).filter((x) => !x.hasAttribute('disabled'))
          const first = els[0]
          const last = els[els.length - 1]
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }}
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close dialog" onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

/** Illustration only (no product photos in the reference data): a damper for fire items, a duct part otherwise. */
export function ProductGraphic({ fire = false }: { fire?: boolean }) {
  return (
    <svg className="product-graphic" viewBox="0 0 100 80" aria-hidden="true">
      <defs>
        <linearGradient id="metal">
          <stop stopColor="#89949c" />
          <stop offset=".3" stopColor="#f1f3f4" />
          <stop offset=".65" stopColor="#79858d" />
          <stop offset="1" stopColor="#ccd4d8" />
        </linearGradient>
      </defs>
      {fire ? (
        <>
          <path d="M17 21 63 10 85 26 85 65 40 77 17 61Z" fill="url(#metal)" stroke="#75808a" />
          <path d="m26 27 37-9 0 38-37 10Z" fill="#34424b" />
          <path d="m31 32 27-7 0 27-27 8Z" fill="#9ba6ad" />
          <path d="m39 28 9 30" stroke="#243540" strokeWidth="5" />
          <rect x="72" y="30" width="20" height="25" rx="3" fill="#ef7927" />
        </>
      ) : (
        <>
          <path d="m24 23 40-13 18 8-4 45-40 12-15-10" fill="url(#metal)" stroke="#6a757c" />
          <ellipse cx="36" cy="47" rx="23" ry="29" fill="url(#metal)" stroke="#9ba4a9" strokeWidth="3" />
          <ellipse cx="36" cy="47" rx="16" ry="22" fill="#39474f" />
          <path d="M24 62 47 29 51 33 29 67Z" fill="#bfc7cb" />
          <path d="m40 47 46-16" stroke="#77838b" strokeWidth="3" />
        </>
      )}
    </svg>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      {children}
    </div>
  )
}
