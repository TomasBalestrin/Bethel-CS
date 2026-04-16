'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface DeliveryEventInput {
  delivery_type: string
  delivery_date: string
  reference_month?: string | null
  title?: string | null
  description?: string | null
  presenter_name?: string | null
}

/** Create a single delivery event (the new per-delivery panel flow). */
export async function createDeliveryEvent(input: DeliveryEventInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado', event: null }

  if (!input.delivery_type) return { error: 'Tipo obrigatório', event: null }
  if (!input.delivery_date) return { error: 'Data obrigatória', event: null }

  const { data, error } = await supabase
    .from('delivery_events')
    .insert({
      delivery_type: input.delivery_type,
      delivery_date: input.delivery_date,
      reference_month: input.reference_month ?? null,
      title: input.title ?? null,
      description: input.description ?? null,
      presenter_name: input.presenter_name ?? null,
    } as never)
    .select('*')
    .single()

  if (error) return { error: error.message, event: null }
  revalidatePath('/entregas')
  return { error: null, event: data }
}

export async function updateDeliveryEvent(id: string, input: Partial<DeliveryEventInput>) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const updates: Record<string, unknown> = {}
  if (input.delivery_type !== undefined) updates.delivery_type = input.delivery_type
  if (input.delivery_date !== undefined) updates.delivery_date = input.delivery_date
  if (input.reference_month !== undefined) updates.reference_month = input.reference_month
  if (input.title !== undefined) updates.title = input.title
  if (input.description !== undefined) updates.description = input.description
  if (input.presenter_name !== undefined) updates.presenter_name = input.presenter_name

  const { error } = await supabase
    .from('delivery_events')
    .update(updates as never)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/entregas')
  return { error: null }
}

export async function deleteDeliveryEvent(id: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase.from('delivery_events').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/entregas')
  return { error: null }
}

/** Add a single mentee as participant of an event. Idempotent: returns ok if
 *  the pair already exists thanks to the UNIQUE constraint. */
export async function addParticipantToEvent(eventId: string, menteeId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('delivery_participations')
    .insert({ delivery_event_id: eventId, mentee_id: menteeId } as never)

  // 23505 = unique violation → already a participant, treat as success
  if (error && (error as { code?: string }).code !== '23505') {
    return { error: error.message }
  }
  revalidatePath('/entregas')
  return { error: null }
}

export async function removeParticipantFromEvent(eventId: string, menteeId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { error } = await supabase
    .from('delivery_participations')
    .delete()
    .eq('delivery_event_id', eventId)
    .eq('mentee_id', menteeId)

  if (error) return { error: error.message }
  revalidatePath('/entregas')
  return { error: null }
}

export interface ImportParticipantsInput {
  eventId: string
  rows: { name?: string; phone?: string; email?: string }[]
}

export interface ImportParticipantsResult {
  total: number
  added: number
  already: number
  errors: { row: number; identifier: string; error: string }[]
}

/** Import a list of participants for a specific delivery event. Matches each
 *  row against mentees by name, phone or email — any single match is enough.
 *  Returns counts and the list of rows that did not match.
 */
export async function importParticipantsForEvent(input: ImportParticipantsInput): Promise<ImportParticipantsResult> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: input.rows.length, added: 0, already: 0, errors: [{ row: 0, identifier: '', error: 'Não autenticado' }] }

  const { data: mentees } = await supabase.from('mentees').select('id, full_name, phone, email')
  const m = mentees ?? []

  // Pre-existing participations for this event (to classify "already")
  const { data: existing } = await supabase
    .from('delivery_participations')
    .select('mentee_id')
    .eq('delivery_event_id', input.eventId)
  const existingSet = new Set((existing ?? []).map((x) => x.mentee_id))

  const norm = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const onlyDigits = (s: string) => s.replace(/\D/g, '')

  let added = 0
  let already = 0
  const errors: ImportParticipantsResult['errors'] = []

  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    const rowNum = i + 2
    const identifier = (row.name || row.phone || row.email || '').trim()
    if (!identifier) {
      errors.push({ row: rowNum, identifier, error: 'Linha vazia' })
      continue
    }

    // Match by ANY of name / phone / email (first hit wins)
    const nameKey = row.name ? norm(row.name) : ''
    const phoneKey = row.phone ? onlyDigits(row.phone).slice(-9) : ''
    const emailKey = row.email ? norm(row.email) : ''

    const match = m.find((x) => {
      if (nameKey && norm(x.full_name || '') === nameKey) return true
      if (phoneKey && x.phone && onlyDigits(x.phone).slice(-9) === phoneKey) return true
      if (emailKey && x.email && norm(x.email) === emailKey) return true
      return false
    })

    if (!match) {
      errors.push({ row: rowNum, identifier, error: 'Mentorado não encontrado' })
      continue
    }

    if (existingSet.has(match.id)) {
      already++
      continue
    }

    const { error: insertErr } = await supabase
      .from('delivery_participations')
      .insert({ delivery_event_id: input.eventId, mentee_id: match.id } as never)

    if (insertErr) {
      const code = (insertErr as { code?: string }).code
      if (code === '23505') {
        already++
      } else {
        errors.push({ row: rowNum, identifier, error: insertErr.message })
      }
      continue
    }
    existingSet.add(match.id)
    added++
  }

  revalidatePath('/entregas')
  return { total: input.rows.length, added, already, errors }
}
