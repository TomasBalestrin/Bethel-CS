'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createStreamChannel } from '@/lib/stream/create-channel'
import type { Database, KanbanType } from '@/types/database'

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
  kanban_type?: KanbanType
}

export async function createMentee(input: CreateMenteeInput) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Não autenticado' }
  }

  const kanbanType = input.kanban_type ?? 'initial'

  // Get the first stage of the target kanban
  const { data: firstStage } = await supabase
    .from('kanban_stages')
    .select('id')
    .eq('type', kanbanType)
    .order('position')
    .limit(1)
    .single()

  if (!firstStage) {
    return { error: 'Etapas não encontradas' }
  }

  // Get specialist profile for Stream
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .single()

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
    kanban_type: kanbanType,
    created_by: user.id,
  }

  const { data: newMentee, error } = await supabase
    .from('mentees')
    .insert(menteeData)
    .select('id')
    .single()

  if (error || !newMentee) {
    return { error: error?.message ?? 'Erro ao criar mentorado' }
  }

  // Create Stream Chat channel for this mentee
  try {
    const channelId = await createStreamChannel({
      menteeId: newMentee.id,
      menteeName: input.full_name,
      specialistId: user.id,
      specialistName: profile?.full_name ?? 'Especialista',
      specialistAvatar: profile?.avatar_url ?? undefined,
    })

    // Save channel ID in the database
    await supabase
      .from('mentees')
      .update({ stream_channel_id: channelId })
      .eq('id', newMentee.id)
  } catch (err) {
    // Channel creation failed — mentee was still created, log but don't block
    console.error('Failed to create Stream channel:', err)
  }

  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
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

  // Get current stage before moving
  const { data: mentee } = await supabase
    .from('mentees')
    .select('current_stage_id')
    .eq('id', menteeId)
    .single()

  const fromStageId = mentee?.current_stage_id ?? null

  const { error } = await supabase
    .from('mentees')
    .update({ current_stage_id: newStageId })
    .eq('id', menteeId)

  if (error) {
    return { error: error.message }
  }

  // Log stage change
  await supabase.from('stage_changes' as never).insert({
    mentee_id: menteeId,
    from_stage_id: fromStageId,
    to_stage_id: newStageId,
    changed_by: user.id,
  } as never)

  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function transitionToMentorship(menteeId: string) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  // Get current stage before transition
  const { data: mentee } = await supabase
    .from('mentees')
    .select('current_stage_id')
    .eq('id', menteeId)
    .single()

  const fromStageId = mentee?.current_stage_id ?? null

  // Get the first stage of the mentorship kanban
  const { data: firstStage } = await supabase
    .from('kanban_stages')
    .select('id')
    .eq('type', 'mentorship')
    .order('position')
    .limit(1)
    .single()

  if (!firstStage) return { error: 'Etapas de mentoria não encontradas' }

  const { error } = await supabase
    .from('mentees')
    .update({
      kanban_type: 'mentorship' as KanbanType,
      current_stage_id: firstStage.id,
    })
    .eq('id', menteeId)

  if (error) return { error: error.message }

  // Log stage change (transition)
  await supabase.from('stage_changes' as never).insert({
    mentee_id: menteeId,
    from_stage_id: fromStageId,
    to_stage_id: firstStage.id,
    changed_by: user.id,
  } as never)

  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  revalidatePath('/mentorados')
  return { error: null }
}
