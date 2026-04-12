"use client"

import { useEffect } from "react"
import Link from "next/link"

export default function AppError({
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
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-bold">Quelque chose s&apos;est mal passé</h2>
        <p className="text-sm text-muted-foreground">
          Essayez de rafraîchir la page ou revenez plus tard.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          Réessayer
        </button>
        <Link
          href="/restaurants"
          className="rounded-full border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          Accueil
        </Link>
      </div>
    </div>
  )
}
