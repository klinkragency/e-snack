/**
 * Logout via GET — browser navigates here directly (not fetch).
 * This guarantees Safari processes the Set-Cookie headers because
 * they're part of a real page navigation / redirect, not an XHR.
 */
export async function GET() {
  return clearAndRedirect()
}

/** Keep POST for backwards compatibility */
export async function POST() {
  return clearAndRedirect()
}

function clearAndRedirect() {
  const isProduction = process.env.NODE_ENV === "production"
  const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined

  const secure = isProduction ? "; Secure" : ""
  const domainAttr = COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : ""
  const expires = "Expires=Thu, 01 Jan 1970 00:00:00 GMT"

  const headers = new Headers()

  // Relative Location — browser resolves against its current origin
  // NOT against request.url which is the internal Docker URL (0.0.0.0:3000)
  headers.set("Location", "/authentification")
  headers.set("Cache-Control", "no-cache, no-store, must-revalidate")

  // Clear WITH domain (matches how cookies were set via COOKIE_DOMAIN)
  headers.append("Set-Cookie", `access_token=; Path=/${domainAttr}; Max-Age=0; ${expires}; HttpOnly; SameSite=Lax${secure}`)
  headers.append("Set-Cookie", `refresh_token=; Path=/${domainAttr}; Max-Age=0; ${expires}; HttpOnly; SameSite=Lax${secure}`)

  // Also clear WITHOUT domain (in case any were set without domain)
  if (COOKIE_DOMAIN) {
    headers.append("Set-Cookie", `access_token=; Path=/; Max-Age=0; ${expires}; HttpOnly; SameSite=Lax${secure}`)
    headers.append("Set-Cookie", `refresh_token=; Path=/; Max-Age=0; ${expires}; HttpOnly; SameSite=Lax${secure}`)
  }

  return new Response(null, { status: 302, headers })
}
