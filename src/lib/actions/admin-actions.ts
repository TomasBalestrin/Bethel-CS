'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

export async function updateUserRole(userId: string, newRole: UserRole) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Verify current user is admin
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (currentProfile?.role !== 'admin') {
    return { error: 'Sem permissão' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { error: null }
}
