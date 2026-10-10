import type { CatalogItem, Estimate, Parameters, PositionOverride } from './types'

const BASE = import.meta.env.VITE_API_URL ?? ''

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `Request failed (${res.status})`)
  }
  return res.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  listTenders: () => call<{ id: string; name: string; pages: number }[]>('/api/tenders'),
  loadDemo: () => call<Estimate>('/api/tenders/demo', { method: 'POST' }),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return call<Estimate>('/api/tenders', { method: 'POST', body: form })
  },
  get: (id: string) => call<Estimate>(`/api/tenders/${id}`),
  override: (id: string, lvId: string, body: PositionOverride) =>
    call<Estimate>(`/api/tenders/${id}/positions/${lvId}`, json('PATCH', body)),
  setParameters: (id: string, body: Partial<Parameters>) =>
    call<Estimate>(`/api/tenders/${id}/parameters`, json('PATCH', body)),
  saveSnapshot: (id: string, name: string) => call<Estimate>(`/api/tenders/${id}/snapshots`, json('POST', { name })),
  deleteSnapshot: (id: string, sid: string) => call<Estimate>(`/api/tenders/${id}/snapshots/${sid}`, { method: 'DELETE' }),
  applySnapshot: (id: string, sid: string) => call<Estimate>(`/api/tenders/${id}/snapshots/${sid}/apply`, { method: 'POST' }),
  catalog: () => call<CatalogItem[]>('/api/reference/catalog'),
  pageUrl: (id: string, page: number) => `${BASE}/api/tenders/${id}/pages/${page}.png`,
}
