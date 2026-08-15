import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { useAuthStore } from '@/shared/auth/session-store'
import MainLayout from './layouts/MainLayout'

const LoginPage = lazy(() => import('@/features/auth').then((module) => ({ default: module.LoginPage })))
const DashboardPage = lazy(() => import('@/features/dashboard').then((module) => ({ default: module.DashboardPage })))
const AppointmentsPage = lazy(() => import('@/features/appointments').then((module) => ({ default: module.AppointmentsPage })))
const PatientsPage = lazy(() => import('@/features/patients').then((module) => ({ default: module.PatientsPage })))
const MedicalRecordsPage = lazy(() => import('@/features/medical-records').then((module) => ({ default: module.MedicalRecordsPage })))
const EmployeeListPage = lazy(() => import('@/features/employees').then((module) => ({ default: module.EmployeeListPage })))

const routeFallback = <div className="empty-box">Đang tải trang...</div>
const dashboardFallback = (
  <div className="card" style={{ textAlign: 'center', padding: 48 }}>
    <p style={{ color: 'var(--text-secondary)' }}>Đang tải dữ liệu...</p>
  </div>
)

function DoctorRoute() {
  const user = useAuthStore((state) => state.user)

  return user?.role === 'doctor' ? (
    <Suspense fallback={routeFallback}><MedicalRecordsPage /></Suspense>
  ) : (
    <Navigate to="/dashboard" replace />
  )
}

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  return user?.role === 'manager' ? <Suspense fallback={routeFallback}>{children}</Suspense> : <Navigate to="/dashboard" replace />
}

export default function AppRouter() {
  const token = useAuthStore((state) => state.token)

  return (
    <Routes>
      <Route
        path="/login"
        element={token ? <Navigate to="/dashboard" replace /> : <Suspense fallback={routeFallback}><LoginPage /></Suspense>}
      />
      <Route
        element={token ? <MainLayout /> : <Navigate to="/login" replace />}
      >
        <Route path="/dashboard" element={<Suspense fallback={dashboardFallback}><DashboardPage /></Suspense>} />
        <Route path="/appointments" element={<Suspense fallback={routeFallback}><AppointmentsPage /></Suspense>} />
        <Route path="/patients" element={<Suspense fallback={routeFallback}><PatientsPage /></Suspense>} />
        <Route path="/medical-records" element={<DoctorRoute />} />
        <Route path="/staff" element={<ManagerRoute><EmployeeListPage /></ManagerRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
