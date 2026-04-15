import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

// Transcription + summary can take ~1-3 min for long calls. Default 60s timeout
// was killing the function mid-way and leaving calls stuck in 'processing'.
export const maxDuration = 300 // 5 minutes (Vercel Pro limit)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })
  }

  const body = await request.json()
  const { callId } = body
  if (!callId) return NextResponse.json({ error: 'callId obrigatório' }, { status: 400 })

  // Get the call record
  const { data: call } = await supabase
    .from('call_records')
    .select('id, mentee_id, specialist_id, recording_url, recording_status, transcription_status')
    .eq('id', callId)
    .single()

  if (!call) return NextResponse.json({ error: 'Ligação não encontrada' }, { status: 404 })
  if (call.transcription_status === 'ready') return NextResponse.json({ status: 'ready' })
  // Allow retry when force=true — used by "Transcrever" button and recovery flow
  // to recover from previous attempts that exceeded the serverless timeout and
  // left the row stuck in 'processing' forever.
  const { force } = body
  if (call.transcription_status === 'processing' && !force) {
    return NextResponse.json({ status: 'processing' })
  }
  if (call.recording_status !== 'ready' || !call.recording_url) {
    return NextResponse.json({ error: 'Gravação ainda não está disponível' }, { status: 400 })
  }

  // Mark as processing
  await supabase
    .from('call_records')
    .update({ transcription_status: 'processing' })
    .eq('id', callId)

  try {
    console.log('[Transcribe] Downloading recording:', call.recording_url)

    // Download the recording audio
    const audioRes = await fetch(call.recording_url)
    if (!audioRes.ok) {
      throw new Error(`Failed to download recording: ${audioRes.status}`)
    }

    const audioBuffer = await audioRes.arrayBuffer()
    const audioFile = new File([audioBuffer], 'recording.mp4', { type: 'audio/mp4' })

    console.log('[Transcribe] Sending to Whisper API, size:', audioBuffer.byteLength)

    // Transcribe with Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'pt',
      response_format: 'text',
    })

    console.log('[Transcribe] Success, length:', transcription.length)

    // Save transcription
    await supabase
      .from('call_records')
      .update({
        transcription: transcription,
        transcription_status: 'ready',
      })
      .eq('id', callId)

    // Auto-generate summary from transcription
    try {
      const { data: mentee } = await supabase
        .from('mentees')
        .select('full_name')
        .eq('id', call.mentee_id)
        .single()

      const summaryCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `Você é um assistente que analisa transcrições de ligações entre um especialista de Customer Success e um mentorado.
Gere um resumo estruturado da ligação em português brasileiro.

Responda EXATAMENTE neste formato JSON (sem markdown, sem backticks):
{
  "summary": "Resumo geral do que foi discutido na ligação (4-6 frases, incluindo os principais tópicos abordados e decisões tomadas)",
  "questions": "Principais dúvidas do mentorado (ou null se não houver)",
  "difficulties": "Dificuldades mencionadas pelo mentorado (ou null se não houver)",
  "next_steps": "Próximos passos combinados (ou null se não houver)"
}

Seja conciso e objetivo. Foque no que é útil para o especialista na próxima conversa.`,
          },
          {
            role: 'user',
            content: `Transcrição da ligação com o mentorado ${mentee?.full_name || 'desconhecido'}:\n\n${transcription}`,
          },
        ],
      })

      const summaryContent = summaryCompletion.choices[0]?.message?.content?.trim()
      if (summaryContent) {
        let parsed: { summary: string; questions: string | null; difficulties: string | null; next_steps: string | null }
        try {
          parsed = JSON.parse(summaryContent)
        } catch {
          parsed = { summary: summaryContent, questions: null, difficulties: null, next_steps: null }
        }

        await supabase.from('attendance_notes').insert({
          mentee_id: call.mentee_id,
          specialist_id: call.specialist_id,
          summary: parsed.summary,
          questions: parsed.questions,
          difficulties: parsed.difficulties,
          next_steps: parsed.next_steps,
          generated_by_ai: true,
        })

        console.log('[Transcribe] Auto-summary saved as attendance_note')
      }
    } catch (summaryErr) {
      console.error('[Transcribe] Auto-summary failed (non-blocking):', summaryErr)
    }

    return NextResponse.json({ status: 'ready', transcription })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Transcribe] Error:', message)

    await supabase
      .from('call_records')
      .update({ transcription_status: 'failed' })
      .eq('id', callId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
