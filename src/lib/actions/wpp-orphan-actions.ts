'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'Não autenticado', supabase, admin: createAdminClient() }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { ok: false as const, error: 'Sem permissão', supabase, admin: createAdminClient() }
  return { ok: true as const, supabase, admin: createAdminClient() }
}

/** Assign an orphan WhatsApp phone to an existing mentee. Updates the mentee's
 *  phone to the incoming WhatsApp format and removes the orphan record. */
export async function assignOrphanToMentee(orphanPhone: string, menteeId: string) {
  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }

  // Update mentee phone using admin client to bypass RLS
  const { error: updateErr } = await auth.admin
    .from('mentees')
    .update({ phone: orphanPhone, updated_at: new Date().toISOString() } as never)
    .eq('id', menteeId)
  if (updateErr) return { error: updateErr.message }

  // Remove the orphan record (admin client because of RLS policy)
  await (auth.admin.from as (name: string) => ReturnType<typeof auth.admin.from>)('wpp_orphan_messages').delete().eq('phone', orphanPhone)

  revalidatePath('/admin')
  revalidatePath('/admin/mensagens-orfas')
  return { error: null }
}

export async function dismissOrphan(orphanPhone: string) {
  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }
  await (auth.admin.from as (name: string) => ReturnType<typeof auth.admin.from>)('wpp_orphan_messages').delete().eq('phone', orphanPhone)
  revalidatePath('/admin/mensagens-orfas')
  return { error: null }
}

export async function clearAllOrphans() {
  const auth = await requireAdmin()
  if (!auth.ok) return { error: auth.error }
  await (auth.admin.from as (name: string) => ReturnType<typeof auth.admin.from>)('wpp_orphan_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  revalidatePath('/admin/mensagens-orfas')
  return { error: null }
}
