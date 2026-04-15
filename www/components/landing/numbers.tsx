import { Reveal } from "./reveal"

type Stat = {
  value: string
  unit?: string
  label: string
  sub: string
}

const PERFORMANCE: Stat[] = [
  { value: "< 80", unit: "ms", label: "p99 API", sub: "Latence GetMenu sur Postgres chaud" },
  { value: "5", unit: "s", label: "Tracking tick", sub: "Positions GPS livreur diffusées" },
  { value: "< 30", unit: "s", label: "Cold start", sub: "docker compose up → healthy" },
  { value: "100", unit: "%", label: "Commissions", sub: "Chaque euro tombe sur votre compte" },
]

const SECURITY: Stat[] = [
  { value: "JWT + TOTP", label: "Auth admin", sub: "Access 15 min, refresh 7j, 2FA en option" },
  { value: "HTTP-only", label: "Cookies", sub: "Secure, SameSite=Lax, signés HMAC" },
  { value: "HTTP-01", label: "TLS Let's Encrypt", sub: "Renouvelé auto, HSTS 1 an" },
  { value: "Outbox", label: "Webhooks Mollie", sub: "Idempotents, rejouables, signés" },
  { value: "CASCADE", label: "Intégrité", sub: "Foreign keys strictes, pas d'orphelin" },
  { value: "5/min", label: "Rate limit", sub: "Login, magic link, OTP email" },
]

const FOOTPRINT: Stat[] = [
  { value: "15", unit: "MB", label: "Binaire Go", sub: "Stripped, compilé statique" },
  { value: "~150", unit: "KB", label: "First-load JS", sub: "App Router + RSC + Turbopack" },
  { value: "6", label: "Containers", sub: "postgres · redis · api · frontend · caddy · minio" },
  { value: "< 1", unit: "GB", label: "DB footprint", sub: "Par tranche de 10 000 commandes" },
]

export function Numbers() {
  return (
    <section
      id="chiffres"
      className="relative bg-[var(--color-ink)] text-[var(--color-paper)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-32 md:px-12 md:py-48">
        <Reveal as="p" className="bistro-divider mb-16 text-[var(--color-paper)]/70">
          <span>Les chiffres qui parlent — chapitre 07</span>
        </Reveal>

        <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:items-end">
          <Reveal as="h2" className="font-display text-5xl leading-[0.92] md:text-7xl">
            Ce qui se<br />
            mesure se<br />
            <em className="text-[var(--color-tomato)]">tient.</em>
          </Reveal>

          <Reveal as="p" delay={1} className="text-lg leading-relaxed text-[var(--color-paper)]/70 md:text-xl">
            Chaque choix technique a une raison mesurable.
            Voici les nombres derrière la plateforme — ce que vous devriez
            attendre d&apos;un SaaS qui s&apos;assume.
          </Reveal>
        </div>

        {/* Performance */}
        <div className="mt-24">
          <Reveal as="p" className="mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tomato)]">
            — Performance
          </Reveal>
          <div className="grid gap-px bg-[var(--color-paper)]/10 sm:grid-cols-2 md:grid-cols-4">
            {PERFORMANCE.map((s, i) => (
              <StatCard key={s.label} stat={s} delay={((i % 4) + 1) as 1 | 2 | 3 | 4} />
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="mt-16">
          <Reveal as="p" className="mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tomato)]">
            — Sécurité
          </Reveal>
          <div className="grid gap-px bg-[var(--color-paper)]/10 sm:grid-cols-2 md:grid-cols-3">
            {SECURITY.map((s, i) => (
              <StatCard key={s.label} stat={s} delay={((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6} />
            ))}
          </div>
        </div>

        {/* Footprint */}
        <div className="mt-16">
          <Reveal as="p" className="mb-8 font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-tomato)]">
            — Empreinte
          </Reveal>
          <div className="grid gap-px bg-[var(--color-paper)]/10 sm:grid-cols-2 md:grid-cols-4">
            {FOOTPRINT.map((s, i) => (
              <StatCard key={s.label} stat={s} delay={((i % 4) + 1) as 1 | 2 | 3 | 4} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function StatCard({
  stat,
  delay,
}: {
  stat: Stat
  delay: 1 | 2 | 3 | 4 | 5 | 6
}) {
  return (
    <Reveal delay={delay} className="flex flex-col gap-3 bg-[var(--color-ink)] p-8 transition-colors hover:bg-[var(--color-ink)]/70">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-5xl italic leading-none md:text-6xl">
          {stat.value}
        </span>
        {stat.unit && (
          <span className="font-mono text-sm text-[var(--color-paper)]/60">
            {stat.unit}
          </span>
        )}
      </div>
      <p className="font-display text-lg italic">{stat.label}</p>
      <p className="text-[13px] leading-relaxed text-[var(--color-paper)]/60">
        {stat.sub}
      </p>
    </Reveal>
  )
}
