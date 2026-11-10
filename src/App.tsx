import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { db, getSetting, setSetting, SETTING } from './data/db'
import { requestPersistence } from './data/storage'
import { KEYS } from './app/config'
import { dailyRefresh } from './app/daily'
import { todayISO } from './domain/dates'
import { Layout } from './ui/Layout'
import { DisclaimerGate } from './ui/components/Disclaimer'
import { Today } from './ui/screens/Today'
import { Settings } from './ui/screens/Settings'
import { Diagnostic } from './ui/screens/Diagnostic'
import { Onboarding } from './ui/screens/Onboarding'
import { Week } from './ui/screens/Week'
import { PlanScreen } from './ui/screens/PlanScreen'
import { StrengthPlayer } from './ui/screens/StrengthPlayer'
import { Tabac } from './ui/screens/Tabac'
import { Suivi } from './ui/screens/Suivi'
import { Nutrition } from './ui/screens/Nutrition'
import { RoutinePlayer } from './ui/screens/RoutinePlayer'
import { Notes } from './ui/screens/Notes'

export default function App() {
  const [ready, setReady] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [onboarded, setOnboarded] = useState(false)

  useEffect(() => {
    ;(async () => {
      await db.open()
      setAccepted(!!(await getSetting(SETTING.disclaimerAcceptedAt)))
      const done = !!(await getSetting(KEYS.onboarded))
      setOnboarded(done)
      // Bilan, recalcul et envoi montre à chaque ouverture (sans bloquer l'affichage).
      if (done) dailyRefresh(todayISO()).catch(() => undefined)
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

  if (!onboarded) return <Onboarding onDone={() => setOnboarded(true)} />

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/aujourdhui" element={<Today />} />
          <Route path="/semaine" element={<Week />} />
          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/renfo/:id" element={<StrengthPlayer />} />
          <Route path="/tabac" element={<Tabac />} />
          <Route path="/routine/:id" element={<RoutinePlayer />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/suivi" element={<Suivi />} />
          <Route path="/reglages" element={<Settings />} />
          <Route path="/diagnostic" element={<Diagnostic />} />
          <Route path="*" element={<Navigate to="/aujourdhui" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
