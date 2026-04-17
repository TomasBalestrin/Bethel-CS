const TZ = 'America/Sao_Paulo'
const START_MIN = 8 * 60 + 30  // 08:30
const END_MIN = 18 * 60 + 30   // 18:30

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour12: false,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function isBusinessHours(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  const parts = partsFormatter.formatToParts(d)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  if (weekday === 'Sat' || weekday === 'Sun') return false
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0')
  const mins = hour * 60 + minute
  return mins >= START_MIN && mins < END_MIN
}
