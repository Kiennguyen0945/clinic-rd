export interface ApiEnvelope<T> {
  success: boolean
  data: T
  message?: string
  error?: {
    code?: string
    message?: string
    details?: Record<string, unknown>
  }
}

export function isApiEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      typeof value.success === 'boolean',
  )
}
