import type { Database, UserRole } from './database'

export type { UserRole }

export type Profile = Database['public']['Tables']['profiles']['Row']
