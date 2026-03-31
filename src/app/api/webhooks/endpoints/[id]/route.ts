import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
 * PUT /api/webhooks/endpoints/[id]
 * Atualiza campos parciais de um endpoint (admin only).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()

  // Campos atualizáveis
  const allowed = [
    'name', 'slug', 'description', 'platform', 'auth_type', 'secret_key',
    'auth_header', 'default_action', 'field_mapping', 'event_field',
    'event_actions', 'default_kanban_stage', 'default_specialist_id',
    'is_active',
  ]

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) {
      updateData[key] = body[key]
    }
  }

  const { data, error } = await supabase
    .from('webhook_endpoints')
    .update(updateData)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Endpoint não encontrado' }, { status: 404 })
  }

  return NextResponse.json(data)
}

/**
 * DELETE /api/webhooks/endpoints/[id]
 * Soft delete: marca is_active = false (admin only).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const admin = await requireAdmin(supabase)
  if (!admin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { error } = await supabase
    .from('webhook_endpoints')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
