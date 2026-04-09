import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Cached query for specialists list.
 * Revalidates every 5 minutes — specialists rarely change.
 */
export const getCachedSpecialists = unstable_cache(
  async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'especialista')
      .order('full_name')
    return data ?? []
  },
  ['specialists-list'],
  { revalidate: 300 } // 5 minutes
)

/**
 * Cached query for kanban stages.
 * Revalidates every 10 minutes — stages almost never change.
 */
export const getCachedStages = unstable_cache(
  async (type: 'initial' | 'mentorship') => {
    const supabase = createClient()
    const { data } = await supabase
      .from('kanban_stages')
      .select('id, name, type, position, created_at')
      .eq('type', type)
      .order('position')
    return data ?? []
  },
  ['kanban-stages'],
  { revalidate: 600 } // 10 minutes
)

/**
 * Cached query for all stages (both types).
 * Used for orphan repair validation.
 */
export const getCachedAllStages = unstable_cache(
  async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('kanban_stages')
      .select('id, type')
      .order('position')
    return data ?? []
  },
  ['all-kanban-stages'],
  { revalidate: 600 }
)
