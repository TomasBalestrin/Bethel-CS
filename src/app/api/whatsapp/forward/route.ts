import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logInsertError } from '@/lib/log-insert-error'

// Encaminha um mentorado para um departamento (Comercial/Marketing/Gestão).
// Grava uma mensagem interna no canal alvo e cria a notificação correspondente.
// Usa admin client para o INSERT em wpp_messages: a policy "Specialist manage
// own mentee" (WITH CHECK specialist_id = auth.uid()) rejeita quando admin/
// outro especialista encaminha um mentorado de outro owner — e como o chamador
// estava usando o client normal, o INSERT sumia silenciosamente.
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const { menteeId, channel, description } = await request.json()
    if (!menteeId || !channel || !description?.trim()) {
      return NextResponse.json({ error: 'menteeId, channel e description são obrigatórios' }, { status: 400 })
    }
    if (!['comercial', 'marketing', 'gestao'].includes(channel)) {
      return NextResponse.json({ error: 'Canal inválido' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: mentee } = await admin
      .from('mentees')
      .select('id, full_name, phone, created_by')
      .eq('id', menteeId)
      .single()
    if (!mentee) return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })

    const deptLabel = channel === 'comercial' ? 'Comercial' : channel === 'marketing' ? 'Marketing' : 'Gestão'
    const content = `📋 Encaminhamento — ${deptLabel}\n\n👤 ${mentee.full_name}\n📱 ${mentee.phone}\n\n📝 ${description.trim()}`

    const { error: insertErr } = await admin.from('wpp_messages').insert({
      mentee_id: menteeId,
      specialist_id: mentee.created_by || user.id,
      instance_id: 'internal',
      direction: 'outgoing',
      message_type: 'text',
      content,
      is_read: false,
      sent_at: new Date().toISOString(),
      channel,
      source: 'api',
    } as never)

    if (insertErr) {
      console.error('[WPP Forward] INSERT failed:', insertErr.message, insertErr.details)
      await logInsertError({
        route: '/api/whatsapp/forward',
        targetTable: 'wpp_messages',
        error: insertErr,
        menteeId,
        specialistId: mentee.created_by || user.id,
        payload: { channel, descriptionLen: description.length },
      })
      return NextResponse.json({ error: `Falha ao salvar encaminhamento: ${insertErr.message}` }, { status: 500 })
    }

    // Cria notificação para o usuário do departamento (se houver). Antes era
    // non-fatal silencioso: o toast de sucesso aparecia mesmo quando a
    // notificação não era gravada e o destinatário nunca ficava sabendo.
    // Agora o response inclui `notified` + `notifyError` para o front poder
    // alertar explicitamente.
    const { data: assignment } = await admin
      .from('department_assignments')
      .select('user_id')
      .eq('department', channel as 'comercial' | 'marketing' | 'gestao')
      .maybeSingle()

    let notified = false
    let notifyError: string | null = null
    if (!assignment) {
      notifyError = `Nenhum usuário designado para ${deptLabel} — só a mensagem interna foi gravada.`
      console.warn('[WPP Forward]', notifyError, { menteeId, channel })
    } else {
      const { error: notifErr } = await admin.from('forwarding_notifications').insert({
        recipient_id: assignment.user_id,
        mentee_id: menteeId,
        department: channel,
        description: description.trim(),
        mentee_name: mentee.full_name,
        mentee_phone: mentee.phone,
        sent_by: user.id,
      } as never)
      if (notifErr) {
        notifyError = `Falha ao notificar ${deptLabel}: ${notifErr.message}`
        console.error('[WPP Forward] Notification insert failed:', notifErr.message, notifErr.details)
      } else {
        notified = true
      }
    }

    return NextResponse.json({ success: true, notified, notifyError })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[WPP Forward] Uncaught error:', message)
    return NextResponse.json({ error: `Erro interno: ${message}` }, { status: 500 })
  }
}
