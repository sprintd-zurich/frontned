import { useRef, type CSSProperties, type ReactNode } from 'react'
import { useStore } from '../store'

/**
 * Two sides with a bar between them that can be dragged (or moved with the arrow keys) to change their ratio.
 * The ratio is shared by every split view and remembered in the browser; a double click resets it to half.
 * `top` spans both sides above them (e.g. the design checks on Review).
 */
export function Split({
  left,
  right,
  top,
  className = '',
}: {
  left: ReactNode
  right: ReactNode
  top?: ReactNode
  className?: string
}) {
  const { ratio, setRatio } = useStore()
  const ref = useRef<HTMLDivElement>(null)
  const start = (ev: React.PointerEvent) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    ev.preventDefault()
    document.body.classList.add('resizing')
    const move = (e: PointerEvent) => setRatio((e.clientX - box.left) / box.width)
    const stop = () => {
      document.body.classList.remove('resizing')
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop)
  }
  return (
    <div ref={ref} className={`split-view ${className}`} style={{ '--ratio': ratio } as CSSProperties}>
      {top}
      {left}
      <div
        className="split-bar"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the left and right side"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={20}
        aria-valuemax={80}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={start}
        onDoubleClick={() => setRatio(0.5)}
        onKeyDown={(ev) => {
          if (ev.key === 'ArrowLeft') setRatio(ratio - 0.03)
          if (ev.key === 'ArrowRight') setRatio(ratio + 0.03)
        }}
      >
        <span />
      </div>
      {right}
    </div>
  )
}
