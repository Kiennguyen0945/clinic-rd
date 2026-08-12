// Temporary compatibility module. New code should import from entities or shared.
export * from '../../entities/appointment'
export * from '../../entities/patient'
export * from '../../entities/slot'
export { mapDoctor } from '../../features/appointments'
export {
  dateLabel,
  relativeSlotDateLabel,
  shortDateLabel,
  timeLabel,
  todayValue,
} from '../../shared/lib/date'
