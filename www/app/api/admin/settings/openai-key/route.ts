import { cookies } from "next/headers"
import { authedBackendFetch } from "@/lib/api-auth"

const COOKIE_NAME = "openai_api_key"

// Verify admin auth by making a lightweight call to backend
async function verifyAdmin(): Promise<boolean> {
  const res = await authedBackendFetch("/api/v1/restaurants?page_size=1")
  return res.status !== 401
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return Response.json({ message: "Non authentifie" }, { status: 401 })
  }
  const cookieStore = await cookies()
  const key = cookieStore.get(COOKIE_NAME)?.value || ""
  return Response.json({ hasKey: !!key, maskedKey: key ? `sk-...${key.slice(-4)}` : "" })
}

export async function PUT(request: Request) {
  if (!(await verifyAdmin())) {
    return Response.json({ message: "Non authentifie" }, { status: 401 })
  }
  const { apiKey } = await request.json()
  const cookieStore = await cookies()

  if (!apiKey) {
    cookieStore.delete(COOKIE_NAME)
    return Response.json({ ok: true, hasKey: false })
  }

  cookieStore.set(COOKIE_NAME, apiKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: "/",
  })

  return Response.json({ ok: true, hasKey: true, maskedKey: `sk-...${apiKey.slice(-4)}` })
}
