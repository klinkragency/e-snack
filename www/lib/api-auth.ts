import { backendFetch } from "@/lib/api"
import { getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/auth-cookies"

async function tryRefresh(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const refreshToken = await getRefreshToken()
  // Don't refresh if token is empty (cleared by logout)
  if (!refreshToken) return null

  const res = await backendFetch("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) return null
  return res.json()
}

export async function authedBackendFetch(path: string, init?: RequestInit): Promise<Response> {
  let accessToken = await getAccessToken()

  // No access token at all — try refresh first
  if (!accessToken) {
    const tokens = await tryRefresh()
    if (!tokens) {
      return Response.json({ message: "Non authentifié" }, { status: 401 })
    }
    await setAuthCookies(tokens.accessToken, tokens.refreshToken)
    accessToken = tokens.accessToken
  }

  // Has access token — try request
  const res = await backendFetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers },
  })

  // If 401, try refresh and retry once
  if (res.status === 401) {
    const tokens = await tryRefresh()
    if (!tokens) {
      return Response.json({ message: "Session expirée" }, { status: 401 })
    }
    await setAuthCookies(tokens.accessToken, tokens.refreshToken)

    return backendFetch(path, {
      ...init,
      headers: { Authorization: `Bearer ${tokens.accessToken}`, ...init?.headers },
    })
  }

  return res
}
