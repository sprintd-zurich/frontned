import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { CatalogItem, Estimate, Parameters, PositionOverride } from './types'
import { Landing } from './components/Landing'
import { Header, type Tab } from './components/Header'
import { PositionsView } from './components/PositionsView'
import { BuildUpView } from './components/BuildUpView'
import { BidView } from './components/BidView'
import { RfqView } from './components/RfqView'

export default function App() {
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [tab, setTab] = useState<Tab>('positions')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (label: string, fn: () => Promise<Estimate>) => {
    setBusy(label)
    setError(null)
    try {
      const e = await fn()
      setEstimate(e)
      const url = new URL(location.href)
      url.searchParams.set('tender', e.tender.id)
      history.replaceState(null, '', url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => {
    api.catalog().then(setCatalog).catch(() => {})
    const id = new URLSearchParams(location.search).get('tender')
    if (id) run('Loading estimate…', () => api.get(id))
  }, [run])

  const override = (lvId: string, body: PositionOverride) =>
    estimate && run('Recalculating…', () => api.override(estimate.tender.id, lvId, body))
  const setParams = (body: Partial<Parameters>) =>
    estimate && run('Recalculating…', () => api.setParameters(estimate.tender.id, body))

  if (!estimate) {
    return (
      <Landing
        busy={busy}
        error={error}
        onDemo={() => run('Reading the tender and pricing every position…', api.loadDemo)}
        onUpload={(f) => run(`Reading ${f.name} and pricing every position…`, () => api.upload(f))}
        onOpen={(id) => run('Loading estimate…', () => api.get(id))}
      />
    )
  }

  return (
    <div className="app">
      <Header
        estimate={estimate}
        tab={tab}
        onTab={setTab}
        busy={busy}
        onHome={() => {
          setEstimate(null)
          history.replaceState(null, '', location.pathname)
        }}
      />
      {error && <div className="banner error">{error}</div>}
      {tab === 'positions' && <PositionsView estimate={estimate} catalog={catalog} onOverride={override} />}
      {tab === 'buildup' && <BuildUpView estimate={estimate} onParams={setParams} />}
      {tab === 'rfq' && <RfqView estimate={estimate} />}
      {tab === 'bid' && (
        <BidView
          estimate={estimate}
          onParams={setParams}
          onSave={(name) => run('Saving scenario…', () => api.saveSnapshot(estimate.tender.id, name))}
          onApply={(sid) => run('Restoring scenario…', () => api.applySnapshot(estimate.tender.id, sid))}
          onDelete={(sid) => run('Removing scenario…', () => api.deleteSnapshot(estimate.tender.id, sid))}
        />
      )}
    </div>
  )
}
