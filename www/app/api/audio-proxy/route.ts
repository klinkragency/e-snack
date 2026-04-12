import { NextRequest, NextResponse } from "next/server"

// Proxy audio files from R2/MinIO to avoid CORS issues in the browser.
// Only allows audio/* content types to prevent misuse.
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return NextResponse.json({ error: "missing url" }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 })
  }

  // Restrict to known storage hosts
  const allowedHosts = [
    "pub-16dc87b31cc34db88feace41a8d406ce.r2.dev",
    "minio",
    "localhost",
    "beldys.fr",
  ]
  const isAllowed = allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`))
  if (!isAllowed) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 })
  }

  try {
    const upstream = await fetch(url, { next: { revalidate: 3600 } })
    const contentType = upstream.headers.get("content-type") ?? "audio/mpeg"
    if (!contentType.startsWith("audio/") && !contentType.startsWith("application/octet-stream")) {
      return NextResponse.json({ error: "not audio" }, { status: 415 })
    }
    const buffer = await upstream.arrayBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err) {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 })
  }
}
