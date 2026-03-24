'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { TestimonialCategory, EngagementType, CallType, RevenueType } from '@/types/database'

export async function addIndication(
  menteeId: string,
  indicatedName: string,
  indicatedPhone: string,
  notes?: string
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('indications').insert({
    mentee_id: menteeId,
    indicated_name: indicatedName,
    indicated_phone: indicatedPhone,
    notes: notes || null,
  })

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

export async function addTestimonial(
  menteeId: string,
  data: {
    testimonial_date: string
    description: string
    niche?: string
    revenue_range?: string
    employee_count?: string
    categories?: TestimonialCategory[]
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
    created_by: user.id,
  })

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
    response_time_minutes?: number
    recorded_at: string
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('engagement_records').insert({
    mentee_id: menteeId,
    type: data.type,
    value: data.value,
    response_time_minutes: data.response_time_minutes ?? null,
    recorded_at: data.recorded_at,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

export async function addCallRecord(
  menteeId: string,
  data: {
    duration_minutes: number
    call_type: CallType
    recorded_at: string
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('call_records').insert({
    mentee_id: menteeId,
    duration_minutes: data.duration_minutes,
    call_type: data.call_type,
    recorded_at: data.recorded_at,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}

export async function addCancellation(
  menteeId: string,
  data: {
    reason: string
    cancelled_at: string
  }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('cancellations').insert({
    mentee_id: menteeId,
    reason: data.reason,
    cancelled_at: data.cancelled_at,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/')
  return { error: null }
}
