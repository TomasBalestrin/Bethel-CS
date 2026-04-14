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
  importedMenteeIds?: string[]
}

function parseDateServer(val: string | number | undefined): string | null {
  if (val === undefined || val === null || val === '') return null
  // Excel serial number (e.g. 45781.99967592592 = a date)
  if (typeof val === 'number' || (typeof val === 'string' && /^\d{4,5}(\.\d+)?$/.test(val.trim()))) {
    const serial = typeof val === 'number' ? val : parseFloat(val)
    if (serial > 1000 && serial < 100000) {
      // Excel epoch: Jan 0, 1900 (with the Lotus 123 leap year bug)
      // Use UTC to avoid timezone-related date shifts
      const utcDays = Math.round(serial) - 25569 // 25569 = days from 1900-01-01 to 1970-01-01
      const date = new Date(utcDays * 86400000)
      if (!isNaN(date.getTime())) {
        const y = date.getUTCFullYear()
        const m = String(date.getUTCMonth() + 1).padStart(2, '0')
        const d = String(date.getUTCDate()).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
    }
  }
  const str = String(val).trim()
  // DD/MM/YYYY (4-digit year)
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`
  // DD/MM/YY (2-digit year → assume 20xx)
  const brMatch2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (brMatch2) {
    const year = parseInt(brMatch2[3], 10)
    const fullYear = year >= 0 && year <= 99 ? 2000 + year : year
    return `${fullYear}-${brMatch2[2].padStart(2, '0')}-${brMatch2[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.substring(0, 10)
  // Fallback: try native parsing but use UTC to avoid timezone shifts
  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    const y = d.getUTCFullYear()
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
    const da = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${mo}-${da}`
  }
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
      const startDate = parseDateServer(raw.start_date)

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
        start_date: startDate ?? null,
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
    'push_subscriptions', 'attendance_notes', 'call_records',
    'attendance_sessions', 'tasks',
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

// ─── Bulk Update: Existing Mentees ──────────────────────────────────────────

export async function bulkUpdateMentees(input: BulkImportInput): Promise<BulkImportResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: input.rows.length, created: 0, errors: [{ row: 0, name: '', error: 'Não autenticado' }] }

  // Load all mentees for matching by phone
  const { data: mentees } = await supabase.from('mentees').select('id, full_name, phone')
  if (!mentees) return { total: input.rows.length, created: 0, errors: [{ row: 0, name: '', error: 'Erro ao carregar mentorados' }] }

  const phoneMap = new Map<string, { id: string; full_name: string }>()
  mentees.forEach((m) => {
    phoneMap.set(m.phone.replace(/\D/g, ''), { id: m.id, full_name: m.full_name })
  })

  const errors: BulkImportResult['errors'] = []
  let created = 0 // actually "updated" count

  for (let i = 0; i < input.rows.length; i++) {
    const raw = input.rows[i]
    const rowNum = i + 2
    const name = String(raw.full_name ?? '').trim()
    const phone = String(raw.phone ?? '').trim().replace(/\D/g, '')

    if (!phone) { errors.push({ row: rowNum, name, error: 'Telefone obrigatório para identificar o mentorado' }); continue }

    const match = phoneMap.get(phone)
    if (!match) { errors.push({ row: rowNum, name, error: 'Mentorado não encontrado com esse telefone' }); continue }

    try {
      // Build update object from only the fields that are present and non-empty
      const updates: Record<string, unknown> = {}

      if (raw.start_date !== undefined && raw.start_date !== '') {
        const d = parseDateServer(raw.start_date)
        if (d) updates.start_date = d
      }
      if (raw.end_date !== undefined && raw.end_date !== '') {
        const d = parseDateServer(raw.end_date)
        if (d) updates.end_date = d
      }
      if (raw.birth_date !== undefined && raw.birth_date !== '') {
        const d = parseDateServer(raw.birth_date)
        if (d) updates.birth_date = d
      }
      if (raw.product_name !== undefined && String(raw.product_name).trim()) {
        updates.product_name = String(raw.product_name).trim()
      }
      if (raw.email !== undefined && String(raw.email).trim()) {
        updates.email = String(raw.email).trim()
      }
      if (raw.instagram !== undefined && String(raw.instagram).trim()) {
        updates.instagram = String(raw.instagram).trim()
      }
      if (raw.city !== undefined && String(raw.city).trim()) {
        updates.city = String(raw.city).trim()
      }
      if (raw.state !== undefined && String(raw.state).trim()) {
        updates.state = String(raw.state).trim().toUpperCase().slice(0, 2)
      }
      if (raw.cpf !== undefined && String(raw.cpf).trim()) {
        updates.cpf = String(raw.cpf).trim()
      }
      if (raw.niche !== undefined && String(raw.niche).trim()) {
        updates.niche = String(raw.niche).trim()
      }
      if (raw.status !== undefined && String(raw.status).trim()) {
        updates.status = parseStatusServer(raw.status as string)
      }
      if (raw.faturamento_antes_mentoria !== undefined && raw.faturamento_antes_mentoria !== '') {
        const v = parseNumberServer(raw.faturamento_antes_mentoria)
        if (v != null) updates.faturamento_antes_mentoria = v
      }
      if (raw.faturamento_atual !== undefined && raw.faturamento_atual !== '') {
        const v = parseNumberServer(raw.faturamento_atual)
        if (v != null) updates.faturamento_atual = v
      }
      if (raw.faturamento_mes_anterior !== undefined && raw.faturamento_mes_anterior !== '') {
        const v = parseNumberServer(raw.faturamento_mes_anterior)
        if (v != null) updates.faturamento_mes_anterior = v
      }
      if (raw.closer_name !== undefined && String(raw.closer_name).trim()) {
        updates.closer_name = String(raw.closer_name).trim()
      }
      if (raw.contract_validity !== undefined && String(raw.contract_validity).trim()) {
        updates.contract_validity = String(raw.contract_validity).trim()
      }
      if (raw.notes !== undefined && String(raw.notes).trim()) {
        updates.notes = String(raw.notes).trim()
      }
      if (raw.nome_empresa !== undefined && String(raw.nome_empresa).trim()) {
        updates.nome_empresa = String(raw.nome_empresa).trim()
      }
      if (raw.seller_name !== undefined && String(raw.seller_name).trim()) {
        updates.seller_name = String(raw.seller_name).trim()
      }
      if (raw.source !== undefined && String(raw.source).trim()) {
        updates.source = String(raw.source).trim()
      }

      if (Object.keys(updates).length === 0) {
        errors.push({ row: rowNum, name: match.full_name, error: 'Nenhum campo para atualizar' })
        continue
      }

      updates.updated_at = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('mentees')
        .update(updates)
        .eq('id', match.id)

      if (updateError) {
        errors.push({ row: rowNum, name: match.full_name, error: updateError.message })
        continue
      }

      created++
    } catch (err) {
      errors.push({ row: rowNum, name: name || match.full_name, error: String(err) })
    }
  }

  revalidatePath('/mentorados')
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  return { total: input.rows.length, created, errors }
}

// ─── Bulk Import: Action Plans ───────────────────────────────────────────────

interface BulkActionPlanInput {
  rows: Record<string, string | number>[]
  matchField: 'full_name' | 'phone' | 'email'
}

export async function bulkImportActionPlans(input: BulkActionPlanInput): Promise<BulkImportResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: input.rows.length, created: 0, errors: [{ row: 0, name: '', error: 'Não autenticado' }] }

  // Load all mentees for matching
  const { data: mentees } = await supabase.from('mentees').select('id, full_name, phone, email')
  if (!mentees) return { total: input.rows.length, created: 0, errors: [{ row: 0, name: '', error: 'Erro ao carregar mentorados' }] }

  // Build lookup maps
  const nameMap = new Map<string, string>()
  const phoneMap = new Map<string, string>()
  const emailMap = new Map<string, string>()
  mentees.forEach((m) => {
    nameMap.set(m.full_name.toLowerCase().trim(), m.id)
    if (m.phone) phoneMap.set(m.phone.replace(/\D/g, ''), m.id)
    if (m.email) emailMap.set(m.email.toLowerCase().trim(), m.id)
  })

  const errors: BulkImportResult['errors'] = []
  let created = 0
  const importedMenteeIds: string[] = []

  for (let i = 0; i < input.rows.length; i++) {
    const raw = input.rows[i]
    const rowNum = i + 2
    const matchValue = String(raw.__match_value ?? '').trim()
    const name = String(raw.__display_name ?? matchValue).trim()

    if (!matchValue) { errors.push({ row: rowNum, name: '', error: 'Campo de identificação vazio' }); continue }

    // Find mentee
    let menteeId: string | undefined
    if (input.matchField === 'full_name') {
      menteeId = nameMap.get(matchValue.toLowerCase())
    } else if (input.matchField === 'phone') {
      menteeId = phoneMap.get(matchValue.replace(/\D/g, ''))
    } else {
      menteeId = emailMap.get(matchValue.toLowerCase())
    }

    if (!menteeId) { errors.push({ row: rowNum, name, error: 'Mentorado não encontrado' }); continue }

    // Build action plan data object
    const planData: Record<string, string | number> = {}
    for (const [key, val] of Object.entries(raw)) {
      if (key.startsWith('__')) continue
      if (val !== '' && val !== null && val !== undefined) {
        planData[key] = val
      }
    }

    try {
      const { data: existing } = await supabase
        .from('action_plans')
        .select('id')
        .eq('mentee_id', menteeId)
        .limit(1)
        .single()

      if (existing) {
        await supabase
          .from('action_plans')
          .update({ data: planData as unknown as Database['public']['Tables']['action_plans']['Update']['data'], submitted_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('action_plans')
          .insert({ mentee_id: menteeId, data: planData as unknown as Database['public']['Tables']['action_plans']['Insert']['data'], submitted_at: new Date().toISOString() })
      }
      // Sync direct fields back to mentee when present in the imported data
      const syncUpdates: Record<string, unknown> = {}
      if (planData.nicho) syncUpdates.niche = String(planData.nicho).trim()
      if (planData.nome_empresa) syncUpdates.nome_empresa = String(planData.nome_empresa).trim()
      if (planData.num_colaboradores) {
        const n = parseInt(String(planData.num_colaboradores), 10)
        if (!isNaN(n) && n > 0) syncUpdates.num_colaboradores = n
      }
      if (planData.faturamento_medio) {
        const f = parseFloat(String(planData.faturamento_medio).replace(/[R$\s.]/g, '').replace(',', '.'))
        if (!isNaN(f) && f > 0) syncUpdates.faturamento_atual = f
      }
      if (planData.cpf) syncUpdates.cpf = String(planData.cpf).trim()
      if (planData.email) syncUpdates.email = String(planData.email).trim()
      if (planData.instagram) syncUpdates.instagram = String(planData.instagram).trim()
      if (planData.cidade) syncUpdates.city = String(planData.cidade).trim()
      if (planData.estado) syncUpdates.state = String(planData.estado).trim()
      if (Object.keys(syncUpdates).length > 0) {
        syncUpdates.updated_at = new Date().toISOString()
        await supabase.from('mentees').update(syncUpdates).eq('id', menteeId)
      }

      created++
      importedMenteeIds.push(menteeId)
    } catch (err) {
      errors.push({ row: rowNum, name, error: String(err) })
    }
  }

  revalidatePath('/mentorados')
  return { total: input.rows.length, created, errors, importedMenteeIds }
}

// ─── Bulk Import: Stage Assignments ──────────────────────────────────────────

interface BulkStageInput {
  rows: { matchValue: string; matchPhone?: string; stageName: string }[]
  matchField: 'full_name' | 'phone' | 'email'
}

export async function bulkImportStages(input: BulkStageInput): Promise<BulkImportResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: input.rows.length, created: 0, errors: [{ row: 0, name: '', error: 'Não autenticado' }] }

  const { data: mentees } = await supabase.from('mentees').select('id, full_name, phone, email')
  const { data: stages } = await supabase.from('kanban_stages').select('id, name, type')

  if (!mentees || !stages) return { total: input.rows.length, created: 0, errors: [{ row: 0, name: '', error: 'Erro ao carregar dados' }] }

  const nameMap = new Map<string, string>()
  const phoneMap = new Map<string, string>()
  const emailMap = new Map<string, string>()
  mentees.forEach((m) => {
    nameMap.set(m.full_name.toLowerCase().trim(), m.id)
    if (m.phone) phoneMap.set(m.phone.replace(/\D/g, ''), m.id)
    if (m.email) emailMap.set(m.email.toLowerCase().trim(), m.id)
  })

  const stageMap = new Map<string, { id: string; type: KanbanType }>()
  stages.forEach((s) => {
    stageMap.set(s.name.toLowerCase().trim(), { id: s.id, type: s.type as KanbanType })
    const norm = s.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    stageMap.set(norm, { id: s.id, type: s.type as KanbanType })
  })

  // Extra aliases for common "Situação" values → map to exit stages
  const stageAliases: Record<string, string> = {
    // Em Processo de Cancelamento
    'em processo de cancelamento': 'em processo de cancelamento',
    'processando cancelamento': 'em processo de cancelamento',
    'cancelando': 'em processo de cancelamento',
    'solicitou cancelamento': 'em processo de cancelamento',
    // Pendência Financeira
    'pendencia financeira': 'pendencia financeira',
    'pendência financeira': 'pendencia financeira',
    'inadimplente': 'pendencia financeira',
    'inadimplencia': 'pendencia financeira',
    'atraso': 'pendencia financeira',
    // Pausa
    'pausa': 'pausa',
    'pausado': 'pausa',
    'pausada': 'pausa',
    // Vai Iniciar Depois
    'vai iniciar depois': 'vai iniciar depois',
    'aguardando inicio': 'vai iniciar depois',
    'aguardando início': 'vai iniciar depois',
    'inicio posterior': 'vai iniciar depois',
    'início posterior': 'vai iniciar depois',
    // Cancelados
    'cancelado': 'cancelados',
    'cancelada': 'cancelados',
    'cancelados': 'cancelados',
  }

  const errors: BulkImportResult['errors'] = []
  let created = 0

  for (let i = 0; i < input.rows.length; i++) {
    const { matchValue, matchPhone, stageName } = input.rows[i]
    const rowNum = i + 2

    if (!matchValue.trim() && !matchPhone?.trim()) { errors.push({ row: rowNum, name: '', error: 'Campo de identificação vazio (nome ou telefone)' }); continue }
    if (!stageName.trim()) { errors.push({ row: rowNum, name: matchValue, error: 'Nome da etapa vazio' }); continue }

    // Try primary match (matchValue), then fallback to phone if provided
    let menteeId: string | undefined
    if (matchValue.trim()) {
      if (input.matchField === 'full_name') {
        menteeId = nameMap.get(matchValue.toLowerCase().trim())
      } else if (input.matchField === 'phone') {
        menteeId = phoneMap.get(matchValue.replace(/\D/g, ''))
      } else {
        menteeId = emailMap.get(matchValue.toLowerCase().trim())
      }
    }
    // Fallback: try phone column if primary didn't match
    if (!menteeId && matchPhone?.trim()) {
      menteeId = phoneMap.get(matchPhone.replace(/\D/g, ''))
    }

    if (!menteeId) { errors.push({ row: rowNum, name: matchValue, error: 'Mentorado não encontrado' }); continue }

    const stageNorm = stageName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    // Try direct match, then normalized, then alias map
    const aliasTarget = stageAliases[stageNorm] ?? stageAliases[stageName.toLowerCase().trim()]
    const stage = stageMap.get(stageName.toLowerCase().trim())
      ?? stageMap.get(stageNorm)
      ?? (aliasTarget ? stageMap.get(aliasTarget) : undefined)

    if (!stage) { errors.push({ row: rowNum, name: matchValue, error: `Etapa "${stageName}" não encontrada` }); continue }

    const { error } = await supabase
      .from('mentees')
      .update({ current_stage_id: stage.id, kanban_type: stage.type, updated_at: new Date().toISOString() })
      .eq('id', menteeId)

    if (error) { errors.push({ row: rowNum, name: matchValue, error: error.message }); continue }
    created++
  }

  revalidatePath('/mentorados')
  revalidatePath('/etapas-iniciais')
  revalidatePath('/etapas-mentoria')
  revalidatePath('/saidas')
  return { total: input.rows.length, created, errors }
}

// ─── Bulk Import: Delivery Events ──────────────────────────────────────────

interface BulkDeliveryEventsInput {
  rows: { date: string; type: string }[]
}

export async function bulkImportDeliveryEvents(input: BulkDeliveryEventsInput): Promise<BulkImportResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, created: 0, errors: [{ row: 0, name: '', error: 'Não autenticado' }] }

  const VALID_TYPES = ['hotseat', 'comercial', 'gestao', 'mkt', 'extras', 'mentoria_individual']
  let created = 0
  const errors: BulkImportResult['errors'] = []

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const rowNum = i + 2
    const typeNorm = row.type.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')

    const matchedType = VALID_TYPES.find((t) => typeNorm.includes(t)) || typeNorm

    if (!row.date) { errors.push({ row: rowNum, name: row.type, error: 'Data obrigatória' }); continue }

    const { error } = await supabase.from('delivery_events').insert({
      delivery_type: matchedType,
      delivery_date: row.date,
    })

    if (error) { errors.push({ row: rowNum, name: row.type, error: error.message }); continue }
    created++
  }

  return { total: input.rows.length, created, errors }
}

// ─── Bulk Import: Delivery Participations ──────────────────────────────────

interface BulkDeliveryParticipationsInput {
  rows: { date: string; type: string; name?: string; phone?: string; email?: string }[]
}

export async function bulkImportDeliveryParticipations(input: BulkDeliveryParticipationsInput): Promise<BulkImportResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, created: 0, errors: [{ row: 0, name: '', error: 'Não autenticado' }] }

  // Fetch all mentees for matching
  const { data: mentees } = await supabase.from('mentees').select('id, full_name, phone, email')
  if (!mentees) return { total: 0, created: 0, errors: [{ row: 0, name: '', error: 'Erro ao buscar mentorados' }] }

  let created = 0
  const errors: BulkImportResult['errors'] = []

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const rowNum = i + 2
    const identifier = row.name || row.phone || row.email || ''

    if (!row.date || !row.type) { errors.push({ row: rowNum, name: identifier, error: 'Data e tipo obrigatórios' }); continue }

    // Match mentee by name, phone, or email
    const mentee = mentees.find((m) => {
      if (row.name && m.full_name.toLowerCase().trim() === row.name.toLowerCase().trim()) return true
      if (row.phone && m.phone.replace(/\D/g, '') === row.phone.replace(/\D/g, '')) return true
      if (row.email && m.email?.toLowerCase().trim() === row.email.toLowerCase().trim()) return true
      return false
    })

    if (!mentee) { errors.push({ row: rowNum, name: identifier, error: 'Mentorado não encontrado' }); continue }

    // Find matching delivery event
    const typeNorm = row.type.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')

    const { data: events } = await supabase
      .from('delivery_events')
      .select('id')
      .eq('delivery_date', row.date)
      .ilike('delivery_type', `%${typeNorm}%`)
      .limit(1)

    if (!events || events.length === 0) {
      errors.push({ row: rowNum, name: identifier, error: `Entrega não encontrada (${row.type} em ${row.date})` })
      continue
    }

    const { error } = await supabase.from('delivery_participations').insert({
      delivery_event_id: events[0].id,
      mentee_id: mentee.id,
    })

    if (error) {
      if (error.code === '23505') { created++; continue } // duplicate, count as success
      errors.push({ row: rowNum, name: identifier, error: error.message }); continue
    }
    created++
  }

  return { total: input.rows.length, created, errors }
}
