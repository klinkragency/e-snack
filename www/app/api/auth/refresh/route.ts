import { NextResponse } from "next/server"
import { backendFetch } from "@/lib/api"
import { getRefreshToken, setAuthCookies } from "@/lib/auth-cookies"
import type { AuthResponse } from "@/lib/auth-types"

export async function POST() {
  const refreshToken = await getRefreshToken()

  if (!refreshToken) {
    const res = NextResponse.json({ message: "No refresh token" }, { status: 401 })
    res.cookies.delete("access_token")
    res.cookies.delete("refresh_token")
    return res
  }

  const res = await backendFetch("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) {
    const response = NextResponse.json({ message: "Session expirée" }, { status: 401 })
    response.cookies.delete("access_token")
    response.cookies.delete("refresh_token")
    return response
  }

  const data: AuthResponse = await res.json()
  await setAuthCookies(data.accessToken, data.refreshToken)
  return NextResponse.json({ user: data.user })
}
