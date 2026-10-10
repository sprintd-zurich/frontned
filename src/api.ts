import type {
  CatalogItem,
  Dataset,
  Estimate,
  Meta,
  MaterialInflation,
  NewQuote,
  Parameters,
  PositionOverride,
  RfqPackage,
  SourceLocation,
  Status,
  TenderSummary,
  Validation,
} from './types'

const BASE = import.meta.env.VITE_API_URL ?? ''

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
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

export const api = {
  listTenders: () => call<TenderSummary[]>('/api/tenders'),
  loadDemo: () => call<Estimate>('/api/tenders/demo', { method: 'POST' }),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return call<Estimate>('/api/tenders', { method: 'POST', body: form })
  },
  get: (id: string) => call<Estimate>(`/api/tenders/${id}`),
  remove: (id: string) => call<{ ok: boolean }>(`/api/tenders/${id}`, { method: 'DELETE' }),
  archive: (id: string, archived: boolean) =>
    call<{ ok: boolean; archived: boolean }>(`/api/tenders/${id}/archive`, json('PATCH', { archived })),
  setMeta: (id: string, body: Partial<Meta>) => call<Estimate>(`/api/tenders/${id}/meta`, json('PATCH', body)),
  override: (id: string, lvId: string, body: PositionOverride) =>
    call<Estimate>(`/api/tenders/${id}/positions/${lvId}`, json('PATCH', body)),
  bulk: (id: string, body: { lv_ids: string[]; reviewed?: boolean; status?: Status }) =>
    call<Estimate>(`/api/tenders/${id}/positions/bulk`, json('POST', body)),
  addNote: (id: string, lvId: string, text: string, author?: string) =>
    call<Estimate>(`/api/tenders/${id}/positions/${lvId}/notes`, json('POST', { text, author })),
  deleteNote: (id: string, lvId: string, nid: string) =>
    call<Estimate>(`/api/tenders/${id}/positions/${lvId}/notes/${nid}`, { method: 'DELETE' }),
  source: (id: string, lvId: string) => call<SourceLocation>(`/api/tenders/${id}/positions/${lvId}/source`),
  setParameters: (id: string, body: Partial<Parameters>) =>
    call<Estimate>(`/api/tenders/${id}/parameters`, json('PATCH', body)),
  setMaterialInflation: (id: string, body: MaterialInflation) =>
    call<Estimate>(`/api/tenders/${id}/material-inflation`, json('PATCH', body)),
  saveSnapshot: (id: string, name: string) => call<Estimate>(`/api/tenders/${id}/snapshots`, json('POST', { name })),
  deleteSnapshot: (id: string, sid: string) => call<Estimate>(`/api/tenders/${id}/snapshots/${sid}`, { method: 'DELETE' }),
  applySnapshot: (id: string, sid: string) => call<Estimate>(`/api/tenders/${id}/snapshots/${sid}/apply`, { method: 'POST' }),
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
}
