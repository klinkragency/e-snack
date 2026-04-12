import { authedBackendFetch } from "@/lib/api-auth"
import { profileBody, parseBody } from "@/lib/api-validation"

export async function PATCH(request: Request) {
  const { data, error } = await parseBody(request, profileBody)
  if (error) return error

  const res = await authedBackendFetch("/api/v1/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  })

  const result = await res.json()
  return Response.json(result, { status: res.status })
}
