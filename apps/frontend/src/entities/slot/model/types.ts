export interface ApiSlot {
  id: number | null
  slotKey?: string
  doctorId: string
  roomId: string
  doctor: { id: string; fullName: string }
  room: { id: string; roomNumber: string }
  slotDate: string
  startTime: string
  endTime: string
  capacity: number
  bookedCount: number
  remainingCapacity: number
  isFull: boolean
  isBookable: boolean
  isOngoing: boolean
  isEnded: boolean
  status: 'OPEN' | 'CLOSED'
}

export type SlotState = 'available' | 'ongoing' | 'full' | 'ended' | 'closed'

export interface SlotDefinition {
  id: string
  start: string
  end: string
  state: SlotState
  booked: number
  capacity: number
  bookable: boolean
  room: string
  date: string
}
