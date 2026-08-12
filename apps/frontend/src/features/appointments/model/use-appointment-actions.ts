import { useState } from 'react'

import type { Appointment, AppointmentStatus } from '../../../entities/appointment'
import { mapPatient } from '../../../entities/patient'
import type { PatientProfile } from '../../../entities/patient'
import type { useAppointmentMutations } from './appointment.mutations'

interface ActionDependencies {
  selectedId: string
  selectedAppointment: Appointment | null
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>
  setPatients: React.Dispatch<React.SetStateAction<PatientProfile[]>>
  mutations: ReturnType<typeof useAppointmentMutations>
}

export function useAppointmentActions({
  selectedId, selectedAppointment, setAppointments, setPatients, mutations,
}: ActionDependencies) {
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null)
  const [patientEditTarget, setPatientEditTarget] = useState<Appointment | null>(null)
  const [appointmentEditTarget, setAppointmentEditTarget] = useState<Appointment | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const updateStatus = async (next: AppointmentStatus) => {
    if (!selectedId) return
    if (next === 'CANCELLED') {
      setCancelTarget(selectedAppointment)
      return
    }
    try {
      if (next === 'WAITING') await mutations.checkIn.mutateAsync(Number(selectedId))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật trạng thái lịch hẹn')
    }
  }

  const cancel = async (reason: string, note: string) => {
    if (!cancelTarget) return
    setSaving(true)
    try {
      await mutations.cancel.mutateAsync({ id: Number(cancelTarget.id), reason, note })
      setCancelTarget(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể hủy lịch hẹn')
    } finally {
      setSaving(false)
    }
  }

  const savePatient = async (values: {
    fullName: string
    phone: string
    email: string
    cccd: string
    insuranceNumber: string
    address: string
  }) => {
    if (!patientEditTarget) return
    setSaving(true)
    try {
      const response = await mutations.updatePatient.mutateAsync({
        id: Number(patientEditTarget.patient.id),
        body: {
          full_name: values.fullName.trim(), phone: values.phone.trim(),
          email: values.email.trim(), cccd: values.cccd.trim(),
          insurance_number: values.insuranceNumber.trim(), address: values.address.trim(),
        },
      })
      const updated = mapPatient(response.patient)
      setPatients((current) => current.map((patient) =>
        patient.id === updated.id ? { ...patient, ...updated } : patient,
      ))
      setAppointments((current) => current.map((appointment) =>
        appointment.patient.id === updated.id
          ? { ...appointment, patient: { ...appointment.patient, ...updated } }
          : appointment,
      ))
      setPatientEditTarget(null)
    } finally {
      setSaving(false)
    }
  }

  const saveReason = async (reason: string) => {
    if (!appointmentEditTarget) return
    setSaving(true)
    try {
      await mutations.update.mutateAsync({
        id: Number(appointmentEditTarget.id), body: { reason: reason.trim() },
      })
      setAppointments((current) => current.map((appointment) =>
        appointment.id === appointmentEditTarget.id
          ? { ...appointment, reason: reason.trim() }
          : appointment,
      ))
      setAppointmentEditTarget(null)
    } finally {
      setSaving(false)
    }
  }

  return {
    cancelTarget, setCancelTarget, patientEditTarget, setPatientEditTarget,
    appointmentEditTarget, setAppointmentEditTarget, saving, error,
    updateStatus, cancel, savePatient, saveReason,
  }
}
