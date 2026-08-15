import { z } from 'zod'

export const employeeSchema = z.object({
  username: z.string().trim().min(1, 'Vui lòng nhập tên đăng nhập.'),
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ và tên.'),
  email: z.string().trim().email('Email không hợp lệ.'),
  phone: z.string().trim().regex(/^(|\d{9,11})$/, 'Số điện thoại phải có 9–11 chữ số.'),
  gender: z.enum(['', 'M', 'F', 'O']),
  dateOfBirth: z.string().optional(),
  address: z.string().trim().optional(),
  roleCode: z.enum(['RECEPTIONIST', 'DOCTOR']),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']),
  password: z.string().min(8, 'Mật khẩu phải có ít nhất 8 ký tự.').optional().or(z.literal('')),
  departmentId: z.string().optional(),
  roomId: z.string().optional(),
}).superRefine((value, context) => {
  if (value.roleCode === 'DOCTOR' && !value.departmentId) {
    context.addIssue({ code: 'custom', path: ['departmentId'], message: 'Vui lòng chọn khoa.' })
  }
})

export type EmployeeFormValues = z.infer<typeof employeeSchema>

export const allocationSchema = z.object({
  roomId: z.string().min(1, 'Vui lòng chọn phòng.'),
  date: z.string().min(1, 'Vui lòng chọn ngày.'),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
}).refine((value) => value.startTime < value.endTime, {
  path: ['endTime'], message: 'Giờ kết thúc phải sau giờ bắt đầu.',
})

export type AllocationFormValues = z.infer<typeof allocationSchema>
