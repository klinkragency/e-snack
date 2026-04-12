import { backendFetch } from "@/lib/api"
import { setAuthCookies } from "@/lib/auth-cookies"
import type { AuthResponse } from "@/lib/auth-types"
import { registerBody, parseBody } from "@/lib/api-validation"

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, registerBody)
  if (error) return error

  const res = await backendFetch("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur lors de l'inscription" }))
    return Response.json(err, { status: res.status })
  }

  const result: AuthResponse = await res.json()
  await setAuthCookies(result.accessToken, result.refreshToken)
  return Response.json({ user: result.user })
}
