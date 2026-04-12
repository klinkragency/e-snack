import { cookies } from "next/headers"

/**
 * Returns the access token for WebSocket authentication.
 * This avoids exposing the HttpOnly cookie to client-side JavaScript.
 * The token is only returned to authenticated users via this server-side handler.
 */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")?.value

  if (!token) {
    return Response.json({ token: null }, { status: 401 })
  }

  return Response.json({ token })
}
