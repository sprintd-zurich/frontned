export type Status =
  | 'calculated'
  | 'supplier_quote_required'
  | 'assumption_applied'
  | 'review_required'
  | 'insufficient_information'
  | 'out_of_scope'
  | 'non_priceable'

export interface Position {
  /** Where this position sits in the tender: system, section, PDF page, item on that page. */
  ref: string
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
  /** product category (Damper, Ductwork, …), editable on the Items tab */
  category: string
  /** HVAC trade colour group (air, heating, …) */
  trade: string
  /** where each number comes from, keyed by field */
  trace: Partial<Record<TraceField, Trace>>
  reviewed: boolean
  notes: Note[]
  alternatives: Alternative[]
  /** product sheet the unit price was taken from */
  price_sheet: string | null
  /** product sheets linked to this position */
  sheets: string[]
  base_material_cost_chf: number
  material_inflation_chf: number
  material_mix: Record<string, number>
  /** The supplier quote that set this price, if any. */
  quote: Quote | null
  /** What the pinned price book charges for the matched product, for comparison with a quote. */
  book_unit_cost_chf: number | null
  /** Placeholder material cost for positions with no price; never folded into material_cost_chf. */
  estimated_material_chf: number | null
  estimated_material_basis: string | null
  /** prices for this position from uploaded product lists that differ from the current price or supplier */
  offers: ListOffer[]
  /** a price request went to a supplier from the Supplier tab */
  requested: { supplier: string | null; at: string } | null
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
  /** 'talk' when it came from a spoken conversation; quote is what was said */
  source?: 'talk' | 'write'
  quote?: string | null
}

export interface TalkEntry {
  /** id of the Experience entry it was saved as */
  id: string
  kind: 'opinion' | 'estimate'
  text: string
  adjustment_pct: number | null
  scope: 'project' | 'system' | 'category'
  ref: string
  quote: string
}

export interface TalkTurn {
  transcript: string
  reply: string
  entries: TalkEntry[]
  model: string | null
  audio: string | null
  speech_error: string | null
  estimate: Estimate
}

export interface BidSuggestion {
  price_chf: number
  low_chf: number
  high_chf: number
  closest_scenario: string | null
  margin_pct: number | null
  summary: string
  reasoning: { text: string; entries: string[]; scenarios: string[] }[]
  entries_used: { id: string; effect_pct: number | null; how: string }[]
  entries_ignored: string[]
  caveats: string[]
  model: string
  at: string
  /** what the model was given, to tell when the suggestion is out of date */
  input: {
    cost_baseline_chf: number
    scenarios: { name: string; bid_price_chf: number; margin_pct: number; win_probability: number }[]
    recommended_scenario: string
    entry_ids: string[]
  }
}

export interface SupplierItem {
  lv_id: string
  package: string
  package_title: string
  /** id in the supplier directory */
  supplier: string
}

/** A supplier from the directory (demo companies until real supplier data is in). */
export interface SupplierInfo {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  city: string
  packages: string[]
  demo: boolean
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
  kind: 'import' | 'change' | 'review' | 'note' | 'export' | 'scenario' | 'meta' | 'sheet' | 'experience' | 'dataset' | 'quote' | 'warning'
  text: string
  lv_id: string | null
  /** the signed-in user who made the change (journal entries before sign-in have none) */
  by?: string | null
}

export type UserRole = 'admin' | 'estimator' | 'viewer'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  must_change_password: boolean
  created_at: string
  last_login_at: string | null
  /** tender ids assigned to this user (Users page only) */
  projects?: string[]
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
  updated_at: string
  reviewed: number
  priceable_positions: number
  meta: Meta
  archived: boolean
  workflow_status: 'in_review' | 'waiting_for_quotes' | 'ready_to_bid'
  completion_pct: number
  open_decisions: number
  supplier_quotes_open: number
  selling_price_chf: number
  last_activity: string
  /** ids of the users the admin assigned to this project */
  assigned?: string[]
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
  material_inflation_chf: number
  labour_cost_chf: number
  install_hours: number
  direct_cost_chf: number
  overhead_pct: number
  overhead_chf: number
  cost_baseline_chf: number
  target_margin_pct: number
  selling_price_chf: number
  selling_price_rounded_chf: number
  unpriced_material_chf: number
  unpriced_coverage_pct: number
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
  /** the bid suggested from the team's experience, once added from the Experience tab */
  experience: ExperienceScenario | null
  /** the estimator's own scenario (Custom window) */
  custom: BidScenario
  /** average inflation over the project duration, added to the baseline the bids are calculated on */
  inflation: { inflation_pct: number; duration_months: number; average_pct: number; amount_chf: number; bid_baseline_chf: number }
  /** the scenario that goes into the offer and the exports, null = indicative selling price */
  selected: string | null
}

