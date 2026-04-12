import { authedBackendFetch } from "@/lib/api-auth"

export async function POST(request: Request) {
  const body = await request.json()

  const res = await authedBackendFetch("/api/v1/upload/presign", {
    method: "POST",
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Erreur upload" }))
    return Response.json(err, { status: res.status })
  }

  const data = await res.json()
  return Response.json({
    uploadUrl: data.upload_url || data.uploadUrl,
    fileKey: data.file_key || data.fileKey,
    publicUrl: data.public_url || data.publicUrl,
    expiresIn: data.expires_in || data.expiresIn,
  })
}
