'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

/** Standardized niche options. When adding/removing, update NICHE_OPTIONS only. */
export const NICHE_OPTIONS = [
  'Saúde',
  'Estética',
  'Odontologia',
  'Fitness',
  'Fotografia',
  'Contabilidade',
  'Advocacia',
  'Turismo',
  'Arquitetura e Engenharia',
  'Mentorias e consultorias',
] as const

export const NICHE_OTHER = 'Outros'

/** Reusable niche picker: predefined list + "Outros" that reveals a free-text input.
 *
 *  Controlled via value/onChange. The final string saved to DB is either one of
 *  NICHE_OPTIONS or the custom text typed under "Outros" — never literally the
 *  word "Outros", so downstream filters/reports work as before.
 */
export function NicheSelect({
  value,
  onChange,
  id,
  placeholder = 'Selecione um nicho',
  className,
}: {
  value: string | null | undefined
  onChange: (next: string) => void
  id?: string
  placeholder?: string
  className?: string
}) {
  const isPredefined = !!value && (NICHE_OPTIONS as readonly string[]).includes(value)
  // Local state: which option the select shows, and the text for "Outros"
  const [selected, setSelected] = useState<string>(() => {
    if (!value) return ''
    return isPredefined ? value : NICHE_OTHER
  })
  const [otherText, setOtherText] = useState<string>(() => (isPredefined ? '' : value || ''))

  // Keep local state in sync when the external value changes (e.g. form reset)
  useEffect(() => {
    if (!value) {
      setSelected('')
      setOtherText('')
      return
    }
    if ((NICHE_OPTIONS as readonly string[]).includes(value)) {
      setSelected(value)
      setOtherText('')
    } else {
      setSelected(NICHE_OTHER)
      setOtherText(value)
    }
  }, [value])

  return (
    <div className={className}>
      <Select
        value={selected}
        onValueChange={(v) => {
          setSelected(v)
          if (v === NICHE_OTHER) {
            onChange(otherText) // emit whatever text is already typed (possibly empty)
          } else {
            onChange(v)
          }
        }}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {NICHE_OPTIONS.map((n) => (
            <SelectItem key={n} value={n}>
              {n}
            </SelectItem>
          ))}
          <SelectItem value={NICHE_OTHER}>{NICHE_OTHER}</SelectItem>
        </SelectContent>
      </Select>
      {selected === NICHE_OTHER && (
        <Input
          className="mt-1.5"
          value={otherText}
          onChange={(e) => {
            setOtherText(e.target.value)
            onChange(e.target.value)
          }}
          placeholder="Descreva o nicho..."
        />
      )}
    </div>
  )
}
