import type { Database } from './database'

export type MenteeRow = Database['public']['Tables']['mentees']['Row']

/** Campos mínimos para exibição em cards e listas */
export const MENTEE_SUMMARY_FIELDS = 'id, full_name, phone, email, instagram, product_name, city, state, status, cliente_fit, priority_level, kanban_type, current_stage_id, start_date, created_at, created_by, niche, closer_name, funnel_origin, birth_date, faturamento_atual, faturamento_antes_mentoria' as const

export type MenteeSummary = Pick<MenteeRow,
  'id' | 'full_name' | 'phone' | 'email' | 'instagram' | 'product_name' |
  'city' | 'state' | 'status' | 'cliente_fit' | 'priority_level' |
  'kanban_type' | 'current_stage_id' | 'start_date' | 'created_at' | 'created_by' |
  'niche' | 'closer_name' | 'funnel_origin' | 'birth_date' | 'faturamento_atual' | 'faturamento_antes_mentoria'
>

/** Full mentee data with computed stats — extends MenteeSummary with optional detail fields */
export interface MenteeWithStats extends MenteeSummary, Partial<Omit<MenteeRow, keyof MenteeSummary>> {
  attendance_count: number
  indication_count: number
  revenue_total: number
  days_since_contact?: number
}

