import { NextResponse } from "next/server"
import { authedBackendFetch } from "@/lib/api-auth"

export async function GET() {
  const res = await authedBackendFetch("/api/v1/auth/profile")

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Non authentifié" }))
    if (res.status === 401) {
      const isProduction = process.env.NODE_ENV === "production"
      const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined
      const cookieOpts = {
        path: "/",
        httpOnly: true,
        sameSite: "lax" as const,
        secure: isProduction,
        maxAge: 0,
        expires: new Date(0),
        ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
      }
      const response = NextResponse.json(err, { status: 401 })
      response.cookies.set("access_token", "", cookieOpts)
      response.cookies.set("refresh_token", "", cookieOpts)
      return response
    }
    return NextResponse.json(err, { status: res.status })
  }

  const user = await res.json()
  return NextResponse.json({ user })
}
