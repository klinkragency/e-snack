import { getAccessToken, getRefreshToken, setAuthCookies } from "@/lib/auth-cookies"
import { backendFetch } from "@/lib/api"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080"

async function tryRefresh(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const refreshToken = await getRefreshToken()
  if (!refreshToken) return null

  const res = await backendFetch("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) return null
  return res.json()
}

async function proxyMultipart(formData: FormData, accessToken: string): Promise<Response> {
  // Do NOT set Content-Type — let fetch set it with the multipart boundary automatically
  return fetch(`${BACKEND_URL}/api/v1/upload/file`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  })
}

export async function POST(request: Request) {
  let accessToken = await getAccessToken()

  if (!accessToken) {
    const tokens = await tryRefresh()
    if (!tokens) {
      return Response.json({ message: "Non authentifié" }, { status: 401 })
    }
    await setAuthCookies(tokens.accessToken, tokens.refreshToken)
    accessToken = tokens.accessToken
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ message: "Requête invalide" }, { status: 400 })
  }

  let res = await proxyMultipart(formData, accessToken)

  // Token expired — refresh and retry once
  if (res.status === 401) {
    const tokens = await tryRefresh()
    if (!tokens) {
      return Response.json({ message: "Session expirée" }, { status: 401 })
    }
    await setAuthCookies(tokens.accessToken, tokens.refreshToken)

    // Re-read the form since the body stream was already consumed
    // formData is already parsed so we can re-use the object
    res = await proxyMultipart(formData, tokens.accessToken)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur upload" }))
    return Response.json(err, { status: res.status })
  }

  const data = await res.json()
  return Response.json({
    fileKey: data.fileKey || data.file_key,
    publicUrl: data.publicUrl || data.public_url,
  })
}
