import { authedBackendFetch } from "@/lib/api-auth"
import { updateAddressBody, uuidParam, parseBody } from "@/lib/api-validation"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!uuidParam.safeParse(id).success) {
    return Response.json({ message: "ID invalide" }, { status: 400 })
  }

  const { data, error } = await parseBody(request, updateAddressBody)
  if (error) return error

  const res = await authedBackendFetch(`/api/v1/auth/addresses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })

  const result = await res.json()
  return Response.json(result, { status: res.status })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!uuidParam.safeParse(id).success) {
    return Response.json({ message: "ID invalide" }, { status: 400 })
  }

  const res = await authedBackendFetch(`/api/v1/auth/addresses/${id}`, {
    method: "DELETE",
  })

  const result = await res.json()
  return Response.json(result, { status: res.status })
}
