import type { Database } from './database'

export type MenteeRow = Database['public']['Tables']['mentees']['Row']

/** Campos mínimos para exibição em cards e listas */
export const MENTEE_SUMMARY_FIELDS = 'id, full_name, phone, email, instagram, product_name, city, state, status, cliente_fit, priority_level, kanban_type, current_stage_id, start_date, created_at, created_by, niche, closer_name, funnel_origin, birth_date, faturamento_atual, faturamento_antes_mentoria, notes, metrics_source_updated_at' as const

export type MenteeSummary = Pick<MenteeRow,
  'id' | 'full_name' | 'phone' | 'email' | 'instagram' | 'product_name' |
  'city' | 'state' | 'status' | 'cliente_fit' | 'priority_level' |
  'kanban_type' | 'current_stage_id' | 'start_date' | 'created_at' | 'created_by' |
  'niche' | 'closer_name' | 'funnel_origin' | 'birth_date' | 'faturamento_atual' | 'faturamento_antes_mentoria' |
  'notes'
>

/** Full mentee data with computed stats — extends MenteeSummary with optional detail fields */
export interface MenteeWithStats extends MenteeSummary, Partial<Omit<MenteeRow, keyof MenteeSummary>> {
  attendance_count: number
  indication_count: number
  revenue_total: number
  days_since_contact?: number
  has_active_session?: boolean
  active_sessions?: Array<{ channel: string; specialist_name: string; specialist_id?: string; started_at?: string }>
  /** Entrada na etapa atual (última stage_changes.changed_at para to_stage_id = current_stage_id).
   *  Fallback: created_at quando não há registro. */
  stage_entered_at?: string
  /** Última atualização do dado no Bethel Metrics (migração 00084 — ainda não
   *  está nos types gerados do Supabase). Alimenta o semáforo BM. */
  metrics_source_updated_at?: string | null
}

