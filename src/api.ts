import type {
  CatalogItem,
  Dataset,
  MaterialInflation,
  NewQuote,
  Status,
  Validation,
  Estimate,
  Meta,
  Parameters,
  PositionOverride,
  RfqPackage,
  SupplierDraft,
  TalkTurn,
  SupplierInfo,
  SupplierItem,
  SourceLocation,
  TenderSummary,
  User,
  UserRole,
} from './types'

export interface DatasetImport {
  name: string
  country: string
  location: string
  region: string
  currency: string
  note?: string
  base_dataset: string
  catalog: File
  productivity: File
  parameters?: File | null
}

const BASE = import.meta.env.VITE_API_URL ?? ''

/** Called when the sign-in ran out (any 401 outside the sign-in form), so the app shows the sign-in page again. */
let signedOut = () => {}
export function onSignedOut(fn: () => void) {
  signedOut = fn
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (res.status === 401 && path !== '/api/auth/login') signedOut()
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${res.status})`)
  }
  return res.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export interface ProductivityRule {
  install_code: string
  work_type: string
  unit: string
  base_hours_per_unit: number
  labour_role: string
  default_hourly_rate_chf: number
  factor_keys: string[]
}

export const api = {
  // sign-in and users
  login: (email: string, password: string) => call<User>('/api/auth/login', json('POST', { email, password })),
  logout: () => call<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  me: () => call<User>('/api/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    call<User>('/api/auth/password', json('POST', { current_password, new_password })),
  users: () => call<User[]>('/api/users'),
  addUser: (body: { name: string; email: string; role: UserRole; password?: string }) =>
    call<{ user: User; temporary_password: string | null }>('/api/users', json('POST', body)),
  updateUser: (uid: string, body: Partial<Pick<User, 'name' | 'email' | 'role' | 'active'>>) =>
    call<User>(`/api/users/${uid}`, json('PATCH', body)),
  resetPassword: (uid: string) =>
    call<{ user: User; temporary_password: string }>(`/api/users/${uid}/reset-password`, { method: 'POST' }),

  listTenders: () => call<TenderSummary[]>('/api/tenders'),
  loadDemo: () => call<Estimate>('/api/tenders/demo', { method: 'POST' }),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return call<Estimate>('/api/tenders', { method: 'POST', body: form })
  },
  get: (id: string) => call<Estimate>(`/api/tenders/${id}`),
  remove: (id: string) => call<{ ok: boolean }>(`/api/tenders/${id}`, { method: 'DELETE' }),
  setMeta: (id: string, body: Partial<Meta>) => call<Estimate>(`/api/tenders/${id}/meta`, json('PATCH', body)),
  override: (id: string, lvId: string, body: PositionOverride) =>
    call<Estimate>(`/api/tenders/${id}/positions/${lvId}`, json('PATCH', body)),
  addNote: (id: string, lvId: string, text: string, author?: string) =>
    call<Estimate>(`/api/tenders/${id}/positions/${lvId}/notes`, json('POST', { text, author })),
  deleteNote: (id: string, lvId: string, nid: string) =>
    call<Estimate>(`/api/tenders/${id}/positions/${lvId}/notes/${nid}`, { method: 'DELETE' }),
  source: (id: string, lvId: string) => call<SourceLocation>(`/api/tenders/${id}/positions/${lvId}/source`),
  selectBid: (id: string, scenario: string | null) => call<Estimate>(`/api/tenders/${id}/bid/select`, json('POST', { scenario })),
  setParameters: (id: string, body: Partial<Parameters>) =>
    call<Estimate>(`/api/tenders/${id}/parameters`, json('PATCH', body)),
  saveSnapshot: (id: string, name: string) => call<Estimate>(`/api/tenders/${id}/snapshots`, json('POST', { name })),
  deleteSnapshot: (id: string, sid: string) => call<Estimate>(`/api/tenders/${id}/snapshots/${sid}`, { method: 'DELETE' }),
  applySnapshot: (id: string, sid: string) => call<Estimate>(`/api/tenders/${id}/snapshots/${sid}/apply`, { method: 'POST' }),
  rfqs: (id: string) => call<RfqPackage[]>(`/api/tenders/${id}/rfqs`),
  rfqUrl: (id: string, key: string) => `${BASE}/api/tenders/${id}/rfqs/${key}.xlsx`,
  exportUrl: (id: string) => `${BASE}/api/tenders/${id}/export.xlsx`,
  tenderPdfUrl: (id: string) => `${BASE}/api/tenders/${id}/pdf`,
  pricedLvUrl: (id: string, inline = false) => `${BASE}/api/tenders/${id}/priced-lv.pdf${inline ? '?inline=true' : ''}`,
  pricedLvInfo: (id: string) =>
    call<{ pages: number; filled: number; positions: number; total_chf: number; key: string }>(`/api/tenders/${id}/priced-lv/info`),
  pricedLvPageUrl: (id: string, page: number, key: string) => `${BASE}/api/tenders/${id}/priced-lv/pages/${page}.png?v=${key}`,
  exportPreview: (id: string) =>
    call<{ name: string; rows: (string | number | boolean | null)[][] }[]>(`/api/tenders/${id}/export/preview`),
  catalog: () => call<CatalogItem[]>('/api/reference/catalog'),
  productivity: () => call<ProductivityRule[]>('/api/reference/productivity'),
  pageUrl: (id: string, page: number) => `${BASE}/api/tenders/${id}/pages/${page}.png`,
  pagePositions: (id: string, page: number) =>
    call<{ lv_id: string; block: { x0: number; y0: number; x1: number; y1: number } | null; lines: { x0: number; y0: number; x1: number; y1: number }[] }[]>(
      `/api/tenders/${id}/pages/${page}/positions`,
    ),
  /** a path the backend returned (trace links, files) as a full URL */
  href: (path: string) => `${BASE}${path}`,
  suppliers: () => call<SupplierInfo[]>('/api/suppliers'),
  supplierItems: (id: string) => call<SupplierItem[]>(`/api/tenders/${id}/supplier/items`),
  supplierDraft: (id: string, lv_ids: string[], supplier: string, contact: string) =>
    call<SupplierDraft>(`/api/tenders/${id}/supplier/draft`, json('POST', { lv_ids, supplier, contact })),
  markRequested: (id: string, lv_ids: string[], supplier: string) =>
    call<Estimate>(`/api/tenders/${id}/supplier/requested`, json('POST', { lv_ids, supplier })),
  supplierDraftUrl: (id: string, lvIds: string[], supplier: string) =>
    `${BASE}/api/tenders/${id}/supplier/draft.xlsx?lv_ids=${lvIds.join(',')}&supplier=${encodeURIComponent(supplier)}`,
  uploadSheet: (id: string, file: File, lvIds: string[], supplier: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('lv_ids', lvIds.join(','))
    form.append('supplier', supplier)
    return call<Estimate>(`/api/tenders/${id}/sheets`, { method: 'POST', body: form })
  },
  linkSheet: (id: string, sid: string, body: { lv_ids?: string[]; supplier?: string }) =>
    call<Estimate>(`/api/tenders/${id}/sheets/${sid}`, json('PATCH', body)),
  deleteSheet: (id: string, sid: string) => call<Estimate>(`/api/tenders/${id}/sheets/${sid}`, { method: 'DELETE' }),
  sheetUrl: (id: string, sid: string, page?: number | null) =>
    `${BASE}/api/tenders/${id}/sheets/${sid}/file${page ? `#page=${page}` : ''}`,
  addExperience: (id: string, entry: Record<string, string>, file?: File | null) => {
    const form = new FormData()
    Object.entries(entry).forEach(([k, v]) => v !== '' && form.append(k, v))
    if (file) form.append('file', file)
    return call<Estimate>(`/api/tenders/${id}/experience`, { method: 'POST', body: form })
  },
  deleteExperience: (id: string, eid: string) => call<Estimate>(`/api/tenders/${id}/experience/${eid}`, { method: 'DELETE' }),
  talk: (id: string, turn: { audio?: Blob | null; text?: string; history: { role: string; text: string }[]; speak: boolean }) => {
    const form = new FormData()
    if (turn.audio) form.append('audio', turn.audio, `speech.${turn.audio.type.includes('mp4') ? 'mp4' : 'webm'}`)
    if (turn.text) form.append('text', turn.text)
    form.append('history', JSON.stringify(turn.history))
    form.append('speak', String(turn.speak))
    return call<TalkTurn>(`/api/tenders/${id}/talk`, { method: 'POST', body: form })
  },
  applySuggestion: (id: string) => call<Estimate>(`/api/tenders/${id}/experience/suggest/apply`, { method: 'POST' }),
  removeSuggestionScenario: (id: string) =>
    call<Estimate>(`/api/tenders/${id}/experience/suggest/apply`, { method: 'DELETE' }),
  suggestBid: (id: string) => call<Estimate>(`/api/tenders/${id}/experience/suggest`, { method: 'POST' }),
  experienceFileUrl: (id: string, eid: string) => `${BASE}/api/tenders/${id}/experience/${eid}/file`,
  archive: (id: string, archived: boolean) =>
    call<{ ok: boolean; archived: boolean }>(`/api/tenders/${id}/archive`, json('PATCH', { archived })),
  bulk: (id: string, body: { lv_ids: string[]; reviewed?: boolean; status?: Status }) =>
    call<Estimate>(`/api/tenders/${id}/positions/bulk`, json('POST', body)),
  setMaterialInflation: (id: string, body: MaterialInflation) =>
    call<Estimate>(`/api/tenders/${id}/material-inflation`, json('PATCH', body)),
  validation: (id: string) => call<Validation>(`/api/tenders/${id}/validation`),

  // price books
  datasets: () => call<Dataset[]>('/api/datasets'),
  dataset: (did: string) => call<Dataset & { catalog: CatalogItem[] }>(`/api/datasets/${did}`),
  createDataset: (body: {
    name: string
    clone_of?: string
    region?: string
    region_label?: string
    country?: string
    location?: string
    material_factor_pct?: number
    labour_factor_pct?: number
  }) => call<Dataset>('/api/datasets', json('POST', body)),
  importDataset: (body: DatasetImport) => {
    const form = new FormData()
    form.append('name', body.name)
    form.append('country', body.country)
    form.append('location', body.location)
    form.append('region', body.region)
    form.append('currency', body.currency)
    form.append('note', body.note ?? '')
    form.append('base_dataset', body.base_dataset)
    form.append('catalog', body.catalog)
    form.append('productivity', body.productivity)
    if (body.parameters) form.append('parameters', body.parameters)
    return call<Dataset>('/api/datasets/import', { method: 'POST', body: form })
  },
  deleteDataset: (did: string) => call<{ ok: boolean }>(`/api/datasets/${did}`, { method: 'DELETE' }),
  setDataset: (id: string, body: { id: string; version?: number }) =>
    call<Estimate>(`/api/tenders/${id}/dataset`, json('PATCH', body)),

  // supplier quotes on a tender
  addQuote: (id: string, body: NewQuote) => call<Estimate>(`/api/tenders/${id}/quotes`, json('POST', body)),
  importQuoteWorkbook: (id: string, file: File, supplier: string, reference: string, quotedAt: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('supplier', supplier)
    form.append('reference', reference)
    form.append('quoted_at', quotedAt)
    return call<Estimate>(`/api/tenders/${id}/quotes/import`, { method: 'POST', body: form })
  },
  importQuoteCsv: (id: string, file: File, supplier: string, reference: string, quotedAt: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('supplier', supplier)
    form.append('reference', reference)
    form.append('quoted_at', quotedAt)
    return call<Estimate>(`/api/tenders/${id}/quotes/import-csv`, { method: 'POST', body: form })
  },
  quoteRequestCsvUrl: (id: string, lvIds: string[]) =>
    `${BASE}/api/tenders/${id}/quotes/request.csv?lv_ids=${encodeURIComponent(lvIds.join(','))}`,
  deleteQuote: (id: string, qid: string) => call<Estimate>(`/api/tenders/${id}/quotes/${qid}`, { method: 'DELETE' }),
  promoteQuote: (id: string, qid: string, datasetId: string) =>
    call<Estimate>(`/api/tenders/${id}/quotes/${qid}/promote`, json('POST', { dataset_id: datasetId })),
}
