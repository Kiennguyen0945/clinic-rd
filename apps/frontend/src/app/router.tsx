import { Navigate, Route, Routes } from 'react-router-dom'

import { LoginPage } from '../features/auth'
import { DashboardPage } from '../features/dashboard'
import { PatientsPage } from '../features/patients'
import AppointmentsPage from '../pages/Appointments'
import MedicalRecordsPage from '../pages/MedicalRecords'
import { useAuthStore } from '../store'
import MainLayout from './layouts/MainLayout'

function DoctorRoute() {
  const user = useAuthStore((state) => state.user)

  return user?.role === 'doctor' ? (
    <MedicalRecordsPage />
  ) : (
    <Navigate to="/dashboard" replace />
  )
}

export default function AppRouter() {
  const token = useAuthStore((state) => state.token)

  return (
    <Routes>
      <Route
        path="/login"
        element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        element={token ? <MainLayout /> : <Navigate to="/login" replace />}
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/medical-records" element={<DoctorRoute />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
