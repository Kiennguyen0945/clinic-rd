import { useEffect } from 'react'

import '../App.css'
import { useAuthStore } from '../store'
import AppProviders from './providers'
import AppRouter from './router'

export default function App() {
  const isLoading = useAuthStore((state) => state.isLoading)
  const loadFromStorage = useAuthStore((state) => state.loadFromStorage)

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  return (
    <AppProviders>
      {isLoading ? (
        <div className="auth-wrapper">
          <div className="auth-card">
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
              Đang tải...
            </p>
          </div>
        </div>
      ) : (
        <AppRouter />
      )}
    </AppProviders>
  )
}
