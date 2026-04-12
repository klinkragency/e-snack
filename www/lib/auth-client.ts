import type { UserProfile } from "@/lib/auth-types"

interface AuthResult {
  user: UserProfile
}

export class TwoFactorRequiredError extends Error {
  twoFaToken: string
  constructor(token: string) {
    super("2FA required")
    this.name = "TwoFactorRequiredError"
    this.twoFaToken = token
  }
}

async function authFetch(path: string, init?: RequestInit): Promise<AuthResult> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Erreur inconnue" }))
    throw new Error(error.message || `Erreur ${res.status}`)
  }

  return res.json()
}

export async function login(email: string, password: string): Promise<UserProfile> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Erreur inconnue" }))
    throw new Error(error.message || `Erreur ${res.status}`)
  }

  const data = await res.json()

  if (data.requires2fa) {
    throw new TwoFactorRequiredError(data.twoFaToken)
  }

  return data.user
}

export async function verify2FA(twoFaToken: string, code: string): Promise<UserProfile> {
  const { user } = await authFetch("/api/auth/2fa", {
    method: "POST",
    body: JSON.stringify({ action: "verify", two_fa_token: twoFaToken, code }),
  })
  return user
}

export async function register(
  email: string,
  password: string,
  phone?: string
): Promise<UserProfile> {
  const { user } = await authFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, phone }),
  })
  return user
}

export async function oauthLogin(
  provider: string,
  idToken: string
): Promise<UserProfile> {
  const { user } = await authFetch("/api/auth/oauth", {
    method: "POST",
    body: JSON.stringify({ provider, id_token: idToken }),
  })
  return user
}

export async function logout(): Promise<void> {
  // Navigate directly to logout endpoint — the server clears cookies
  // via Set-Cookie headers and 302 redirects to /authentification.
  // This is more reliable than fetch() because Safari guarantees
  // Set-Cookie processing on navigation redirects (but not on XHR).
  window.location.href = "/api/auth/logout"
}

export async function getMe(): Promise<UserProfile> {
  const { user } = await authFetch("/api/auth/me")
  return user
}
