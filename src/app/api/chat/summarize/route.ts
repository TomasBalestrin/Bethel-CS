import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { menteeId } = await request.json()
  if (!menteeId) return NextResponse.json({ error: 'menteeId obrigatório' }, { status: 400 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })
  }

  // Get mentee name
  const { data: mentee } = await supabase
    .from('mentees')
    .select('full_name')
    .eq('id', menteeId)
    .single()

  if (!mentee) return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })

  // Get last 100 text messages
  const { data: messages } = await supabase
    .from('wpp_messages')
    .select('direction, content, sender_name, sent_at, message_type')
    .eq('mentee_id', menteeId)
    .order('sent_at', { ascending: false })
    .limit(100)

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'Sem mensagens para resumir' }, { status: 400 })
  }

  // Format messages for the prompt (reverse to chronological order)
  const formatted = messages
    .reverse()
    .map((m) => {
      const sender = m.direction === 'outgoing' ? 'Especialista' : (m.sender_name || mentee.full_name)
      const text = m.message_type && m.message_type !== 'text'
        ? `[${m.message_type === 'audio' ? 'Áudio' : m.message_type === 'image' ? 'Imagem' : 'Arquivo'}]`
        : (m.content || '')
      return `${sender}: ${text}`
    })
    .filter((line) => line.trim())
    .join('\n')

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `Você é um assistente que analisa conversas de WhatsApp entre um especialista de Customer Success e um mentorado.
Gere um resumo estruturado da conversa em português brasileiro.

Responda EXATAMENTE neste formato JSON (sem markdown, sem backticks):
{
  "summary": "Resumo geral do que foi discutido (2-3 frases)",
  "questions": "Principais dúvidas do mentorado (ou null se não houver)",
  "difficulties": "Dificuldades mencionadas pelo mentorado (ou null se não houver)",
  "next_steps": "Próximos passos combinados (ou null se não houver)"
}

Seja conciso e objetivo. Foque no que é útil para o especialista na próxima conversa.
Se houver mensagens de áudio, mencione que houve troca de áudios (conteúdo não disponível).`,
        },
        {
          role: 'user',
          content: `Conversa com o mentorado ${mentee.full_name}:\n\n${formatted}`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) {
      return NextResponse.json({ error: 'Resposta vazia da IA' }, { status: 500 })
    }

    // Parse the JSON response
    let parsed: { summary: string; questions: string | null; difficulties: string | null; next_steps: string | null }
    try {
      parsed = JSON.parse(content)
    } catch {
      // If JSON parsing fails, use the raw text as summary
      parsed = { summary: content, questions: null, difficulties: null, next_steps: null }
    }

    // Save to database
    const { data: note, error: insertError } = await supabase
      .from('attendance_notes')
      .insert({
        mentee_id: menteeId,
        specialist_id: user.id,
        summary: parsed.summary,
        questions: parsed.questions,
        difficulties: parsed.difficulties,
        next_steps: parsed.next_steps,
        generated_by_ai: true,
      })
      .select('*')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ note })
  } catch (err) {
    console.error('[Summarize] OpenAI error:', err)
    return NextResponse.json({ error: 'Erro ao gerar resumo' }, { status: 500 })
  }
}
