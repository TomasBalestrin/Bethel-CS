import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Valida assinatura HMAC SHA-256.
 * Aceita formato raw hex ou prefixado com "sha256=".
 */
export function validateHmacSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  const bare = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature

  if (bare.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(bare, 'hex'), Buffer.from(expected, 'hex'))
}

/**
 * Valida Bearer token no header Authorization.
 */
export function validateBearerToken(
  authHeader: string,
  secret: string
): boolean {
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader
  return token === secret
}

/**
 * Valida token via query param (?token=X ou ?key=X).
 */
export function validateQueryParam(
  queryParams: URLSearchParams,
  secret: string
): boolean {
  return queryParams.get('token') === secret || queryParams.get('key') === secret
}

/**
 * Função principal: valida autenticação do webhook baseada no auth_type do endpoint.
 */
export function validateWebhookAuth(
  request: {
    rawBody: string
    headers: Headers
    url: string
  },
  endpoint: {
    auth_type: string
    secret_key: string | null
    auth_header: string | null
  }
): boolean {
  if (endpoint.auth_type === 'none' || !endpoint.secret_key) {
    return true
  }

  const secret = endpoint.secret_key

  switch (endpoint.auth_type) {
    case 'hmac_sha256': {
      const headerName = endpoint.auth_header ?? 'x-webhook-secret'
      const signature = request.headers.get(headerName)
      if (!signature) return false
      return validateHmacSignature(request.rawBody, signature, secret)
    }
    case 'bearer_token': {
      const authHeader = request.headers.get('authorization') ?? ''
      return validateBearerToken(authHeader, secret)
    }
    case 'query_param': {
      const url = new URL(request.url)
      return validateQueryParam(url.searchParams, secret)
    }
    default:
      return false
  }
}
