import { authedBackendFetch } from "@/lib/api-auth"
import { verifyEmailBody, parseBody } from "@/lib/api-validation"

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, verifyEmailBody)
  if (error) return error

  const res = await authedBackendFetch("/api/v1/auth/verify-email", {
    method: "POST",
    body: JSON.stringify(data),
  })

  const result = await res.json()
  return Response.json(result, { status: res.status })
}
