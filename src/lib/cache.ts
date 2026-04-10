import { createClient } from '@/lib/supabase/server'

/**
 * Query for specialists list.
 * Simple helper to avoid repeating the query across pages.
 */
export async function getCachedSpecialists() {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'especialista')
    .order('full_name')
  return data ?? []
}

/**
 * Query for kanban stages by type.
 */
export async function getCachedStages(type: 'initial' | 'mentorship' | 'exit') {
  const supabase = createClient()
  const { data } = await supabase
    .from('kanban_stages')
    .select('id, name, type, position, created_at')
    .eq('type', type)
    .order('position')
  return data ?? []
}

/**
 * Query for all stages (both types).
 */
export async function getCachedAllStages() {
  const supabase = createClient()
  const { data } = await supabase
    .from('kanban_stages')
    .select('id, type')
    .order('position')
  return data ?? []
}
