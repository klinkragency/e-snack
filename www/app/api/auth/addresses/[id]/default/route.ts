import { authedBackendFetch } from "@/lib/api-auth"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const res = await authedBackendFetch(`/api/v1/auth/addresses/${id}/default`, {
    method: "POST",
    body: JSON.stringify({}),
  })

  const data = await res.json()
  return Response.json(data, { status: res.status })
}
