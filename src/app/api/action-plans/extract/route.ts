import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' })

/**
 * POST /api/action-plans/extract
 *
 * After bulk-importing action plans, calls GPT-4o-mini to extract structured
 * business data (niche, company name, collaborators, revenue) from the
 * free-text responses stored in the action_plans.data JSON column.
 *
 * Body: { menteeIds: string[] }
 *   - menteeIds: IDs of mentees whose action plans should be analysed.
 *                 If omitted, processes all action plans that have not been
 *                 extracted yet (mentees with null nome_empresa AND null niche).
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })
  }

  const body = await request.json()
  const menteeIds: string[] | undefined = body.menteeIds

  // Fetch action plans
  let apQuery = supabase
    .from('action_plans')
    .select('id, mentee_id, data')
    .not('data', 'is', null)

  if (menteeIds && menteeIds.length > 0) {
    apQuery = apQuery.in('mentee_id', menteeIds)
  }

  const { data: actionPlans, error: fetchError } = await apQuery
  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!actionPlans || actionPlans.length === 0) {
    return NextResponse.json({ processed: 0, results: [] })
  }

  // Fetch mentee data for all related mentees
  const apMenteeIds = [...new Set(actionPlans.map((ap) => ap.mentee_id))]
  const { data: menteesData } = await supabase
    .from('mentees')
    .select('id, full_name, niche, nome_empresa, num_colaboradores, faturamento_atual')
    .in('id', apMenteeIds)

  const menteeMap = new Map(
    (menteesData ?? []).map((m) => [m.id, m])
  )

  const results: { menteeId: string; name: string; extracted: Record<string, unknown>; error?: string }[] = []

  // Process in batches of 5 to avoid rate limits
  const BATCH_SIZE = 5
  for (let i = 0; i < actionPlans.length; i += BATCH_SIZE) {
    const batch = actionPlans.slice(i, i + BATCH_SIZE)

    const promises = batch.map(async (ap) => {
      const mentee = menteeMap.get(ap.mentee_id)
      if (!mentee) {
        return { menteeId: ap.mentee_id, name: '?', extracted: {}, error: 'Mentorado não encontrado' }
      }
      const planData = ap.data as Record<string, unknown>

      // Build a text summary of the action plan responses for the AI
      const relevantFields: Record<string, string> = {}
      const fieldLabels: Record<string, string> = {
        atuacao_profissional: 'Atuação profissional',
        produtos_servicos: 'Produtos/Serviços',
        faturamento_medio: 'Faturamento médio últimos 3 meses',
        equipe: 'Equipe (quantas pessoas e funções)',
        estrutura_comercial: 'Estrutura comercial',
        estrutura_marketing: 'Estrutura de marketing',
        estrutura_gestao: 'Estrutura de gestão',
        momento_negocio: 'Momento do negócio',
        nicho: 'Nicho informado',
        nome_empresa: 'Nome da empresa informado',
        num_colaboradores: 'Nº de colaboradores informado',
        tempo_atuacao: 'Tempo de atuação',
        resultado_funis: 'Resultado por funil em R$',
        funis_venda: 'Funis de venda ativos',
        entrega_produto: 'Entrega do produto/serviço',
      }

      for (const [key, label] of Object.entries(fieldLabels)) {
        const val = planData[key]
        if (val && String(val).trim()) {
          relevantFields[label] = String(val).trim()
        }
      }

      // If no useful data, skip
      if (Object.keys(relevantFields).length === 0) {
        return { menteeId: mentee.id, name: mentee.full_name, extracted: {}, error: 'Sem dados relevantes no plano de ação' }
      }

      const promptText = Object.entries(relevantFields)
        .map(([label, value]) => `${label}: ${value}`)
        .join('\n')

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content: `Você é um assistente que analisa respostas de planos de ação de mentorados de negócios.
A partir das respostas fornecidas, extraia as seguintes informações estruturadas:

Responda EXATAMENTE neste formato JSON (sem markdown, sem backticks):
{
  "nicho": "Nicho/segmento de atuação do negócio (ex: 'Odontologia', 'E-commerce de moda', 'Consultoria financeira'). Se não for possível identificar, retorne null.",
  "nome_empresa": "Nome da empresa/negócio. Se não for mencionado explicitamente, retorne null.",
  "num_colaboradores": "Número inteiro de colaboradores/funcionários. Extraia o número da descrição da equipe. Se a pessoa trabalha sozinha, retorne 1. Se não for possível identificar, retorne null.",
  "faturamento_medio": "Faturamento médio mensal em reais (apenas o número, sem R$ ou formatação). Interprete valores como '50k' = 50000, '120mil' = 120000. Se não for possível identificar, retorne null."
}

Seja preciso e extraia apenas informações que estejam claramente presentes nas respostas.
Não invente dados. Se não houver informação suficiente para um campo, retorne null.`
            },
            {
              role: 'user',
              content: `Mentorado: ${mentee.full_name}\n\nRespostas do plano de ação:\n${promptText}`
            },
          ],
        })

        const content = completion.choices[0]?.message?.content?.trim()
        if (!content) {
          return { menteeId: mentee.id, name: mentee.full_name, extracted: {}, error: 'Resposta vazia da IA' }
        }

        let parsed: { nicho: string | null; nome_empresa: string | null; num_colaboradores: number | null; faturamento_medio: number | null }
        try {
          parsed = JSON.parse(content)
        } catch {
          return { menteeId: mentee.id, name: mentee.full_name, extracted: {}, error: 'Erro ao interpretar resposta da IA' }
        }

        // Build update object — only update fields that AI extracted AND are currently empty on the mentee
        const updates: Record<string, unknown> = {}

        if (parsed.nicho && !mentee.niche) {
          updates.niche = parsed.nicho
        }
        if (parsed.nome_empresa && !mentee.nome_empresa) {
          updates.nome_empresa = parsed.nome_empresa
        }
        if (parsed.num_colaboradores != null && !mentee.num_colaboradores) {
          const num = typeof parsed.num_colaboradores === 'string'
            ? parseInt(parsed.num_colaboradores, 10)
            : parsed.num_colaboradores
          if (!isNaN(num) && num > 0) {
            updates.num_colaboradores = num
          }
        }
        if (parsed.faturamento_medio != null && !mentee.faturamento_atual) {
          const fat = typeof parsed.faturamento_medio === 'string'
            ? parseFloat(String(parsed.faturamento_medio).replace(/[^\d.,]/g, '').replace(',', '.'))
            : parsed.faturamento_medio
          if (!isNaN(fat) && fat > 0) {
            updates.faturamento_atual = fat
          }
        }

        // Apply updates to mentee
        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString()
          await supabase
            .from('mentees')
            .update(updates)
            .eq('id', mentee.id)
        }

        return { menteeId: mentee.id, name: mentee.full_name, extracted: { ...parsed, applied: updates } }
      } catch (err) {
        console.error(`[Extract] OpenAI error for ${mentee.full_name}:`, err)
        return { menteeId: mentee.id, name: mentee.full_name, extracted: {}, error: 'Erro na chamada OpenAI' }
      }
    })

    const batchResults = await Promise.all(promises)
    results.push(...batchResults)
  }

  return NextResponse.json({
    processed: results.length,
    updated: results.filter((r) => !r.error && Object.keys(r.extracted).length > 0).length,
    results,
  })
}
