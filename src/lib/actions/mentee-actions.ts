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
  specialist_id?: string
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
    created_by: input.specialist_id || user.id,
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

// ─── Bulk Import ─────────────────────────────────────────────────────────────

interface BulkImportInput {
  rows: Record<string, string | number>[]
  defaultSpecialistId?: string
}

interface BulkImportResult {
  total: number
  created: number
  errors: { row: number; name: string; error: string }[]
}

function parseDateServer(val: string | number | undefined): string | null {
  if (val === undefined || val === null || val === '') return null
  // Excel serial number (e.g. 45781.99967592592 = a date)
  if (typeof val === 'number' || (typeof val === 'string' && /^\d{4,5}(\.\d+)?$/.test(val.trim()))) {
    const serial = typeof val === 'number' ? val : parseFloat(val)
    if (serial > 1000 && serial < 100000) {
      // Excel epoch: Jan 0, 1900 (with the Lotus 123 leap year bug)
      // Round to nearest day to avoid fractional time issues
      const excelEpoch = new Date(1899, 11, 30) // Dec 30, 1899
      const date = new Date(excelEpoch.getTime() + Math.round(serial) * 86400000)
      if (!isNaN(date.getTime())) {
        const y = date.getFullYear()
        const m = String(date.getMonth() + 1).padStart(2, '0')
        const d = String(date.getDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    }
  }
  const str = String(val).trim()
  // DD/MM/YYYY
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10)
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10)
  return null
}

function parseNumberServer(val: string | number | undefined): number | null {
  if (val === undefined || val === null || val === '') return null
  const num = parseFloat(String(val).replace(/[R$\s.]/g, '').replace(',', '.'))
  return isNaN(num) ? null : num
}

function parseStatusServer(val: string | undefined): 'ativo' | 'cancelado' | 'concluido' {
  if (!val) return 'ativo'
  const v = String(val).toLowerCase().trim()
  if (v.includes('cancel') || v.includes('churn') || v.includes('inativ') || v.includes('pausad')) return 'cancelado'
  if (v.includes('concluid') || v.includes('finish') || v.includes('encerr')) return 'concluido'
  return 'ativo'
}

