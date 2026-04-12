import { authedBackendFetch } from "@/lib/api-auth"
import { backendFetch } from "@/lib/api"
import { setAuthCookies } from "@/lib/auth-cookies"
import type { AuthResponse } from "@/lib/auth-types"

// POST /api/auth/2fa — setup, enable, verify, or disable 2FA
export async function POST(request: Request) {
  const body = await request.json()
  const { action, ...rest } = body as { action: string; [key: string]: unknown }

  const endpoints: Record<string, string> = {
    setup: "/api/v1/auth/2fa/setup",
    enable: "/api/v1/auth/2fa/enable",
    verify: "/api/v1/auth/2fa/verify",
    disable: "/api/v1/auth/2fa/disable",
  }

  const endpoint = endpoints[action]
  if (!endpoint) {
    return Response.json({ message: "Action invalide" }, { status: 400 })
  }

  // Verify2FA is a public endpoint (uses temporary token, not JWT)
  if (action === "verify") {
    const res = await backendFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(rest),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Code 2FA invalide" }))
      return Response.json(err, { status: res.status })
    }

    const result: AuthResponse = await res.json()
    await setAuthCookies(result.accessToken, result.refreshToken)
    return Response.json({ user: result.user })
  }

  // All other actions require authentication
  const res = await authedBackendFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(rest),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur 2FA" }))
    return Response.json(err, { status: res.status })
  }

  return Response.json(await res.json())
}
