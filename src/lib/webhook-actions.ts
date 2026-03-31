import { createAdminClient } from '@/lib/supabase/admin'
import { applyFieldMapping } from '@/lib/webhook-fields'

export type WebhookAction =
  | 'create_mentee'
  | 'update_mentee'
  | 'move_kanban'
  | 'deactivate_mentee'
  | 'log_only'

export interface WebhookActionResult {
  success: boolean
  action: string
  mentee_id?: string
  details?: Record<string, unknown>
  error?: string
}

interface EndpointConfig {
  field_mapping: Record<string, string>
  default_kanban_stage?: string | null
  default_specialist_id?: string | null
  slug?: string
}

const MENTEE_FIND_FIELDS = 'id, full_name, email, phone, product_name, status, transaction_id, amount, source, webhook_notes'

/**
 * Busca mentorado por email → phone → transaction_id (deduplicação).
 */
async function findMentee(supabase: ReturnType<typeof createAdminClient>, email?: string, phone?: string, transactionId?: string) {
  if (email) {
    const { data } = await supabase
      .from('mentees')
      .select(MENTEE_FIND_FIELDS)
      .eq('email', email)
      .limit(1)
      .single()
    if (data) return data
  }
  if (phone) {
    const { data } = await supabase
      .from('mentees')
      .select(MENTEE_FIND_FIELDS)
      .eq('phone', phone)
      .limit(1)
      .single()
    if (data) return data
  }
  if (transactionId) {
    const { data } = await supabase
      .from('mentees')
      .select(MENTEE_FIND_FIELDS)
      .eq('transaction_id', transactionId)
      .limit(1)
      .single()
    if (data) return data
  }
  return null
}

/**
 * Busca o ID de uma etapa do kanban pelo nome.
 */
async function findKanbanStageByName(supabase: ReturnType<typeof createAdminClient>, stageName: string) {
  const { data } = await supabase
    .from('kanban_stages')
    .select('id, type')
    .eq('name', stageName)
    .limit(1)
    .single()
  return data
}

/**
 * create_mentee: cria mentorado com deduplicação (email → phone → transaction_id).
 * Se já existe, atualiza campos vazios e retorna como "deduplicated".
 */
async function executeCreateMentee(
  payload: unknown,
  config: EndpointConfig
): Promise<WebhookActionResult> {
  const supabase = createAdminClient()
  const fields = applyFieldMapping(payload, config.field_mapping)

  const name = fields.name as string | undefined
  const email = fields.email as string | undefined
  const phone = fields.phone as string | undefined
  const product = fields.product_name as string | undefined
  const amount = fields.amount !== undefined ? Number(fields.amount) : undefined
  const transactionId = fields.transaction_id as string | undefined
  const notes = fields.notes as string | undefined

  // Criar com o que tiver — nome não é obrigatório, usa fallback
  const fullName = name || 'Sem nome (webhook)'

  // Deduplicação: email → phone → transaction_id
  const existing = await findMentee(supabase, email, phone, transactionId)
  if (existing) {
    const updateData: Record<string, unknown> = {}
    if (email && !existing.email) updateData.email = email
    if (phone && !existing.phone) updateData.phone = phone
    if (product && !existing.product_name) updateData.product_name = product
    if (amount !== undefined && !existing.amount) updateData.amount = amount
    if (transactionId && !existing.transaction_id) updateData.transaction_id = transactionId
    if (notes && !existing.webhook_notes) updateData.webhook_notes = notes
    if (name && existing.full_name === 'Sem nome (webhook)') updateData.full_name = name

    if (Object.keys(updateData).length > 0) {
      await supabase.from('mentees').update(updateData).eq('id', existing.id)
    }
    return {
      success: true,
      action: 'create_mentee',
      mentee_id: existing.id,
      details: { deduplicated: true, updated_fields: Object.keys(updateData) },
    }
  }

  // Determinar etapa do kanban
  let currentStageId: string | null = null
  let kanbanType: 'initial' | 'mentorship' = 'initial'

  if (config.default_kanban_stage) {
    const stage = await findKanbanStageByName(supabase, config.default_kanban_stage)
    if (stage) {
      currentStageId = stage.id
      kanbanType = stage.type as 'initial' | 'mentorship'
    }
  }

  if (!currentStageId) {
    const { data: firstStage } = await supabase
      .from('kanban_stages')
      .select('id')
      .eq('type', 'initial')
      .order('position')
      .limit(1)
      .single()
    if (firstStage) currentStageId = firstStage.id
  }

  const { data: newMentee, error } = await supabase
    .from('mentees')
    .insert({
      full_name: fullName,
      email: email ?? null,
      phone: phone ?? '',
      product_name: product ?? 'Mentoria Elite Premium',
      start_date: new Date().toISOString().split('T')[0],
      current_stage_id: currentStageId,
      kanban_type: kanbanType,
      created_by: config.default_specialist_id ?? null,
      priority_level: 1,
      amount: amount ?? null,
      transaction_id: transactionId ?? null,
      webhook_notes: notes ?? null,
      source: config.slug ? `webhook:${config.slug}` : 'webhook',
    })
    .select('id')
    .single()

  if (error || !newMentee) {
    return {
      success: false,
      action: 'create_mentee',
      error: error?.message ?? 'Erro ao criar mentorado',
      details: { extracted: fields },
    }
  }

  return {
    success: true,
    action: 'create_mentee',
    mentee_id: newMentee.id,
    details: { created: true, kanban_stage: config.default_kanban_stage },
  }
}

