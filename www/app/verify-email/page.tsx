"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mail } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { OtpVerifyForm } from "@/components/otp-verify-form"

export default function VerifyEmailPage() {
  const router = useRouter()
  const { user, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && user?.emailVerified) {
      router.push("/onboarding")
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    router.push("/authentification")
    return null
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Mail size={28} className="text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Vérifiez votre email</h1>
          <p className="text-sm text-muted-foreground">
            Un code à 6 chiffres a été envoyé à
          </p>
          <p className="text-sm font-medium">{user.email}</p>
        </div>

        <OtpVerifyForm onVerified={() => router.push("/onboarding")} />

        <Link
          href="/onboarding"
          className="inline-block text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Passer pour l&apos;instant
        </Link>
      </div>
    </div>
  )
}
