import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await request.json()
  const res = await authedBackendFetch(`/api/v1/admin/options/${id}`, {
    method: "PUT",
    body: JSON.stringify({ id, ...data }),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await authedBackendFetch(`/api/v1/admin/options/${id}`, {
    method: "DELETE",
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
