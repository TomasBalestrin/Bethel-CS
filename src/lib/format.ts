/**
 * Format an ISO date string (yyyy-mm-dd or full ISO timestamp) to dd/MM/yyyy.
 * Returns the original string if parsing fails.
 */
export function formatDateBR(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
