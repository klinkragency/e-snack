import { backendFetch } from "@/lib/api"
import { authedBackendFetch } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  // Maintenance status is public on the Go side — no auth needed for GET.
  // Using backendFetch (not authedBackendFetch) avoids masking the real
  // state when the admin's access token is expired.
  try {
    const res = await backendFetch("/api/v1/maintenance")
    if (!res.ok) {
      return Response.json({ enabled: false }, { status: 200 })
    }
    const data = await res.json()
    return Response.json(data)
  } catch {
    return Response.json({ enabled: false }, { status: 200 })
  }
}

export async function PUT(request: Request) {
  const body = await request.json()
  const res = await authedBackendFetch("/api/v1/maintenance", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur" }))
    return Response.json(err, { status: res.status })
  }
  const data = await res.json()
  return Response.json(data)
}