export async function bulkCreateMentees(input: BulkImportInput): Promise<BulkImportResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: input.rows.length, created: 0, errors: [{ row: 0, name: '', error: 'Não autenticado' }] }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  // Get default stage (initial kanban, first position)
  const { data: firstStage } = await supabase
    .from('kanban_stages')
    .select('id')
    .eq('type', 'initial')
    .order('position')
    .limit(1)
    .single()

  if (!firstStage) return { total: input.rows.length, created: 0, errors: [{ row: 0, name: '', error: 'Etapas não encontradas' }] }

  // Build specialist name→id map for admin imports
  const { data: specialistsData } = await supabase.from('profiles').select('id, full_name').eq('role', 'especialista')
  const specialistMap = new Map<string, string>()
  specialistsData?.forEach((s) => {
    specialistMap.set(s.full_name.toLowerCase().trim(), s.id)
    // Also index by first name for fuzzy matching
    const firstName = s.full_name.split(' ')[0].toLowerCase()
    if (!specialistMap.has(firstName)) specialistMap.set(firstName, s.id)
  })

  const errors: BulkImportResult['errors'] = []
  let created = 0

  for (let i = 0; i < input.rows.length; i++) {
    const raw = input.rows[i]
    const rowNum = i + 2 // spreadsheet row (1-indexed header + 1)
    const name = String(raw.full_name ?? '').trim()

    try {
      const fullName = name
      const phone = String(raw.phone ?? '').trim().replace(/\s+/g, '')
      const productName = String(raw.product_name ?? '').trim()
      const startDate = parseDateServer(raw.start_date) ?? new Date().toISOString().substring(0, 10)

      if (!fullName) { errors.push({ row: rowNum, name: '', error: 'Nome obrigatório' }); continue }
      if (!phone) { errors.push({ row: rowNum, name: fullName, error: 'Telefone obrigatório' }); continue }
      if (!productName) { errors.push({ row: rowNum, name: fullName, error: 'Produto obrigatório' }); continue }

      // Resolve specialist: non-admin always uses own ID
      let createdBy = user.id
      if (profile?.role === 'admin') {
        if (raw.specialist_name) {
          const specName = String(raw.specialist_name).toLowerCase().trim()
          const found = specialistMap.get(specName) ?? specialistMap.get(specName.split(' ')[0])
          if (found) createdBy = found
          else createdBy = input.defaultSpecialistId || user.id
        } else {
          createdBy = input.defaultSpecialistId || user.id
        }
      }

      const menteeData: MenteeInsert = {
        full_name: fullName,
        phone,
        product_name: productName,
        start_date: startDate,
        end_date: parseDateServer(raw.end_date),
        cpf: raw.cpf ? String(raw.cpf).trim() : null,
        birth_date: parseDateServer(raw.birth_date),
        email: raw.email ? String(raw.email).trim() : null,
        instagram: raw.instagram ? String(raw.instagram).trim() : null,
        city: raw.city ? String(raw.city).trim() : null,
        state: raw.state ? String(raw.state).trim().toUpperCase().slice(0, 2) : null,
        closer_name: raw.closer_name ? String(raw.closer_name).trim() : null,
        seller_name: raw.seller_name ? String(raw.seller_name).trim() : null,
        status: parseStatusServer(raw.status as string | undefined),
        faturamento_antes_mentoria: parseNumberServer(raw.faturamento_antes_mentoria),
        faturamento_atual: parseNumberServer(raw.faturamento_atual),
        faturamento_mes_anterior: parseNumberServer(raw.faturamento_mes_anterior),
        contract_validity: raw.contract_validity ? String(raw.contract_validity).trim() : null,
        niche: raw.niche ? String(raw.niche).trim() : null,
        notes: raw.notes ? String(raw.notes).trim() : null,
        source: raw.source ? String(raw.source).trim() : null,
        webhook_notes: raw.webhook_notes ? String(raw.webhook_notes).trim() : null,
        current_stage_id: firstStage.id,
        kanban_type: 'initial',
        created_by: createdBy,
        priority_level: 1,
      }

      const { error: insertError } = await supabase.from('mentees').insert(menteeData)
      if (insertError) {
        if (insertError.code === '23505') {
          errors.push({ row: rowNum, name: fullName, error: 'Telefone já cadastrado' })
        } else {
          errors.push({ row: rowNum, name: fullName, error: insertError.message })
        }
        continue
      }

      created++
    } catch (err) {
      errors.push({ row: rowNum, name, error: String(err) })
    }
  }

  revalidatePath('/mentorados')
  revalidatePath('/etapas-iniciais')
  return { total: input.rows.length, created, errors }
}

// ─── Bulk Actions ────────────────────────────────────────────────────────────

export async function bulkDeleteMentees(menteeIds: string[]) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const relatedTables = [
    'attendances', 'action_plans', 'indications', 'intensivo_records',
    'revenue_records', 'objectives', 'testimonials', 'engagement_records',
    'cs_activities', 'chat_metrics', 'wpp_messages', 'cancellations',
    'push_subscriptions', 'attendance_notes',
  ] as const

  // Clear referrals
  await supabase.from('mentees').update({ referred_by_mentee_id: null }).in('referred_by_mentee_id', menteeIds)

  // Delete related records
  for (const table of relatedTables) {
    await supabase.from(table).delete().in('mentee_id', menteeIds)
  }

  const { error, count } = await supabase
    .from('mentees')
    .delete({ count: 'exact' })
    .in('id', menteeIds)

  if (error) return { error: error.message }

  revalidatePath('/mentorados')
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null, count }
}

export async function bulkMoveMentees(menteeIds: string[], newStageId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('mentees')
    .update({ current_stage_id: newStageId, updated_at: new Date().toISOString() })
    .in('id', menteeIds)

  if (error) return { error: error.message }

  revalidatePath('/mentorados')
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}

export async function bulkAssignSpecialist(menteeIds: string[], specialistId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('mentees')
    .update({ created_by: specialistId, updated_at: new Date().toISOString() })
    .in('id', menteeIds)

  if (error) return { error: error.message }

  revalidatePath('/mentorados')
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { error: null }
}
