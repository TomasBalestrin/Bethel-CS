import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revokeMessage } from '@/lib/nextapps'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { messageId } = await request.json()
    if (!messageId) {
      return NextResponse.json({ error: 'messageId é obrigatório' }, { status: 400 })
    }

    // Find the message
    const { data: msg, error: msgError } = await supabase
      .from('wpp_messages')
      .select('id, mentee_id, message_id, direction, instance_id')
      .eq('id', messageId)
      .single()

    if (msgError || !msg) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    // Only allow deleting outgoing messages
    if (msg.direction !== 'outgoing') {
      return NextResponse.json({ error: 'Só é possível apagar mensagens enviadas' }, { status: 400 })
    }

    // Try to revoke on WhatsApp if we have a message_id
    let revokedOnWhatsApp = false
    if (msg.message_id) {
      // Find phone number
      const { data: mentee } = await supabase
        .from('mentees')
        .select('phone')
        .eq('id', msg.mentee_id)
        .single()

      if (mentee) {
        let phone = mentee.phone.replace(/\D/g, '')
        if (!phone.startsWith('55')) phone = '55' + phone

        const result = await revokeMessage(phone, msg.message_id, msg.instance_id || undefined)
        revokedOnWhatsApp = result.success
      }
    }

    // Always delete from database
    await supabase.from('wpp_messages').delete().eq('id', messageId)

    return NextResponse.json({ success: true, revokedOnWhatsApp })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[WPP Delete] Error:', message)
    return NextResponse.json({ error: `Erro interno: ${message}` }, { status: 500 })
  }
}
