import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import './App.css'
import { useAuthStore } from './store'
import MainLayout from './components/MainLayout'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import AppointmentsPage from './pages/Appointments'
import PatientsPage from './pages/Patients'

function App() {
  const token = useAuthStore((s) => s.token)
  const isLoading = useAuthStore((s) => s.isLoading)
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage)

  useEffect(() => {
    loadFromStorage()
  }, [])

  if (isLoading) {
    return (
      <div className="app-shell login-shell">
        <div className="login-card">
          <p>Đang tải...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route element={token ? <MainLayout /> : <Navigate to="/login" replace />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

