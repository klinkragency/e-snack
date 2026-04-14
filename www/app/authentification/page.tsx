"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, Eye, EyeOff, Mail, Lock, User, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"
import { useAuth, hydrateDefaultAddress } from "@/hooks/use-auth"
import { useAppStore } from "@/lib/store"
import { TwoFactorRequiredError, verify2FA } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

const passwordSchema = z
  .string()
  .min(8, "8 caractères minimum")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre")

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
})

const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  password: passwordSchema,
  name: z.string().min(1, "Prénom requis"),
})

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!

function buildGoogleOAuthUrl() {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  sessionStorage.setItem("google_nonce", nonce)
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: window.location.origin + "/authentification",
    response_type: "id_token",
    scope: "openid email profile",
    nonce,
    prompt: "select_account",
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export default function AuthentificationPage() {
  const router = useRouter()
  const { login, register, googleLogin } = useAuth({ skipInitialFetch: true })
  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [tfaToken, setTfaToken] = useState("")
  const [tfaCode, setTfaCode] = useState("")

  const navigateAfterLogin = useCallback(async (user: { emailVerified?: boolean }) => {
    if (!user.emailVerified) {
      router.push("/verify-email")
      return
    }
    const params = new URLSearchParams(window.location.search)
    const redirectTo = params.get("redirect")
    if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
      window.location.href = redirectTo
      return
    }
    const hasAddress = await hydrateDefaultAddress()
    window.location.href = hasAddress ? "/restaurants" : "/onboarding"
  }, [router])

  // Handle Google OAuth redirect return: parse id_token from URL fragment
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const idToken = hash.get("id_token")
    if (!idToken) return
    // Clean the URL fragment immediately
    window.history.replaceState(null, "", window.location.pathname + window.location.search)
    setIsPending(true)
    googleLogin(idToken)
      .then(navigateAfterLogin)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Erreur Google Sign-In"))
      .finally(() => setIsPending(false))
  }, [googleLogin, navigateAfterLogin])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const schema = mode === "login" ? loginSchema : registerSchema
    const result = schema.safeParse({ email, password, name })
    if (!result.success) {
      toast.error(result.error.errors[0].message)
      return
    }

    setIsPending(true)
    try {
      if (mode === "login") {
        const u = await login(email, password)
        await navigateAfterLogin(u)
      } else {
        await register(email, password)
        router.push("/verify-email")
      }
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        setTfaToken(err.twoFaToken)
        setIsPending(false)
        return
      }
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue")
    } finally {
      setIsPending(false)
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (tfaCode.length !== 6) return
    setIsPending(true)
    try {
      const u = await verify2FA(tfaToken, tfaCode)
      useAppStore.getState().setUser(u)
      await navigateAfterLogin(u)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Code invalide")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex min-h-dvh bg-background">

      {/* Left — image panel (desktop only) */}
      <div className="relative hidden lg:flex lg:w-[45%] xl:w-1/2 shrink-0">
        <Image
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80"
          alt="Food"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 z-10 p-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">e-SNACK</p>
          <h2 className="text-4xl font-bold text-white leading-tight">
            Une seule plateforme.<br />Quatre univers culinaires.
          </h2>
          <p className="mt-4 max-w-sm text-white/60 text-sm leading-relaxed">
            Commandez auprès de nos restaurants exclusifs et recevez vos plats en moins de 30 minutes.
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            Retour
          </Link>
          <span className="text-sm font-bold tracking-tight">e-SNACK</span>
        </div>

        {/* Form — vertically centered */}
        <div className="flex flex-1 flex-col items-center justify-center px-5 pb-10">
          <div className="w-full max-w-[380px]">

            {/* 2FA */}
            {tfaToken ? (
              <div className="space-y-5">
                <div className="text-center space-y-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5 mx-auto mb-4">
                    <Lock size={22} />
                  </div>
                  <h1 className="text-2xl font-bold">Vérification 2FA</h1>
                  <p className="text-sm text-muted-foreground">Entrez le code de votre application d&apos;authentification</p>
                </div>
                <form onSubmit={handleVerify2FA} className="space-y-3" noValidate>
                  <input
                    type="text"
                    value={tfaCode}
                    onChange={(e) => setTfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000 000"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    className="w-full rounded-2xl border bg-muted/30 px-4 py-4 text-center text-2xl font-mono tracking-[0.4em] outline-none focus:ring-2 focus:ring-foreground/20 transition-all"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isPending || tfaCode.length !== 6}
                    className="flex w-full items-center justify-center rounded-2xl bg-foreground py-4 text-sm font-semibold text-background disabled:opacity-40 transition-opacity"
                  >
                    {isPending ? <Loader2 size={16} className="animate-spin" /> : "Vérifier le code"}
                  </button>
                  <button type="button" onClick={() => { setTfaToken(""); setTfaCode("") }} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                    ← Retour à la connexion
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-6">

                {/* Heading */}
                <div className="space-y-1">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {mode === "login" ? "Bon retour 👋" : "Créer un compte"}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {mode === "login"
                      ? "Connectez-vous pour commander"
                      : "Rejoignez le club en quelques secondes"}
                  </p>
                </div>

                {/* Tab switcher */}
                <div className="relative flex border-b">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className={cn(
                      "flex-1 pb-3 text-sm font-semibold transition-colors relative",
                      mode === "login" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Connexion
                    {mode === "login" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-foreground translate-y-px" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("register")}
                    className={cn(
                      "flex-1 pb-3 text-sm font-semibold transition-colors relative",
                      mode === "register" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Inscription
                    {mode === "register" && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-foreground translate-y-px" />
                    )}
                  </button>
                </div>

                {/* Google OAuth redirect button */}
                {process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true" && (
                <>
                <button
                  type="button"
                  onClick={() => { window.location.href = buildGoogleOAuthUrl() }}
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl border bg-background py-3.5 text-base font-medium transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continuer avec Google
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">ou</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                </>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                  {mode === "register" && (
                    <div className="relative">
                      <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Prénom"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-2xl border bg-muted/30 py-3.5 pl-11 pr-4 text-base outline-none transition-all focus:bg-background focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                        autoComplete="given-name"
                      />
                    </div>
                  )}

                  <div className="relative">
                    <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type="email"
                      placeholder="Adresse email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border bg-muted/30 py-3.5 pl-11 pr-4 text-base outline-none transition-all focus:bg-background focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                      autoComplete="email"
                      inputMode="email"
                    />
                  </div>

                  <div className="relative">
                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Mot de passe"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border bg-muted/30 py-3.5 pl-11 pr-12 text-base outline-none transition-all focus:bg-background focus:ring-2 focus:ring-foreground/20 placeholder:text-muted-foreground"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {mode === "login" && (
                    <div className="flex justify-end">
                      <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Mot de passe oublié ?
                      </Link>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="!mt-4 flex w-full items-center justify-center rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                  >
                    {isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : mode === "login" ? (
                      "Se connecter"
                    ) : (
                      "Créer mon compte"
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Legal */}
            <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
              En continuant, vous acceptez nos{" "}
              <Link href="#" className="underline underline-offset-2">CGU</Link>{" "}
              et notre{" "}
              <Link href="#" className="underline underline-offset-2">politique de confidentialité</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
