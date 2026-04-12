import { authedBackendFetch } from "@/lib/api-auth"

export async function POST(request: Request) {
  const body = await request.json()

  const res = await authedBackendFetch("/api/v1/upload/confirm", {
    method: "POST",
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur confirmation" }))
    return Response.json(err, { status: res.status })
  }

  const data = await res.json()
  return Response.json(data)
}
