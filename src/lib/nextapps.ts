/**
 * Next Apps (WhatsApp) server-side authentication and API client.
 * Manages JWT tokens with auto-refresh. NEVER import in client components.
 */

const BASE_URL = process.env.NEXTAPPS_BASE_URL || 'https://service.nexttrack.com.br'
const EMAIL = process.env.NEXTAPPS_EMAIL || ''
const PASSWORD = process.env.NEXTAPPS_PASSWORD || ''

let accessToken = ''
let refreshToken = ''
let tokenExpiresAt = 0

async function doLogin(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Next Apps login failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  accessToken = data.accessToken || data.token || ''
  refreshToken = data.refreshToken || ''
  // Assume token lasts 1 hour if not specified
  tokenExpiresAt = Date.now() + (data.expiresIn || 3600) * 1000

  return accessToken
}

async function doRefresh(): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })

    if (!res.ok) {
      // Refresh failed, do full login
      return await doLogin()
    }

    const data = await res.json()
    accessToken = data.accessToken || data.token || ''
    if (data.refreshToken) refreshToken = data.refreshToken
    tokenExpiresAt = Date.now() + (data.expiresIn || 3600) * 1000

    return accessToken
  } catch {
    // Refresh failed, do full login
    return await doLogin()
  }
}

async function getToken(): Promise<string> {
  // Valid token with 60s buffer
  if (accessToken && Date.now() < tokenExpiresAt - 60000) {
    return accessToken
  }
  // Try refresh if we have a refresh token
  if (refreshToken) {
    return await doRefresh()
  }
  // No tokens at all, do full login
  return await doLogin()
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...options.headers,
  }

  let res = await fetch(url, { ...options, headers })

  // Retry once on 401 (token expired mid-request)
  if (res.status === 401) {
    accessToken = ''
    tokenExpiresAt = 0
    const newToken = await getToken()
    res = await fetch(url, {
      ...options,
      headers: { ...headers, Authorization: `Bearer ${newToken}` },
    })
  }

  return res
}

export async function sendMessage(
  instanceId: string,
  phone: string,
  message: string,
  type?: string,
  imageUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      phone,
      message,
      type: type || 'text',
    }
    if (imageUrl) body.imageUrl = imageUrl

    const res = await authFetch(
      `${BASE_URL}/api/chats/instances/${instanceId}/send`,
      { method: 'POST', body: JSON.stringify(body) }
    )

    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `Send failed (${res.status}): ${text}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function getQRCode(
  instanceId: string
): Promise<{ ascii?: string; status?: boolean; error?: string }> {
  try {
    const res = await authFetch(
      `${BASE_URL}/api/instances/${instanceId}/qrcode/image`,
      { method: 'GET' }
    )

    if (!res.ok) {
      const text = await res.text()
      return { error: `QR failed (${res.status}): ${text}` }
    }

    const data = await res.json()
    return { ascii: data.ascii, status: data.status }
  } catch (err) {
    return { error: String(err) }
  }
}
