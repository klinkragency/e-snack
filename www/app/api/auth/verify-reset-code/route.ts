import { backendFetch } from "@/lib/api"
import { parseBody } from "@/lib/api-validation"
import { z } from "zod"

const verifyResetCodeBody = z.object({
  email: z.string().email().max(255),
  code: z.string().regex(/^[0-9]{6}$/),
})

export async function POST(request: Request) {
  const { data, error } = await parseBody(request, verifyResetCodeBody)
  if (error) return error

  const res = await backendFetch("/api/v1/auth/verify-reset-code", {
    method: "POST",
    body: JSON.stringify({ email: data.email, code: data.code }),
  })

  const body = await res.json().catch(() => ({}))

  if (!res.ok) {
    return Response.json(
      { message: body.message || "Code incorrect" },
      { status: res.status }
    )
  }

  return Response.json({
    success: true,
    resetToken: body.resetToken || body.reset_token || "",
  })
}
