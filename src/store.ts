import { create } from 'zustand'
import { api, type DatasetImport, type ProductivityRule } from './api'
import type { Pill } from './derive'
import type {
  CatalogItem,
  Dataset,
  Estimate,
  Meta,
  MaterialInflation,
  NewQuote,
  Parameters,
  PositionOverride,
  Status,
  TenderSummary,
} from './types'

const LAST = 'equans-tender-id'

interface Filters {
  system: string
  pill: Pill
  search: string
  section: string
  hideDucts: boolean
  /** Restrict the tables to these positions (e.g. the ones a design check points at). */
  only: { label: string; ids: string[] } | null
}

interface State extends Filters {
  estimate: Estimate | null
  tenders: TenderSummary[]
  catalog: CatalogItem[]
  datasets: Dataset[]
  rules: Record<string, ProductivityRule>
  selected: string | null
  busy: string | null
  error: string | null
  toast: string
  ready: boolean
  /** Calculation page: the position table or the project build-up. */
  calcView: 'positions' | 'buildup'
  filter: (f: Partial<Filters>) => void
  clearFilters: () => void
  select: (lvId: string | null) => void
  notify: (s: string) => void
  init: () => Promise<void>
  refreshTenders: () => Promise<void>
  open: (id: string) => Promise<string | null>
  loadDemo: () => Promise<string | null>
  upload: (f: File) => Promise<string | null>
  close: () => void
  removeTender: (id: string) => Promise<void>
  archiveTender: (id: string, archived: boolean) => Promise<void>
  override: (lvId: string, body: PositionOverride, done?: string) => Promise<void>
  bulk: (lvIds: string[], body: { reviewed?: boolean; status?: Status }, done?: string) => Promise<void>
  addNote: (lvId: string, text: string, author?: string) => Promise<void>
  deleteNote: (lvId: string, nid: string) => Promise<void>
  setParams: (b: Partial<Parameters>) => Promise<void>
  setMaterialInflation: (b: MaterialInflation) => Promise<void>
  setMeta: (b: Partial<Meta>) => Promise<void>
  refreshDatasets: () => Promise<void>
  setDataset: (datasetId: string, version?: number) => Promise<void>
  createDataset: (body: {
    name: string
    clone_of?: string
    region?: string
    region_label?: string
    country?: string
    location?: string
    material_factor_pct?: number
    labour_factor_pct?: number
  }) => Promise<void>
  importDataset: (body: DatasetImport) => Promise<boolean>
  deleteDataset: (datasetId: string) => Promise<void>
  addQuote: (body: NewQuote, done?: string) => Promise<void>
  importQuoteWorkbook: (file: File, supplier: string, reference: string, quotedAt: string) => Promise<void>
  importQuoteCsv: (file: File, supplier: string, reference: string, quotedAt: string) => Promise<void>
  deleteQuote: (qid: string) => Promise<void>
  promoteQuote: (qid: string, datasetId: string) => Promise<void>
  saveSnapshot: (name: string) => Promise<void>
  applySnapshot: (sid: string) => Promise<void>
  deleteSnapshot: (sid: string) => Promise<void>
}

const NO_FILTERS: Filters = { system: 'all', pill: 'all', search: '', section: 'all', hideDucts: false, only: null }

function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST, id)
    else localStorage.removeItem(LAST)
  } catch {
    /* private mode: the URL path still carries the tender */
  }
}

