import { PostHog } from "posthog-node"

let _client: PostHog | null = null

export function getPostHogServer(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null
  if (!_client) {
    _client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return _client
}

// Query PostHog via REST API (requires personal API key + project ID)
// NOTE: the ingestion host is us.i.posthog.com but the REST API is on us.posthog.com
export async function queryPostHog<T = unknown>(body: object): Promise<T | null> {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  if (!apiKey || !projectId) return null

  // Derive the REST API host from the ingestion host:
  //   https://us.i.posthog.com  → https://us.posthog.com
  //   https://eu.i.posthog.com  → https://eu.posthog.com
  const ingestionHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"
  const apiHost = ingestionHost.replace(/\/\/([a-z]+)\.i\.posthog\.com/, "//$1.posthog.com")

  const res = await fetch(`${apiHost}/api/projects/${projectId}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    next: { revalidate: 300 },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    console.error("[PostHog] query failed", res.status, text)
    // Re-throw with status so callers can distinguish auth errors vs real failures
    const err = new Error(text || `HTTP ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.json() as Promise<T>
}
