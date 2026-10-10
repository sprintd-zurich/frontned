import type { DesignCheck, Estimate } from '../types'

const LEVEL: Record<DesignCheck['level'], { label: string; tone: string; icon: string }> = {
  warning: { label: 'Check', tone: 'alert', icon: '!' },
  info: { label: 'Note', tone: 'warn', icon: 'i' },
  ok: { label: 'Passed', tone: 'ok', icon: '✓' },
}

export function ChecksView({ estimate, onShow }: { estimate: Estimate; onShow: (label: string, ids: string[]) => void }) {
  const checks = estimate.checks
  const count = (l: DesignCheck['level']) => checks.filter((c) => c.level === l).length
  return (
    <div className="buildup">
      <section className="card wide">
        <div className="card-title">Design consistency checks</div>
        <p className="muted small">
          Cross-checks between the LV text, the engineer duct lists and the equipment sizes. They point at things to
          verify; they do not change any price. {count('warning')} to check · {count('info')} notes · {count('ok')} passed.
        </p>
        <div className="checks">
          {checks.map((c, i) => (
            <div key={i} className={`check ${c.level}`}>
              <span className={`check-icon ${LEVEL[c.level].tone}`} aria-label={LEVEL[c.level].label}>
                {LEVEL[c.level].icon}
              </span>
              <div className="check-body">
                <div className="check-title">
                  <span className={`chip ${LEVEL[c.level].tone}`}>{LEVEL[c.level].label}</span> {c.title}
                </div>
                <div className="small">{c.detail}</div>
                <div className="muted small">PDF page {c.pages.join(', ')}</div>
              </div>
              {c.positions.length > 0 && (
                <button className="btn small-btn" onClick={() => onShow(c.title, c.positions)}>
                  Show {c.positions.length} position{c.positions.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
