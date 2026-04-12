import { authedBackendFetch } from "@/lib/api-auth"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get("page") || "1"
  const pageSize = searchParams.get("pageSize") || "10"

  const res = await authedBackendFetch(`/api/v1/orders?page=${page}&pageSize=${pageSize}`)
  const data = await res.json()
  return Response.json(data, { status: res.status })
}

export async function POST(request: Request) {
  const body = await request.json()

  const res = await authedBackendFetch("/api/v1/orders", {
    method: "POST",
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return Response.json(
      { message: data.message || "Erreur lors de la création de la commande" },
      { status: res.status }
    )
  }

  return Response.json(data)
}
