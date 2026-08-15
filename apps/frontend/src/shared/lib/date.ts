export const todayValue = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export const tomorrowValue = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
}

export const timeLabel = (value: string) =>
  value.includes('T') ? value.slice(11, 16) : value.slice(0, 5)

export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))

export const shortDateLabel = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))

export const relativeSlotDateLabel = (value: string) => {
  const tomorrow = new Date(`${todayValue()}T12:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowValue = tomorrow.toISOString().slice(0, 10)
  if (value === todayValue()) return `Hôm nay, ${shortDateLabel(value)}`
  if (value === tomorrowValue) return `Ngày mai, ${shortDateLabel(value)}`
  return `Ngày ${shortDateLabel(value)}`
}
