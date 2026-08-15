export function employeeInitials(fullName: string) {
  const normalized = fullName.trim().replace(/^BS\.\s*/iu, '')
  const words = normalized.split(/\s+/).filter(Boolean)
  const nameParts = words.length > 1 ? words.slice(1) : words
  return nameParts.map((word) => word[0]?.toLocaleUpperCase('vi-VN')).join('').slice(0, 2)
}

export function employeeDisplayName(fullName: string, role: 'DOCTOR' | 'RECEPTIONIST') {
  const name = fullName.trim()
  if (role !== 'DOCTOR' || /^BS\.\s*/iu.test(name)) return name
  return `BS. ${name}`
}

export function editableEmployeeName(fullName: string) {
  return fullName.trim().replace(/^BS\.\s*/iu, '')
}

export function usernameFromFullName(fullName: string) {
  return fullName
    .trim()
    .toLocaleLowerCase('vi-VN')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '')
}
