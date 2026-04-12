import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await request.json()
  const endpoint = data.enable ? "enable" : "disable"
  const res = await authedBackendFetch(`/api/v1/admin/users/${id}/2fa/${endpoint}`, { method: "POST" })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
