import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Helper: verifica se o usuário autenticado é admin.
 */
async function requireAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null
  return user
}

/**
 * GET /api/webhooks/endpoints
 * Lista todos os endpoints (admin only).
 */
export async function GET() {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select('id, name, slug, description, platform, direction, auth_type, default_action, is_active, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * POST /api/webhooks/endpoints
 * Cria um novo endpoint (admin only).
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()

  const { name, slug, platform, description, auth_type, secret_key, auth_header,
    default_action, field_mapping, event_field, event_actions,
    default_kanban_stage, default_specialist_id } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'name e slug são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .insert({
      name,
      slug,
      platform: platform ?? 'custom',
      description: description ?? null,
      auth_type: auth_type ?? 'none',
      secret_key: secret_key ?? null,
      auth_header: auth_header ?? 'x-webhook-secret',
      default_action: default_action ?? 'log_only',
      field_mapping: field_mapping ?? {},
      event_field: event_field ?? null,
      event_actions: event_actions ?? {},
      default_kanban_stage: default_kanban_stage ?? null,
      default_specialist_id: default_specialist_id ?? null,
      created_by: admin.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
