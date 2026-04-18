// Janela comercial: seg–sex 08:30–18:30 (inclusivo/exclusivo), fuso SP.
// Brasil não observa horário de verão desde 2019 e SP fica em UTC-3 fixo,
// então usamos aritmética direta em vez de Intl.DateTimeFormat — evita
// variações de ICU/locale em runtimes enxutos (Vercel edge, etc.).
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000 // São Paulo = UTC-3
const START_MIN = 8 * 60 + 30  // 08:30
const END_MIN = 18 * 60 + 30   // 18:30

function spParts(date: Date | string): { weekday: number; minutes: number } {
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return { weekday: 0, minutes: 0 }
  const sp = new Date(d.getTime() - TZ_OFFSET_MS)
  return {
    // getUTCDay da data ajustada = dia da semana local SP (0=Dom, 6=Sáb)
    weekday: sp.getUTCDay(),
    minutes: sp.getUTCHours() * 60 + sp.getUTCMinutes(),
  }
}

/** true se o timestamp cai em seg–sex 08:30–18:30 SP. */
export function isBusinessHours(date: Date | string): boolean {
  const { weekday, minutes } = spParts(date)
  if (weekday === 0 || weekday === 6) return false
  return minutes >= START_MIN && minutes < END_MIN
}

/** true se o timestamp cai fora da janela comercial (18:31 SP → 08:29 SP,
 *  ou em qualquer horário de sábado/domingo). */
export function isOutOfBusinessHours(date: Date | string): boolean {
  return !isBusinessHours(date)
}
