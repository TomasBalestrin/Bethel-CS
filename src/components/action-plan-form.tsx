'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2 } from 'lucide-react'
import { submitActionPlan } from '@/lib/actions/action-plan-actions'

const DISCOVERY_OPTIONS = [
  'Comprou algum produto da área de membros do Cleiton',
  'Veio do Instagram do Cleiton',
  'Participou do Intensivo da Alta Performance',
  'Indicação',
  'Participa da mentoria da Júlia Ottoni',
]

const TOTAL_QUESTIONS = 22

interface ActionPlanFormProps {
  token: string
  menteeName: string
}

export function ActionPlanForm({ token, menteeName }: ActionPlanFormProps) {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [endereco, setEndereco] = useState('')
  const [discovery, setDiscovery] = useState<string[]>([])
  const [motivacao, setMotivacao] = useState('')
  const [expectativas, setExpectativas] = useState('')
  const [atuacao, setAtuacao] = useState('')
  const [tempoAtuacao, setTempoAtuacao] = useState('')
  const [produtos, setProdutos] = useState('')
  const [funis, setFunis] = useState('')
  const [processoVenda, setProcessoVenda] = useState('')
  const [faturamento, setFaturamento] = useState('')
  const [resultadoFunis, setResultadoFunis] = useState('')
  const [erros, setErros] = useState('')
  const [desafios, setDesafios] = useState('')
  const [funisTestados, setFunisTestados] = useState('')
  const [estruturaComercial, setEstruturaComercial] = useState('')
  const [estruturaMarketing, setEstruturaMarketing] = useState('')
  const [entrega, setEntrega] = useState('')
  const [gestao, setGestao] = useState('')
  const [equipe, setEquipe] = useState('')
  const [momentoNegocio, setMomentoNegocio] = useState('')
  const [objetivosUrgentes, setObjetivosUrgentes] = useState('')
  const [visaoFuturo, setVisaoFuturo] = useState('')

  const filledCount = useMemo(() => {
    const fields = [
      endereco, discovery.length > 0 ? 'filled' : '', motivacao, expectativas,
      atuacao, tempoAtuacao, produtos, funis, processoVenda, faturamento,
      resultadoFunis, erros, desafios, funisTestados, estruturaComercial,
      estruturaMarketing, entrega, gestao, equipe, momentoNegocio,
      objetivosUrgentes, visaoFuturo,
    ]
    return fields.filter((v) => typeof v === 'string' ? v.trim() !== '' : !!v).length
  }, [
    endereco, discovery, motivacao, expectativas, atuacao, tempoAtuacao,
    produtos, funis, processoVenda, faturamento, resultadoFunis, erros,
    desafios, funisTestados, estruturaComercial, estruturaMarketing, entrega,
    gestao, equipe, momentoNegocio, objetivosUrgentes, visaoFuturo,
  ])

  const progressPct = Math.round((filledCount / TOTAL_QUESTIONS) * 100)

  function toggleDiscovery(option: string) {
    setDiscovery((prev) =>
      prev.includes(option)
        ? prev.filter((o) => o !== option)
        : [...prev, option]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const data = {
      endereco_completo: endereco,
      como_nos_conheceu: discovery,
      motivacao_elite_premium: motivacao,
      expectativas_resultados: expectativas,
      atuacao_profissional: atuacao,
      tempo_atuacao: tempoAtuacao,
      produtos_servicos: produtos,
      funis_venda: funis,
      processo_venda: processoVenda,
      media_faturamento: faturamento,
      resultado_funis: resultadoFunis,
      erros_identificados: erros,
      desafios_funis: desafios,
      funis_testados: funisTestados,
      estrutura_comercial: estruturaComercial,
      estrutura_marketing: estruturaMarketing,
      entrega_produto: entrega,
      estrutura_gestao: gestao,
      equipe: equipe,
      momento_negocio: momentoNegocio,
      objetivos_urgentes: objetivosUrgentes,
      visao_futuro: visaoFuturo,
    }

    const result = await submitActionPlan(token, data)

    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: '#F8FBFF' }}>
        <div className="w-full max-w-[680px] rounded-lg bg-white p-10 text-center shadow-card animate-slide-up">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          <h1 className="mt-4 font-heading text-2xl font-semibold text-foreground">
            Formulário enviado com sucesso!
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nossa equipe entrará em contato em breve.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FBFF' }}>
      <div className="mx-auto max-w-[680px] px-4 py-10 sm:px-6">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
            Bethel CS
          </h2>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Progresso</span>
            <span className="text-xs font-semibold text-foreground">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full gradient-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Plano de Ação
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Olá, {menteeName}! Preencha o formulário abaixo com atenção.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Q1 */}
          <FormCard number={1} label="Qual o seu endereço completo?" hint="Exemplo: Rua Ação, número 01, Bairro Bethel">
            <Input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              required
              placeholder="Digite seu endereço completo"
            />
          </FormCard>

          {/* Q2 — Multiple choice cards */}
          <FormCard number={2} label="Por onde você nos conheceu?" hint="Pode selecionar mais de uma opção">
            <div className="grid gap-2">
              {DISCOVERY_OPTIONS.map((option) => {
                const selected = discovery.includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleDiscovery(option)}
                    className={`w-full text-left rounded-lg border-2 px-4 py-3 text-sm transition-all ${
                      selected
                        ? 'border-accent bg-accent/5 text-foreground font-medium'
                        : 'border-border bg-white text-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </FormCard>

          {/* Q3 */}
          <FormCard number={3} label="Por que você decidiu fazer parte da Elite Premium?">
            <Textarea
              value={motivacao}
              onChange={(e) => setMotivacao(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva sua motivação..."
            />
          </FormCard>

          {/* Q4 */}
          <FormCard number={4} label="O que você espera de resultados ao final da mentoria?">
            <Textarea
              value={expectativas}
              onChange={(e) => setExpectativas(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Quais resultados você espera alcançar..."
            />
          </FormCard>

          {/* Q5 */}
          <FormCard number={5} label="O que você faz hoje? Profissionalmente falando. Conte-nos um pouco mais sobre sua atuação.">
            <Textarea
              value={atuacao}
              onChange={(e) => setAtuacao(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva sua atuação profissional..."
            />
          </FormCard>

          {/* Q6 */}
          <FormCard number={6} label="Há quanto tempo você atua com isso?">
            <Input
              value={tempoAtuacao}
              onChange={(e) => setTempoAtuacao(e.target.value)}
              required
              placeholder="Ex: 3 anos"
            />
          </FormCard>

          {/* Q7 */}
          <FormCard
            number={7}
            label="Quais são os 4 principais produtos/serviços que você vende hoje, em ordem do mais vendido para o menos vendido?"
            hint="Formato: Nome – Descrição – Valor de venda (R$) – Lucro aproximado (R$)"
          >
            <Textarea
              value={produtos}
              onChange={(e) => setProdutos(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Liste seus produtos/serviços..."
            />
          </FormCard>

          {/* Q8 */}
          <FormCard
            number={8}
            label="Como você vende hoje? Quais funis de venda estão ativos no seu negócio?"
            hint="Exemplos: indicação, upsell para clientes atuais, tráfego pago no WhatsApp"
          >
            <Textarea
              value={funis}
              onChange={(e) => setFunis(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva seus funis de venda..."
            />
          </FormCard>

          {/* Q9 */}
          <FormCard number={9} label="Como você passa o preço para o seu cliente? Descreva o percurso do cliente desde a primeira mensagem até o fechamento da venda.">
            <Textarea
              value={processoVenda}
              onChange={(e) => setProcessoVenda(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva o processo de venda..."
            />
          </FormCard>

          {/* Q10 */}
          <FormCard
            number={10}
            label="Qual a sua média de faturamento mensal? Informe quanto faturou nos últimos 3 meses."
            hint="Formato: Média de Faturamento: R$X - Faturamento Mês 1: R$X; Mês 2: R$X; Mês 3: R$X"
          >
            <Textarea
              value={faturamento}
              onChange={(e) => setFaturamento(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Informe seu faturamento..."
            />
          </FormCard>

          {/* Q11 */}
          <FormCard
            number={11}
            label="Quanto cada funil gerou de resultado (R$) nos últimos 3 meses?"
            hint="Formato: Funil – Investimento (se tiver) – Faturamento mês 1 / mês 2 / mês 3"
          >
            <Textarea
              value={resultadoFunis}
              onChange={(e) => setResultadoFunis(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Detalhe os resultados por funil..."
            />
          </FormCard>

          {/* Q12 */}
          <FormCard number={12} label="Quais erros você identifica em cada um dos seus funis de venda e no seu negócio de modo geral?">
            <Textarea
              value={erros}
              onChange={(e) => setErros(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Liste os erros identificados..."
            />
          </FormCard>

          {/* Q13 */}
          <FormCard number={13} label="Quais são os principais desafios que você encontra nesses funis?">
            <Textarea
              value={desafios}
              onChange={(e) => setDesafios(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva seus desafios..."
            />
          </FormCard>

          {/* Q14 */}
          <FormCard number={14} label="Quais novos funis você já testou e não funcionaram?">
            <Textarea
              value={funisTestados}
              onChange={(e) => setFunisTestados(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva os funis que não funcionaram..."
            />
          </FormCard>

          {/* Q15 */}
          <FormCard
            number={15}
            label="Qual é a sua estrutura comercial hoje?"
            hint="Descreva: quantos vendedores, se tem terceirizados e quais canais usam para vender."
          >
            <Textarea
              value={estruturaComercial}
              onChange={(e) => setEstruturaComercial(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva sua estrutura comercial..."
            />
          </FormCard>

          {/* Q16 */}
          <FormCard
            number={16}
            label="Qual é a sua estrutura de marketing?"
            hint="Descreva: quem cria e edita conteúdos, quem posta, quem faz tráfego pago e outros canais."
          >
            <Textarea
              value={estruturaMarketing}
              onChange={(e) => setEstruturaMarketing(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva sua estrutura de marketing..."
            />
          </FormCard>

          {/* Q17 */}
          <FormCard
            number={17}
            label="Como funciona a entrega do seu produto/serviço na prática?"
            hint="Descreva: como funciona, quem realiza, qual a capacidade atual e se há espaço para crescer."
          >
            <Textarea
              value={entrega}
              onChange={(e) => setEntrega(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva o processo de entrega..."
            />
          </FormCard>

          {/* Q18 */}
          <FormCard
            number={18}
            label="Qual é a sua estrutura de gestão hoje?"
            hint="Descreva: indicadores ativos, CRM, sistema financeiro e o que ainda precisa melhorar."
          >
            <Textarea
              value={gestao}
              onChange={(e) => setGestao(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva sua estrutura de gestão..."
            />
          </FormCard>

          {/* Q19 */}
          <FormCard number={19} label="Quantas pessoas trabalham com você e qual a função de cada uma?">
            <Textarea
              value={equipe}
              onChange={(e) => setEquipe(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva sua equipe..."
            />
          </FormCard>

          {/* Q20 */}
          <FormCard number={20} label="Na sua visão, qual o momento do seu negócio hoje?">
            <Textarea
              value={momentoNegocio}
              onChange={(e) => setMomentoNegocio(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Descreva o momento atual do seu negócio..."
            />
          </FormCard>

          {/* Q21 */}
          <FormCard number={21} label="Quais os objetivos mais urgentes para atingir hoje no seu negócio?">
            <Textarea
              value={objetivosUrgentes}
              onChange={(e) => setObjetivosUrgentes(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Liste seus objetivos mais urgentes..."
            />
          </FormCard>

          {/* Q22 */}
          <FormCard number={22} label="Onde você vê o seu negócio em 6 meses, 1 ano e 5 anos?">
            <Textarea
              value={visaoFuturo}
              onChange={(e) => setVisaoFuturo(e.target.value)}
              required
              className="min-h-[120px] resize-y"
              placeholder="Compartilhe sua visão de futuro..."
            />
          </FormCard>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[52px] rounded-lg gradient-primary text-white font-heading font-semibold text-base transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar meu Plano de Ação'}
          </button>
        </form>
      </div>
    </div>
  )
}

function FormCard({
  number,
  label,
  hint,
  children,
}: {
  number: number
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-white p-6 shadow-card">
      <div className="flex items-start gap-3 mb-4">
        <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full gradient-primary text-xs font-bold text-white">
          {number}
        </span>
        <div>
          <p className="font-heading font-medium text-base text-foreground leading-snug">
            {label}
          </p>
          {hint && (
            <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
          )}
        </div>
      </div>
      <div className="ml-10">{children}</div>
    </div>
  )
}
