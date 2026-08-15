import { apiRequest } from './http-client'

function localDate() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export async function synchronizeCurrentReportingSnapshot() {
  const date = localDate()
  await apiRequest('/api/reports/synchronize/', {
    method: 'POST',
    body: JSON.stringify({ dateFrom: date, dateTo: date }),
  })
}
