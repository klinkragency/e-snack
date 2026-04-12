import { authedBackendFetch } from "@/lib/api-auth"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await authedBackendFetch(`/api/v1/admin/users/${id}`)
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await request.json()
  // Backend uses PATCH (defined in proto)
  const res = await authedBackendFetch(`/api/v1/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await authedBackendFetch(`/api/v1/admin/users/${id}`, { method: "DELETE" })
  if (res.status === 204) return new Response(null, { status: 204 })
  const body = await res.json().catch(() => ({}))
  return Response.json(body, { status: res.status })
}
