'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Json } from '@/types/database'

export async function submitActionPlan(token: string, data: Record<string, Json>) {
  const supabase = createClient()

  // Look up mentee by token
  const { data: mentee } = await supabase
    .from('mentees')
    .select('id')
    .eq('action_plan_token', token)
    .single()

  if (!mentee) {
    return { error: 'Token inválido ou mentorado não encontrado' }
  }

  // Check for existing plan (allow resubmission — data will be updated)
  const { data: existing } = await supabase
    .from('action_plans')
    .select('id, submitted_at')
    .eq('mentee_id', mentee.id)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('action_plans')
      .update({ data, submitted_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('action_plans').insert({
      mentee_id: mentee.id,
      data,
      submitted_at: new Date().toISOString(),
    })
    if (error) return { error: error.message }
  }

  // Sync contact + business data back to mentee
  const updates: Record<string, unknown> = {}
  if (data.cpf) updates.cpf = data.cpf
  if (data.data_aniversario) updates.birth_date = data.data_aniversario
  if (data.email) updates.email = data.email
  if (data.instagram) updates.instagram = data.instagram
  if (data.cidade) updates.city = data.cidade
  if (data.estado) updates.state = data.estado
  if (data.nicho) updates.niche = data.nicho
  if (data.nome_empresa) updates.nome_empresa = data.nome_empresa
  if (data.num_colaboradores) {
    const n = parseInt(String(data.num_colaboradores), 10)
    if (!isNaN(n) && n > 0) updates.num_colaboradores = n
  }
  if (data.faturamento_medio) {
    const f = parseFloat(String(data.faturamento_medio).replace(/[R$\s.]/g, '').replace(',', '.'))
    if (!isNaN(f) && f > 0) updates.faturamento_atual = f
  }
  if (Object.keys(updates).length > 0) {
    await supabase.from('mentees').update(updates).eq('id', mentee.id)
  }

  return { error: null }
}

/** Edit an existing action plan from the CS panel (authenticated user).
 *  Lets specialists fix/complement answers after the mentee submitted the form.
 *  Also mirrors the sync of contact/business fields back to the mentee,
 *  matching submitActionPlan behavior so edits stay consistent.
 */
export async function updateActionPlan(menteeId: string, data: Record<string, Json>) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: existing } = await supabase
    .from('action_plans')
    .select('id')
    .eq('mentee_id', menteeId)
    .maybeSingle()

  if (!existing) return { error: 'Plano de ação não encontrado para este mentorado' }

  const { error } = await supabase
    .from('action_plans')
    .update({ data, submitted_at: new Date().toISOString() })
    .eq('id', existing.id)
  if (error) return { error: error.message }

  // Mirror the same contact/business sync as submitActionPlan
  const updates: Record<string, unknown> = {}
  if (data.cpf) updates.cpf = data.cpf
  if (data.data_aniversario) updates.birth_date = data.data_aniversario
  if (data.email) updates.email = data.email
  if (data.instagram) updates.instagram = data.instagram
  if (data.cidade) updates.city = data.cidade
  if (data.estado) updates.state = data.estado
  if (data.nicho) updates.niche = data.nicho
  if (data.nome_empresa) updates.nome_empresa = data.nome_empresa
  if (data.num_colaboradores) {
    const n = parseInt(String(data.num_colaboradores), 10)
    if (!isNaN(n) && n > 0) updates.num_colaboradores = n
  }
  if (data.faturamento_medio) {
    const f = parseFloat(String(data.faturamento_medio).replace(/[R$\s.]/g, '').replace(',', '.'))
    if (!isNaN(f) && f > 0) updates.faturamento_atual = f
  }
  if (Object.keys(updates).length > 0) {
    await supabase.from('mentees').update(updates).eq('id', menteeId)
  }

  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  revalidatePath('/mentorados')
  return { error: null }
}
