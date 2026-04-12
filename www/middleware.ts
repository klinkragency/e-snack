import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that require authentication (restaurants accessible without auth)
const PROTECTED_PATHS = ["/checkout", "/confirmation", "/suivi", "/account", "/admin", "/livreur", "/facture"]
const AUTH_PATH = "/authentification"

// Simple in-memory rate limiter (per-instance; use Redis for multi-instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const RATE_LIMIT_MAX: Record<string, number> = {
  "/api/auth/login": 10,
  "/api/auth/register": 5,
  "/api/auth/verify-email": 10,
  "/api/auth/verify-email/send": 3,
  "/api/auth/change-password": 5,
  "/api/auth/forgot-password": 3,
  "/api/auth/verify-reset-code": 10,
  "/api/auth/reset-password": 5,
}

function checkRateLimit(ip: string, path: string): boolean {
  const limit = Object.entries(RATE_LIMIT_MAX).find(([p]) => path.startsWith(p))
  if (!limit) return true

  const key = `${ip}:${limit[0]}`
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  entry.count++
  return entry.count <= limit[1]
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  // Check for non-empty cookie values — logout sets cookies to "" with maxAge=0
  // but Safari may still present them briefly during navigation
  const accessToken = request.cookies.get("access_token")?.value
  const refreshToken = request.cookies.get("refresh_token")?.value
  const hasAuth = Boolean(accessToken || refreshToken)

  // --- Rate limiting on API auth routes ---
  if (pathname.startsWith("/api/auth/") && request.method === "POST") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    if (!checkRateLimit(ip, pathname)) {
      return NextResponse.json(
        { message: "Trop de requêtes. Réessayez dans une minute." },
        { status: 429 }
      )
    }
  }

  // --- CSRF: state-changing API calls must come from same origin ---
  // Exclude webhook paths (Mollie webhook won't send Origin header)
  // Exclude /api/auth/logout — it's now a GET redirect, harmless from CSRF perspective
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/webhook/") &&
    pathname !== "/api/auth/logout" &&
    request.method !== "GET"
  ) {
    const origin = request.headers.get("origin")
    const host = request.headers.get("host")
    if (origin && host) {
      // If Origin is present, it must match the host
      const originHost = new URL(origin).host
      if (originHost !== host) {
        return NextResponse.json({ message: "Requête non autorisée" }, { status: 403 })
      }
    }
    // If no Origin header (Safari same-origin quirk), allow through —
    // the httpOnly cookie requirement already prevents cross-origin abuse
  }

  // --- Auth redirects ---
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))

  if (isProtected && !hasAuth) {
    const loginUrl = new URL(AUTH_PATH, request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname === AUTH_PATH && hasAuth) {
    // Always allow through — the auth page handles logged-in users.
    // The logout route redirects here after clearing cookies; blocking
    // this path causes Safari redirect loops with stale cookies.
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/restaurants/:path*",
    "/restaurant/:path*",
    "/checkout/:path*",
    "/confirmation/:path*",
    "/suivi/:path*",
    "/account/:path*",
    "/authentification",
    "/admin/:path*",
    "/livreur/:path*",
    "/facture/:path*",
    "/api/:path*",
  ],
}
