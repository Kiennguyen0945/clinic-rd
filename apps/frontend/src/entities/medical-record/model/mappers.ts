import type { ApiMedicalRecordHistoryItem } from './types'

// The API already returns the domain shape; this mapper creates a stable copy at
// the boundary so later transport changes do not leak into UI consumers.
export const mapMedicalRecordHistory = (
  records: ApiMedicalRecordHistoryItem[],
) => records.map((record) => ({ ...record }))
