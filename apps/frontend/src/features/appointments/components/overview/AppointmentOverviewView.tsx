import type { ReceptionContext } from '../../api/reception.api'
import { AppointmentOverview } from './AppointmentOverview'

interface Props {
  selectedDate: string
  setSelectedDate: (value: string) => void
  onCreate: () => void
  onViewDoctor: (value: string) => void
  context: ReceptionContext | null
  loading: boolean
  error: string
  department: string
  setDepartment: (value: string) => void
  doctor: string
  setDoctor: (value: string) => void
  slotStatus: string
  setSlotStatus: (value: string) => void
}

export function AppointmentOverviewView(props: Props) {
  return <AppointmentOverview
    selectedDate={props.selectedDate}
    onDateChange={props.setSelectedDate}
    onCreate={props.onCreate}
    onViewDoctor={props.onViewDoctor}
    context={props.context}
    loading={props.loading}
    error={props.error}
    receptionClosed={false}
    departmentFilter={props.department}
    onDepartmentFilterChange={props.setDepartment}
    doctorFilter={props.doctor}
    onDoctorFilterChange={props.setDoctor}
    slotStatusFilter={props.slotStatus}
    onSlotStatusFilterChange={props.setSlotStatus}
  />
}
