import { create } from 'zustand'
import { api, type ProductivityRule } from './api'
import type { Pill } from './derive'
import type { CatalogItem, Dataset, Estimate, MaterialInflation, Meta, Parameters, PositionOverride, Status, TenderSummary } from './types'

const LAST = 'equans-tender-id'

interface Filters {
  system: string
  /** HVAC trade from the category strip */
  category: string
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
  filter: (f: Partial<Filters>) => void
  clearFilters: () => void
  select: (lvId: string | null) => void
  notify: (s: string) => void
  init: () => Promise<void>
  refreshTenders: () => Promise<void>
  open: (id: string) => Promise<void>
  loadDemo: () => Promise<void>
  upload: (f: File) => Promise<void>
  close: () => void
  removeTender: (id: string) => Promise<void>
  archiveTender: (id: string, archived: boolean) => Promise<void>
  override: (lvId: string, body: PositionOverride, done?: string) => Promise<void>
  bulk: (lvIds: string[], body: { reviewed?: boolean; status?: Status }, done?: string) => Promise<void>
  setMaterialInflation: (b: MaterialInflation) => Promise<void>
  refreshDatasets: () => Promise<void>
  setDataset: (datasetId: string, version?: number) => Promise<void>
  addNote: (lvId: string, text: string, author?: string) => Promise<void>
  deleteNote: (lvId: string, nid: string) => Promise<void>
  setParams: (b: Partial<Parameters>) => Promise<void>
  setMeta: (b: Partial<Meta>) => Promise<void>
  saveSnapshot: (name: string) => Promise<void>
  applySnapshot: (sid: string) => Promise<void>
  deleteSnapshot: (sid: string) => Promise<void>
  /** any change that returns the estimate (sheets, experience, …) */
  act: (label: string, fn: (tid: string) => Promise<Estimate>, done?: string) => Promise<boolean>
  /** share of the window the left side of the split views takes (0.2–0.8) */
  ratio: number
  setRatio: (r: number) => void
}

const RATIO = 'equans-split-ratio'
function savedRatio() {
  try {
    const r = Number(localStorage.getItem(RATIO))
    return r >= 0.2 && r <= 0.8 ? r : 0.5
  } catch {
    return 0.5
  }
}

const NO_FILTERS: Filters = { system: 'all', category: 'all', pill: 'all', search: '', section: 'all', hideDucts: false, only: null }

function remember(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST, id)
    else localStorage.removeItem(LAST)
  } catch {
    /* private mode: the URL still carries the tender */
  }
  const url = new URL(location.href)
  if (id) url.searchParams.set('tender', id)
  else url.searchParams.delete('tender')
  history.replaceState(history.state, '', url)
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
    ratio: savedRatio(),
    setRatio: (r) => {
      const ratio = Math.min(0.8, Math.max(0.2, r))
      set({ ratio })
      try {
        localStorage.setItem(RATIO, String(ratio))
      } catch {
        /* the ratio then lasts for this visit */
      }
    },
    act: (label, fn, done) => run(label, () => fn(tid()), done),
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
      let id = new URLSearchParams(location.search).get('tender')
      try {
        id = id ?? localStorage.getItem(LAST)
      } catch {
        /* ignore */
      }
      if (id && get().tenders.some((t) => t.id === id)) await get().open(id)
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
      set({ ...NO_FILTERS, selected: null })
      await run('Loading estimate…', () => api.get(id))
    },
    loadDemo: async () => {
      set({ ...NO_FILTERS, selected: null })
      if (await run('Reading the tender and pricing every position…', api.loadDemo, 'Tender imported and priced.'))
        get().refreshTenders()
    },
    upload: async (f) => {
      set({ ...NO_FILTERS, selected: null })
      if (await run(`Reading ${f.name} and pricing every position…`, () => api.upload(f), 'Tender imported and priced.'))
        get().refreshTenders()
    },
    close: () => {
      set({ estimate: null, selected: null, ...NO_FILTERS })
      remember(null)
    },
    removeTender: async (id) => {
      try {
        await api.remove(id)
        if (get().estimate?.tender.id === id) get().close()
        set({ tenders: get().tenders.filter((t) => t.id !== id) })
        get().refreshTenders()
        set({ toast: 'Tender deleted permanently.' })
      } catch (err) {
        set({ error: (err as Error).message })
      }
    },
    archiveTender: async (id, archived) => {
      try {
        await api.archive(id, archived)
        if (archived && get().estimate?.tender.id === id) get().close()
        // the list moves at once; the full refresh can take a moment with many tenders
        set({ tenders: get().tenders.map((t) => (t.id === id ? { ...t, archived } : t)) })
        get().refreshTenders()
        set({ toast: archived ? 'Tender moved to Archived.' : 'Tender restored.' })
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
    setMaterialInflation: async (b) => {
      await run('Recalculating…', () => api.setMaterialInflation(tid(), b), 'Material inflation applied.')
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
    addNote: async (lvId, text, author) => {
      await run('Saving note…', () => api.addNote(tid(), lvId, text, author ?? get().estimate?.tender.meta.estimator), 'Note saved.')
    },
    deleteNote: async (lvId, nid) => {
      await run('Removing note…', () => api.deleteNote(tid(), lvId, nid))
    },
    setParams: async (b) => {
      await run('Recalculating…', () => api.setParameters(tid(), b), 'Parameters applied; every price is recalculated.')
    },
    setMeta: async (b) => {
      await run('Saving…', () => api.setMeta(tid(), b), 'Project details saved.')
      get().refreshTenders()
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
