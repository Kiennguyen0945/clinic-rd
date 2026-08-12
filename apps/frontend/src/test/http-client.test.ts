import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../shared/api/api-error'
import { apiRequest } from '../shared/api/http-client'
import { useAuthStore } from '../shared/auth/session-store'
import { server } from './server'

describe('shared HTTP client contract', () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      isLoading: false,
      error: null,
    })
  })

  it('keeps request headers and JSON data-envelope mapping stable', async () => {
    useAuthStore.setState({ token: 'access-token' })
    let capturedRequest: {
      authorization: string | null
      contentType: string | null
      requestId: string | null
      body: unknown
    } | null = null

    server.use(
      http.post('/api/contract/', async ({ request }) => {
        capturedRequest = {
          authorization: request.headers.get('Authorization'),
          contentType: request.headers.get('Content-Type'),
          requestId: request.headers.get('X-Request-Id'),
          body: await request.json(),
        }
        return HttpResponse.json({
          success: true,
          data: { id: 42, label: 'unchanged' },
        })
      }),
    )

    const result = await apiRequest<{ id: number; label: string }>('/api/contract/', {
      method: 'POST',
      headers: { 'X-Request-Id': 'request-123' },
      body: JSON.stringify({ patientId: 7 }),
    })

    expect(capturedRequest).toEqual({
      authorization: 'Bearer access-token',
      contentType: 'application/json',
      requestId: 'request-123',
      body: { patientId: 7 },
    })
    expect(result).toEqual({ id: 42, label: 'unchanged' })
  })

  it('normalizes API errors without losing server details', async () => {
    server.use(
      http.put('/api/contract/', () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_SLOT',
              message: 'Khung giờ không hợp lệ',
              details: { slotId: 99 },
            },
          },
          { status: 422 },
        ),
      ),
    )

    const request = apiRequest('/api/contract/', { method: 'PUT' })

    await expect(request).rejects.toEqual(
      expect.objectContaining<ApiError>({
        name: 'ApiError',
        message: 'Khung giờ không hợp lệ',
        status: 422,
        code: 'INVALID_SLOT',
        details: { slotId: 99 },
      }),
    )
  })

  it('returns a predictable error for a non-envelope response', async () => {
    server.use(
      http.get('/api/contract/', () =>
        new HttpResponse('Service unavailable', { status: 503 }),
      ),
    )

    await expect(apiRequest('/api/contract/')).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Máy chủ không thể xử lý yêu cầu (503)',
      status: 503,
    })
  })

  it('passes request cancellation through to fetch', async () => {
    const controller = new AbortController()
    controller.abort()
    const abortError = Object.assign(new Error('The operation was aborted'), {
      name: 'AbortError',
    })
    const fetchMock = vi.fn((_input: string, init: RequestInit) => {
      expect(init.signal).toBe(controller.signal)
      expect(init.signal?.aborted).toBe(true)
      return Promise.reject(abortError)
    })
    vi.stubGlobal('fetch', fetchMock)

    try {
      await expect(
        apiRequest('/api/slow-contract/', { signal: controller.signal }),
      ).rejects.toMatchObject({ name: 'AbortError' })
      expect(fetchMock).toHaveBeenCalledOnce()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
