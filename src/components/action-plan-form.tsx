'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-8 text-center shadow-card animate-slide-up">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" />
          <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">
            Formulário enviado com sucesso!
          </h1>
          <p className="mt-2 text-muted-foreground">
            Nossa equipe entrará em contato em breve.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 text-center">
        <Image
          src="/logo.png"
          alt="Bethel CS"
          width={160}
          height={48}
          className="mx-auto h-12 w-auto"
          priority
        />
        <h1 className="mt-4 font-heading text-2xl font-bold text-foreground">
          Plano de Ação
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Olá, {menteeName}! Preencha o formulário abaixo com atenção.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Q1 */}
        <FormField
          number={1}
          label="Qual o seu endereço completo?"
          hint="Exemplo: Rua Ação, número 01, Bairro Bethel"
        >
          <Input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            required
          />
        </FormField>

        {/* Q2 */}
        <FormField
          number={2}
          label="Por onde você nos conheceu?"
          hint="Pode selecionar mais de uma opção"
        >
          <div className="space-y-2">
            {DISCOVERY_OPTIONS.map((option) => (
              <label
                key={option}
                className="flex items-start gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={discovery.includes(option)}
                  onChange={() => toggleDiscovery(option)}
                  className="mt-0.5 h-4 w-4 rounded border-input"
                />
                <span className="text-sm text-foreground">{option}</span>
              </label>
            ))}
          </div>
        </FormField>

        {/* Q3 */}
        <FormField
          number={3}
          label="Por que você decidiu fazer parte da Elite Premium?"
        >
          <Textarea
            value={motivacao}
            onChange={(e) => setMotivacao(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q4 */}
        <FormField
          number={4}
          label="O que você espera de resultados ao final da mentoria?"
        >
          <Textarea
            value={expectativas}
            onChange={(e) => setExpectativas(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q5 */}
        <FormField
          number={5}
          label="O que você faz hoje? Profissionalmente falando. Conte-nos um pouco mais sobre sua atuação."
        >
          <Textarea
            value={atuacao}
            onChange={(e) => setAtuacao(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q6 */}
        <FormField
          number={6}
          label="Há quanto tempo você atua com isso?"
        >
          <Input
            value={tempoAtuacao}
            onChange={(e) => setTempoAtuacao(e.target.value)}
            required
          />
        </FormField>

        {/* Q7 */}
        <FormField
          number={7}
          label="Quais são os 4 principais produtos/serviços que você vende hoje, em ordem do mais vendido para o menos vendido?"
          hint="Formato: Nome – Descrição – Valor de venda (R$) – Lucro aproximado (R$)"
        >
          <Textarea
            value={produtos}
            onChange={(e) => setProdutos(e.target.value)}
            rows={5}
            required
          />
        </FormField>

        {/* Q8 */}
        <FormField
          number={8}
          label="Como você vende hoje? Quais funis de venda estão ativos no seu negócio?"
          hint="Exemplos: indicação, upsell para clientes atuais, tráfego pago no WhatsApp"
        >
          <Textarea
            value={funis}
            onChange={(e) => setFunis(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q9 */}
        <FormField
          number={9}
          label="Como você passa o preço para o seu cliente? Descreva o percurso do cliente desde a primeira mensagem até o fechamento da venda."
        >
          <Textarea
            value={processoVenda}
            onChange={(e) => setProcessoVenda(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q10 */}
        <FormField
          number={10}
          label="Qual a sua média de faturamento mensal? Informe quanto faturou nos últimos 3 meses."
          hint="Formato: Média de Faturamento: R$X - Faturamento Mês 1: R$X; Mês 2: R$X; Mês 3: R$X"
        >
          <Textarea
            value={faturamento}
            onChange={(e) => setFaturamento(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q11 */}
        <FormField
          number={11}
          label="Quanto cada funil gerou de resultado (R$) nos últimos 3 meses?"
          hint="Formato: Funil – Investimento (se tiver) – Faturamento mês 1 / mês 2 / mês 3"
        >
          <Textarea
            value={resultadoFunis}
            onChange={(e) => setResultadoFunis(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q12 */}
        <FormField
          number={12}
          label="Quais erros você identifica em cada um dos seus funis de venda e no seu negócio de modo geral?"
        >
          <Textarea
            value={erros}
            onChange={(e) => setErros(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q13 */}
        <FormField
          number={13}
          label="Quais são os principais desafios que você encontra nesses funis?"
        >
          <Textarea
            value={desafios}
            onChange={(e) => setDesafios(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q14 */}
        <FormField
          number={14}
          label="Quais novos funis você já testou e não funcionaram?"
        >
          <Textarea
            value={funisTestados}
            onChange={(e) => setFunisTestados(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q15 */}
        <FormField
          number={15}
          label="Qual é a sua estrutura comercial hoje?"
          hint="Descreva: quantos vendedores, se tem terceirizados e quais canais usam para vender."
        >
          <Textarea
            value={estruturaComercial}
            onChange={(e) => setEstruturaComercial(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q16 */}
        <FormField
          number={16}
          label="Qual é a sua estrutura de marketing?"
          hint="Descreva: quem cria e edita conteúdos, quem posta, quem faz tráfego pago e outros canais."
        >
          <Textarea
            value={estruturaMarketing}
            onChange={(e) => setEstruturaMarketing(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q17 */}
        <FormField
          number={17}
          label="Como funciona a entrega do seu produto/serviço na prática?"
          hint="Descreva: como funciona, quem realiza, qual a capacidade atual e se há espaço para crescer."
        >
          <Textarea
            value={entrega}
            onChange={(e) => setEntrega(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q18 */}
        <FormField
          number={18}
          label="Qual é a sua estrutura de gestão hoje?"
          hint="Descreva: indicadores ativos, CRM, sistema financeiro e o que ainda precisa melhorar."
        >
          <Textarea
            value={gestao}
            onChange={(e) => setGestao(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q19 */}
        <FormField
          number={19}
          label="Quantas pessoas trabalham com você e qual a função de cada uma?"
        >
          <Textarea
            value={equipe}
            onChange={(e) => setEquipe(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q20 */}
        <FormField
          number={20}
          label="Na sua visão, qual o momento do seu negócio hoje?"
        >
          <Textarea
            value={momentoNegocio}
            onChange={(e) => setMomentoNegocio(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q21 */}
        <FormField
          number={21}
          label="Quais os objetivos mais urgentes para atingir hoje no seu negócio?"
        >
          <Textarea
            value={objetivosUrgentes}
            onChange={(e) => setObjetivosUrgentes(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {/* Q22 */}
        <FormField
          number={22}
          label="Onde você vê o seu negócio em 6 meses, 1 ano e 5 anos?"
        >
          <Textarea
            value={visaoFuturo}
            onChange={(e) => setVisaoFuturo(e.target.value)}
            rows={4}
            required
          />
        </FormField>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar Plano de Ação'}
        </Button>
      </form>
    </div>
  )
}

function FormField({
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
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <Label className="text-sm font-medium text-foreground">
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
          {number}
        </span>
        {label}
      </Label>
      {hint && (
        <p className="mt-1 ml-8 text-xs text-muted-foreground">{hint}</p>
      )}
      <div className="mt-3 ml-8">{children}</div>
    </div>
  )
}
