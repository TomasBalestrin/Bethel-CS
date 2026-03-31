/**
 * Extrai valor de um objeto usando dot notation.
 * Ex: extractField({ data: { buyer: { name: "Maria" } } }, "data.buyer.name") → "Maria"
 */
export function extractField(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current !== null && current !== undefined && typeof current === 'object') {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

/**
 * Aplica todos os mapeamentos de campos e retorna objeto com valores extraídos.
 * Ex: applyFieldMapping(payload, { name: "data.buyer.name", email: "data.buyer.email" })
 *   → { name: "Maria", email: "maria@email.com" }
 */
export function applyFieldMapping(
  payload: unknown,
  mapping: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [targetField, sourcePath] of Object.entries(mapping)) {
    result[targetField] = extractField(payload, sourcePath)
  }
  return result
}
