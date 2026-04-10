import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import type { Database } from '@/types/database'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

/**
 * POST /api/action-plans/extract-from-chat
 *
 * Receives selected chat messages and uses GPT-4o-mini to extract
 * action plan fields from the conversation. Saves/updates the action plan.
 *
 * Body: { menteeId: string, messages: { content: string, direction: string, sent_at: string }[] }
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })
  }

  const { menteeId, messages } = await request.json()
  if (!menteeId || !messages?.length) {
    return NextResponse.json({ error: 'menteeId e messages são obrigatórios' }, { status: 400 })
  }

  // Get mentee name
  const { data: mentee } = await supabase
    .from('mentees')
    .select('id, full_name')
    .eq('id', menteeId)
    .single()

  if (!mentee) return NextResponse.json({ error: 'Mentorado não encontrado' }, { status: 404 })

  // Format messages for the prompt
  const formatted = messages
    .map((m: { content: string; direction: string; sent_at: string }) => {
      const sender = m.direction === 'outgoing' ? 'Especialista' : mentee.full_name
      return `${sender}: ${m.content}`
    })
    .filter((line: string) => line.trim())
    .join('\n')

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `Você é um assistente que analisa mensagens de WhatsApp entre um especialista de Customer Success e um mentorado.
O mentorado respondeu as perguntas do plano de ação por mensagem ao invés de preencher o formulário online.
Extraia as respostas e mapeie para os campos do plano de ação.

Responda EXATAMENTE neste formato JSON (sem markdown, sem backticks):
{
  "nome_empresa": "Nome da empresa (ou null)",
  "nicho": "Nicho/segmento do negócio (ou null)",
  "num_colaboradores": "Número ou faixa de colaboradores (ou null)",
  "endereco_completo": "Endereço completo (ou null)",
  "cpf": "CPF (ou null)",
  "email": "Email (ou null)",
  "instagram": "Instagram (ou null)",
  "cidade": "Cidade (ou null)",
  "estado": "Estado (ou null)",
  "motivacao_elite_premium": "Por que decidiu entrar na mentoria (ou null)",
  "expectativas_resultados": "O que espera de resultados (ou null)",
  "atuacao_profissional": "O que faz profissionalmente (ou null)",
  "tempo_atuacao": "Há quanto tempo atua (ou null)",
  "produtos_servicos": "Principais produtos/serviços (ou null)",
  "funis_venda": "Funis de venda ativos (ou null)",
  "processo_venda": "Processo de venda (ou null)",
  "faturamento_medio": "Faturamento médio mensal em centavos como número inteiro (ou null)",
  "resultado_funis": "Resultado por funil (ou null)",
  "erros_identificados": "Erros identificados (ou null)",
  "desafios_funis": "Desafios nos funis (ou null)",
  "funis_testados": "Funis testados que não funcionaram (ou null)",
  "estrutura_comercial": "Estrutura comercial (ou null)",
  "estrutura_marketing": "Estrutura de marketing (ou null)",
  "entrega_produto": "Entrega do produto/serviço (ou null)",
  "estrutura_gestao": "Estrutura de gestão (ou null)",
  "equipe": "Equipe e funções (ou null)",
  "momento_negocio": "Momento do negócio (ou null)",
  "objetivos_urgentes": "Objetivos urgentes (ou null)",
  "visao_futuro": "Visão de futuro (ou null)"
}

Extraia apenas informações claramente presentes nas mensagens. Use null para campos sem informação.
Mantenha as respostas na íntegra quando possível, não resuma excessivamente.`
        },
        {
          role: 'user',
          content: `Mensagens do mentorado ${mentee.full_name}:\n\n${formatted}`
        },
      ],
    })

    const content = completion.choices[0]?.message?.content?.trim()
    if (!content) {
      return NextResponse.json({ error: 'Resposta vazia da IA' }, { status: 500 })
    }

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(content)
    } catch {
      return NextResponse.json({ error: 'Erro ao interpretar resposta da IA' }, { status: 500 })
    }

    // Remove null values
    const planData: Record<string, unknown> = {}
    let fieldCount = 0
    for (const [key, val] of Object.entries(extracted)) {
      if (val !== null && val !== undefined && val !== '') {
        planData[key] = val
        fieldCount++
      }
    }

    // Save/update action plan
    const { data: existing } = await supabase
      .from('action_plans')
      .select('id, data')
      .eq('mentee_id', menteeId)
      .maybeSingle()

    if (existing) {
      // Merge with existing data (don't overwrite fields that already exist)
      const existingData = (existing.data as Record<string, unknown>) || {}
      const mergedData = { ...existingData, ...planData }
      await supabase
        .from('action_plans')
        .update({ data: mergedData as unknown as Database['public']['Tables']['action_plans']['Update']['data'], submitted_at: new Date().toISOString() })
        .eq('id', existing.id)
    } else {
      await supabase.from('action_plans').insert({
        mentee_id: menteeId,
        data: planData as unknown as Database['public']['Tables']['action_plans']['Insert']['data'],
        submitted_at: new Date().toISOString(),
      })
    }

    // Sync key fields to mentee
    const menteeUpdates: Record<string, unknown> = {}
    if (planData.nicho) menteeUpdates.niche = planData.nicho
    if (planData.nome_empresa) menteeUpdates.nome_empresa = planData.nome_empresa
    if (planData.email) menteeUpdates.email = planData.email
    if (planData.instagram) menteeUpdates.instagram = planData.instagram
    if (planData.cidade) menteeUpdates.city = planData.cidade
    if (planData.estado) menteeUpdates.state = planData.estado
    if (Object.keys(menteeUpdates).length > 0) {
      menteeUpdates.updated_at = new Date().toISOString()
      await supabase.from('mentees').update(menteeUpdates).eq('id', menteeId)
    }

    return NextResponse.json({ fieldCount, extracted: planData })
  } catch (err) {
    console.error('[ExtractFromChat] OpenAI error:', err)
    return NextResponse.json({ error: 'Erro ao processar mensagens' }, { status: 500 })
  }
}
