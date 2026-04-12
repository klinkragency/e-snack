import { authedBackendFetch } from "@/lib/api-auth"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const res = await authedBackendFetch(`/api/v1/orders/${id}`)

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur" }))
    return Response.json(err, { status: res.status })
  }

  return Response.json(await res.json())
}
