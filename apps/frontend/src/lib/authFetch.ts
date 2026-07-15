import { useAuthStore } from '../store'

type AuthFetchInput = string

export async function authFetch(input: AuthFetchInput, init: RequestInit = {}) {
  const makeRequest = (token: string | null) => {
    const headers = new Headers(init.headers || {})
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return fetch(input, {
      ...init,
      headers,
    })
  }

  const store = useAuthStore.getState()
  let response = await makeRequest(store.token)

  if (response.status !== 401) {
    return response
  }

  const refreshed = await store.refreshAccessToken()
  if (!refreshed) {
    store.logout()
    return response
  }

  const nextStore = useAuthStore.getState()
  response = await makeRequest(nextStore.token)
  if (response.status === 401) {
    nextStore.logout()
  }

  return response
}