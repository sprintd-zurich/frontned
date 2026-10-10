import type {
  AiStatus,
  CatalogItem,
  Estimate,
  InterviewDraft,
  InterviewSession,
  Meta,
  Parameters,
  PositionOverride,
  RfqPackage,
  SupplierDraft,
  SupplierItem,
  SourceLocation,
  TenderSummary,
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
  setMeta: (id: string, body: Partial<Meta>) => call<Estimate>(`/api/tenders/${id}/meta`, json('PATCH', body)),
  override: (id: string, lvId: string, body: PositionOverride) =>
    call<Estimate>(`/api/tenders/${id}/positions/${lvId}`, json('PATCH', body)),
  addNote: (id: string, lvId: string, text: string, author?: string) =>
    call<Estimate>(`/api/tenders/${id}/positions/${lvId}/notes`, json('POST', { text, author })),
  deleteNote: (id: string, lvId: string, nid: string) =>
    call<Estimate>(`/api/tenders/${id}/positions/${lvId}/notes/${nid}`, { method: 'DELETE' }),
  source: (id: string, lvId: string) => call<SourceLocation>(`/api/tenders/${id}/positions/${lvId}/source`),
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
  /** a path the backend returned (trace links, files) as a full URL */
  href: (path: string) => `${BASE}${path}`,
  supplierItems: (id: string) => call<SupplierItem[]>(`/api/tenders/${id}/supplier/items`),
  supplierDraft: (id: string, lv_ids: string[], supplier: string, contact: string) =>
    call<SupplierDraft>(`/api/tenders/${id}/supplier/draft`, json('POST', { lv_ids, supplier, contact })),
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
  setExperienceApply: (id: string, apply: boolean) =>
    call<Estimate>(`/api/tenders/${id}/experience/settings`, json('PATCH', { apply })),
  deleteExperience: (id: string, eid: string) => call<Estimate>(`/api/tenders/${id}/experience/${eid}`, { method: 'DELETE' }),
  experienceFileUrl: (id: string, eid: string) => `${BASE}/api/tenders/${id}/experience/${eid}/file`,
  aiStatus: () => call<AiStatus>('/api/ai/status'),
  getInterview: (id: string) => call<InterviewSession | null>(`/api/tenders/${id}/interview`),
  startInterview: (id: string) => call<InterviewSession>(`/api/tenders/${id}/interview`, { method: 'POST' }),
  answerInterview: (id: string, iid: string, text: string) =>
    call<InterviewSession>(`/api/tenders/${id}/interview/${iid}/answer`, json('POST', { text })),
  finishInterview: (id: string, iid: string) =>
    call<InterviewSession>(`/api/tenders/${id}/interview/${iid}/finish`, { method: 'POST' }),
  editDraft: (id: string, iid: string, did: string, body: Partial<InterviewDraft> & { clear_pct?: boolean }) =>
    call<InterviewSession>(`/api/tenders/${id}/interview/${iid}/drafts/${did}`, json('PATCH', body)),
  confirmInterview: (id: string, iid: string) =>
    call<{ session: InterviewSession; estimate: Estimate }>(`/api/tenders/${id}/interview/${iid}/confirm`, json('POST', {})),
  discardInterview: (id: string, iid: string) => call<{ ok: boolean }>(`/api/tenders/${id}/interview/${iid}`, { method: 'DELETE' }),
  transcribe: (id: string, audio: Blob) => {
    const form = new FormData()
    form.append('file', audio, audio.type.includes('mp4') ? 'recording.mp4' : 'recording.webm')
    return call<{ text: string; provider: string }>(`/api/tenders/${id}/voice/transcribe`, { method: 'POST', body: form })
  },
  speak: async (id: string, text: string) => {
    const res = await fetch(`${BASE}/api/tenders/${id}/voice/speak`, json('POST', { text }))
    if (!res.ok) throw new Error(`Speech failed (${res.status})`)
    return res.blob()
  },
}
