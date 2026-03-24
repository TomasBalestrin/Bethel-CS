'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

type MenteeInsert = Database['public']['Tables']['mentees']['Insert']

interface CreateMenteeInput {
  full_name: string
  phone: string
  product_name: string
  start_date: string
  end_date?: string
  cpf?: string
  birth_date?: string
  email?: string
  instagram?: string
  city?: string
  state?: string
  has_partner?: boolean
  partner_name?: string
  seller_name?: string
  funnel_origin?: string
  referred_by_mentee_id?: string
  priority_level?: number
}

export async function createMentee(input: CreateMenteeInput) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Não autenticado' }
  }

  // Get the first stage of the initial kanban
  const { data: firstStage } = await supabase
    .from('kanban_stages')
    .select('id')
    .eq('type', 'initial')
    .order('position')
    .limit(1)
    .single()

  if (!firstStage) {
    return { error: 'Etapas iniciais não encontradas' }
  }

  const menteeData: MenteeInsert = {
    full_name: input.full_name,
    phone: input.phone,
    product_name: input.product_name,
    start_date: input.start_date,
    end_date: input.end_date || null,
    cpf: input.cpf || null,
    birth_date: input.birth_date || null,
    email: input.email || null,
    instagram: input.instagram || null,
    city: input.city || null,
    state: input.state || null,
    has_partner: input.has_partner ?? false,
    partner_name: input.partner_name || null,
    seller_name: input.seller_name || null,
    funnel_origin: input.funnel_origin || null,
    referred_by_mentee_id: input.referred_by_mentee_id || null,
    priority_level: input.priority_level ?? 1,
    current_stage_id: firstStage.id,
    kanban_type: 'initial',
    created_by: user.id,
  }

  const { error } = await supabase.from('mentees').insert(menteeData)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/etapas-iniciais')
  return { error: null }
}

export async function moveMentee(menteeId: string, newStageId: string) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Não autenticado' }
  }

  const { error } = await supabase
    .from('mentees')
    .update({ current_stage_id: newStageId })
    .eq('id', menteeId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/etapas-iniciais')
  return { error: null }
}
