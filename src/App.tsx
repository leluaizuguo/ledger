import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import RecordPage from './pages/RecordPage'
import BillsPage from './pages/BillsPage'
import ChartPage from './pages/ChartPage'
import CalendarPage from './pages/CalendarPage'
import AccountPage from './pages/AccountPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/record"   element={<RecordPage />} />
          <Route path="/bills"    element={<BillsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/chart"    element={<ChartPage />} />
          <Route path="/accounts" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/record" replace />} />
      </Routes>
    </HashRouter>
  )
}
