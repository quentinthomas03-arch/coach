import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { db, getSetting, setSetting, SETTING } from './data/db'
import { requestPersistence } from './data/storage'
import { loadPiste } from './ui/theme'
import { Layout } from './ui/Layout'
import { DisclaimerGate } from './ui/components/Disclaimer'
import { Today } from './ui/screens/Today'
import { Settings } from './ui/screens/Settings'
import { Diagnostic } from './ui/screens/Diagnostic'
import { DesignPreview } from './ui/screens/DesignPreview'
import { Placeholder } from './ui/screens/Placeholder'

export default function App() {
  const [ready, setReady] = useState(false)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    ;(async () => {
      await db.open()
      await loadPiste()
      setAccepted(!!(await getSetting(SETTING.disclaimerAcceptedAt)))
      const persisted = await requestPersistence()
      if (persisted !== undefined) await setSetting(SETTING.persistGranted, persisted)
      setReady(true)
    })()
  }, [])

  if (!ready) return null
  if (!accepted)
    return (
      <DisclaimerGate
        onAccept={async () => {
          await setSetting(SETTING.disclaimerAcceptedAt, new Date().toISOString())
          setAccepted(true)
        }}
      />
    )

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/aujourdhui" element={<Today />} />
          <Route
            path="/semaine"
            element={<Placeholder title="Semaine" phase="Phase 1" items={['Plan de la semaine', 'Tes disponibilités en 30 secondes', 'Ce qui a été recalculé et pourquoi']} />}
          />
          <Route
            path="/plan"
            element={<Placeholder title="Plan" phase="Phases 1 et 3" items={['Reprise puis Forme continue', 'Objectifs : route, chrono, trail, forme', 'Vue par phases jusqu’à l’échéance']} />}
          />
          <Route
            path="/nutrition"
            element={<Placeholder title="Nutrition" phase="Phase 4" items={['Objectifs calories et macros du jour', 'Journal rapide, favoris, repas d’hier', 'Hydratation selon séance et météo']} />}
          />
          <Route
            path="/suivi"
            element={<Placeholder title="Suivi" phase="Phase 2" items={['Volume et charge hebdomadaires', 'Progression des allures', 'Régularité du renfo, poids si saisi']} />}
          />
          <Route path="/reglages" element={<Settings />} />
          <Route path="/diagnostic" element={<Diagnostic />} />
          <Route path="/design" element={<DesignPreview />} />
          <Route path="*" element={<Navigate to="/aujourdhui" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
