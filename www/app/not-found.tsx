import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="text-center space-y-2">
        <h1 className="text-6xl font-bold tracking-tight">404</h1>
        <h2 className="text-lg font-semibold">Page introuvable</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
      </div>
      <Link
        href="/restaurants"
        className="rounded-full bg-foreground px-8 py-3 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        Retour aux restaurants
      </Link>
    </div>
  )
}
