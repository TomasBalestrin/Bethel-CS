'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createMentee } from '@/lib/actions/mentee-actions'

const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

interface CreateMenteeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingMentees: { id: string; full_name: string }[]
}

export function CreateMenteeDialog({
  open,
  onOpenChange,
  existingMentees,
}: CreateMenteeDialogProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [productName, setProductName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [email, setEmail] = useState('')
  const [instagram, setInstagram] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [hasPartner, setHasPartner] = useState(false)
  const [partnerName, setPartnerName] = useState('')
  const [sellerName, setSellerName] = useState('')
  const [funnelOrigin, setFunnelOrigin] = useState('')
  const [referredByMenteeId, setReferredByMenteeId] = useState('')
  const [priorityLevel, setPriorityLevel] = useState('1')

  function resetForm() {
    setFullName('')
    setPhone('')
    setProductName('')
    setStartDate('')
    setEndDate('')
    setCpf('')
    setBirthDate('')
    setEmail('')
    setInstagram('')
    setCity('')
    setState('')
    setHasPartner(false)
    setPartnerName('')
    setSellerName('')
    setFunnelOrigin('')
    setReferredByMenteeId('')
    setPriorityLevel('1')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const result = await createMentee({
      full_name: fullName,
      phone,
      product_name: productName,
      start_date: startDate,
      end_date: endDate || undefined,
      cpf: cpf || undefined,
      birth_date: birthDate || undefined,
      email: email || undefined,
      instagram: instagram || undefined,
      city: city || undefined,
      state: state || undefined,
      has_partner: hasPartner,
      partner_name: hasPartner ? partnerName : undefined,
      seller_name: sellerName || undefined,
      funnel_origin: funnelOrigin || undefined,
      referred_by_mentee_id: referredByMenteeId || undefined,
      priority_level: parseInt(priorityLevel, 10),
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    resetForm()
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Mentorado</DialogTitle>
          <DialogDescription>
            Preencha os dados para cadastrar um novo mentorado.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <form onSubmit={handleSubmit} className="space-y-4 pr-4">
            {/* Dados da mentoria */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Dados da Mentoria
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="product_name">Produto atual *</Label>
                  <Input
                    id="product_name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="start_date">Data de início *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end_date">Data final</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Dados pessoais */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Dados Pessoais
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="full_name">Nome completo *</Label>
                  <Input
                    id="full_name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="birth_date">Data de aniversário</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Telefone *</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="instagram">@Instagram</Label>
                  <Input
                    id="instagram"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    placeholder="@"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="state">Estado</Label>
                  <Select value={state} onValueChange={setState}>
                    <SelectTrigger id="state">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {BR_STATES.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Sócio */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Sócio
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="has_partner"
                  checked={hasPartner}
                  onChange={(e) => setHasPartner(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="has_partner">Entrou com sócio?</Label>
              </div>
              {hasPartner && (
                <div className="space-y-1">
                  <Label htmlFor="partner_name">Nome do sócio</Label>
                  <Input
                    id="partner_name"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Informações adicionais */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Informações Adicionais
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="seller_name">Vendedor que vendeu</Label>
                  <Input
                    id="seller_name"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="funnel_origin">De qual funil veio</Label>
                  <Input
                    id="funnel_origin"
                    value={funnelOrigin}
                    onChange={(e) => setFunnelOrigin(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="referred_by">Indicado por mentorado</Label>
                  <Select
                    value={referredByMenteeId}
                    onValueChange={setReferredByMenteeId}
                  >
                    <SelectTrigger id="referred_by">
                      <SelectValue placeholder="Nenhum" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingMentees.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="priority_level">Nível de prioridade *</Label>
                  <Select
                    value={priorityLevel}
                    onValueChange={setPriorityLevel}
                  >
                    <SelectTrigger id="priority_level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 — Pagou o mínimo</SelectItem>
                      <SelectItem value="2">2 — Valor alto, pagamento próximo</SelectItem>
                      <SelectItem value="3">3 — Pagou tudo</SelectItem>
                      <SelectItem value="4">4 — Pagou tudo + indicou +1</SelectItem>
                      <SelectItem value="5">5 — Pagou tudo + indicou +5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
