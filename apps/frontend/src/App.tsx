import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import './App.css'
import { useAuthStore } from './store'
import MainLayout from './components/MainLayout'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import AppointmentsPage from './pages/Appointments'
import PatientsPage from './pages/Patients'
import MedicalRecordsPage from './pages/MedicalRecords'

function DoctorRoute() {
  const user = useAuthStore((s) => s.user)
  return user?.role === 'doctor' ? <MedicalRecordsPage /> : <Navigate to="/dashboard" replace />
}

function App() {
  const token = useAuthStore((s) => s.token)
  const isLoading = useAuthStore((s) => s.isLoading)
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage)

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  if (isLoading) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Đang tải...</p>
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
          <Route path="/medical-records" element={<DoctorRoute />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
