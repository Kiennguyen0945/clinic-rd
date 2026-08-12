import { apiRequest } from '../../../shared/api'
import type { ApiSlot } from '../model/types'

export const slotApi = {
  list: (date: string, doctorId: string, bookingType = 'SCHEDULE') =>
    apiRequest<{ slots: ApiSlot[] }>(
      `/api/doctor-slots/?date=${date}&doctorId=${doctorId}&bookingType=${bookingType}`,
    ),
}