export const useStore = create<State>((set, get) => {
  /** Run an API call that returns the full estimate; keeps one busy label and one error at a time. */
  async function run(label: string, fn: () => Promise<Estimate>, done?: string) {
    set({ busy: label, error: null })
    try {
      const estimate = await fn()
      const sel = get().selected
      set({
        estimate,
        selected: sel && estimate.positions.some((p) => p.lv_id === sel) ? sel : (estimate.positions[0]?.lv_id ?? null),
      })
      remember(estimate.tender.id)
      if (done) set({ toast: done })
      return true
    } catch (err) {
      set({ error: (err as Error).message })
      return false
    } finally {
      set({ busy: null })
    }
  }
  const tid = () => get().estimate!.tender.id

  return {
    ...NO_FILTERS,
    estimate: null,
    tenders: [],
    catalog: [],
    datasets: [],
    rules: {},
    selected: null,
    busy: null,
    error: null,
    toast: '',
    ready: false,
    calcView: 'positions',
    filter: (f) => set(f),
    clearFilters: () => set(NO_FILTERS),
    select: (selected) => set({ selected }),
    notify: (toast) => set({ toast }),

    init: async () => {
      api.catalog().then((catalog) => set({ catalog })).catch(() => {})
      api
        .productivity()
        .then((r) => set({ rules: Object.fromEntries(r.map((x) => [x.install_code, x])) }))
        .catch(() => {})
      get().refreshDatasets()
      await get().refreshTenders()
      set({ ready: true })
    },
    refreshTenders: async () => {
      try {
        set({ tenders: await api.listTenders() })
      } catch (err) {
        set({ error: `Cannot reach the pricing API: ${(err as Error).message}` })
      }
    },
    open: async (id) => {
      if (get().estimate?.tender.id === id) return id
      set({ ...NO_FILTERS, selected: null })
      return (await run('Loading estimate…', () => api.get(id))) ? id : null
    },
    loadDemo: async () => {
      set({ ...NO_FILTERS, selected: null })
      if (await run('Reading the tender and pricing every position…', api.loadDemo, 'Tender imported and priced.')) {
        get().refreshTenders()
        return get().estimate?.tender.id ?? null
      }
      return null
    },
    upload: async (f) => {
      set({ ...NO_FILTERS, selected: null })
      if (await run(`Reading ${f.name} and pricing every position…`, () => api.upload(f), 'Tender imported and priced.')) {
        get().refreshTenders()
        return get().estimate?.tender.id ?? null
      }
      return null
    },
    close: () => {
      set({ estimate: null, selected: null, ...NO_FILTERS })
      remember(null)
    },
    removeTender: async (id) => {
      try {
        await api.remove(id)
        if (get().estimate?.tender.id === id) get().close()
        await get().refreshTenders()
        set({ toast: 'Tender removed.' })
      } catch (err) {
        set({ error: (err as Error).message })
      }
    },
    archiveTender: async (id, archived) => {
      try {
        await api.archive(id, archived)
        if (archived && get().estimate?.tender.id === id) get().close()
        await get().refreshTenders()
        set({ toast: archived ? 'Project archived.' : 'Project restored.' })
      } catch (err) {
        set({ error: (err as Error).message })
      }
    },
    override: async (lvId, body, done) => {
      await run('Recalculating…', () => api.override(tid(), lvId, body), done)
    },
    bulk: async (lvIds, body, done) => {
      await run('Updating positions…', () => api.bulk(tid(), { lv_ids: lvIds, ...body }), done)
    },
    addNote: async (lvId, text, author) => {
      await run('Saving note…', () => api.addNote(tid(), lvId, text, author ?? get().estimate?.tender.meta.estimator), 'Note saved.')
    },
    deleteNote: async (lvId, nid) => {
      await run('Removing note…', () => api.deleteNote(tid(), lvId, nid))
    },
    setParams: async (b) => {
      await run('Recalculating…', () => api.setParameters(tid(), b), 'Parameters applied; every price is recalculated.')
    },
    setMaterialInflation: async (b) => {
      await run('Recalculating…', () => api.setMaterialInflation(tid(), b), 'Material inflation applied.')
    },
    setMeta: async (b) => {
      await run('Saving…', () => api.setMeta(tid(), b), 'Project details saved.')
      get().refreshTenders()
    },
    refreshDatasets: async () => {
      try {
        set({ datasets: await api.datasets() })
      } catch {
        /* the price-book picker simply stays empty */
      }
    },
    setDataset: async (datasetId, version) => {
      const name = get().datasets.find((d) => d.id === datasetId)?.name ?? datasetId
      await run('Repricing against the price book\u2026', () => api.setDataset(tid(), { id: datasetId, version }),
        `Price book set to ${name}.`)
    },
    createDataset: async (body) => {
      set({ busy: 'Creating the price book\u2026', error: null })
      try {
        await api.createDataset(body)
        await get().refreshDatasets()
        set({ toast: `Price book "${body.name}" created.` })
      } catch (err) {
        set({ error: (err as Error).message })
      } finally {
        set({ busy: null })
      }
    },
    importDataset: async (body) => {
      set({ busy: 'Validating and importing CSV files…', error: null })
      try {
        await api.importDataset(body)
        await get().refreshDatasets()
        set({ toast: `Dataset "${body.name}" imported.` })
        return true
      } catch (err) {
        set({ error: (err as Error).message })
        return false
      } finally {
        set({ busy: null })
      }
    },
    deleteDataset: async (datasetId) => {
      try {
        await api.deleteDataset(datasetId)
        await get().refreshDatasets()
        set({ toast: 'Price book removed.' })
      } catch (err) {
        set({ error: (err as Error).message })
      }
    },
    addQuote: async (body, done) => {
      await run('Applying the supplier quote\u2026', () => api.addQuote(tid(), body), done ?? 'Supplier quote applied.')
    },
    importQuoteWorkbook: async (file, supplier, reference, quotedAt) => {
      await run(
        'Importing supplier prices…',
        () => api.importQuoteWorkbook(tid(), file, supplier, reference, quotedAt),
        'Supplier prices imported. Calculation updated.',
      )
    },
    importQuoteCsv: async (file, supplier, reference, quotedAt) => {
      await run(
        'Importing supplier prices…',
        () => api.importQuoteCsv(tid(), file, supplier, reference, quotedAt),
        'Supplier prices imported. Calculation updated.',
      )
    },
    deleteQuote: async (qid) => {
      await run('Removing the quote\u2026', () => api.deleteQuote(tid(), qid), 'Quote removed.')
    },
    promoteQuote: async (qid, datasetId) => {
      const name = get().datasets.find((d) => d.id === datasetId)?.name ?? datasetId
      if (await run('Publishing to the price book\u2026', () => api.promoteQuote(tid(), qid, datasetId),
        `Quote published to ${name}.`))
        get().refreshDatasets()
    },
    saveSnapshot: async (name) => {
      await run('Saving scenario…', () => api.saveSnapshot(tid(), name), `Scenario "${name}" saved.`)
    },
    applySnapshot: async (sid) => {
      await run('Restoring scenario…', () => api.applySnapshot(tid(), sid), 'Scenario parameters restored.')
    },
    deleteSnapshot: async (sid) => {
      await run('Removing scenario…', () => api.deleteSnapshot(tid(), sid))
    },
  }
})

/** The loaded estimate; only call inside screens that render once a tender is open. */
export const useEstimate = () => useStore((s) => s.estimate!)
