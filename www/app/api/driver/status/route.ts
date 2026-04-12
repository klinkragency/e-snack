import { authedBackendFetch } from "@/lib/api-auth"

export async function GET() {
  const res = await authedBackendFetch("/api/v1/driver/status")
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
