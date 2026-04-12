"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-bold">Une erreur est survenue</h2>
        <p className="text-sm text-muted-foreground">
          Nous nous excusons pour la gêne occasionnée.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
      >
        Réessayer
      </button>
    </div>
  )
}
