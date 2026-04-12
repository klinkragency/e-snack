import { cookies } from "next/headers"

const isProduction = process.env.NODE_ENV === "production"
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies()
  const opts = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  }
  cookieStore.set("access_token", accessToken, { ...opts, maxAge: 60 * 15 })
  cookieStore.set("refresh_token", refreshToken, { ...opts, maxAge: 60 * 60 * 24 * 7 })
}

export async function clearAuthCookies() {
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === "production"
  const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined
  const opts = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    maxAge: 0,
    expires: new Date(0),
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
  }
  cookieStore.set("access_token", "", opts)
  cookieStore.set("refresh_token", "", opts)
}

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get("access_token")?.value
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get("refresh_token")?.value
}
