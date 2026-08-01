import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import Layout from './components/Layout'
import RecordPage from './pages/RecordPage'
import BillsPage from './pages/BillsPage'
import ChartPage from './pages/ChartPage'
import CalendarPage from './pages/CalendarPage'
import AccountPage from './pages/AccountPage'
import LoginPage from './pages/LoginPage'
import { isLoggedIn } from './utils/api'

function AuthGuard() {
  if (!isLoggedIn()) return <Navigate to="/login" replace />
  return <Outlet />
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGuard />}>
          <Route element={<Layout />}>
            <Route path="/record" element={<RecordPage />} />
            <Route path="/bills" element={<BillsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/chart" element={<ChartPage />} />
            <Route path="/accounts" element={<AccountPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/record" replace />} />
      </Routes>
    </HashRouter>
  )
}
