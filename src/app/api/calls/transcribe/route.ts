import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecordings } from '@/lib/daily'
import OpenAI from 'openai'

// Transcription + summary can take ~1-3 min for long calls. Default 60s timeout
// was killing the function mid-way and leaving calls stuck in 'processing'.
export const maxDuration = 300 // 5 minutes (Vercel Pro limit)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

/** Transcribe a long recording via AssemblyAI.
 *  AssemblyAI pulls the audio from the given URL on its side, so we don't
 *  have to upload the (potentially hundreds of MB) file from our function.
 *  Polls for up to ~4 min — within Vercel Pro's 5-min serverless limit.
 */
async function transcribeWithAssemblyAI(
  audioUrl: string,
  apiKey: string,
  log: (stage: string, extra?: Record<string, unknown>) => void,
): Promise<string> {
  // 1. Submit the transcription job
  const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      language_code: 'pt',
    }),
  })
  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => '')
    throw new Error(`AssemblyAI submit failed (${submitRes.status}): ${text}`)
  }
  const submitData = await submitRes.json() as { id: string; status?: string }
  const id = submitData.id
  log('assemblyai submitted', { id })

  // 2. Poll until completed/error, or we run out of time
  const pollUrl = `https://api.assemblyai.com/v2/transcript/${id}`
  const startTs = Date.now()
  const maxWaitMs = 4 * 60 * 1000 // 4 minutes (leaves 1 min buffer under maxDuration)
  while (Date.now() - startTs < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 5000))
    const pollRes = await fetch(pollUrl, { headers: { Authorization: apiKey } })
    if (!pollRes.ok) {
      const text = await pollRes.text().catch(() => '')
      throw new Error(`AssemblyAI poll failed (${pollRes.status}): ${text}`)
    }
    const data = await pollRes.json() as { status: string; text?: string; error?: string }
    if (data.status === 'completed') {
      return data.text || ''
    }
    if (data.status === 'error') {
      throw new Error(`AssemblyAI: ${data.error || 'falha desconhecida'}`)
    }
    // queued | processing → continue
  }
  throw new Error('AssemblyAI ainda processando após 4 min. Clique em "Tentar novamente" em 1-2 min — a transcrição vai continuar de onde parou.')
}

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

  // Get the call record — include daily_room_name so we can refresh an expired URL
  const { data: call } = await supabase
    .from('call_records')
    .select('id, mentee_id, specialist_id, recording_url, recording_status, transcription_status, daily_room_name')
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

  const t0 = Date.now()
  const log = (stage: string, extra?: Record<string, unknown>) =>
    console.log('[Transcribe]', `[+${Math.round((Date.now() - t0) / 1000)}s]`, stage, extra ?? '')

  try {
    log('start', { callId, url: call.recording_url })

    // Make sure we have a fresh, valid Daily URL before doing anything — both
    // the Whisper path (which downloads the file) and the AssemblyAI path
    // (which pulls the URL on its end) need it to be live.
    let downloadUrl = call.recording_url
    const headRes = await fetch(downloadUrl, { method: 'HEAD' })
    if ((headRes.status === 403 || headRes.status === 404) && call.daily_room_name) {
      log('URL expired, refreshing from Daily', { status: headRes.status })
      const recordings = await getRecordings(call.daily_room_name)
      const fresh = recordings.find((r) => !!r.download_url)
      if (fresh?.download_url && fresh.download_url !== downloadUrl) {
        downloadUrl = fresh.download_url
        await supabase
          .from('call_records')
          .update({ recording_url: downloadUrl })
          .eq('id', callId)
        log('URL refreshed')
      }
    }

    // Decide route by file size: Whisper (fast, cheap) for <=25 MB;
    // AssemblyAI (URL-based, handles up to ~2 GB) for larger files.
    // Content-Length comes back on Daily's signed URLs.
    const sizeHeaderRes = await fetch(downloadUrl, { method: 'HEAD' })
    const sizeBytes = Number(sizeHeaderRes.headers.get('content-length') || '0')
    const sizeMB = sizeBytes / 1024 / 1024
    log('size probed', { sizeMB: sizeMB.toFixed(2) })

    const WHISPER_LIMIT_MB = 25
    let transcription: string

    if (sizeBytes > 0 && sizeMB > WHISPER_LIMIT_MB) {
      // ── AssemblyAI path (large files) ──
      const key = process.env.ASSEMBLYAI_API_KEY
      if (!key) {
        throw new Error(`Gravação tem ${sizeMB.toFixed(1)} MB — acima do limite de ${WHISPER_LIMIT_MB} MB do Whisper. Configure ASSEMBLYAI_API_KEY no Vercel para transcrever ligações longas automaticamente.`)
      }
      log('using AssemblyAI (file exceeds Whisper limit)')
      transcription = await transcribeWithAssemblyAI(downloadUrl, key, log)
      log('assemblyai done', { transcriptLen: transcription.length })
    } else {
      // ── Whisper path (small files) ──
      const audioRes = await fetch(downloadUrl)
      if (!audioRes.ok) {
        throw new Error(`Failed to download recording: HTTP ${audioRes.status} ${audioRes.statusText}`)
      }
      const audioBuffer = await audioRes.arrayBuffer()
      const actualMB = audioBuffer.byteLength / 1024 / 1024
      log('downloaded', { bytes: audioBuffer.byteLength, sizeMB: actualMB.toFixed(2) })

      // Sanity check: some Daily URLs don't return content-length in HEAD,
      // so we re-check after the full download.
      if (actualMB > WHISPER_LIMIT_MB) {
        const key = process.env.ASSEMBLYAI_API_KEY
        if (!key) {
          throw new Error(`Gravação tem ${actualMB.toFixed(1)} MB — acima do limite de ${WHISPER_LIMIT_MB} MB do Whisper. Configure ASSEMBLYAI_API_KEY no Vercel para transcrever ligações longas automaticamente.`)
        }
        log('size over limit after download — falling back to AssemblyAI')
        transcription = await transcribeWithAssemblyAI(downloadUrl, key, log)
      } else {
        const audioFile = new File([audioBuffer], 'recording.mp4', { type: 'audio/mp4' })
        log('sending to Whisper')
        transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          language: 'pt',
          response_format: 'text',
        })
        log('whisper done', { transcriptLen: transcription.length })
      }
    }

    // Save transcription FIRST so the UI shows "ready" even if summary fails
    await supabase
      .from('call_records')
      .update({
        transcription: transcription,
        transcription_status: 'ready',
      })
      .eq('id', callId)
    log('transcription saved → status=ready')

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

    log('all done')
    return NextResponse.json({ status: 'ready', transcription })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[Transcribe] FAILED after', Math.round((Date.now() - t0) / 1000), 's:', message, stack)

    await supabase
      .from('call_records')
      .update({ transcription_status: 'failed' })
      .eq('id', callId)

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
