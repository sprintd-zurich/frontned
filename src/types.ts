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
  airflow_m3h: number | null
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
  /** stays true once the estimator changed anything on the position, even after a reset */
  edited: boolean
  edited_fields: string[]
  category: string
  /** where each number comes from, keyed by field */
  trace: Partial<Record<TraceField, Trace>>
  reviewed: boolean
  notes: Note[]
  alternatives: Alternative[]
  /** product sheet the unit price was taken from */
  price_sheet: string | null
  /** product sheets linked to this position */
  sheets: string[]
}

export type TraceField =
  | 'quantity'
  | 'net_unit_cost_chf'
  | 'material_cost_chf'
  | 'base_hours_per_unit'
  | 'adjusted_install_hours'
  | 'hourly_rate_chf'
  | 'labour_cost_chf'
  | 'direct_position_cost_chf'

export interface TraceLink {
  label: string
  /** API path of the file, with #page=N for a PDF page */
  href: string
  kind: 'tender' | 'company' | 'sheet'
  page?: number | null
  row?: number | null
}

export interface Trace {
  source: string
  lines: string[]
  links?: TraceLink[]
}

export interface Found {
  value: string | number
  page: number
  line: string
}

export interface SheetPrice {
  value: number
  kind: 'net' | 'list' | 'price'
  page: number
  line: string
}

/** A supplier product sheet or quote, stored with the tender and read for prices and product data. */
export interface Sheet {
  id: string
  name: string
  file: string
  supplier: string
  lv_ids: string[]
  at: string
  found: {
    pages: number
    readable: boolean
    prices: SheetPrice[]
    discount: Found | null
    manufacturer: string | null
    type: Found | null
    article: Found | null
    lead_time: Found | null
    valid_until: Found | null
  }
}

export interface Experience {
  id: string
  at: string
  kind: 'opinion' | 'estimate' | 'file'
  text: string
  scope: 'project' | 'system' | 'category' | 'position'
  ref: string
  adjustment_pct: number | null
  author: string | null
  file: { name: string; stored: string } | null
}

export interface SupplierItem {
  lv_id: string
  package: string
  package_title: string
}

export interface SupplierDraft {
  subject: string
  text: string
  pages: number[]
  lines: { lv_id: string; system: string; text: string; quantity: number | null; unit: string; source_page: number }[]
}

export interface Category {
  id: string
  label: string
  color: string
}

export interface Note {
  id: string
  text: string
  author: string | null
  at: string
}

export interface Activity {
  at: string
  kind: 'import' | 'change' | 'review' | 'note' | 'export' | 'scenario' | 'meta' | 'sheet' | 'experience'
  text: string
  lv_id: string | null
}

export interface Meta {
  project_name: string
  client: string
  planner: string
  location: string
  tender_no: string
  project_no: string
  trade: string
  document_date: string
  submission_date: string
  estimator: string
}

export interface TenderSummary {
  id: string
  name: string
  pages: number
  positions: number
  created_at: string
  reviewed: number
  meta: Meta
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface SourceLocation {
  page: number
  lines: Box[]
  block: Box | null
  match: number
}

export interface Alternative {
  product_id: string
  description: string
  net_unit_cost_chf: number
  install_code: string
  reason: string
  material_delta_chf: number
  supplier_quote_required: boolean
}

export interface DesignCheck {
  level: 'warning' | 'info' | 'ok'
  title: string
  detail: string
  positions: string[]
  pages: number[]
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
  bid: Record<string, number>
}

export interface BidScenario {
  scenario: string
  bid_price_chf: number
  margin_pct: number
  estimated_win_probability: number
  expected_contribution_chf: number
}

export interface BidPoint {
  margin_pct: number
  bid_price_chf: number
  estimated_win_probability: number
  expected_contribution_chf: number
}

export interface BidAnalysis {
  scenarios: BidScenario[]
  recommended: string
  curve: BidPoint[]
  peak_margin_pct: number
  cost_baseline_chf: number
  reference_price_chf: number
  inputs: Record<string, number>
  limits: { min_probability: number; max_probability: number }
}

export interface Snapshot {
  id: string
  name: string
  overrides: number
  parameters: Parameters
  summary: {
    material_cost_chf: number
    labour_cost_chf: number
    install_hours: number
    direct_cost_chf: number
    cost_baseline_chf: number
    selling_price_rounded_chf: number
    target_margin_pct: number
    recommended_scenario: string
    recommended_bid_chf: number
    recommended_win_probability: number
    recommended_contribution_chf: number
  }
}

export interface Estimate {
  tender: { id: string; name: string; pages: number; reviewed: string[]; created_at: string; meta: Meta }
  positions: Position[]
  categories: Category[]
  project: Project
  parameters: Parameters
  bid: BidAnalysis
  snapshots: Snapshot[]
  checks: DesignCheck[]
  activity: Activity[]
  sheets: Sheet[]
  experience: Experience[]
}

export interface CatalogItem {
  product_id: string
  category: string
  subcategory: string
  manufacturer: string
  model: string
  description: string
  unit: string
  list_price_chf: string
  discount_pct: string
  net_cost_chf: number
  install_code: string
  source_type: string
  supplier_quote_required: boolean
}

export interface PositionOverride {
  product_id?: string
  quantity?: number
  net_unit_cost_chf?: number
  base_hours_per_unit?: number
  hourly_rate_chf?: number
  status?: Status
  price_sheet?: string
  price_page?: number
  reviewed?: boolean
  reset?: boolean
}

export interface RfqPackage {
  key: string
  title: string
  subject: string
  positions: number
  budget_chf: number
  unpriced: number
  pages: number[]
  lines: { lv_id: string; system: string; text: string; quantity: number | null; unit: string; source_page: number }[]
  text: string
}
