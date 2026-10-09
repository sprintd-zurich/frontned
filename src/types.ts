export type Status =
  | 'calculated'
  | 'supplier_quote_required'
  | 'assumption_applied'
  | 'review_required'
  | 'insufficient_information'
  | 'out_of_scope'
  | 'non_priceable'

export interface Position {
  lv_id: string
  system: string
  section: string | null
  source_page: number
  source_pages: number[]
  source_line: string
  title: string
  variant: string
  description: string
  attributes: Record<string, string | number | boolean>
  unit: string
  kind: string
  extracted_quantity: number | null
  components: { text: string; quantity: number | null; unit: string; source_page: number }[]
  product_id: string | null
  product_description: string | null
  install_code: string | null
  quantity: number | null
  net_unit_cost_chf: number | null
  price_source: string | null
  material_cost_chf: number
  adjusted_install_hours: number
  labour_cost_chf: number
  direct_position_cost_chf: number
  status: Status
  review_required: boolean
  match_kind: string
  match_confidence: number
  assumptions: string[]
  factors_applied: string[]
  hourly_rate_chf: number | null
  base_hours_per_unit: number | null
  overridden: string[]
  reviewed: boolean
}

export interface CostLine {
  label: string
  amount_chf: number
  basis: string
}

export interface Project {
  cost_lines: CostLine[]
  material_cost_chf: number
  labour_cost_chf: number
  install_hours: number
  direct_cost_chf: number
  overhead_pct: number
  overhead_chf: number
  cost_baseline_chf: number
  target_margin_pct: number
  selling_price_chf: number
  selling_price_rounded_chf: number
}

export interface Parameters {
  productivity_factors: Record<string, number>
  commercial: Record<string, number>
  project_costs: Record<string, number>
  allowances: Record<string, number>
}

export interface Estimate {
  tender: { id: string; name: string; pages: number; reviewed: string[] }
  positions: Position[]
  project: Project
  parameters: Parameters
}

export interface CatalogItem {
  product_id: string
  category: string
  subcategory: string
  description: string
  unit: string
  net_cost_chf: number
  install_code: string
  source_type: string
}

export interface PositionOverride {
  product_id?: string
  quantity?: number
  net_unit_cost_chf?: number
  base_hours_per_unit?: number
  hourly_rate_chf?: number
  status?: Status
  reviewed?: boolean
  reset?: boolean
}
