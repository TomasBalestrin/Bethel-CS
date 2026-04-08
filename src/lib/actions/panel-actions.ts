'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TestimonialCategory, EngagementType, CsActivityType, RevenueType, Database } from '@/types/database'

type MenteeUpdate = Database['public']['Tables']['mentees']['Update']

export async function updateMentee(menteeId: string, data: MenteeUpdate) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Sem permissão' }

  const { error } = await supabase
    .from('mentees')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', menteeId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  revalidatePath('/mentorados')
  return { error: null }
}

export async function deleteMentee(menteeId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return { error: 'Sem permissão' }

  // Clear referrals pointing to this mentee
  await supabase.from('mentees').update({ referred_by_mentee_id: null }).eq('referred_by_mentee_id', menteeId)

  // Delete related records first (cascade)
  const tables = [
    'attendances',
    'action_plans',
    'indications',
    'intensivo_records',
    'revenue_records',
    'objectives',
    'testimonials',
    'engagement_records',
    'cs_activities',
    'chat_metrics',
    'wpp_messages',
    'cancellations',
    'push_subscriptions',
  ] as const

  for (const table of tables) {
    await supabase.from(table).delete().eq('mentee_id', menteeId)
  }

  const { error } = await supabase.from('mentees').delete().eq('id', menteeId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  revalidatePath('/mentorados')
  return { error: null }
}

export async function addIndication(
  menteeId: string,
  data: {
    indication_date: string
    quantity_indicated: number
    quantity_confirmed: number
    revenue_generated: number
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('indications').insert({
    mentee_id: menteeId,
    indication_date: data.indication_date,
    quantity_indicated: data.quantity_indicated,
    quantity_confirmed: data.quantity_confirmed,
    revenue_generated: data.revenue_generated,
  })

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function updateIndication(
  recordId: string,
  data: {
    indication_date?: string
    quantity_indicated?: number
    quantity_confirmed?: number
    revenue_generated?: number
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('indications')
    .update(data)
    .eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function deleteIndication(recordId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('indications').delete().eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function addIntensivoRecord(
  menteeId: string,
  data: {
    participated?: boolean
    participation_date?: string
    indication_name?: string
    indication_phone?: string
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('intensivo_records').insert({
    mentee_id: menteeId,
    participated: data.participated ?? false,
    participation_date: data.participation_date || null,
    indication_name: data.indication_name || null,
    indication_phone: data.indication_phone || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function updateIntensivoRecord(
  recordId: string,
  data: {
    participated?: boolean
    participation_date?: string
    indication_name?: string
    indication_phone?: string
    guest_name?: string
    guest_phone?: string
    converted?: boolean
    converted_name?: string
    converted_value?: number
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('intensivo_records')
    .update({
      participated: data.participated ?? false,
      participation_date: data.participation_date || null,
      indication_name: data.indication_name || null,
      indication_phone: data.indication_phone || null,
    })
    .eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function deleteIntensivoRecord(recordId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('intensivo_records').delete().eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function addRevenueRecord(
  menteeId: string,
  data: {
    product_name: string
    sale_value: number
    entry_value: number
    revenue_type?: RevenueType
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('revenue_records').insert({
    mentee_id: menteeId,
    product_name: data.product_name,
    sale_value: data.sale_value,
    entry_value: data.entry_value,
    revenue_type: data.revenue_type ?? 'crossell',
    registered_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function updateRevenueRecord(
  recordId: string,
  data: {
    product_name: string
    sale_value: number
    entry_value: number
    revenue_type?: RevenueType
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('revenue_records')
    .update({
      product_name: data.product_name,
      sale_value: data.sale_value,
      entry_value: data.entry_value,
      revenue_type: data.revenue_type ?? 'crossell',
    })
    .eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function deleteRevenueRecord(recordId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('revenue_records')
    .delete()
    .eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function addObjective(
  menteeId: string,
  data: {
    title: string
    description?: string
    achieved_at?: string
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('objectives').insert({
    mentee_id: menteeId,
    title: data.title,
    description: data.description || null,
    achieved_at: data.achieved_at || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function updateObjective(
  recordId: string,
  data: { title: string; description?: string; achieved_at?: string }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('objectives')
    .update({
      title: data.title,
      description: data.description || null,
      achieved_at: data.achieved_at || null,
    })
    .eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function deleteObjective(recordId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('objectives').delete().eq('id', recordId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function addTestimonial(
  menteeId: string,
  data: {
    testimonial_date: string
    description: string
    niche?: string
    revenue_range?: string
    employee_count?: string
    categories?: TestimonialCategory[]
    attachment_url?: string
    attachment_type?: 'photo' | 'video'
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('testimonials').insert({
    mentee_id: menteeId,
    testimonial_date: data.testimonial_date,
    description: data.description,
    niche: data.niche || null,
    revenue_range: data.revenue_range || null,
    employee_count: data.employee_count || null,
    categories: data.categories ?? [],
    attachment_url: data.attachment_url || null,
    attachment_type: data.attachment_type || null,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function updateTestimonial(
  testimonialId: string,
  data: {
    testimonial_date: string
    description: string
    niche?: string
    revenue_range?: string
    employee_count?: string
    categories?: TestimonialCategory[]
    attachment_url?: string
    attachment_type?: 'photo' | 'video'
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const updateData: Record<string, unknown> = {
    testimonial_date: data.testimonial_date,
    description: data.description,
    niche: data.niche || null,
    revenue_range: data.revenue_range || null,
    employee_count: data.employee_count || null,
    categories: data.categories ?? [],
  }
  if (data.attachment_url) {
    updateData.attachment_url = data.attachment_url
    updateData.attachment_type = data.attachment_type || null
  }

  const { error } = await supabase.from('testimonials').update(updateData).eq('id', testimonialId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function deleteTestimonial(testimonialId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('testimonials').delete().eq('id', testimonialId)

  if (error) return { error: error.message }
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function generateActionPlanLink(menteeId: string) {
  const supabase = createClient()

  const { data: mentee } = await supabase
    .from('mentees')
    .select('action_plan_token')
    .eq('id', menteeId)
    .single()

  if (!mentee) return { error: 'Mentorado não encontrado', token: null }
  return { error: null, token: mentee.action_plan_token }
}

export async function toggleClienteFit(menteeId: string, value: boolean) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('mentees')
    .update({ cliente_fit: value })
    .eq('id', menteeId)

  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  revalidatePath('/mentorados')
  return { error: null }
}

export async function addEngagementRecord(
  menteeId: string,
  data: {
    type: EngagementType
    value: number
    notes?: string
    recorded_at: string
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('engagement_records').insert({
    mentee_id: menteeId,
    specialist_id: user.id,
    type: data.type,
    value: data.value,
    notes: data.notes ?? null,
    recorded_at: data.recorded_at,
  })

  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

export async function addCsActivity(
  menteeId: string,
  data: {
    type: CsActivityType
    duration_minutes: number
    notes?: string
    activity_date: string
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('cs_activities').insert({
    mentee_id: menteeId,
    specialist_id: user.id,
    type: data.type,
    duration_minutes: data.duration_minutes,
    notes: data.notes ?? null,
    activity_date: data.activity_date,
  })

  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

// ─── Presential Events ───
export async function addPresentialEvent(menteeId: string, data: { event_date: string; brought_guest?: boolean; guest_name?: string; guest_phone?: string; converted?: boolean; converted_name?: string; converted_value?: number; notes?: string }) {
  const supabase = createClient()
  const { error } = await supabase.from('presential_events').insert({ mentee_id: menteeId, ...data })
  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

export async function updatePresentialEvent(id: string, data: Record<string, unknown>) {
  const supabase = createClient()
  const { error } = await supabase.from('presential_events').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

export async function deletePresentialEvent(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('presential_events').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

// ─── Individual Sessions ───
export async function addIndividualSession(menteeId: string, data: { session_date: string; duration_minutes?: number; specialist_name?: string; notes?: string }) {
  const supabase = createClient()
  const { error } = await supabase.from('individual_sessions').insert({ mentee_id: menteeId, ...data })
  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

export async function deleteIndividualSession(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('individual_sessions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

// ─── Extra Deliveries ───
export async function addExtraDelivery(menteeId: string, data: { delivery_date: string; delivery_type?: string; description?: string }) {
  const supabase = createClient()
  const { error } = await supabase.from('extra_deliveries').insert({ mentee_id: menteeId, ...data })
  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

export async function deleteExtraDelivery(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('extra_deliveries').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}
