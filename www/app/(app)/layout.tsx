"use client"

import { useEffect, useState } from "react"
import { AppHeader } from "@/components/app-header"
import { ErrorBoundary } from "@/components/error-boundary"
import { useAuth } from "@/hooks/use-auth"
import { Wrench, Loader2 } from "lucide-react"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message?: string } | null>(null)

  useEffect(() => {
    fetch("/api/maintenance", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setMaintenance({ enabled: data?.enabled === true, message: data?.message }))
      .catch(() => setMaintenance({ enabled: false }))
  }, [])

  // Show spinner while auth + maintenance are loading
  if (isLoading || maintenance === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show maintenance page for non-admin users
  if (maintenance?.enabled && user?.role !== "admin") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center">
        <div className="mx-auto max-w-md space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <Wrench size={36} className="text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Maintenance en cours
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            {maintenance.message || "Nous effectuons une mise a jour. Revenez dans quelques instants."}
          </p>
          <div className="pt-4">
            <p className="text-xs text-muted-foreground">BELDY&apos;S CLUB</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <ErrorBoundary>
        <main>{children}</main>
      </ErrorBoundary>
    </div>
  )
}
