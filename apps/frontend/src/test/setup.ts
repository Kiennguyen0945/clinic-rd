import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { queryClient } from '../shared/api/query-client'
import { server } from './server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  queryClient.clear()
  server.resetHandlers()
  localStorage.clear()
})

afterAll(() => server.close())
