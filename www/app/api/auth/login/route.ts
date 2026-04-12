import { backendFetch } from "@/lib/api"
import { setAuthCookies } from "@/lib/auth-cookies"
import type { AuthResponse } from "@/lib/auth-types"
import { loginBody, parseBody } from "@/lib/api-validation"

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, loginBody)
  if (error) return error

  const res = await backendFetch("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Identifiants incorrects" }))
    return Response.json(err, { status: res.status })
  }

  const result: AuthResponse & { requires_2fa?: boolean; two_fa_token?: string } = await res.json()

  // 2FA challenge — don't set auth cookies yet
  if (result.requires2fa || result.requires_2fa) {
    return Response.json({
      requires2fa: true,
      twoFaToken: result.twoFaToken || result.two_fa_token,
    })
  }

  await setAuthCookies(result.accessToken, result.refreshToken)
  return Response.json({ user: result.user })
}
