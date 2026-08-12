import { timeLabel } from '../../../shared/lib/date'
import type { ApiSlot, SlotDefinition, SlotState } from './types'

export function mapSlot(slot: ApiSlot): SlotDefinition {
  const state: SlotState =
    slot.status === 'CLOSED'
      ? 'closed'
      : slot.isEnded
        ? 'ended'
        : slot.isFull
          ? 'full'
          : slot.isOngoing
            ? 'ongoing'
            : 'available'
  return {
    id: slot.slotKey || String(slot.id),
    start: timeLabel(slot.startTime),
    end: timeLabel(slot.endTime),
    state,
    booked: slot.bookedCount,
    capacity: slot.capacity,
    bookable: slot.isBookable,
    room: slot.room.roomNumber,
    date: slot.slotDate,
  }
}

export function isSlotAvailable(slot: SlotDefinition) {
  return (
    slot.state !== 'ended' &&
    slot.state !== 'full' &&
    slot.state !== 'closed' &&
    slot.booked < slot.capacity
  )
}

export function emptyBookingSlot(): SlotDefinition {
  return {
    id: '',
    start: 'Chưa chọn khung giờ',
    end: '',
    state: 'available',
    booked: 0,
    capacity: 0,
    bookable: false,
    room: '',
    date: '',
  }
}
