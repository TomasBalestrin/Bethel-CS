'use server'

import { createClient } from '@/lib/supabase/server'
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

  // Check if already submitted
  const { data: existing } = await supabase
    .from('action_plans')
    .select('id, submitted_at')
    .eq('mentee_id', mentee.id)
    .maybeSingle()

  if (existing?.submitted_at) {
    return { error: 'Formulário já foi enviado anteriormente' }
  }

  if (existing) {
    // Update existing draft
    const { error } = await supabase
      .from('action_plans')
      .update({ data, submitted_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    // Insert new
    const { error } = await supabase.from('action_plans').insert({
      mentee_id: mentee.id,
      data,
      submitted_at: new Date().toISOString(),
    })

    if (error) return { error: error.message }
  }

  return { error: null }
}
