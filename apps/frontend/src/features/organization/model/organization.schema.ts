import { z } from 'zod'

export const departmentSchema = z.object({
  code: z.string().trim().min(1, 'Vui lòng nhập mã khoa.').max(50),
  name: z.string().trim().min(1, 'Vui lòng nhập tên khoa.').max(150),
  description: z.string().trim(),
})
export type DepartmentFormValues = z.infer<typeof departmentSchema>

export const roomSchema = z.object({
  room_number: z.string().trim().min(1, 'Vui lòng nhập tên hoặc số phòng.').max(50),
  department_id: z.string().min(1, 'Vui lòng chọn khoa.'),
  description: z.string().trim(),
})
export type RoomFormValues = z.infer<typeof roomSchema>
