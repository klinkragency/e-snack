import { authedBackendFetch } from "@/lib/api-auth"
import { createAddressBody, parseBody } from "@/lib/api-validation"

export async function GET() {
  const res = await authedBackendFetch("/api/v1/auth/addresses")
  const data = await res.json()
  return Response.json(data, { status: res.status })
}

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, createAddressBody)
  if (error) return error

  const res = await authedBackendFetch("/api/v1/auth/addresses", {
    method: "POST",
    body: JSON.stringify(data),
  })

  const result = await res.json()
  return Response.json(result, { status: res.status })
}
