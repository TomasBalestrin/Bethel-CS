import type { Database } from './database'

export type MenteeRow = Database['public']['Tables']['mentees']['Row']

export interface MenteeWithStats extends MenteeRow {
  attendance_count: number
  indication_count: number
  revenue_total: number
}
