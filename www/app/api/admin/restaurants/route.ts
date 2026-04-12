import { authedBackendFetch } from "@/lib/api-auth"

export async function GET() {
  const res = await authedBackendFetch("/api/v1/restaurants")
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}

export async function POST(request: Request) {
  const data = await request.json()
  const res = await authedBackendFetch("/api/v1/admin/restaurants", {
    method: "POST",
    body: JSON.stringify(data),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
