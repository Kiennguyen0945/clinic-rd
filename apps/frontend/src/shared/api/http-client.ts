import { useAuthStore } from '../auth/session-store'
import { ApiError } from './api-error'
import type { ApiEnvelope } from './api-envelope'
import { isApiEnvelope } from './api-envelope'

export async function authenticatedFetch(
  input: string,
  init: RequestInit = {},
) {
  const makeRequest = (token: string | null) => {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)

    return fetch(input, { ...init, headers })
  }

  const store = useAuthStore.getState()
  let response = await makeRequest(store.token)

  if (response.status !== 401) return response

  const refreshed = await store.refreshAccessToken()
  if (!refreshed) {
    store.logout()
    return response
  }

  const nextStore = useAuthStore.getState()
  response = await makeRequest(nextStore.token)
  if (response.status === 401) nextStore.logout()

  return response
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')

  const response = await authenticatedFetch(path, { ...init, headers })
  const contentType = response.headers.get('content-type') || ''
  let payload: ApiEnvelope<T> | null = null

  if (contentType.includes('application/json')) {
    try {
      const value: unknown = await response.json()
      payload = isApiEnvelope<T>(value) ? value : null
    } catch {
      payload = null
    }
  } else {
    await response.text()
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError(
      payload?.error?.message ||
        payload?.message ||
        `Máy chủ không thể xử lý yêu cầu (${response.status})`,
      {
        status: response.status,
        code: payload?.error?.code,
        details: payload?.error?.details,
      },
    )
  }

  return payload.data
}
