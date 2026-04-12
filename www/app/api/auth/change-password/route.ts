import { authedBackendFetch } from "@/lib/api-auth"
import { changePasswordBody, parseBody } from "@/lib/api-validation"

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, changePasswordBody)
  if (error) return error

  const res = await authedBackendFetch("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify(data),
  })

  const result = await res.json()
  return Response.json(result, { status: res.status })
}
