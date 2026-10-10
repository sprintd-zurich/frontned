import { useState } from 'react'
import { useStore } from '../store'
import type { Parameters } from '../types'

export const PARAM_LABELS: Record<string, string> = {
  reference_win_probability: 'Base win probability',
  price_sensitivity_probability_points_per_1pct_price: 'Prob. lost per +1% price',
  strategic_appetite_adjustment: 'Strategic appetite',
  competition_adjustment: 'Competition',
  margin_Aggressive: 'Aggressive margin %',
  margin_Target: 'Target margin %',
  margin_Conservative: 'Conservative margin %',
  site_efficiency: 'Site efficiency',
  school_logistics: 'School logistics',
  mounting_height_school: 'Mounting height (school)',
  mounting_height_sports_hall: 'Mounting height (sports hall)',
  timber_interface: 'Timber interface',
  overhead_pct: 'Overhead %',
  target_margin_pct: 'Target margin %',
  material_waste_pct: 'Material waste %',
  small_material_pct: 'Small material %',
  transport_equipment_pct: 'Transport & equipment %',
  supplier_package_contingency_pct: 'Supplier contingency %',
  engineering_hours: 'Engineering hours',
  engineering_rate_chf_per_h: 'Engineering rate CHF/h',
  commissioning_hours: 'Commissioning hours',
  commissioning_rate_chf_per_h: 'Commissioning rate CHF/h',
  hygiene_inspection_chf: 'Hygiene inspection CHF',
  documentation_chf: 'Documentation CHF',
}

/** Editable parameter list; a value is sent when the field loses focus and the whole estimate recalculates. */
export function ParamGroup({
  title,
  group,
  values,
  step,
  hide = [],
}: {
  title: string
  group: keyof Parameters
  values: Record<string, number>
  step: number
  hide?: string[]
}) {
  const setParams = useStore((s) => s.setParams)
  const [draft, setDraft] = useState<Record<string, string>>({})
  return (
    <div className="param-group">
      <h4>{title}</h4>
      {Object.entries(values)
        .filter(([k]) => !hide.includes(k))
        .map(([k, v]) => (
          <label key={k} className="param">
            <span>{PARAM_LABELS[k] ?? k.replace(/_/g, ' ')}</span>
            <input
              type="number"
              step={step}
              value={draft[k] ?? String(v)}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              onBlur={() => {
                const n = Number(draft[k])
                if (draft[k] !== undefined && draft[k] !== '' && !Number.isNaN(n) && n !== v) setParams({ [group]: { [k]: n } })
                setDraft((d) => {
                  const rest = { ...d }
                  delete rest[k]
                  return rest
                })
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </label>
        ))}
    </div>
  )
}
