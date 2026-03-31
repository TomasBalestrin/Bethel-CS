import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateWebhookAuth } from '@/lib/webhook-auth'
import { extractField } from '@/lib/webhook-fields'
import { executeWebhookAction, type WebhookAction } from '@/lib/webhook-actions'
import type { Json } from '@/types/database'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const startTime = Date.now()
  const supabase = createAdminClient()

  // 1. Buscar endpoint por slug
  const { data: endpoint } = await supabase
    .from('webhook_endpoints')
    .select('*')
    .eq('slug', params.slug)
    .eq('is_active', true)
    .single()

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  }

  // 2. Ler body raw (necessário para HMAC) e parsear JSON
  const rawBody = await request.text()
  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    payload = {}
  }

  // 3. Validar assinatura
  const isAuthValid = validateWebhookAuth(
    { rawBody, headers: request.headers, url: request.url },
    { auth_type: endpoint.auth_type, secret_key: endpoint.secret_key, auth_header: endpoint.auth_header }
  )

  if (!isAuthValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 4. Sanitizar headers para log (mascarar valores sensíveis)
  const headersObj: Record<string, string> = {}
  const sensitiveHeaders = ['authorization', 'x-webhook-secret', 'x-signature', 'cookie']
  request.headers.forEach((value, key) => {
    headersObj[key] = sensitiveHeaders.includes(key.toLowerCase())
      ? '****'
      : value
  })

  // 5. Inserir log com status 'received'
  const { data: log } = await supabase
    .from('webhook_logs')
    .insert({
      endpoint_id: endpoint.id,
      direction: 'inbound',
      method: request.method,
      headers: headersObj as Json,
      payload: payload as Json,
      query_params: Object.fromEntries(new URL(request.url).searchParams) as Json,
      source_ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
      status: 'received',
    })
    .select('id')
    .single()

  const logId = log?.id

  // 6. Determinar ação: event_actions[evento] || default_action
  let action: WebhookAction = endpoint.default_action as WebhookAction
  let eventType: string | null = null

  if (endpoint.event_field) {
    const eventValue = extractField(payload, endpoint.event_field)
    if (typeof eventValue === 'string') {
      eventType = eventValue
      const eventActions = endpoint.event_actions as Record<string, string> | null
      if (eventActions && eventActions[eventValue]) {
        action = eventActions[eventValue] as WebhookAction
      }
    }
  }

  // 7. Executar ação
  const result = await executeWebhookAction(action, payload, {
    field_mapping: (endpoint.field_mapping as Record<string, string>) ?? {},
    default_kanban_stage: endpoint.default_kanban_stage,
    default_specialist_id: endpoint.default_specialist_id,
  })

  const processingTime = Date.now() - startTime

  // 8. Atualizar log com resultado
  if (logId) {
    await supabase
      .from('webhook_logs')
      .update({
        event_type: eventType,
        action_executed: action,
        action_result: result as unknown as Json,
        status: result.success ? 'processed' : 'failed',
        error_message: result.error ?? null,
        processing_time_ms: processingTime,
      })
      .eq('id', logId)
  }

  // 9. Sempre retornar 200 para não desativar webhooks na plataforma externa
  return NextResponse.json({
    status: result.success ? 'processed' : 'failed',
    log_id: logId,
  })
}