export interface ExperienceScenario extends BidScenario {
  low_chf: number
  high_chf: number
  suggestion_at: string
  model: string
  applied_at: string
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
  /** the price the exports carry: the selected bid, or the indicative selling price */
  offer: { scenario: string | null; price_chf: number }
  snapshots: Snapshot[]
  checks: DesignCheck[]
  activity: Activity[]
  sheets: Sheet[]
  experience: Experience[]
  bid_suggestion: BidSuggestion | null
  suggestion_service: { configured: boolean; model: string }
  voice_service: { configured: boolean }
  dataset: TenderDataset
  quotes: Quote[]
  confidence: Confidence
  extraction: Extraction
  material_inflation: MaterialInflation
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
  ref?: string
  system?: string
  category?: string
  title?: string
  variant?: string
  description?: string
  unit?: string
  material_mix?: Record<string, number>
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

export interface MaterialInflation {
  base_date: string
  as_of_date: string
  rates_pct: Record<string, number>
}

export interface UnreadPage {
  page: number
  first_line: string
  quantity_lines: number
}

export interface Extraction {
  pages: number
  project: string
  header_pattern: 'bkp_code' | 'running_header' | null
  lv_pages: number
  duct_list_pages: number
  front_matter_pages: number
  trailing_pages: number
  body_pages: number
  read_pages: number
  positions: number
  systems: { system: string; pages: number; positions: number }[]
  unread: UnreadPage[]
  missed_pages: UnreadPage[]
  warnings: string[]
}

/** A supplier price recorded on one tender. Beats the price book, loses to an estimator override. */
export interface Quote {
  id: string
  /** Set when the quote is for a catalogue product (reusable, can be promoted to a price book). */
  product_id: string | null
  /** Set when the quote is for one specific LV position that has no catalogue item. */
  lv_id: string | null
  supplier: string
  reference: string
  net_cost_chf: number
  /** The price book's figure for the same product, so the delta stays visible. */
  book_cost_chf: number | null
  quoted_at: string
  valid_until: string
  note: string
  entered_by: string | null
  at: string
}

/** What the estimator fills in when a supplier price comes back. */
export interface NewQuote {
  net_cost_chf: number
  supplier: string
  product_id?: string | null
  lv_id?: string | null
  reference?: string
  quoted_at?: string
  valid_until?: string
  note?: string
  entered_by?: string | null
}

export interface DatasetVersion {
  version: number
  created_at: string
  source: string
  note: string
  derived_from: { dataset: string; version: number; material_factor_pct: number; labour_factor_pct: number } | null
  changes: {
    product_id: string
    kind: 'price_updated' | 'item_added'
    was_chf?: number
    now_chf: number
    supplier?: string
    reference?: string
    quoted_at?: string
    from_tender?: string
    entered_by?: string | null
  }[]
}

/** A price book: catalogue, installation rules with their labour rates, and project parameters. */
export interface Dataset {
  id: string
  name: string
  region: string
  region_label: string
  country: string
  location: string
  currency: string
  notes: string
  immutable: boolean
  derived?: boolean
  source_kind: 'csv' | 'derived' | string
  source_files: string[]
  versions: DatasetVersion[]
  latest_version: number
  products: number
  install_rules: number
  labour_rate_chf: number
  updated_at: string
}

/** The price book a tender is pinned to. */
export interface TenderDataset {
  id: string
  name: string
  region: string
  region_label: string
  country: string
  location: string
  source_kind: string
  source_files: string[]
  notes: string
  immutable: boolean
  derived: boolean
  version: number
  latest_version: number
  pinned_at: string
  version_note: string
  missing?: boolean
}

export interface ConfidenceBucket {
  key: 'firm' | 'assumption' | 'quote' | 'labour_only' | 'open'
  label: string
  positions: number
  value_chf: number
  share_pct: number
  lv_ids: string[]
}

export interface Confidence {
  buckets: ConfidenceBucket[]
  position_value_chf: number
  firm_share_pct: number
  unpriced: {
    estimated_positions: number
    estimated_material_chf: number
    no_basis_positions: number
    no_basis_labour_chf: number
    lv_ids_estimated: string[]
    lv_ids_no_basis: string[]
  }
}

export interface ValidationField {
  field: string
  label: string
  kind: 'text' | 'number' | 'chf' | 'hours'
  expected: string | number | boolean | null
  actual: string | number | boolean | null
  match: boolean
}

export interface ValidationPosition {
  /** The id Equans uses in the reference files, e.g. LV0001. */
  lv_id: string
  /** The position our extraction produced for it, e.g. X0009. */
  our_lv_id: string | null
  /** Our tender reference for the position paired with this expectation. */
  our_ref: string | null
  found: boolean
  match: boolean
  description: string
  source_page: number
  system: string
  category: string
  title: string | null
  variant?: string
  overridden: string[]
  /** Set when a supplier quote explains the difference from the reference. */
  quote: Quote | null
  explained?: boolean
  mismatches: string[]
  fields: ValidationField[]
}

export interface Validation {
  source: string
  positions: ValidationPosition[]
  totals: { label: string; expected: number; actual: number; match: boolean }[]
  scenarios: {
    scenario: string
    margin_pct: number
    expected_bid_chf: number | null
    actual_bid_chf: number
    expected_win_probability: number | null
    actual_win_probability: number
    match: boolean
  }[]
  summary: {
    total: number
    exact: number
    found: number
    edited: number
    unexplained: number
    totals_match: boolean
    scenarios_match: boolean
    passed: boolean
  }
}

/** A row of a supplier product list that matches a position which already has a price. */
export interface ListOffer {
  lv_id: string
  supplier: string
  price_chf: number
  description: string
  article: string
  /** where in the file: "row 12" or "page 2" */
  where: string
  score: number
  current_chf: number | null
  current_supplier: string | null
  sheet: string
  sheet_name: string
}