/**
 * update_mentee: busca por email/phone e atualiza campos mapeados.
 */
async function executeUpdateMentee(
  payload: unknown,
  config: EndpointConfig
): Promise<WebhookActionResult> {
  const supabase = createAdminClient()
  const fields = applyFieldMapping(payload, config.field_mapping)

  const email = fields.email as string | undefined
  const phone = fields.phone as string | undefined

  const mentee = await findMentee(supabase, email, phone)
  if (!mentee) {
    return {
      success: false,
      action: 'update_mentee',
      error: 'mentee_not_found',
      details: { email, phone },
    }
  }

  // Mapear apenas campos válidos da tabela mentees
  const allowedFields = [
    'full_name', 'email', 'phone', 'cpf', 'birth_date', 'instagram',
    'city', 'state', 'product_name', 'seller_name', 'funnel_origin',
    'has_partner', 'partner_name', 'amount', 'transaction_id', 'webhook_notes',
  ]
  const updateData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.includes(key) && value !== undefined) {
      updateData[key] = value
    }
  }

  if (Object.keys(updateData).length === 0) {
    return {
      success: true,
      action: 'update_mentee',
      mentee_id: mentee.id,
      details: { no_fields_to_update: true },
    }
  }

  const { error } = await supabase
    .from('mentees')
    .update(updateData)
    .eq('id', mentee.id)

  if (error) {
    return { success: false, action: 'update_mentee', mentee_id: mentee.id, error: error.message }
  }

  return {
    success: true,
    action: 'update_mentee',
    mentee_id: mentee.id,
    details: { updated_fields: Object.keys(updateData) },
  }
}

/**
 * move_kanban: busca mentorado e move para etapa especificada.
 */
async function executeMoveKanban(
  payload: unknown,
  config: EndpointConfig
): Promise<WebhookActionResult> {
  const supabase = createAdminClient()
  const fields = applyFieldMapping(payload, config.field_mapping)

  const email = fields.email as string | undefined
  const phone = fields.phone as string | undefined
  const stageName = (fields.kanban_stage as string) ?? config.default_kanban_stage

  const mentee = await findMentee(supabase, email, phone)
  if (!mentee) {
    return { success: false, action: 'move_kanban', error: 'mentee_not_found', details: { email, phone } }
  }

  if (!stageName) {
    return { success: false, action: 'move_kanban', mentee_id: mentee.id, error: 'Etapa do kanban não especificada' }
  }

  const stage = await findKanbanStageByName(supabase, stageName)
  if (!stage) {
    return { success: false, action: 'move_kanban', mentee_id: mentee.id, error: `Etapa "${stageName}" não encontrada` }
  }

  const { error } = await supabase
    .from('mentees')
    .update({ current_stage_id: stage.id, kanban_type: stage.type as 'initial' | 'mentorship' })
    .eq('id', mentee.id)

  if (error) {
    return { success: false, action: 'move_kanban', mentee_id: mentee.id, error: error.message }
  }

  return {
    success: true,
    action: 'move_kanban',
    mentee_id: mentee.id,
    details: { stage_name: stageName, stage_id: stage.id },
  }
}

/**
 * deactivate_mentee: marca mentorado como cancelado.
 */
async function executeDeactivateMentee(
  payload: unknown,
  config: EndpointConfig
): Promise<WebhookActionResult> {
  const supabase = createAdminClient()
  const fields = applyFieldMapping(payload, config.field_mapping)

  const email = fields.email as string | undefined
  const phone = fields.phone as string | undefined

  const mentee = await findMentee(supabase, email, phone)
  if (!mentee) {
    return { success: false, action: 'deactivate_mentee', error: 'mentee_not_found', details: { email, phone } }
  }

  const { error } = await supabase
    .from('mentees')
    .update({ status: 'cancelado' })
    .eq('id', mentee.id)

  if (error) {
    return { success: false, action: 'deactivate_mentee', mentee_id: mentee.id, error: error.message }
  }

  return {
    success: true,
    action: 'deactivate_mentee',
    mentee_id: mentee.id,
    details: { previous_status: mentee.status },
  }
}

/**
 * Função principal: executa a ação do webhook.
 */
export async function executeWebhookAction(
  action: WebhookAction,
  payload: unknown,
  config: EndpointConfig
): Promise<WebhookActionResult> {
  switch (action) {
    case 'create_mentee':
      return executeCreateMentee(payload, config)
    case 'update_mentee':
      return executeUpdateMentee(payload, config)
    case 'move_kanban':
      return executeMoveKanban(payload, config)
    case 'deactivate_mentee':
      return executeDeactivateMentee(payload, config)
    case 'log_only':
      return { success: true, action: 'log_only' }
    default:
      return { success: false, action: action, error: `Ação desconhecida: ${action}` }
  }
}
